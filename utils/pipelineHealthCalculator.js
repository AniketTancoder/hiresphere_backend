const Candidate = require('../models/Candidate');
const CandidateProfile = require('../models/CandidateProfile');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const PipelineHealth = require('../models/PipelineHealth');
const HealthThresholds = require('../models/HealthThresholds');

/**
 * Pipeline Health Calculator
 * Calculates comprehensive health metrics for recruitment pipeline
 */
class PipelineHealthCalculator {

  /**
   * Calculate overall pipeline health
   * @param {string} organizationId - Organization/user ID
   * @returns {Promise<Object>} Health calculation results
   */
  static async calculatePipelineHealth(organizationId) {
    try {
      let thresholds = await HealthThresholds.getActiveForOrganization(organizationId);
      if (!thresholds) {
        thresholds = await HealthThresholds.createDefaultsForOrganization(organizationId);
      }

      const [
        candidates,
        jobs,
        applications,
        recentApplications
      ] = await Promise.all([
        this.getCandidatesData(organizationId),
        this.getJobsData(organizationId),
        this.getApplicationsData(organizationId),
        this.getRecentApplicationsData(organizationId, 7)
      ]);

      const metrics = {
        candidateVolumeHealth: this.calculateCandidateVolumeHealth(candidates, jobs, thresholds),
        applicationRateHealth: this.calculateApplicationRateHealth(recentApplications, thresholds),
        timeToFillHealth: this.calculateTimeToFillHealth(jobs, applications, thresholds),
        diversityHealth: this.calculateDiversityHealth(candidates, thresholds)
      };

      const healthScore = this.calculateOverallHealthScore(metrics, thresholds);

      const status = this.getStatusFromScore(healthScore, thresholds);

      const triggers = this.identifyTriggers(metrics, thresholds);

      const recommendations = this.generateRecommendations(triggers);

      const alerts = this.generateAlerts(metrics, thresholds);

      const metricsData = {
        activeCandidates: candidates.length,
        weeklyApplications: recentApplications.length,
        avgTimeToFill: await this.calculateAverageTimeToFill(jobs, applications),
        openPositions: jobs.filter(job => job.status === 'open').length,
        candidateToJobRatio: jobs.length > 0 ? candidates.length / jobs.length : 0,
        diversityRatio: this.calculateDiversityRatio(candidates),
        ...metrics
      };

      return {
        timestamp: new Date(),
        healthScore,
        status,
        metrics: metricsData,
        triggers,
        recommendations,
        alerts,
        calculatedBy: organizationId
      };

    } catch (error) {
      console.error('Error calculating pipeline health:', error);
      throw error;
    }
  }

