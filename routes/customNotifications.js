const express = require('express');
const CustomNotificationService = require('../services/CustomNotificationService');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const User = require('../models/User');

    const user = await User.findById(decoded.id).select('-password');
    if (!user || (user.role !== 'admin' && user.role !== 'recruiter')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.post('/templates', authenticateAdmin, async (req, res) => {
  try {
    const validationErrors = CustomNotificationService.validateTemplateData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const template = await CustomNotificationService.createTemplate(req.body, req.user._id);
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/templates', authenticateAdmin, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      category: req.query.category,
      type: req.query.type,
      tags: req.query.tags ? req.query.tags.split(',') : [],
      limit: parseInt(req.query.limit) || 20,
      skip: parseInt(req.query.skip) || 0,
      includeAll: req.query.includeAll === 'true'
    };

    const result = await CustomNotificationService.getTemplates(filters, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/templates/:id', authenticateAdmin, async (req, res) => {
  try {
    const template = await require('../models/CustomNotificationTemplate').findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user._id },
        { status: 'active' }
      ]
    }).populate('createdBy', 'name email');

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/templates/:id', authenticateAdmin, async (req, res) => {
  try {
    const validationErrors = CustomNotificationService.validateTemplateData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const template = await CustomNotificationService.updateTemplate(
      req.params.id,
      req.body,
      req.user._id
    );
    res.json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/templates/:id', authenticateAdmin, async (req, res) => {
  try {
    await CustomNotificationService.deleteTemplate(req.params.id, req.user._id);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/templates/:id/clone', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const clonedTemplate = await CustomNotificationService.cloneTemplate(
      req.params.id,
      req.user._id,
      name
    );
    res.status(201).json(clonedTemplate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/templates/:id/send', authenticateAdmin, async (req, res) => {
  try {
    const { variables, targetingOverrides } = req.body;
    const result = await CustomNotificationService.sendFromTemplate(
      req.params.id,
      variables,
      targetingOverrides
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/templates/:id/analytics', authenticateAdmin, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const analytics = await CustomNotificationService.getTemplateAnalytics(
      req.params.id,
      req.user._id,
      timeframe
    );
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/metadata', authenticateAdmin, async (req, res) => {
  try {
    const metadata = {
      categories: [
        { value: 'application', label: 'Applications' },
        { value: 'interview', label: 'Interviews' },
        { value: 'profile', label: 'Profiles' },
        { value: 'job', label: 'Jobs' },
        { value: 'system', label: 'System' },
        { value: 'compliance', label: 'Compliance' },
        { value: 'team', label: 'Team' },
        { value: 'market', label: 'Market' },
        { value: 'performance', label: 'Performance' },
        { value: 'integration', label: 'Integration' }
      ],
      types: [
        { value: 'custom_system', label: 'System Notification' },
        { value: 'custom_marketing', label: 'Marketing Message' },
        { value: 'custom_reminder', label: 'Reminder' },
        { value: 'custom_alert', label: 'Alert' },
        { value: 'custom_announcement', label: 'Announcement' }
      ],
      priorities: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' }
      ],
      urgencies: [
        { value: 'immediate', label: 'Immediate' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'batch', label: 'Batch' }
      ],
      deliveryChannels: [
        { value: 'in_app', label: 'In-App' },
        { value: 'email', label: 'Email' },
        { value: 'push', label: 'Push Notification' },
        { value: 'sms', label: 'SMS' }
      ],
      variableTypes: [
        { value: 'string', label: 'Text' },
        { value: 'number', label: 'Number' },
        { value: 'date', label: 'Date' },
        { value: 'boolean', label: 'Yes/No' }
      ]
    };

    res.json(metadata);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/templates/preview', authenticateAdmin, async (req, res) => {
  try {
    const { templateData, variables } = req.body;

    const CustomNotificationTemplate = require('../models/CustomNotificationTemplate');
    const tempTemplate = new CustomNotificationTemplate(templateData);

    const validationErrors = tempTemplate.validateVariables(variables);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Variable validation failed',
        errors: validationErrors
      });
    }

    const rendered = tempTemplate.render(variables);

    res.json({
      rendered,
      variables: tempTemplate.variables,
      validationErrors: []
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/templates/bulk/status', authenticateAdmin, async (req, res) => {
  try {
    const { templateIds, status } = req.body;

    if (!['active', 'inactive', 'archived'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const CustomNotificationTemplate = require('../models/CustomNotificationTemplate');
    const result = await CustomNotificationTemplate.updateMany(
      {
        _id: { $in: templateIds },
        createdBy: req.user._id
      },
      { status }
    );

    res.json({
      message: `Updated ${result.modifiedCount} templates`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tags/popular', authenticateAdmin, async (req, res) => {
  try {
    const CustomNotificationTemplate = require('../models/CustomNotificationTemplate');
    const tags = await CustomNotificationTemplate.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json(tags.map(tag => ({ tag: tag._id, count: tag.count })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;