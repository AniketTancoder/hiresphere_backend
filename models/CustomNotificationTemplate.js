const mongoose = require('mongoose');

const customNotificationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'custom_system',
      'custom_marketing',
      'custom_reminder',
      'custom_alert',
      'custom_announcement'
    ]
  },
  category: {
    type: String,
    required: true,
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
    ]
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
  deliveryChannels: [{
    type: String,
    enum: ['in_app', 'email', 'push', 'sms']
  }],
  actionButtons: [{
    label: String,
    url: String,
    type: { type: String, enum: ['primary', 'secondary'], default: 'secondary' }
  }],
  variables: [{
    name: String,
    type: { type: String, enum: ['string', 'number', 'date', 'boolean'] },
    required: { type: Boolean, default: false },
    defaultValue: mongoose.Schema.Types.Mixed,
    description: String
  }],
  conditions: {
    userType: {
      type: String,
      enum: ['admin', 'candidate', 'both'],
      default: 'both'
    },
    userRole: [{
      type: String,
      enum: ['admin', 'recruiter', 'candidate']
    }],
    activeUsersOnly: {
      type: Boolean,
      default: true
    },
    dateRange: {
      start: Date,
      end: Date
    }
  },
  triggers: {
    manual: { type: Boolean, default: true },
    scheduled: {
      enabled: { type: Boolean, default: false },
      cronExpression: String,
      timezone: { type: String, default: 'UTC' }
    },
    eventBased: {
      enabled: { type: Boolean, default: false },
      eventType: String,
      conditions: mongoose.Schema.Types.Mixed
    }
  },
  targeting: {
    audience: {
      type: String,
      enum: ['all', 'segment', 'individual'],
      default: 'all'
    },
    segments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserSegment'
    }],
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    filters: {
      location: [String],
      department: [String],
      experience: {
        min: Number,
        max: Number
      },
      skills: [String]
    }
  },
  analytics: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    lastSent: Date
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [String],
  abTestEnabled: {
    type: Boolean,
    default: false
  },
  abTestVariants: [{
    name: String,
    title: String,
    message: String,
    weight: { type: Number, min: 0, max: 100, default: 50 }
  }]
}, {
  timestamps: true
});

// Indexes
customNotificationTemplateSchema.index({ type: 1 });
customNotificationTemplateSchema.index({ category: 1 });
customNotificationTemplateSchema.index({ status: 1 });
customNotificationTemplateSchema.index({ createdBy: 1 });
customNotificationTemplateSchema.index({ 'conditions.userType': 1 });
customNotificationTemplateSchema.index({ tags: 1 });

// Virtual for delivery rate
customNotificationTemplateSchema.virtual('deliveryRate').get(function() {
  return this.analytics.sent > 0 ? (this.analytics.delivered / this.analytics.sent) * 100 : 0;
});

// Virtual for read rate
customNotificationTemplateSchema.virtual('readRate').get(function() {
  return this.analytics.sent > 0 ? (this.analytics.read / this.analytics.sent) * 100 : 0;
});

// Virtual for click rate
customNotificationTemplateSchema.virtual('clickRate').get(function() {
  return this.analytics.sent > 0 ? (this.analytics.clicked / this.analytics.sent) * 100 : 0;
});

// Method to render template with variables
customNotificationTemplateSchema.methods.render = function(variables = {}) {
  let renderedTitle = this.title;
  let renderedMessage = this.message;
  let renderedShortMessage = this.shortMessage;

  // Replace variables in templates
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    renderedTitle = renderedTitle.replace(new RegExp(placeholder, 'g'), value);
    renderedMessage = renderedMessage.replace(new RegExp(placeholder, 'g'), value);
    if (renderedShortMessage) {
      renderedShortMessage = renderedShortMessage.replace(new RegExp(placeholder, 'g'), value);
    }
  });

  return {
    title: renderedTitle,
    message: renderedMessage,
    shortMessage: renderedShortMessage
  };
};

// Method to validate variables
customNotificationTemplateSchema.methods.validateVariables = function(variables = {}) {
  const errors = [];

  this.variables.forEach(variable => {
    if (variable.required && !variables[variable.name]) {
      errors.push(`Required variable '${variable.name}' is missing`);
    }

    if (variables[variable.name]) {
      // Type validation
      switch (variable.type) {
        case 'number':
          if (isNaN(Number(variables[variable.name]))) {
            errors.push(`Variable '${variable.name}' must be a number`);
          }
          break;
        case 'boolean':
          if (typeof variables[variable.name] !== 'boolean') {
            errors.push(`Variable '${variable.name}' must be a boolean`);
          }
          break;
        case 'date':
          if (isNaN(Date.parse(variables[variable.name]))) {
            errors.push(`Variable '${variable.name}' must be a valid date`);
          }
          break;
      }
    }
  });

  return errors;
};

// Method to check if user matches targeting criteria
customNotificationTemplateSchema.methods.matchesUser = function(user, userProfile = null) {
  // Check user type
  if (this.conditions.userType !== 'both') {
    const userType = user.role === 'admin' || user.role === 'recruiter' ? 'admin' : 'candidate';
    if (this.conditions.userType !== userType) return false;
  }

  // Check user role
  if (this.conditions.userRole && this.conditions.userRole.length > 0) {
    if (!this.conditions.userRole.includes(user.role)) return false;
  }

  // Check targeting
  if (this.targeting.audience === 'individual') {
    return this.targeting.users.some(userId => userId.toString() === user._id.toString());
  }

  if (this.targeting.audience === 'segment') {
    // Check if user belongs to specified segments
    // This would require additional logic based on your segmentation system
    return true; // Simplified for now
  }

  // Check filters
  if (userProfile && this.targeting.filters) {
    const filters = this.targeting.filters;

    if (filters.location && filters.location.length > 0) {
      if (!filters.location.includes(userProfile.location)) return false;
    }

    if (filters.department && filters.department.length > 0) {
      if (!filters.department.includes(userProfile.department)) return false;
    }

    if (filters.experience) {
      const exp = userProfile.experience || 0;
      if (exp < filters.experience.min || exp > filters.experience.max) return false;
    }

    if (filters.skills && filters.skills.length > 0) {
      const userSkills = userProfile.skills || [];
      const hasRequiredSkills = filters.skills.every(skill =>
        userSkills.some(userSkill => userSkill.toLowerCase().includes(skill.toLowerCase()))
      );
      if (!hasRequiredSkills) return false;
    }
  }

  return true;
};

// Static method to get active templates
customNotificationTemplateSchema.statics.getActiveTemplates = function(category = null, type = null) {
  const query = { status: 'active' };

  if (category) query.category = category;
  if (type) query.type = type;

  return this.find(query).sort({ createdAt: -1 });
};

// Static method to get templates by tags
customNotificationTemplateSchema.statics.getTemplatesByTags = function(tags) {
  return this.find({
    status: 'active',
    tags: { $in: tags }
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('CustomNotificationTemplate', customNotificationTemplateSchema);