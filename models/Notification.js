const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientType: {
    type: String,
    enum: ['admin', 'candidate'],
    required: true
  },
  type: {
    type: String,
    enum: [
      'new_application',
      'application_status_update',
      'profile_view',
      'job_match',
      'new_job',
      'interview_scheduled',
      'profile_reminder',
      'system',
      'candidate_update',
      'job_expiring',
      'incomplete_application_reminder',
      'interview_preparation_alert',
      'deadline_warning',
      'similar_job_suggestion',
      'profile_completeness_nudge',
      'recruiter_profile_view',
      'skill_match_alert',
      'application_milestone',
      'market_trend_insight',
      'networking_suggestion',
      'interview_conflict_detection',
      'reference_request_reminder',
      'document_expiry_alert',
      'privacy_setting_update',
      'platform_feature_announcement',
      'pipeline_bottleneck_alert',
      'candidate_drop_off_warning',
      'diversity_metric_alert',
      'time_to_fill_exceedance',
      'high_potential_candidate',
      'passive_candidate_rediscovery',
      'candidate_engagement_drop',
      'duplicate_application_detection',
      'reference_check_completion',
      'background_check_result',
      'job_posting_expiry_warning',
      'interview_feedback_pending',
      'offer_approval_request',
      'compliance_requirement_alert',
      'integration_failure_notification',
      'team_task_assignment',
      'collaborator_comment',
      'approval_workflow_request',
      'team_performance_metric',
      'cross_team_candidate_share',
      'predictive_acceptance_alert',
      'market_salary_alert',
      'competitor_job_posting',
      'candidate_sentiment_analysis',
      'team_capacity_warning',
      'interview_no_show_reschedule',
      'offer_expiry_reminder',
      'onboarding_checklist_update',
      'compliance_deadline_reminder',
      'performance_review_scheduling',
      'calendar_conflict_alert',
      'email_communication_sync',
      'hris_onboarding_update',
      'background_check_status',
      'job_board_performance',
      'eeo_reporting_reminder',
      'right_to_work_expiry',
      'visa_status_update',
      'data_privacy_consent_renewal',
      'regulatory_change_alert'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  shortMessage: {
    type: String,
    trim: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  urgency: {
    type: String,
    enum: ['immediate', 'scheduled', 'batch'],
    default: 'scheduled'
  },
  category: {
    type: String,
    enum: [
      'application',
      'interview',
      'profile',
      'job',
      'system',
      'compliance',
      'team',
      'market',
      'performance',
      'integration'
    ],
    required: true
  },
  actionUrl: {
    type: String,
    trim: true
  },
  actionButtons: [{
    label: String,
    url: String,
    type: { type: String, enum: ['primary', 'secondary'], default: 'secondary' }
  }],
  deliveryChannels: [{
    type: String,
    enum: ['in_app', 'email', 'push', 'sms']
  }],
  scheduledFor: {
    type: Date
  },
  quietHoursRespected: {
    type: Boolean,
    default: true
  },
  focusModeRespected: {
    type: Boolean,
    default: true
  },
  locationBased: {
    type: Boolean,
    default: false
  },
  deviceAware: {
    type: Boolean,
    default: false
  },
  escalationRules: {
    enabled: { type: Boolean, default: false },
    unacknowledgedAfter: { type: Number },
    escalateTo: [{ type: String, enum: ['email', 'sms', 'supervisor'] }]
  },
  metadata: {
    triggerSource: String,
    predictiveScore: Number,
    marketData: mongoose.Schema.Types.Mixed,
    complianceFlags: [String],
    aiGenerated: { type: Boolean, default: false },
    personalizationData: mongoose.Schema.Types.Mixed
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, recipientType: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

notificationSchema.statics.createNotification = async function(data) {
  const notificationData = {
    ...data,
    deliveryChannels: data.deliveryChannels || ['in_app'],
    category: data.category || this.getCategoryFromType(data.type),
    urgency: data.urgency || this.calculateUrgency(data.type, data.priority),
    shortMessage: data.shortMessage || this.generateShortMessage(data.message)
  };

  const notification = new this(notificationData);
  const savedNotification = await notification.save();

  if (global.sendRealTimeNotification) {
    global.sendRealTimeNotification(data.recipient, data.recipientType, savedNotification);
  }

  if (notificationData.scheduledFor && notificationData.scheduledFor > new Date()) {
    this.scheduleNotification(savedNotification._id, notificationData.scheduledFor);
  }

  return savedNotification;
};

notificationSchema.statics.getUnreadCount = function(recipientId, recipientType) {
  return this.countDocuments({
    recipient: recipientId,
    recipientType,
    isRead: false,
    expiresAt: { $gt: new Date() }
  });
};

notificationSchema.statics.getNotifications = function(recipientId, recipientType, limit = 20, skip = 0, filters = {}) {
  const query = {
    recipient: recipientId,
    recipientType,
    expiresAt: { $gt: new Date() },
    archived: false
  };

  if (filters.category) query.category = filters.category;
  if (filters.type) query.type = filters.type;
  if (filters.priority) query.priority = filters.priority;
  if (filters.urgency) query.urgency = filters.urgency;
  if (filters.isRead !== undefined) query.isRead = filters.isRead;
  if (filters.dateFrom) query.createdAt = { $gte: filters.dateFrom };
  if (filters.dateTo) query.createdAt = { ...query.createdAt, $lte: filters.dateTo };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

notificationSchema.statics.getCategoryFromType = function(type) {
  const categoryMap = {
    'new_application': 'application',
    'application_status_update': 'application',
    'incomplete_application_reminder': 'application',
    'deadline_warning': 'application',
    'application_milestone': 'application',
    'duplicate_application_detection': 'application',
    'interview_scheduled': 'interview',
    'interview_preparation_alert': 'interview',
    'interview_conflict_detection': 'interview',
    'interview_feedback_pending': 'interview',
    'interview_no_show_reschedule': 'interview',
    'profile_view': 'profile',
    'profile_reminder': 'profile',
    'profile_completeness_nudge': 'profile',
    'recruiter_profile_view': 'profile',
    'document_expiry_alert': 'profile',
    'privacy_setting_update': 'profile',
    'job_match': 'job',
    'new_job': 'job',
    'similar_job_suggestion': 'job',
    'skill_match_alert': 'job',
    'job_expiring': 'job',
    'job_posting_expiry_warning': 'job',
    'competitor_job_posting': 'job',
    'system': 'system',
    'platform_feature_announcement': 'system',
    'integration_failure_notification': 'system',
    'compliance_requirement_alert': 'compliance',
    'eeo_reporting_reminder': 'compliance',
    'right_to_work_expiry': 'compliance',
    'visa_status_update': 'compliance',
    'data_privacy_consent_renewal': 'compliance',
    'regulatory_change_alert': 'compliance',
    'team_task_assignment': 'team',
    'collaborator_comment': 'team',
    'approval_workflow_request': 'team',
    'team_performance_metric': 'team',
    'cross_team_candidate_share': 'team',
    'market_trend_insight': 'market',
    'market_salary_alert': 'market',
    'pipeline_bottleneck_alert': 'performance',
    'candidate_drop_off_warning': 'performance',
    'diversity_metric_alert': 'performance',
    'time_to_fill_exceedance': 'performance',
    'high_potential_candidate': 'performance',
    'candidate_engagement_drop': 'performance',
    'team_capacity_warning': 'performance',
    'calendar_conflict_alert': 'integration',
    'email_communication_sync': 'integration',
    'hris_onboarding_update': 'integration',
    'background_check_status': 'integration',
    'job_board_performance': 'integration'
  };

  return categoryMap[type] || 'system';
};

notificationSchema.statics.calculateUrgency = function(type, priority) {
  const immediateTypes = [
    'candidate_accepts_offer',
    'candidate_rejects_offer',
    'interview_no_show',
    'interview_cancellation',
    'system_error',
    'integration_failure_notification',
    'urgent_compliance_requirement',
    'security_alert',
    'access_alert'
  ];

  if (immediateTypes.includes(type) || priority === 'urgent') {
    return 'immediate';
  }

  const scheduledTypes = [
    'application_status_update',
    'interview_scheduled',
    'team_collaboration_message',
    'daily_summary_digest',
    'pipeline_health_warning'
  ];

  if (scheduledTypes.includes(type) || priority === 'high') {
    return 'scheduled';
  }

  return 'batch';
};

notificationSchema.statics.generateShortMessage = function(message) {
  if (message.length <= 100) return message;
  return message.substring(0, 97) + '...';
};

notificationSchema.statics.scheduleNotification = function(notificationId, scheduledFor) {
  console.log(`Notification ${notificationId} scheduled for ${scheduledFor}`);
};

notificationSchema.statics.getPrioritizedNotifications = function(recipientId, recipientType, userPreferences = {}) {
  const query = {
    recipient: recipientId,
    recipientType,
    expiresAt: { $gt: new Date() },
    archived: false
  };

  if (userPreferences.quietHoursEnabled) {
    const now = new Date();
    const currentHour = now.getHours();
    if (currentHour >= userPreferences.quietHoursStart || currentHour < userPreferences.quietHoursEnd) {
      query.urgency = { $ne: 'immediate' };
    }
  }

  if (userPreferences.focusModeEnabled) {
    query.focusModeRespected = true;
  }

  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

module.exports = mongoose.model('Notification', notificationSchema);