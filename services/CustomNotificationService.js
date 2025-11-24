const CustomNotificationTemplate = require('../models/CustomNotificationTemplate');
const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const NotificationTriggerService = require('./NotificationTriggerService');

class CustomNotificationService {
  constructor() {
    this.abTestCache = new Map();
    this.cacheExpiry = 60 * 60 * 1000;
  }

  async createTemplate(templateData, createdBy) {
    try {
      const template = new CustomNotificationTemplate({
        ...templateData,
        createdBy
      });

      await template.save();
      return template;
    } catch (error) {
      console.error('Error creating notification template:', error);
      throw error;
    }
  }

  async updateTemplate(templateId, updateData, userId) {
    try {
      const template = await CustomNotificationTemplate.findOne({
        _id: templateId,
        createdBy: userId
      });

      if (!template) {
        throw new Error('Template not found or access denied');
      }

      Object.assign(template, updateData);
      await template.save();

      return template;
    } catch (error) {
      console.error('Error updating notification template:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId, userId) {
    try {
      const result = await CustomNotificationTemplate.findOneAndDelete({
        _id: templateId,
        createdBy: userId
      });

      if (!result) {
        throw new Error('Template not found or access denied');
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting notification template:', error);
      throw error;
    }
  }

  async getTemplates(filters = {}, userId = null) {
    try {
      const query = {};

      if (filters.status) query.status = filters.status;
      if (filters.category) query.category = filters.category;
      if (filters.type) query.type = filters.type;
      if (filters.createdBy) query.createdBy = filters.createdBy;
      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (userId && !filters.includeAll) {
        query.createdBy = userId;
      }

      const templates = await CustomNotificationTemplate.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      const total = await CustomNotificationTemplate.countDocuments(query);

      return {
        templates,
        total,
        page: Math.floor((filters.skip || 0) / (filters.limit || 50)) + 1,
        pages: Math.ceil(total / (filters.limit || 50))
      };
    } catch (error) {
      console.error('Error fetching notification templates:', error);
      throw error;
    }
  }

  async sendFromTemplate(templateId, variables = {}, targetingOverrides = {}) {
    try {
      const template = await CustomNotificationTemplate.findById(templateId);

      if (!template || template.status !== 'active') {
        throw new Error('Template not found or not active');
      }

      const validationErrors = template.validateVariables(variables);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      const rendered = template.render(variables);

      const recipients = await this.getTemplateRecipients(template, targetingOverrides);

      let notifications = [];
      if (template.abTestEnabled && template.abTestVariants.length > 0) {
        notifications = await this.sendABTestNotifications(template, rendered, recipients, variables);
      } else {
        notifications = await this.sendStandardNotifications(template, rendered, recipients, variables);
      }

      await this.updateTemplateAnalytics(templateId, notifications.length);

      return {
        success: true,
        sent: notifications.length,
        notifications
      };
    } catch (error) {
      console.error('Error sending notification from template:', error);
      throw error;
    }
  }

  async getTemplateRecipients(template, overrides = {}) {
    const User = require('../models/User');
    const Candidate = require('../models/Candidate');

    let users = [];

    if (overrides.users && overrides.users.length > 0) {
      users = await User.find({ _id: { $in: overrides.users } });
    } else if (template.targeting.audience === 'all') {
      const userQuery = {};

      if (template.conditions.userType !== 'both') {
        if (template.conditions.userType === 'admin') {
          userQuery.role = { $in: ['admin', 'recruiter'] };
        } else {
          userQuery.role = 'candidate';
        }
      }

      users = await User.find(userQuery);
    }

    const validRecipients = [];
    for (const user of users) {
      let userProfile = null;
      if (user.role === 'candidate') {
        userProfile = await Candidate.findOne({ user: user._id });
      }

      if (template.matchesUser(user, userProfile)) {
        validRecipients.push({
          user,
          profile: userProfile,
          type: user.role === 'candidate' ? 'candidate' : 'admin'
        });
      }
    }

    return validRecipients;
  }

  async sendStandardNotifications(template, rendered, recipients, variables) {
    const notifications = [];

    for (const recipient of recipients) {
      try {
        const preferences = await NotificationPreferences.findOne({
          user: recipient.user._id,
          userType: recipient.type
        });

        if (preferences && !preferences.shouldDeliverNotification({
          type: template.type,
          category: template.category,
          priority: template.priority
        })) {
          continue;
        }

        const notification = await Notification.createNotification({
          recipient: recipient.user._id,
          recipientType: recipient.type,
          type: template.type,
          title: rendered.title,
          message: rendered.message,
          shortMessage: rendered.shortMessage,
          data: variables,
          priority: template.priority,
          urgency: template.urgency,
          category: template.category,
          deliveryChannels: template.deliveryChannels,
          actionButtons: template.actionButtons
        });

        notifications.push(notification);
      } catch (error) {
        console.error(`Error sending notification to ${recipient.user._id}:`, error);
      }
    }

    return notifications;
  }

  async sendABTestNotifications(template, rendered, recipients, variables) {
    const notifications = [];
    const variants = [rendered, ...template.abTestVariants.map(v => template.render({ ...variables, ...v }))];

    for (const recipient of recipients) {
      try {
        const variant = this.selectABTestVariant(variants, template.abTestVariants);

        const preferences = await NotificationPreferences.findOne({
          user: recipient.user._id,
          userType: recipient.type
        });

        if (preferences && !preferences.shouldDeliverNotification({
          type: template.type,
          category: template.category,
          priority: template.priority
        })) {
          continue;
        }

        const notification = await Notification.createNotification({
          recipient: recipient.user._id,
          recipientType: recipient.type,
          type: template.type,
          title: variant.title,
          message: variant.message,
          shortMessage: variant.shortMessage,
          data: { ...variables, abTestVariant: variant.name || 'control' },
          priority: template.priority,
          urgency: template.urgency,
          category: template.category,
          deliveryChannels: template.deliveryChannels,
          actionButtons: template.actionButtons
        });

        notifications.push(notification);
      } catch (error) {
        console.error(`Error sending A/B test notification to ${recipient.user._id}:`, error);
      }
    }

    return notifications;
  }

  selectABTestVariant(variants, variantConfigs) {
    const totalWeight = variantConfigs.reduce((sum, v) => sum + (v.weight || 50), 50);
    const random = Math.random() * totalWeight;

    let cumulativeWeight = 50;
    if (random <= cumulativeWeight) {
      return variants[0];
    }

    for (let i = 0; i < variantConfigs.length; i++) {
      cumulativeWeight += variantConfigs[i].weight || 50;
      if (random <= cumulativeWeight) {
        return { ...variants[i + 1], name: variantConfigs[i].name };
      }
    }

    return variants[0];
  }

  async updateTemplateAnalytics(templateId, sentCount) {
    try {
      await CustomNotificationTemplate.findByIdAndUpdate(templateId, {
        $inc: { 'analytics.sent': sentCount },
        $set: { 'analytics.lastSent': new Date() }
      });
    } catch (error) {
      console.error('Error updating template analytics:', error);
    }
  }

  async cloneTemplate(templateId, userId, newName = null) {
    try {
      const original = await CustomNotificationTemplate.findOne({
        _id: templateId,
        $or: [
          { createdBy: userId },
          { status: 'active' }
        ]
      });

      if (!original) {
        throw new Error('Template not found');
      }

      const cloned = new CustomNotificationTemplate({
        ...original.toObject(),
        _id: undefined,
        name: newName || `${original.name} (Copy)`,
        status: 'draft',
        analytics: {
          sent: 0,
          delivered: 0,
          read: 0,
          clicked: 0,
          engagementRate: 0
        },
        createdBy: userId
      });

      await cloned.save();
      return cloned;
    } catch (error) {
      console.error('Error cloning template:', error);
      throw error;
    }
  }

  async getTemplateAnalytics(templateId, userId, timeframe = '30d') {
    try {
      const template = await CustomNotificationTemplate.findOne({
        _id: templateId,
        createdBy: userId
      });

      if (!template) {
        throw new Error('Template not found');
      }

      const now = new Date();
      const startDate = new Date(now.getTime() - this.parseTimeframe(timeframe));

      const notifications = await Notification.find({
        type: template.type,
        createdAt: { $gte: startDate },
        'data.templateId': templateId
      });

      const analytics = {
        template: {
          id: template._id,
          name: template.name,
          type: template.type,
          category: template.category
        },
        period: { start: startDate, end: now },
        metrics: {
          sent: notifications.length,
          delivered: notifications.filter(n => !n.archived).length,
          read: notifications.filter(n => n.isRead).length,
          engagementRate: 0
        },
        performance: {
          deliveryRate: 0,
          readRate: 0,
          averageResponseTime: 0
        }
      };

      if (analytics.metrics.sent > 0) {
        analytics.metrics.engagementRate = (analytics.metrics.read / analytics.metrics.sent) * 100;
        analytics.performance.deliveryRate = (analytics.metrics.delivered / analytics.metrics.sent) * 100;
        analytics.performance.readRate = (analytics.metrics.read / analytics.metrics.sent) * 100;
      }

      const responseTimes = notifications
        .filter(n => n.isRead && n.updatedAt && n.createdAt)
        .map(n => n.updatedAt - n.createdAt);

      if (responseTimes.length > 0) {
        analytics.performance.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }

      return analytics;
    } catch (error) {
      console.error('Error getting template analytics:', error);
      throw error;
    }
  }

  parseTimeframe(timeframe) {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));

    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      case 'y': return value * 365 * 24 * 60 * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }

  validateTemplateData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!data.message || data.message.trim().length === 0) {
      errors.push('Message is required');
    }

    if (!data.type) {
      errors.push('Type is required');
    }

    if (!data.category) {
      errors.push('Category is required');
    }

    if (data.variables) {
      data.variables.forEach((variable, index) => {
        if (!variable.name || variable.name.trim().length === 0) {
          errors.push(`Variable ${index + 1}: name is required`);
        }
      });
    }

    return errors;
  }

  clearCache() {
    this.abTestCache.clear();
  }
}

module.exports = new CustomNotificationService();