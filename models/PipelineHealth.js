const mongoose = require('mongoose');

const pipelineHealthSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  healthScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  status: {
    type: String,
    enum: ['healthy', 'warning', 'critical'],
    required: true
  },
  metrics: {
    activeCandidates: {
      type: Number,
      default: 0
    },
    weeklyApplications: {
      type: Number,
      default: 0
    },
    avgTimeToFill: {
      type: Number,
      default: 0
    },
    openPositions: {
      type: Number,
      default: 0
    },
    candidateToJobRatio: {
      type: Number,
      default: 0
    },
    diversityRatio: {
      type: Number,
      default: 0
    },
    candidateVolumeHealth: {
      type: Number,
      default: 0
    },
    applicationRateHealth: {
      type: Number,
      default: 0
    },
    timeToFillHealth: {
      type: Number,
      default: 0
    }
  },
  triggers: [{
    type: String,
    enum: [
      'LOW_CANDIDATE_VOLUME',
      'LOW_APPLICATION_RATE',
      'HIGH_TIME_TO_FILL',
      'LOW_DIVERSITY_RATIO',
      'HEALTHY_RECOVERY'
    ]
  }],
  recommendations: [{
    type: String
  }],
  alerts: [{
    type: {
      type: String,
      enum: ['LOW_CANDIDATE_VOLUME', 'LOW_APPLICATION_RATE', 'HIGH_TIME_TO_FILL', 'LOW_DIVERSITY_RATIO']
    },
    severity: {
      type: String,
      enum: ['critical', 'warning', 'info']
    },
    title: String,
    message: String,
    recommendations: [String],
    quickActions: [{
      label: String,
      action: String
    }],
    acknowledged: {
      type: Boolean,
      default: false
    },
    acknowledgedAt: Date,
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date
  }],
  calculatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
pipelineHealthSchema.index({ timestamp: -1 });
pipelineHealthSchema.index({ status: 1 });
pipelineHealthSchema.index({ healthScore: -1 });

// Method to calculate health status based on score
pipelineHealthSchema.methods.getStatusFromScore = function(score) {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  return 'critical';
};

// Method to generate recommendations based on triggers
pipelineHealthSchema.methods.generateRecommendations = function() {
  const recommendations = [];

  this.triggers.forEach(trigger => {
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

  this.recommendations = [...new Set(recommendations)]; // Remove duplicates
};

// Static method to get latest health record
pipelineHealthSchema.statics.getLatest = function() {
  return this.findOne().sort({ timestamp: -1 });
};

// Static method to get health trends
pipelineHealthSchema.statics.getTrends = function(days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({ timestamp: { $gte: startDate } })
    .sort({ timestamp: 1 })
    .select('timestamp healthScore status metrics');
};

module.exports = mongoose.model('PipelineHealth', pipelineHealthSchema);