  /**
   * Get candidates data for organization (same logic as /api/candidates)
   */
  static async getCandidatesData(organizationId) {
    let portalCandidates = [];
    try {
      portalCandidates = await CandidateProfile.find({})
        .populate('skills.skill', 'name displayName')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching portal candidates:', error);
      portalCandidates = [];
    }

    const adminCandidates = await Candidate.find({ addedBy: organizationId })
      .sort({ createdAt: -1 });
  
      const formattedPortalCandidates = portalCandidates.map(profile => ({
      _id: profile._id,
      name: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      phone: profile.phone,
      skills: profile.skills
        .filter(skillEntry => skillEntry.skill)
        .map(skillEntry => ({
          skill: {
            name: skillEntry.skill?.name || skillEntry.skill?.toString() || 'Unknown Skill',
            displayName: skillEntry.skill?.displayName || skillEntry.skill?.name || skillEntry.skill?.toString() || 'Unknown Skill'
          },
          proficiency: skillEntry.proficiency || 'Beginner'
        })),
      experience: profile.yearsOfExperience || 0,
      education: Array.isArray(profile.education) ? profile.education.map(e => `${e.degree} in ${e.fieldOfStudy}`).join(', ') : '',
      currentCompany: profile.currentCompany || '',
      currentTitle: profile.currentTitle || '',
      location: profile.location?.city ? `${profile.location.city}, ${profile.location.state || ''}`.trim() : '',
      preferredLocations: profile.preferredLocations || [],
      desiredSalary: profile.desiredSalary,
      profileCompleteness: profile.profileCompleteness || 0,
      lastActive: profile.lastActive,
      resumeText: profile.resume?.filename ? 'Resume uploaded' : '',
      resumeFile: profile.resume?.filename || null,
      resume: profile.resume,
      aiAnalysis: profile.aiAnalysis || null,
      status: 'new',
      addedBy: null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      isPortalCandidate: true
    }));

    const formattedAdminCandidates = adminCandidates.map(candidate => ({
      _id: candidate._id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      skills: (candidate.skills || []).filter(skill => skill).map(skill => ({
        skill: { name: skill, displayName: skill },
        proficiency: 'Intermediate'
      })),
      experience: candidate.experience || 0,
      education: candidate.education || '',
      currentCompany: candidate.currentCompany || '',
      currentTitle: candidate.currentTitle || '',
      resumeText: candidate.resumeText || '',
      resumeFile: candidate.resumeFile || null,
      resume: null,
      aiAnalysis: candidate.aiAnalysis || null,
      status: candidate.status || 'new',
      addedBy: candidate.addedBy,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      isPortalCandidate: false,
      profileCompleteness: 50,
      lastActive: candidate.updatedAt
    }));

    const allCandidates = [...formattedPortalCandidates, ...formattedAdminCandidates];

    return allCandidates;
  }

  /**
   * Get jobs data for organization
   */
  static async getJobsData(organizationId) {
    return await Job.find({ createdBy: organizationId });
  }

  /**
   * Get applications data for organization
   */
  static async getApplicationsData(organizationId) {
    const jobs = await Job.find({ createdBy: organizationId }).select('_id');
    const jobIds = jobs.map(job => job._id);
    return await JobApplication.find({ job: { $in: jobIds } });
  }

  /**
   * Get recent applications data
   */
  static async getRecentApplicationsData(organizationId, days = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const jobs = await Job.find({ createdBy: organizationId }).select('_id');
    const jobIds = jobs.map(job => job._id);

    return await JobApplication.find({
      job: { $in: jobIds },
      createdAt: { $gte: startDate }
    });
  }

  /**
   * Calculate candidate volume health
   */
  static calculateCandidateVolumeHealth(candidates, jobs, thresholds) {
    const openJobs = jobs.filter(job => job.status === 'open').length;
    if (openJobs === 0) return 100;

    const candidatesPerJob = candidates.length / openJobs;
    const targetCandidatesPerJob = thresholds.minCandidatesPerJob;

    const health = Math.min(100, (candidatesPerJob / targetCandidatesPerJob) * 100);

    return Math.round(health);
  }

  /**
   * Calculate application rate health
   */
  static calculateApplicationRateHealth(recentApplications, thresholds) {
    const weeklyApplications = recentApplications.length;
    const targetWeeklyApplications = thresholds.minWeeklyApplications;

    const health = Math.min(100, (weeklyApplications / targetWeeklyApplications) * 100);

    return Math.round(health);
  }

  /**
   * Calculate time to fill health
   */
  static calculateTimeToFillHealth(jobs, applications, thresholds) {
    const maxTimeToFill = thresholds.maxTimeToFill;

    const completedApplications = applications.filter(app => app.status === 'hired');

    if (completedApplications.length === 0) return 100;

    const totalTimeToFill = completedApplications.reduce((sum, app) => {
      const job = jobs.find(j => j._id.toString() === app.job.toString());
      if (!job) return sum;

      const timeToFill = Math.ceil((new Date(app.updatedAt) - new Date(job.createdAt)) / (1000 * 60 * 60 * 24));
      return sum + timeToFill;
    }, 0);

    const avgTimeToFill = totalTimeToFill / completedApplications.length;

    const health = Math.max(0, Math.min(100, 100 - ((avgTimeToFill - maxTimeToFill) / maxTimeToFill) * 100));

    return Math.round(health);
  }

