const mongoose = require('mongoose');

const healthThresholdsSchema = new mongoose.Schema({
  minCandidatesPerJob: {
    type: Number,
    default: 10,
    min: 1
  },
  criticalCandidatesPerJob: {
    type: Number,
    default: 5,
    min: 1
  },

  minWeeklyApplications: {
    type: Number,
    default: 20,
    min: 1
  },
  criticalWeeklyApplications: {
    type: Number,
    default: 10,
    min: 1
  },

  maxTimeToFill: {
    type: Number,
    default: 30,
    min: 1
  },
  criticalTimeToFill: {
    type: Number,
    default: 60,
    min: 1
  },

  minDiversityRatio: {
    type: Number,
    default: 0.2,
    min: 0,
    max: 1
  },
  criticalDiversityRatio: {
    type: Number,
    default: 0.1,
    min: 0,
    max: 1
  },

  healthyScoreMin: {
    type: Number,
    default: 80,
    min: 0,
    max: 100
  },
  warningScoreMin: {
    type: Number,
    default: 60,
    min: 0,
    max: 100
  },

  weights: {
    candidateVolume: {
      type: Number,
      default: 40,
      min: 0,
      max: 100
    },
    applicationRate: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    },
    timeToFill: {
      type: Number,
      default: 20,
      min: 0,
      max: 100
    },
    diversityRatio: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    }
  },

  alertEnabled: {
    type: Boolean,
    default: true
  },
  emailAlerts: {
    type: Boolean,
    default: true
  },
  inAppAlerts: {
    type: Boolean,
    default: true
  },
  alertFrequency: {
    type: String,
    enum: ['immediate', 'hourly', 'daily', 'weekly'],
    default: 'immediate'
  },

  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  customThresholds: {
    type: Map,
    of: Number,
    default: {}
  },

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

healthThresholdsSchema.index({ organizationId: 1, isActive: 1 }, { unique: true });

healthThresholdsSchema.statics.getDefaults = function() {
  return {
    minCandidatesPerJob: 10,
    criticalCandidatesPerJob: 5,
    minWeeklyApplications: 20,
    criticalWeeklyApplications: 10,
    maxTimeToFill: 30,
    criticalTimeToFill: 60,
    minDiversityRatio: 0.2,
    criticalDiversityRatio: 0.1,
    healthyScoreMin: 80,
    warningScoreMin: 60,
    weights: {
      candidateVolume: 40,
      applicationRate: 30,
      timeToFill: 20,
      diversityRatio: 10
    },
    alertEnabled: true,
    emailAlerts: true,
    inAppAlerts: true,
    alertFrequency: 'immediate'
  };
};

healthThresholdsSchema.methods.validateConfiguration = function() {
  const errors = [];

  const totalWeight = Object.values(this.weights).reduce((sum, weight) => sum + weight, 0);
  if (totalWeight !== 100) {
    errors.push(`Metric weights must sum to 100, currently sum to ${totalWeight}`);
  }

  if (this.warningScoreMin >= this.healthyScoreMin) {
    errors.push('Warning score minimum must be less than healthy score minimum');
  }

  if (this.criticalDiversityRatio >= this.minDiversityRatio) {
    errors.push('Critical diversity ratio must be less than minimum diversity ratio');
  }

  return errors;
};

healthThresholdsSchema.statics.getActiveForOrganization = function(orgId) {
  return this.findOne({ organizationId: orgId, isActive: true });
};

healthThresholdsSchema.statics.createDefaultsForOrganization = function(orgId) {
  const defaults = this.getDefaults();
  return this.create({
    ...defaults,
    organizationId: orgId
  });
};

module.exports = mongoose.model('HealthThresholds', healthThresholdsSchema);