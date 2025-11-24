const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: false,
  },
  description: {
    type: String,
    required: true,
  },
  requiredSkills: [String],
  niceToHaveSkills: [String],
  experience: Number,
  location: String,
  salaryMin: Number,
  salaryMax: Number,
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
  jobType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'freelance', 'internship'],
    default: 'full-time'
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'mid', 'senior', 'executive', 'not-specified'],
    default: 'not-specified'
  },
  industry: String,
  remote: {
    type: Boolean,
    default: false
  },
  companyDescription: String,
  companySize: String,
  status: {
    type: String,
    enum: ['open', 'closed', 'draft'],
    default: 'open'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  aiAnalysis: {
    biasScore: Number,
    genderNeutral: Boolean,
    inclusiveLanguage: Boolean,
    skillSpecificity: Number
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Job', jobSchema);