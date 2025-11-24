const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CandidateProfile',
    required: true
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  status: {
    type: String,
    enum: ['submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'],
    default: 'submitted'
  },

  applicationData: {
    coverLetter: String,
    expectedSalary: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'USD'
      }
    },
    availability: {
      type: String,
      enum: ['immediately', '2_weeks', '1_month', '3_months', 'negotiable'],
      default: 'negotiable'
    },
    customQuestions: [{
      question: String,
      answer: String
    }]
  },

  aiAnalysis: {
    matchScore: {
      type: Number,
      min: 0,
      max: 100
    },
    technicalMatch: Number,
    experienceFit: Number,
    culturalFit: Number,
    successProbability: Number,
    skillBreakdown: [{
      skill: String,
      candidateProficiency: String,
      jobRequirement: String,
      match: Boolean
    }],
    strengths: [String],
    concerns: [String],
    recommendations: [String]
  },

  timeline: [{
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  interviews: [{
    type: {
      type: String,
      enum: ['phone_screen', 'technical', 'behavioral', 'final', 'panel'],
      required: true
    },
    scheduledDate: Date,
    duration: Number, // minutes
    interviewers: [{
      name: String,
      role: String,
      email: String
    }],
    location: {
      type: {
        type: String,
        enum: ['onsite', 'virtual', 'phone']
      },
      details: String // meeting link, address, etc.
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
      default: 'scheduled'
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      strengths: [String],
      concerns: [String],
      recommendation: {
        type: String,
        enum: ['strong_hire', 'hire', 'maybe', 'no_hire']
      },
      notes: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  communications: [{
    type: {
      type: String,
      enum: ['email', 'phone', 'message', 'note'],
      required: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    subject: String,
    content: String,
    attachments: [{
      filename: String,
      url: String
    }],
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],

  offer: {
    salary: {
      amount: Number,
      currency: {
        type: String,
        default: 'USD'
      },
      period: {
        type: String,
        enum: ['hourly', 'monthly', 'yearly'],
        default: 'yearly'
      }
    },
    benefits: [String],
    startDate: Date,
    status: {
      type: String,
      enum: ['extended', 'accepted', 'declined', 'negotiating'],
      default: 'extended'
    },
    responseDeadline: Date,
    notes: String
  },

  closureReason: {
    type: {
      type: String,
      enum: ['hired_elsewhere', 'not_interested', 'better_offer', 'timing', 'skills_mismatch', 'experience_mismatch', 'cultural_fit', 'other']
    },
    details: String,
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    closedAt: {
      type: Date,
      default: Date.now
    }
  },

  source: {
    type: String,
    enum: ['direct', 'referral', 'job_board', 'social_media', 'agency', 'internal'],
    default: 'direct'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [String],

  timeToReview: Number, // hours from submission to first review
  timeToDecision: Number, // hours from submission to final decision
  candidateEngagement: {
    lastActivity: Date,
    responseRate: Number, // percentage of communications responded to
    interviewShowRate: Number // percentage of interviews attended
  }
}, {
  timestamps: true
});

jobApplicationSchema.index({ job: 1, candidate: 1 }, { unique: true }); // Prevent duplicate applications
jobApplicationSchema.index({ status: 1 });
jobApplicationSchema.index({ 'aiAnalysis.matchScore': -1 });
jobApplicationSchema.index({ createdAt: -1 });
jobApplicationSchema.index({ recruiter: 1 });

jobApplicationSchema.virtual('daysSinceApplication').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

jobApplicationSchema.methods.updateTimeline = function(newStatus, notes = '', updatedBy = null) {
  this.timeline.push({
    status: newStatus,
    notes,
    updatedBy
  });
  this.status = newStatus;
};

jobApplicationSchema.methods.calculateEngagement = function() {
  const totalCommunications = this.communications.length;
  const responses = this.communications.filter(comm => comm.direction === 'inbound').length;
  this.candidateEngagement.responseRate = totalCommunications > 0 ? (responses / totalCommunications) * 100 : 0;

  const scheduledInterviews = this.interviews.length;
  const attendedInterviews = this.interviews.filter(int => int.status === 'completed').length;
  this.candidateEngagement.interviewShowRate = scheduledInterviews > 0 ? (attendedInterviews / scheduledInterviews) * 100 : 0;

  this.candidateEngagement.lastActivity = this.updatedAt;
};

jobApplicationSchema.pre('save', function(next) {
  // Update timeline if status changed
  if (this.isModified('status') && this.timeline.length === 0) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  // Calculate engagement metrics
  this.calculateEngagement();

  next();
});

module.exports = mongoose.model('JobApplication', jobApplicationSchema);