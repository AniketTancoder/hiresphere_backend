const mongoose = require('mongoose');

const notificationPreferencesSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  userType: {
    type: String,
    enum: ['admin', 'candidate'],
    required: true
  },

  globalSettings: {
    enabled: { type: Boolean, default: true },
    quietHoursEnabled: { type: Boolean, default: false },
    quietHoursStart: { type: Number, min: 0, max: 23, default: 22 },
    quietHoursEnd: { type: Number, min: 0, max: 23, default: 8 },
    focusModeEnabled: { type: Boolean, default: false },
    locationBasedEnabled: { type: Boolean, default: false },
    timezone: { type: String, default: 'UTC' }
  },

  categoryPreferences: {
    application: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    },
    interview: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    },
    profile: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    },
    job: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    },
    system: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    },
    compliance: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    },
    team: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    },
    market: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'digest' }
    },
    performance: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'digest' }
    },
    integration: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      frequency: { type: String, enum: ['instant', 'digest', 'weekly'], default: 'instant' }
    }
  },

  typePreferences: {
    urgent: {
      enabled: { type: Boolean, default: true },
      channels: [{ type: String, enum: ['in_app', 'email', 'push', 'sms'] }],
      snoozeEnabled: { type: Boolean, default: false }
    },

    new_application: { enabled: { type: Boolean, default: true } },
    application_status_update: { enabled: { type: Boolean, default: true } },
    incomplete_application_reminder: { enabled: { type: Boolean, default: true } },
    deadline_warning: { enabled: { type: Boolean, default: true } },
    application_milestone: { enabled: { type: Boolean, default: true } },

    interview_scheduled: { enabled: { type: Boolean, default: true } },
    interview_preparation_alert: { enabled: { type: Boolean, default: true } },
    interview_conflict_detection: { enabled: { type: Boolean, default: true } },
    interview_feedback_pending: { enabled: { type: Boolean, default: false } },

    profile_view: { enabled: { type: Boolean, default: true } },
    profile_completeness_nudge: { enabled: { type: Boolean, default: true } },
    recruiter_profile_view: { enabled: { type: Boolean, default: true } },
    document_expiry_alert: { enabled: { type: Boolean, default: true } },

    job_match: { enabled: { type: Boolean, default: true } },
    new_job: { enabled: { type: Boolean, default: true } },
    similar_job_suggestion: { enabled: { type: Boolean, default: true } },
    skill_match_alert: { enabled: { type: Boolean, default: true } },

    system: { enabled: { type: Boolean, default: true } },
    platform_feature_announcement: { enabled: { type: Boolean, default: true } },

    pipeline_bottleneck_alert: { enabled: { type: Boolean, default: true } },
    candidate_drop_off_warning: { enabled: { type: Boolean, default: true } },
    time_to_fill_exceedance: { enabled: { type: Boolean, default: true } },
    team_task_assignment: { enabled: { type: Boolean, default: true } },
    compliance_requirement_alert: { enabled: { type: Boolean, default: true } },

    market_trend_insight: { enabled: { type: Boolean, default: true } },
    predictive_acceptance_alert: { enabled: { type: Boolean, default: true } },
    networking_suggestion: { enabled: { type: Boolean, default: true } }
  },

  deliveryPreferences: {
    emailSettings: {
      enabled: { type: Boolean, default: true },
      digestTime: { type: String, enum: ['morning', 'afternoon', 'evening'], default: 'morning' },
      digestFrequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' }
    },
    pushSettings: {
      enabled: { type: Boolean, default: true },
      mobileOnly: { type: Boolean, default: false }
    },
    smsSettings: {
      enabled: { type: Boolean, default: false },
      urgentOnly: { type: Boolean, default: true }
    }
  },

  temporaryOverrides: [{
    category: String,
    type: String,
    enabled: Boolean,
    startDate: Date,
    endDate: Date,
    reason: String
  }],

  analytics: {
    lastActive: Date,
    engagementScore: { type: Number, min: 0, max: 100, default: 50 },
    preferredTimes: [Number],
    responsePatterns: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

notificationPreferencesSchema.index({ user: 1, userType: 1 });
notificationPreferencesSchema.index({ 'globalSettings.quietHoursEnabled': 1 });
notificationPreferencesSchema.index({ 'globalSettings.focusModeEnabled': 1 });

notificationPreferencesSchema.statics.getOrCreatePreferences = async function(userId, userType) {
  let preferences = await this.findOne({ user: userId, userType });

  if (!preferences) {
    const defaultPrefs = this.getDefaultPreferences(userType);
    preferences = new this({
      user: userId,
      userType,
      ...defaultPrefs
    });
    await preferences.save();
  }

  return preferences;
};

notificationPreferencesSchema.statics.getDefaultPreferences = function(userType) {
  const basePreferences = {
    globalSettings: {
      enabled: true,
      quietHoursEnabled: false,
      quietHoursStart: 22,
      quietHoursEnd: 8,
      focusModeEnabled: false,
      locationBasedEnabled: false,
      timezone: 'UTC'
    },
    deliveryPreferences: {
      emailSettings: {
        enabled: true,
        digestTime: 'morning',
        digestFrequency: 'daily'
      },
      pushSettings: {
        enabled: true,
        mobileOnly: false
      },
      smsSettings: {
        enabled: false,
        urgentOnly: true
      }
    }
  };

  if (userType === 'admin') {
    return {
      ...basePreferences,
      categoryPreferences: {
        application: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
        interview: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
        profile: { enabled: true, channels: ['in_app'], frequency: 'instant' },
        job: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
        system: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
        compliance: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
        team: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
        market: { enabled: true, channels: ['in_app'], frequency: 'digest' },
        performance: { enabled: true, channels: ['in_app', 'email'], frequency: 'digest' },
        integration: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' }
      }
    };
  }

  return {
    ...basePreferences,
    categoryPreferences: {
      application: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
      interview: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
      profile: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
      job: { enabled: true, channels: ['in_app', 'email'], frequency: 'instant' },
      system: { enabled: true, channels: ['in_app'], frequency: 'instant' },
      compliance: { enabled: false, channels: [], frequency: 'instant' },
      team: { enabled: false, channels: [], frequency: 'instant' },
      market: { enabled: true, channels: ['in_app'], frequency: 'digest' },
      performance: { enabled: false, channels: [], frequency: 'digest' },
      integration: { enabled: false, channels: [], frequency: 'instant' }
    }
  };
};

notificationPreferencesSchema.methods.shouldDeliverNotification = function(notification) {
  if (!this.globalSettings.enabled) return false;

  const categoryPrefs = this.categoryPreferences[notification.category];
  if (!categoryPrefs || !categoryPrefs.enabled) return false;

  const typePrefs = this.typePreferences[notification.type];
  if (typePrefs && typePrefs.enabled === false) return false;

  const activeOverride = this.temporaryOverrides.find(override =>
    override.category === notification.category ||
    override.type === notification.type
  );
  if (activeOverride && !activeOverride.enabled) return false;

  if (this.globalSettings.quietHoursEnabled && notification.urgency !== 'immediate') {
    const now = new Date();
    const currentHour = now.getHours();
    const start = this.globalSettings.quietHoursStart;
    const end = this.globalSettings.quietHoursEnd;

    if (start > end) {
      if (currentHour >= start || currentHour < end) return false;
    } else {
      if (currentHour >= start && currentHour < end) return false;
    }
  }

  if (this.globalSettings.focusModeEnabled && !notification.focusModeRespected) {
    return false;
  }

  return true;
};

notificationPreferencesSchema.methods.getDeliveryChannels = function(notification) {
  const categoryPrefs = this.categoryPreferences[notification.category];
  if (!categoryPrefs) return ['in_app'];

  return categoryPrefs.channels.length > 0 ? categoryPrefs.channels : ['in_app'];
};

module.exports = mongoose.model('NotificationPreferences', notificationPreferencesSchema);