  /**
   * Calculate diversity health
   */
  static calculateDiversityHealth(candidates, thresholds) {
    const diversityRatio = this.calculateDiversityRatio(candidates);
    const targetDiversityRatio = thresholds.minDiversityRatio;

    const health = Math.min(100, (diversityRatio / targetDiversityRatio) * 100);

    return Math.round(health);
  }

  /**
   * Calculate diversity ratio (simplified - based on gender/ethnicity indicators in names)
   */
  static calculateDiversityRatio(candidates) {
    if (candidates.length === 0) return 0;

    const diverseIndicators = ['patel', 'kumar', 'singh', 'garcia', 'rodriguez', 'chen', 'kim', 'williams', 'brown'];

    const diverseCandidates = candidates.filter(candidate => {
      const name = candidate.name.toLowerCase();
      return diverseIndicators.some(indicator => name.includes(indicator));
    });

    return diverseCandidates.length / candidates.length;
  }

  /**
   * Calculate overall health score using weighted average
   */
  static calculateOverallHealthScore(metrics, thresholds) {
    const weights = thresholds.weights;

    const score = (
      (metrics.candidateVolumeHealth * weights.candidateVolume / 100) +
      (metrics.applicationRateHealth * weights.applicationRate / 100) +
      (metrics.timeToFillHealth * weights.timeToFill / 100) +
      (metrics.diversityHealth * weights.diversityRatio / 100)
    );

    return Math.round(score);
  }

  /**
   * Get status from health score
   */
  static getStatusFromScore(score, thresholds) {
    if (score >= thresholds.healthyScoreMin) return 'healthy';
    if (score >= thresholds.warningScoreMin) return 'warning';
    return 'critical';
  }

  /**
   * Identify triggers based on metrics
   */
  static identifyTriggers(metrics, thresholds) {
    const triggers = [];

    if (metrics.candidateVolumeHealth < 60) {
      triggers.push('LOW_CANDIDATE_VOLUME');
    }

    if (metrics.applicationRateHealth < 60) {
      triggers.push('LOW_APPLICATION_RATE');
    }

    if (metrics.timeToFillHealth < 60) {
      triggers.push('HIGH_TIME_TO_FILL');
    }

    if (metrics.diversityHealth < 60) {
      triggers.push('LOW_DIVERSITY_RATIO');
    }

    return triggers;
  }

  /**
   * Generate recommendations based on triggers
   */
  static generateRecommendations(triggers) {
    const recommendations = [];

    triggers.forEach(trigger => {
      switch (trigger) {
        case 'LOW_CANDIDATE_VOLUME':
          recommendations.push(
            'Post new jobs to attract more candidates',
            'Activate candidate rediscovery from your database',
            'Expand sourcing to new job boards',
            'Review job descriptions for appeal'
          );
          break;
        case 'LOW_APPLICATION_RATE':
          recommendations.push(
            'Promote jobs on social media',
            'Optimize job descriptions for SEO',
            'Simplify application process',
            'Enable quick apply features'
          );
          break;
        case 'HIGH_TIME_TO_FILL':
          recommendations.push(
            'Review screening process bottlenecks',
            'Increase sourcing efforts for hard-to-fill roles',
            'Consider internal mobility options',
            'Adjust role requirements if too restrictive'
          );
          break;
        case 'LOW_DIVERSITY_RATIO':
          recommendations.push(
            'Review job posting language for inclusivity',
            'Partner with diverse candidate networks',
            'Implement blind recruitment practices',
            'Train recruiters on unconscious bias'
          );
          break;
      }
    });

    return [...new Set(recommendations)];
  }

