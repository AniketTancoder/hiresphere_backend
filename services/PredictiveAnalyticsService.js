const JobApplication = require('../models/JobApplication');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const NotificationTriggerService = require('./NotificationTriggerService');

class PredictiveAnalyticsService {
  constructor() {
    this.predictionCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Predict candidate acceptance probability
  async predictAcceptanceProbability(applicationId) {
    try {
      const application = await JobApplication.findById(applicationId)
        .populate('candidate')
        .populate('job');

      if (!application) return null;

      const features = await this.extractFeatures(application);
      const probability = this.calculateAcceptanceProbability(features);

      // Cache the result
      this.predictionCache.set(applicationId, {
        probability,
        timestamp: Date.now(),
        features
      });

      // Trigger notification if probability is high
      if (probability >= 0.8) {
        await NotificationTriggerService.trigger('predictive_acceptance_alert', {
          recipientId: application.assignedTo || application.candidate._id,
          recipientType: application.assignedTo ? 'admin' : 'candidate',
          applicationId,
          probability: Math.round(probability * 100),
          candidateName: application.candidate.name,
          jobTitle: application.job.title
        });
      }

      return probability;
    } catch (error) {
      console.error('Error predicting acceptance probability:', error);
      return null;
    }
  }

  // Extract features for prediction model
  async extractFeatures(application) {
    const candidate = application.candidate;
    const job = application.job;

    // Profile completeness score (0-1)
    const profileCompleteness = this.calculateProfileCompleteness(candidate);

    // Skills match score (0-1)
    const skillsMatch = await this.calculateSkillsMatch(candidate, job);

    // Experience match (0-1)
    const experienceMatch = this.calculateExperienceMatch(candidate, job);

    // Application speed (days since job posting)
    const applicationSpeed = this.calculateApplicationSpeed(application, job);

    // Previous application history
    const applicationHistory = await this.getApplicationHistory(candidate._id);

    // Company fit (based on previous applications to same company)
    const companyFit = await this.calculateCompanyFit(candidate._id, job.company);

    return {
      profileCompleteness,
      skillsMatch,
      experienceMatch,
      applicationSpeed,
      applicationHistory,
      companyFit,
      candidateExperience: candidate.experience || 0,
      jobLevel: this.getJobLevel(job),
      applicationStage: application.status
    };
  }

  // Calculate acceptance probability using weighted features
  calculateAcceptanceProbability(features) {
    let score = 0;

    // Profile completeness (30% weight)
    score += features.profileCompleteness * 0.3;

    // Skills match (25% weight)
    score += features.skillsMatch * 0.25;

    // Experience match (20% weight)
    score += features.experienceMatch * 0.2;

    // Application history factor (15% weight)
    const historyFactor = Math.min(features.applicationHistory.successRate || 0, 1);
    score += historyFactor * 0.15;

    // Company fit (10% weight)
    score += features.companyFit * 0.1;

    // Adjust based on application stage
    const stageMultiplier = this.getStageMultiplier(features.applicationStage);
    score *= stageMultiplier;

    // Adjust based on application speed (faster is often better, but not always)
    const speedFactor = this.getSpeedFactor(features.applicationSpeed);
    score *= speedFactor;

    return Math.max(0, Math.min(1, score));
  }

  calculateProfileCompleteness(candidate) {
    let score = 0;
    let totalFields = 0;

    // Basic info
    if (candidate.name) score += 1;
    if (candidate.email) score += 1;
    if (candidate.phone) score += 1;
    totalFields += 3;

    // Professional info
    if (candidate.skills && candidate.skills.length > 0) score += 1;
    if (candidate.experience) score += 1;
    if (candidate.education && candidate.education.length > 0) score += 1;
    totalFields += 3;

    // Additional info
    if (candidate.resume) score += 1;
    if (candidate.linkedinProfile) score += 1;
    if (candidate.portfolio) score += 1;
    totalFields += 3;

    return totalFields > 0 ? score / totalFields : 0;
  }

  async calculateSkillsMatch(candidate, job) {
    if (!candidate.skills || !job.requiredSkills) return 0;

    const candidateSkills = candidate.skills.map(s => s.toLowerCase());
    const jobSkills = job.requiredSkills.map(s => s.toLowerCase());

    const matches = jobSkills.filter(skill =>
      candidateSkills.some(candidateSkill =>
        candidateSkill.includes(skill) || skill.includes(candidateSkill)
      )
    );

    return jobSkills.length > 0 ? matches.length / jobSkills.length : 0;
  }

  calculateExperienceMatch(candidate, job) {
    const candidateExp = candidate.experience || 0;
    const requiredExp = job.experienceRequired || 0;

    if (requiredExp === 0) return 1; // No experience required
    if (candidateExp >= requiredExp) return 1; // Overqualified
    if (candidateExp >= requiredExp * 0.8) return 0.8; // Close match
    if (candidateExp >= requiredExp * 0.6) return 0.6; // Moderate match

    return candidateExp / requiredExp; // Proportional match
  }

  calculateApplicationSpeed(application, job) {
    const jobPostedDate = new Date(job.createdAt);
    const applicationDate = new Date(application.createdAt);
    const daysDiff = (applicationDate - jobPostedDate) / (1000 * 60 * 60 * 24);

    return Math.max(0, daysDiff);
  }

  async getApplicationHistory(candidateId) {
    const applications = await JobApplication.find({ candidate: candidateId });

    if (applications.length === 0) {
      return { total: 0, successRate: 0, averageResponseTime: 0 };
    }

    const accepted = applications.filter(app =>
      ['accepted', 'hired'].includes(app.status)
    ).length;

    const successRate = accepted / applications.length;

    // Calculate average response time (simplified)
    const responseTimes = applications
      .filter(app => app.updatedAt && app.createdAt)
      .map(app => (new Date(app.updatedAt) - new Date(app.createdAt)) / (1000 * 60 * 60 * 24));

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      total: applications.length,
      successRate,
      averageResponseTime
    };
  }

