const { METRICS_CONFIG } = require('../constants/metricsConstants');

class MetricsService {
  static calculatePipelineHealth(metrics) {
    const score = METRICS_CONFIG.CALCULATION_METHODS.HEALTH_SCORE(metrics);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  static getHealthStatus(score) {
    const status = METRICS_CONFIG.CALCULATION_METHODS.GET_STATUS(score);
    const color = METRICS_CONFIG.CALCULATION_METHODS.GET_COLOR(status);
    const label = METRICS_CONFIG.CALCULATION_METHODS.GET_LABEL(status);

    return {
      status,
      color,
      label,
    };
  }

  static calculateCandidateVolume(activeCandidates, openPositions) {
    if (openPositions === 0) return 100;

    const targetCandidatesPerJob = METRICS_CONFIG.TARGETS.CANDIDATES_PER_JOB;
    const candidatesPerJob = activeCandidates / openPositions;
    const health = (candidatesPerJob / targetCandidatesPerJob) * 100;

    return Math.max(0, Math.min(100, Math.round(health)));
  }

  static calculateApplicationRate(weeklyApplications) {
    const targetWeeklyApplications = METRICS_CONFIG.TARGETS.WEEKLY_APPLICATIONS;
    const health = (weeklyApplications / targetWeeklyApplications) * 100;

    return Math.max(0, Math.min(100, Math.round(health)));
  }

  static calculateTimeToFill(avgDaysToFill) {
    const maxTimeToFill = METRICS_CONFIG.TARGETS.MAX_TIME_TO_FILL_DAYS;

    if (avgDaysToFill <= maxTimeToFill) return 100;

    const health = Math.max(0, 100 - ((avgDaysToFill - maxTimeToFill) / maxTimeToFill) * 100);

    return Math.round(health);
  }

  static calculateDiversity(diverseCandidates, totalCandidates) {
    if (totalCandidates === 0) return 0;

    const diversityRatio = diverseCandidates / totalCandidates;
    const targetDiversityRatio = METRICS_CONFIG.TARGETS.MIN_DIVERSITY_RATIO;
    const health = (diversityRatio / targetDiversityRatio) * 100;

    return Math.max(0, Math.min(100, Math.round(health)));
  }

  static calculateCandidateToJobRatio(totalCandidates, totalJobs) {
    if (totalJobs === 0) return 0;
    const ratio = totalCandidates / totalJobs;
    return Math.round(ratio * 100) / 100;
  }

  static calculateConversionRate(hiredCount, totalApplications) {
    if (totalApplications === 0) return 0;
    const rate = (hiredCount / totalApplications) * 100;
    return Math.round(rate * 10) / 10;
  }

  static getCriticalTriggers(metrics) {
    const triggers = [];

    if (metrics.candidateVolumeHealth < 30) {
      triggers.push('LOW_CANDIDATE_VOLUME');
    }

    if (metrics.applicationRateHealth < 30) {
      triggers.push('LOW_APPLICATION_RATE');
    }

    if (metrics.timeToFillHealth < 30) {
      triggers.push('HIGH_TIME_TO_FILL');
    }

    if (metrics.diversityHealth < 30) {
      triggers.push('LOW_DIVERSITY_RATIO');
    }

    return triggers;
  }

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

  static formatHealthScore(score) {
    return METRICS_CONFIG.DISPLAY_FORMATS.HEALTH_SCORE(score);
  }

  static formatPercentage(value) {
    return METRICS_CONFIG.DISPLAY_FORMATS.PERCENTAGE(value);
  }

  static formatRatio(value) {
    return METRICS_CONFIG.DISPLAY_FORMATS.RATIO(value);
  }

  static formatDays(value) {
    return METRICS_CONFIG.DISPLAY_FORMATS.DAYS(value);
  }

  static validateHealthScore(score) {
    return METRICS_CONFIG.VALIDATION.HEALTH_SCORE.MIN <= score &&
           score <= METRICS_CONFIG.VALIDATION.HEALTH_SCORE.MAX;
  }

  static validatePercentage(value) {
    return METRICS_CONFIG.VALIDATION.PERCENTAGES.MIN <= value &&
           value <= METRICS_CONFIG.VALIDATION.PERCENTAGES.MAX;
  }

  static getConfig() {
    return METRICS_CONFIG;
  }

  static calculateAllMetrics(rawData) {
    const metrics = {
      candidateVolume: this.calculateCandidateVolume(
        rawData.activeCandidates || 0,
        rawData.openPositions || 0
      ),
      applicationRate: this.calculateApplicationRate(
        rawData.weeklyApplications || 0
      ),
      timeToFill: this.calculateTimeToFill(
        rawData.avgDaysToFill || 0
      ),
      diversityRatio: this.calculateDiversity(
        rawData.diverseCandidates || 0,
        rawData.totalCandidates || 0
      ),
    };

    const healthScore = this.calculatePipelineHealth(metrics);
    const healthStatus = this.getHealthStatus(healthScore);

    return {
      metrics,
      health: {
        score: healthScore,
        status: healthStatus.status,
        color: healthStatus.color,
        label: healthStatus.label,
      },
      triggers: this.getCriticalTriggers(metrics),
      recommendations: this.generateRecommendations(this.getCriticalTriggers(metrics)),
    };
  }
}

module.exports = MetricsService;