  /**
   * Generate alerts based on metrics
   */
  static generateAlerts(metrics, thresholds) {
    const alerts = [];

    if (metrics.candidateVolumeHealth < 30) {
      alerts.push({
        type: 'LOW_CANDIDATE_VOLUME',
        severity: 'critical',
        title: 'Pipeline Health Critical',
        message: 'Your candidate pipeline is running low. Consider posting more jobs or sourcing additional candidates.',
        recommendations: [
          'Post new jobs to attract more candidates',
          'Activate candidate rediscovery from your database',
          'Expand sourcing to new job boards',
          'Review job descriptions for appeal'
        ],
        quickActions: [
          { label: '💡 Post New Job', action: 'navigateToJobCreation' },
          { label: '🔍 Rediscover Candidates', action: 'activateRediscovery' },
          { label: '📊 Analyze Pipeline', action: 'showDetailedAnalytics' }
        ]
      });
    } else if (metrics.candidateVolumeHealth < 60) {
      alerts.push({
        type: 'LOW_CANDIDATE_VOLUME',
        severity: 'warning',
        title: 'Low Candidate Volume',
        message: 'Your candidate pool is below recommended levels.',
        recommendations: [
          'Post additional jobs to increase candidate flow',
          'Review current job postings for appeal'
        ],
        quickActions: [
          { label: '➕ Post New Job', action: 'navigateToJobCreation' }
        ]
      });
    }

    if (metrics.applicationRateHealth < 30) {
      alerts.push({
        type: 'LOW_APPLICATION_RATE',
        severity: 'critical',
        title: 'Application Rate Critical',
        message: 'Weekly applications have dropped significantly below target.',
        recommendations: [
          'Promote jobs on social media',
          'Optimize job descriptions for SEO',
          'Simplify application process',
          'Enable quick apply features'
        ],
        quickActions: [
          { label: '📱 Promote Jobs', action: 'promoteJobs' },
          { label: '✏️ Edit Job Posts', action: 'editJobPosts' }
        ]
      });
    }

    if (metrics.timeToFillHealth < 30) {
      alerts.push({
        type: 'HIGH_TIME_TO_FILL',
        severity: 'warning',
        title: 'Extended Time-to-Fill',
        message: 'Positions are taking longer to fill than industry average.',
        recommendations: [
          'Review screening process bottlenecks',
          'Increase sourcing efforts for hard-to-fill roles',
          'Consider internal mobility options',
          'Adjust role requirements if too restrictive'
        ],
        quickActions: [
          { label: '🔄 Review Process', action: 'reviewProcess' }
        ]
      });
    }

    if (metrics.diversityHealth < 30) {
      alerts.push({
        type: 'LOW_DIVERSITY_RATIO',
        severity: 'warning',
        title: 'Diversity Concerns',
        message: 'Candidate diversity is below recommended levels.',
        recommendations: [
          'Review job posting language for inclusivity',
          'Partner with diverse candidate networks',
          'Implement blind recruitment practices'
        ],
        quickActions: [
          { label: '🌈 Review Diversity', action: 'reviewDiversity' }
        ]
      });
    }

    return alerts;
  }

  /**
   * Calculate average time to fill
   */
  static async calculateAverageTimeToFill(jobs, applications) {
    const hiredApplications = applications.filter(app => app.status === 'hired');

    if (hiredApplications.length === 0) return 0;

    const totalDays = hiredApplications.reduce((sum, app) => {
      const job = jobs.find(j => j._id.toString() === app.job.toString());
      if (!job) return sum;

      const days = Math.ceil((new Date(app.updatedAt) - new Date(job.createdAt)) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);

    return Math.round(totalDays / hiredApplications.length);
  }

  /**
   * Save health calculation to database
   */
  static async saveHealthCalculation(healthData) {
    const pipelineHealth = new PipelineHealth(healthData);
    await pipelineHealth.save();
    return pipelineHealth;
  }

  /**
   * Get latest health data
   */
  static async getLatestHealth(organizationId) {
    return await PipelineHealth.findOne({ calculatedBy: organizationId })
      .sort({ timestamp: -1 });
  }

  /**
   * Get health trends
   */
  static async getHealthTrends(organizationId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return await PipelineHealth.find({
      calculatedBy: organizationId,
      timestamp: { $gte: startDate }
    })
    .sort({ timestamp: 1 })
    .select('timestamp healthScore status metrics');
  }
}

module.exports = PipelineHealthCalculator;