  async calculateCompanyFit(candidateId, company) {
    const companyApplications = await JobApplication.find({
      candidate: candidateId,
      company: company
    });

    if (companyApplications.length === 0) return 0.5; // Neutral

    const accepted = companyApplications.filter(app =>
      ['accepted', 'hired'].includes(app.status)
    ).length;

    return accepted / companyApplications.length;
  }

  getJobLevel(job) {
    const title = job.title.toLowerCase();
    if (title.includes('senior') || title.includes('lead') || title.includes('principal')) return 3;
    if (title.includes('mid') || title.includes('junior')) return 1;
    return 2; // Default to mid-level
  }

  getStageMultiplier(stage) {
    const multipliers = {
      'submitted': 0.3,
      'under_review': 0.5,
      'shortlisted': 0.7,
      'interview_scheduled': 0.8,
      'interviewed': 0.9,
      'offered': 0.95,
      'accepted': 1.0,
      'rejected': 0.1,
      'withdrawn': 0.1
    };

    return multipliers[stage] || 0.3;
  }

  getSpeedFactor(daysSincePosting) {
    if (daysSincePosting <= 1) return 1.1; // Very fast application
    if (daysSincePosting <= 3) return 1.0; // Fast application
    if (daysSincePosting <= 7) return 0.9; // Normal speed
    if (daysSincePosting <= 14) return 0.8; // Slow
    return 0.7; // Very slow
  }

  // Market salary alerts
  async checkMarketSalaryAlert(jobId, offeredSalary) {
    const job = await Job.findById(jobId);
    if (!job) return;

    const marketRate = await this.getMarketRate(job.title, job.location);
    if (!marketRate) return;

    const percentageDiff = ((offeredSalary - marketRate.average) / marketRate.average) * 100;

    if (percentageDiff < -10) { // More than 10% below market
      await NotificationTriggerService.trigger('market_salary_alert', {
        recipientId: job.createdBy,
        recipientType: 'admin',
        jobId,
        offeredSalary,
        marketRate: marketRate.average,
        percentageDiff: Math.round(percentageDiff),
        jobTitle: job.title
      });
    }
  }

  // Get market rate for job title and location (simplified)
  async getMarketRate(jobTitle, location) {
    // This would integrate with a salary database API
    // For now, return mock data based on job title
    const title = jobTitle.toLowerCase();

    const salaryData = {
      'software engineer': { average: 120000, min: 90000, max: 180000 },
      'senior software engineer': { average: 150000, min: 120000, max: 220000 },
      'product manager': { average: 130000, min: 100000, max: 180000 },
      'data scientist': { average: 125000, min: 95000, max: 190000 },
      'ux designer': { average: 95000, min: 70000, max: 140000 },
      'devops engineer': { average: 130000, min: 100000, max: 180000 }
    };

    // Find matching job title
    for (const [key, data] of Object.entries(salaryData)) {
      if (title.includes(key)) {
        return data;
      }
    }

    // Default fallback
    return { average: 100000, min: 70000, max: 150000 };
  }

  // Competitor job posting notifications
  async checkCompetitorJobs(candidateId, currentJobTitle, currentCompany) {
    // This would integrate with job board APIs
    // For now, simulate competitor monitoring
    const competitors = this.getCompetitors(currentCompany);

    // Mock competitor job postings
    const competitorJobs = [
      {
        title: currentJobTitle,
        company: competitors[0],
        salary: 130000,
        location: 'Remote'
      }
    ];

    for (const job of competitorJobs) {
      await NotificationTriggerService.trigger('competitor_job_posting', {
        recipientId: candidateId,
        recipientType: 'candidate',
        jobTitle: job.title,
        company: job.company,
        salary: job.salary,
        location: job.location
      });
    }
  }

  getCompetitors(company) {
    const competitorMap = {
      'Google': ['Microsoft', 'Amazon', 'Meta', 'Apple'],
      'Microsoft': ['Google', 'Amazon', 'Apple', 'Meta'],
      'Amazon': ['Google', 'Microsoft', 'Meta', 'Apple'],
      'Meta': ['Google', 'Microsoft', 'Amazon', 'TikTok'],
      'Apple': ['Google', 'Microsoft', 'Samsung', 'Huawei']
    };

    return competitorMap[company] || ['Tech Company A', 'Tech Company B'];
  }

  // Clear expired cache entries
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.predictionCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.predictionCache.delete(key);
      }
    }
  }

  // Get cached prediction
  getCachedPrediction(applicationId) {
    const cached = this.predictionCache.get(applicationId);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.probability;
    }
    return null;
  }
}

module.exports = new PredictiveAnalyticsService();