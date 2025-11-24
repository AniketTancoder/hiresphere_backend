const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobApplication',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  emailType: {
    type: String,
    enum: ['shortlisted', 'rejected', 'selected', 'interview_invitation', 'offer_followup', 'rejection_followup'],
    required: true
  },
  recipient: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending', 'bounced', 'complained'],
    default: 'pending',
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: {
    type: Date
  },
  openedAt: {
    type: Date
  },
  clickedAt: {
    type: Date
  },
  errorMessage: {
    type: String,
    trim: true
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  emailProvider: {
    type: String,
    default: 'gmail'
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    templateVersion: String,
    campaignId: String
  },
  engagement: {
    opened: {
      type: Boolean,
      default: false
    },
    clicked: {
      type: Boolean,
      default: false
    },
    unsubscribed: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
emailLogSchema.index({ applicationId: 1 });
emailLogSchema.index({ candidateId: 1 });
emailLogSchema.index({ jobId: 1 });
emailLogSchema.index({ emailType: 1 });
emailLogSchema.index({ status: 1 });
emailLogSchema.index({ sentAt: -1 });
emailLogSchema.index({ recipient: 1 });

// Virtual for delivery time
emailLogSchema.virtual('deliveryTime').get(function() {
  if (this.deliveredAt && this.sentAt) {
    return this.deliveredAt - this.sentAt;
  }
  return null;
});

// Method to mark as delivered
emailLogSchema.methods.markDelivered = function() {
  this.status = 'sent';
  this.deliveredAt = new Date();
  return this.save();
};

// Method to mark as opened
emailLogSchema.methods.markOpened = function() {
  this.engagement.opened = true;
  this.openedAt = new Date();
  return this.save();
};

// Method to mark as clicked
emailLogSchema.methods.markClicked = function() {
  this.engagement.clicked = true;
  this.clickedAt = new Date();
  return this.save();
};

// Method to record failure
emailLogSchema.methods.recordFailure = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  return this.save();
};

// Static method to get email statistics
emailLogSchema.statics.getEmailStats = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        sentAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalSent: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        opened: { $sum: { $cond: ['$engagement.opened', 1, 0] } },
        clicked: { $sum: { $cond: ['$engagement.clicked', 1, 0] } }
      }
    }
  ]);
};

// Static method to get emails by type
emailLogSchema.statics.getEmailsByType = function(emailType, limit = 50) {
  return this.find({ emailType })
    .sort({ sentAt: -1 })
    .limit(limit)
    .populate('applicationId', 'status')
    .populate('candidateId', 'name email')
    .populate('jobId', 'title');
};

// Static method to get recent failed emails
emailLogSchema.statics.getFailedEmails = function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    status: 'failed',
    sentAt: { $gte: since }
  })
  .sort({ sentAt: -1 })
  .populate('applicationId', 'status')
  .populate('candidateId', 'name email')
  .populate('jobId', 'title');
};

module.exports = mongoose.model('EmailLog', emailLogSchema);