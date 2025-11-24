const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: String,
  resumeText: {
    type: String,
    default: '',
  },
  skills: [String],
  experience: Number,
  education: String,
  currentCompany: String,
  resumeFile: String,
  aiAnalysis: {
    matchScore: Number,
    skillBreakdown: [{
      skill: String,
      relevance: Number,
      experience: Number
    }],
    biasScore: Number,
    strengths: [String],
    improvements: [String]
  },
  status: {
    type: String,
    enum: ['new', 'screening', 'interview', 'offer', 'hired'],
    default: 'new'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Candidate', candidateSchema);