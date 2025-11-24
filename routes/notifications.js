const express = require('express');
const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const NotificationTriggerService = require('../services/NotificationTriggerService');
const NotificationAnalyticsService = require('../services/NotificationAnalyticsService');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    if (decoded.type === 'candidate') {
      req.user = { id: decoded.id, type: 'candidate' };
    } else {
      const User = require('../models/User');
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      req.user = { id: user._id, type: 'admin', role: user.role };
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/', authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = {
      recipient: req.user.id,
      recipientType: req.user.type,
      expiresAt: { $gt: new Date() }
    };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/unread-count', authenticateUser, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user.id, req.user.type);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/read', authenticateUser, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id,
      recipientType: req.user.type
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.markAsRead();
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/mark-all-read', authenticateUser, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user.id,
        recipientType: req.user.type,
        isRead: false
      },
      { isRead: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id,
      recipientType: req.user.type
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/create', auth, async (req, res) => {
  try {
    const notification = await Notification.createNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    const preferences = await NotificationPreferences.getOrCreatePreferences(
      req.user.id,
      req.user.type
    );
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/preferences', authenticateUser, async (req, res) => {
  try {
    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: req.user.id, userType: req.user.type },
      req.body,
      { new: true, upsert: true, runValidators: true }
    );
    res.json(preferences);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/preferences/reset', authenticateUser, async (req, res) => {
  try {
    const defaultPreferences = NotificationPreferences.getDefaultPreferences(req.user.type);
    const preferences = await NotificationPreferences.findOneAndUpdate(
      { user: req.user.id, userType: req.user.type },
      defaultPreferences,
      { new: true, upsert: true }
    );
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/filtered', authenticateUser, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      type,
      priority,
      urgency,
      isRead,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const filters = {};
    if (category) filters.category = category;
    if (type) filters.type = type;
    if (priority) filters.priority = priority;
    if (urgency) filters.urgency = urgency;
    if (isRead !== undefined) filters.isRead = isRead === 'true';
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    const notifications = await Notification.getNotifications(
      req.user.id,
      req.user.type,
      parseInt(limit),
      (parseInt(page) - 1) * parseInt(limit),
      filters
    );

    let filteredNotifications = notifications;
    if (search) {
      filteredNotifications = notifications.filter(notification =>
        notification.title.toLowerCase().includes(search.toLowerCase()) ||
        notification.message.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = await Notification.countDocuments({
      recipient: req.user.id,
      recipientType: req.user.type,
      expiresAt: { $gt: new Date() },
      archived: false,
      ...filters
    });

    res.json({
      notifications: filteredNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/archive', authenticateUser, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id,
        recipientType: req.user.type
      },
      { archived: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification archived' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/bulk/archive', authenticateUser, async (req, res) => {
  try {
    const { notificationIds } = req.body;

    await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        recipient: req.user.id,
        recipientType: req.user.type
      },
      { archived: true }
    );

    res.json({ message: `${notificationIds.length} notifications archived` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const baseQuery = {
      recipient: req.user.id,
      recipientType: req.user.type,
      expiresAt: { $gt: new Date() },
      archived: false
    };

    const [
      totalCount,
      unreadCount,
      urgentCount,
      todayCount
    ] = await Promise.all([
      Notification.countDocuments(baseQuery),
      Notification.countDocuments({ ...baseQuery, isRead: false }),
      Notification.countDocuments({ ...baseQuery, priority: 'urgent', isRead: false }),
      Notification.countDocuments({
        ...baseQuery,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    const categoryStats = await Notification.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      total: totalCount,
      unread: unreadCount,
      urgent: urgentCount,
      today: todayCount,
      categories: categoryStats.reduce((acc, stat) => {
        acc[stat._id] = { total: stat.total, unread: stat.unread };
        return acc;
      }, {})
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/trigger', auth, async (req, res) => {
  try {
    const notification = await NotificationTriggerService.triggerCustomNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/test', authenticateUser, async (req, res) => {
  try {
    const testNotification = await Notification.createNotification({
      recipient: req.user.id,
      recipientType: req.user.type,
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification to verify your notification settings are working correctly.',
      priority: 'low',
      category: 'system'
    });

    res.json({
      message: 'Test notification sent',
      notification: testNotification
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analytics', authenticateUser, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const analytics = await NotificationAnalyticsService.getNotificationAnalytics(
      req.user.id,
      req.user.type,
      timeframe
    );
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analytics/system', auth, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const analytics = await NotificationAnalyticsService.getSystemAnalytics(timeframe);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analytics/performance', authenticateUser, async (req, res) => {
  try {
    const { category, type, startDate, endDate } = req.query;

    const query = {
      recipient: req.user.id,
      recipientType: req.user.type
    };

    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (category) query.category = category;
    if (type) query.type = type;

    const notifications = await Notification.find(query).sort({ createdAt: -1 });

    const performance = {
      total: notifications.length,
      read: notifications.filter(n => n.isRead).length,
      unread: notifications.filter(n => !n.isRead).length,
      averageResponseTime: 0,
      topTypes: {},
      categoryBreakdown: {}
    };

    const responseTimes = notifications
      .filter(n => n.isRead && n.updatedAt && n.createdAt)
      .map(n => n.updatedAt - n.createdAt);

    if (responseTimes.length > 0) {
      performance.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    notifications.forEach(n => {
      performance.topTypes[n.type] = (performance.topTypes[n.type] || 0) + 1;
      performance.categoryBreakdown[n.category] = (performance.categoryBreakdown[n.category] || 0) + 1;
    });

    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/export', authenticateUser, async (req, res) => {
  try {
    const { format = 'json', startDate, endDate, category, type } = req.query;

    const query = {
      recipient: req.user.id,
      recipientType: req.user.type
    };

    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (category) query.category = category;
    if (type) query.type = type;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .select('-__v');

    if (format === 'csv') {
      const csvData = convertToCSV(notifications);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="notifications.csv"');
      res.send(csvData);
    } else {
      res.json(notifications);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function convertToCSV(notifications) {
  if (notifications.length === 0) return '';

  const headers = ['Type', 'Title', 'Message', 'Category', 'Priority', 'Is Read', 'Created At'];
  const rows = notifications.map(n => [
    n.type,
    n.title,
    n.message,
    n.category,
    n.priority,
    n.isRead ? 'Yes' : 'No',
    n.createdAt.toISOString()
  ]);

  return [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
}

module.exports = router;