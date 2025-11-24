const mongoose = require('mongoose');

const candidateProfileSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },

  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  location: {
    city: String,
    state: String,
    country: String,
    remote: {
      type: Boolean,
      default: false
    }
  },

  currentTitle: {
    type: String,
    trim: true
  },
  currentCompany: {
    type: String,
    trim: true
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    max: 50
  },
  desiredSalary: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },

  skills: [{
    skill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill'
    },
    proficiency: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0
    }
  }],

  education: [{
    degree: {
      type: String,
      required: true,
      trim: true
    },
    institution: {
      type: String,
      required: true,
      trim: true
    },
    fieldOfStudy: {
      type: String,
      trim: true
    },
    graduationYear: {
      type: Number,
      min: 1950,
      max: new Date().getFullYear() + 10
    },
    gpa: {
      type: Number,
      min: 0,
      max: 4.0
    }
  }],

  experience: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    company: {
      type: String,
      required: true,
      trim: true
    },
    location: String,
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date,
    current: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      trim: true
    },
    achievements: [String]
  }],

  resume: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },

  profileVisibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  openToOpportunities: {
    type: Boolean,
    default: true
  },
  preferredJobTypes: [{
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship']
  }],
  preferredLocations: [String],
  willingToRelocate: {
    type: Boolean,
    default: false
  },

  profileCompleteness: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  },

  applicationsCount: {
    type: Number,
    default: 0
  },
  lastApplicationDate: Date,

  emailNotifications: {
    applications: { type: Boolean, default: true },
    jobMatches: { type: Boolean, default: true },
    profileViews: { type: Boolean, default: false },
    newsletters: { type: Boolean, default: true }
  },

  aiAnalysis: {
    matchScore: Number,
    technicalMatch: Number,
    experienceFit: Number,
    culturalFit: Number,
    successProbability: Number,
    skillBreakdown: [{
      skill: String,
      relevance: Number,
      experience: Number
    }],
    biasScore: Number,
    strengths: [String],
    improvements: [String],
    insights: {
      overQualified: Boolean,
      underQualified: Boolean,
      skillGap: Number,
      recommendedAction: String,
      riskFactors: [String]
    }
  },

  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date
}, {
  timestamps: true
});

candidateProfileSchema.index({ email: 1 });
candidateProfileSchema.index({ 'skills.skill': 1 });
candidateProfileSchema.index({ location: 1 });
candidateProfileSchema.index({ currentTitle: 1 });
candidateProfileSchema.index({ lastActive: -1 });

candidateProfileSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

candidateProfileSchema.methods.calculateProfileCompleteness = function() {
  let completeness = 0;
  const totalFields = 15;

  if (this.firstName && this.lastName) completeness += 5;
  if (this.email) completeness += 5;
  if (this.phone) completeness += 5;
  if (this.location && (this.location.city || this.location.remote)) completeness += 5;

  if (this.currentTitle) completeness += 5;
  if (this.yearsOfExperience !== undefined) completeness += 5;
  if (this.skills && this.skills.length > 0) completeness += 10;
  if (this.resume && this.resume.filename) completeness += 5;

  if (this.education && this.education.length > 0) completeness += 10;
  if (this.experience && this.experience.length > 0) completeness += 15;

  if (this.preferredJobTypes && this.preferredJobTypes.length > 0) completeness += 5;
  if (this.preferredLocations && this.preferredLocations.length > 0) completeness += 5;
  if (this.desiredSalary && (this.desiredSalary.min || this.desiredSalary.max)) completeness += 5;

  if (this.openToOpportunities !== undefined) completeness += 5;
  if (this.willingToRelocate !== undefined) completeness += 5;
  if (this.profileVisibility) completeness += 5;

  this.profileCompleteness = Math.min(100, Math.round((completeness / 100) * 100));
  return this.profileCompleteness;
};

candidateProfileSchema.pre('save', function(next) {
  this.calculateProfileCompleteness();
  this.lastActive = new Date();
  next();
});

module.exports = mongoose.model('CandidateProfile', candidateProfileSchema);