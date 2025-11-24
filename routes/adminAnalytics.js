const express = require('express');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const CandidateProfile = require('../models/CandidateProfile');
const JobApplication = require('../models/JobApplication');
const PipelineHealth = require('../models/PipelineHealth');
const HealthThresholds = require('../models/HealthThresholds');
const PipelineHealthCalculator = require('../utils/pipelineHealthCalculator');
const MetricsService = require('../services/MetricsService');
const auth = require('../middleware/auth');

const router = express.Router();

// Get dashboard metrics
router.get('/metrics', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Job metrics
    const totalJobs = await Job.countDocuments({ createdBy: userId });
    const activeJobs = await Job.countDocuments({ createdBy: userId, status: 'active' });
    const closedJobs = await Job.countDocuments({ createdBy: userId, status: 'closed' });

    // Application metrics
    const userJobs = await Job.find({ createdBy: userId }).select('_id');
    const jobIds = userJobs.map(job => job._id);

    const totalApplications = await JobApplication.countDocuments({ jobId: { $in: jobIds } });
    const pendingApplications = await JobApplication.countDocuments({
      jobId: { $in: jobIds },
      status: 'pending'
    });
    const reviewedApplications = await JobApplication.countDocuments({
      jobId: { $in: jobIds },
      status: { $in: ['shortlisted', 'rejected', 'interviewed'] }
    });

    // Candidate metrics
    const totalCandidates = await Candidate.countDocuments({ addedBy: userId });

    // Time-based metrics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentJobs = await Job.countDocuments({
      createdBy: userId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    const recentApplications = await JobApplication.countDocuments({
      jobId: { $in: jobIds },
      appliedAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      jobs: {
        total: totalJobs,
        active: activeJobs,
        closed: closedJobs,
        recent: recentJobs
      },
      applications: {
        total: totalApplications,
        pending: pendingApplications,
        reviewed: reviewedApplications,
        recent: recentApplications
      },
      candidates: {
        total: totalCandidates
      },
      conversionRate: totalApplications > 0 ? (reviewedApplications / totalApplications * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get application funnel data
router.get('/funnel', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userJobs = await Job.find({ createdBy: userId }).select('_id');
    const jobIds = userJobs.map(job => job._id);

    const applications = await JobApplication.find({ jobId: { $in: jobIds } });

    const funnel = {
      applied: applications.length,
      reviewed: applications.filter(app => ['shortlisted', 'rejected', 'interviewed'].includes(app.status)).length,
      shortlisted: applications.filter(app => app.status === 'shortlisted').length,
      interviewed: applications.filter(app => app.status === 'interviewed').length,
      offered: applications.filter(app => app.status === 'offered').length,
      hired: applications.filter(app => app.status === 'hired').length
    };

    res.json(funnel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get skill demand analytics
router.get('/skills', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const jobs = await Job.find({ createdBy: userId, status: 'active' });

    const skillCount = {};
    jobs.forEach(job => {
      job.requiredSkills.forEach(skill => {
        skillCount[skill] = (skillCount[skill] || 0) + 1;
      });
    });

    const topSkills = Object.entries(skillCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    res.json(topSkills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get time-to-hire metrics
router.get('/time-to-hire', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userJobs = await Job.find({ createdBy: userId }).select('_id');
    const jobIds = userJobs.map(job => job._id);

    const hiredApplications = await JobApplication.find({
      jobId: { $in: jobIds },
      status: 'hired'
    }).populate('jobId', 'createdAt');

    const timeToHire = hiredApplications.map(app => {
      const jobCreated = new Date(app.jobId.createdAt);
      const hiredDate = new Date(app.updatedAt);
      const days = Math.ceil((hiredDate - jobCreated) / (1000 * 60 * 60 * 24));
      return days;
    });

    const averageTimeToHire = timeToHire.length > 0
      ? Math.round(timeToHire.reduce((sum, days) => sum + days, 0) / timeToHire.length)
      : 0;

    res.json({
      averageTimeToHire,
      hiresCount: timeToHire.length,
      timeDistribution: timeToHire
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current pipeline health status
router.get('/pipeline-health', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if we already have a record for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingTodayRecord = await PipelineHealth.findOne({
      calculatedBy: userId,
      timestamp: { $gte: today, $lt: tomorrow }
    });

    let healthData;
    if (existingTodayRecord) {
      // Use existing record for today
      healthData = existingTodayRecord;
    } else {
      // Calculate fresh data and save for historical tracking
      const newHealthData = await PipelineHealthCalculator.calculatePipelineHealth(userId);
      healthData = await PipelineHealthCalculator.saveHealthCalculation(newHealthData);
    }

    // Use centralized service to ensure consistent formatting
    const formattedResponse = {
      healthScore: healthData.healthScore,
      status: healthData.status,
      metrics: {
        activeCandidates: healthData.metrics.activeCandidates,
        weeklyApplications: healthData.metrics.weeklyApplications,
        openPositions: healthData.metrics.openPositions,
        avgTimeToFill: healthData.metrics.avgTimeToFill,
        candidateToJobRatio: healthData.metrics.candidateToJobRatio,
        candidateVolumeHealth: healthData.metrics.candidateVolumeHealth,
        applicationRateHealth: healthData.metrics.applicationRateHealth,
        timeToFillHealth: healthData.metrics.timeToFillHealth,
        diversityHealth: healthData.metrics.diversityHealth,
      },
      alerts: healthData.alerts || [],
      recommendations: healthData.recommendations || [],
      triggers: healthData.triggers || [],
      timestamp: healthData.timestamp,
    };

    res.json(formattedResponse);
  } catch (error) {
    console.error('Error fetching pipeline health:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get detailed pipeline metrics
router.get('/pipeline-metrics', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all candidates (same logic as /api/candidates)
    let portalCandidates = [];
    try {
      portalCandidates = await CandidateProfile.find({})
        .populate('skills.skill', 'name displayName')
        .sort({ createdAt: -1 });
    } catch (error) {
      portalCandidates = [];
    }

    const adminCandidates = await Candidate.find({ addedBy: userId });
    const allCandidates = [...portalCandidates, ...adminCandidates];

    const [
      jobs,
      applications,
      recentApplications
    ] = await Promise.all([
      Job.find({ createdBy: userId }),
      JobApplication.find({ recruiter: userId }),
      JobApplication.find({
        recruiter: userId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    const metrics = {
      totalCandidates: allCandidates.length, // Now includes all candidates
      totalJobs: jobs.length,
      openJobs: jobs.filter(job => job.status === 'open').length,
      totalApplications: applications.length,
      weeklyApplications: recentApplications.length,
      hiredCandidates: applications.filter(app => app.status === 'hired').length,
      candidateToJobRatio: jobs.length > 0 ? (allCandidates.length / jobs.length).toFixed(2) : 0,
      applicationConversionRate: applications.length > 0 ?
        ((applications.filter(app => app.status === 'hired').length / applications.length) * 100).toFixed(1) : 0
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Recalculate pipeline health
router.post('/calculate-health', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const healthData = await PipelineHealthCalculator.calculatePipelineHealth(userId);
    const savedHealth = await PipelineHealthCalculator.saveHealthCalculation(healthData);

    // Return formatted response using centralized service
    const formattedResponse = {
      healthScore: savedHealth.healthScore,
      status: savedHealth.status,
      metrics: {
        activeCandidates: savedHealth.metrics.activeCandidates,
        weeklyApplications: savedHealth.metrics.weeklyApplications,
        openPositions: savedHealth.metrics.openPositions,
        avgTimeToFill: savedHealth.metrics.avgTimeToFill,
        candidateToJobRatio: savedHealth.metrics.candidateToJobRatio,
        candidateVolumeHealth: savedHealth.metrics.candidateVolumeHealth,
        applicationRateHealth: savedHealth.metrics.applicationRateHealth,
        timeToFillHealth: savedHealth.metrics.timeToFillHealth,
        diversityHealth: savedHealth.metrics.diversityHealth,
      },
      alerts: savedHealth.alerts || [],
      recommendations: savedHealth.recommendations || [],
      triggers: savedHealth.triggers || [],
      timestamp: savedHealth.timestamp,
    };

    res.json(formattedResponse);
  } catch (error) {
    console.error('Error calculating health:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get historical health trends
router.get('/health-trends', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;

    const trends = await PipelineHealthCalculator.getHealthTrends(userId, days);

    res.json(trends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get health thresholds
router.get('/health-thresholds', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    let thresholds = await HealthThresholds.getActiveForOrganization(userId);
    if (!thresholds) {
      thresholds = await HealthThresholds.createDefaultsForOrganization(userId);
    }

    res.json(thresholds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update health thresholds
router.put('/health-thresholds', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    let thresholds = await HealthThresholds.getActiveForOrganization(userId);
    if (!thresholds) {
      thresholds = await HealthThresholds.createDefaultsForOrganization(userId);
    }

    // Update the thresholds
    Object.keys(updates).forEach(key => {
      if (thresholds[key] !== undefined) {
        thresholds[key] = updates[key];
      }
    });

    // Validate configuration
    const validationErrors = thresholds.validateConfiguration();
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Invalid threshold configuration',
        errors: validationErrors
      });
    }

    await thresholds.save();

    res.json(thresholds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Acknowledge alert
router.post('/alerts/:alertId/acknowledge', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const alertId = req.params.alertId;

    const healthRecord = await PipelineHealth.findOne({
      calculatedBy: userId,
      'alerts._id': alertId
    });

    if (!healthRecord) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    const alert = healthRecord.alerts.id(alertId);
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();

    await healthRecord.save();

    res.json({ message: 'Alert acknowledged' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resolve alert
router.post('/alerts/:alertId/resolve', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const alertId = req.params.alertId;

    const healthRecord = await PipelineHealth.findOne({
      calculatedBy: userId,
      'alerts._id': alertId
    });

    if (!healthRecord) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    const alert = healthRecord.alerts.id(alertId);
    alert.resolved = true;
    alert.resolvedAt = new Date();

    await healthRecord.save();

    res.json({ message: 'Alert resolved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;