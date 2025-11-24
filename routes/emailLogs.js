const express = require('express');
const EmailLog = require('../models/EmailLog');
const auth = require('../middleware/auth');

const router = express.Router();

// Get email logs with filtering
router.get('/logs', auth, async (req, res) => {
  try {
    const { status, emailType, limit = 50, page = 1 } = req.query;

    let query = {};

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by email type
    if (emailType && emailType !== 'all') {
      query.emailType = emailType;
    }

    // Get logs with pagination
    const logs = await EmailLog.find(query)
      .populate('applicationId', 'status')
      .populate('candidateId', 'name email')
      .populate('jobId', 'title')
      .sort({ sentAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get stats
    const stats = await EmailLog.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      logs,
      stats: stats[0] || { total: 0, sent: 0, failed: 0, pending: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await EmailLog.countDocuments(query)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get email statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await EmailLog.aggregate([
      {
        $match: {
          sentAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          bounced: { $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] } },
          complained: { $sum: { $cond: [{ $eq: ['$status', 'complained'] }, 1, 0] } }
        }
      }
    ]);

    // Get email type breakdown
    const typeBreakdown = await EmailLog.aggregate([
      {
        $match: {
          sentAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$emailType',
          count: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      overview: stats[0] || { total: 0, sent: 0, failed: 0, pending: 0, bounced: 0, complained: 0 },
      typeBreakdown,
      period: { days, startDate }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific email log details
router.get('/:id', auth, async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id)
      .populate('applicationId')
      .populate('candidateId', 'name email')
      .populate('jobId', 'title company');

    if (!log) {
      return res.status(404).json({ message: 'Email log not found' });
    }

    res.json(log);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resend failed email
router.post('/:id/resend', auth, async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ message: 'Email log not found' });
    }

    if (log.status === 'sent') {
      return res.status(400).json({ message: 'Email was already sent successfully' });
    }

    // Import EmailService here to avoid circular dependencies
    const EmailService = require('../services/EmailService');
    const emailService = new EmailService();

    // Get application and related data
    const Application = require('../models/JobApplication');
    const application = await Application.findById(log.applicationId)
      .populate('candidateId')
      .populate('jobId');

    if (!application) {
      return res.status(404).json({ message: 'Related application not found' });
    }

    // Attempt to resend
    const success = await emailService.sendStatusEmail(
      application.candidateId,
      application.jobId,
      application.status, // Use current status as old status
      log.emailType,
      log.applicationId
    );

    if (success) {
      // Update the log status
      log.status = 'sent';
      log.sentAt = new Date();
      log.retryCount += 1;
      await log.save();

      res.json({ message: 'Email resent successfully', log });
    } else {
      log.retryCount += 1;
      await log.save();

      res.status(500).json({ message: 'Failed to resend email' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk operations on email logs
router.post('/bulk', auth, async (req, res) => {
  try {
    const { operation, logIds } = req.body;

    if (!logIds || !Array.isArray(logIds)) {
      return res.status(400).json({ message: 'logIds array is required' });
    }

    let result;

    switch (operation) {
      case 'delete':
        result = await EmailLog.deleteMany({ _id: { $in: logIds } });
        break;

      case 'mark_sent':
        result = await EmailLog.updateMany(
          { _id: { $in: logIds }, status: { $ne: 'sent' } },
          { status: 'sent', sentAt: new Date() }
        );
        break;

      default:
        return res.status(400).json({ message: 'Invalid operation' });
    }

    res.json({
      message: `Bulk ${operation} completed`,
      modifiedCount: result.modifiedCount || result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;