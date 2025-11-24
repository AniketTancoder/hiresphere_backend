const METRICS_CONFIG = {
  HEALTH_THRESHOLDS: {
    HEALTHY_MIN: 80,
    WARNING_MIN: 60,
    CRITICAL_MAX: 59,
  },

  WEIGHTS: {
    CANDIDATE_VOLUME: 0.4,
    APPLICATION_RATE: 0.3,
    TIME_TO_FILL: 0.2,
    DIVERSITY_RATIO: 0.1,
  },

  TARGETS: {
    CANDIDATES_PER_JOB: 10,
    WEEKLY_APPLICATIONS: 20,
    MAX_TIME_TO_FILL_DAYS: 30,
    MIN_DIVERSITY_RATIO: 0.2,
  },

  CRITICAL_THRESHOLDS: {
    CANDIDATES_PER_JOB: 5,
    WEEKLY_APPLICATIONS: 10,
    TIME_TO_FILL_DAYS: 60,
    DIVERSITY_RATIO: 0.1,
  },

  COLORS: {
    HEALTHY: '#00c851',
    WARNING: '#ffaa00',
    CRITICAL: '#ff4444',
    NEUTRAL: '#6c757d',
    SUCCESS: '#10b981',
    ERROR: '#ef4444',
  },

  STATUS_LABELS: {
    HEALTHY: 'Healthy',
    WARNING: 'Needs Attention',
    CRITICAL: 'Critical',
    UNKNOWN: 'Unknown',
  },

  ROUNDING: {
    PERCENTAGES: 0,
    SCORES: 0,
    RATIOS: 2,
  },

  CALCULATION_METHODS: {
    HEALTH_SCORE: function(metrics) {
      return (
        (metrics.candidateVolume * this.WEIGHTS.CANDIDATE_VOLUME) +
        (metrics.applicationRate * this.WEIGHTS.APPLICATION_RATE) +
        (metrics.timeToFill * this.WEIGHTS.TIME_TO_FILL) +
        (metrics.diversityRatio * this.WEIGHTS.DIVERSITY_RATIO)
      );
    },

    GET_STATUS: function(score) {
      if (score >= this.HEALTH_THRESHOLDS.HEALTHY_MIN) return 'healthy';
      if (score >= this.HEALTH_THRESHOLDS.WARNING_MIN) return 'warning';
      return 'critical';
    },

    GET_COLOR: function(status) {
      return this.COLORS[status.toUpperCase()] || this.COLORS.NEUTRAL;
    },

    GET_LABEL: function(status) {
      return this.STATUS_LABELS[status.toUpperCase()] || this.STATUS_LABELS.UNKNOWN;
    },
  },

  VALIDATION: {
    HEALTH_SCORE: {
      MIN: 0,
      MAX: 100,
    },
    PERCENTAGES: {
      MIN: 0,
      MAX: 100,
    },
    RATIOS: {
      MIN: 0,
      MAX: 10,
    },
  },

  DISPLAY_FORMATS: {
    HEALTH_SCORE: function(score) {
      return `${Math.round(score)}%`;
    },
    PERCENTAGE: function(value) {
      return `${Math.round(value)}%`;
    },
    RATIO: function(value) {
      return `${value.toFixed(this.ROUNDING.RATIOS)}:1`;
    },
    DAYS: function(value) {
      return `${Math.round(value)}d`;
    },
  },
};

const getHealthStatus = (score) => {
  return METRICS_CONFIG.CALCULATION_METHODS.GET_STATUS(score);
};

const getHealthColor = (status) => {
  return METRICS_CONFIG.CALCULATION_METHODS.GET_COLOR(status);
};

const getStatusLabel = (status) => {
  return METRICS_CONFIG.CALCULATION_METHODS.GET_LABEL(status);
};

const formatHealthScore = (score) => {
  return METRICS_CONFIG.DISPLAY_FORMATS.HEALTH_SCORE(score);
};

const formatPercentage = (value) => {
  return METRICS_CONFIG.DISPLAY_FORMATS.PERCENTAGE(value);
};

const validateHealthScore = (score) => {
  return score >= METRICS_CONFIG.VALIDATION.HEALTH_SCORE.MIN &&
         score <= METRICS_CONFIG.VALIDATION.HEALTH_SCORE.MAX;
};

const validatePercentage = (value) => {
  return value >= METRICS_CONFIG.VALIDATION.PERCENTAGES.MIN &&
         value <= METRICS_CONFIG.VALIDATION.PERCENTAGES.MAX;
};

module.exports = {
  METRICS_CONFIG,
  getHealthStatus,
  getHealthColor,
  getStatusLabel,
  formatHealthScore,
  formatPercentage,
  validateHealthScore,
  validatePercentage,
};