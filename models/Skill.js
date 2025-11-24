const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'programming_languages',
      'frameworks_libraries',
      'databases',
      'devops_cloud',
      'tools_platforms',
      'soft_skills',
      'domain_expertise',
      'design',
      'mobile',
      'data_science',
      'security',
      'testing',
      'other'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },

  description: {
    type: String,
    trim: true
  },
  aliases: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  popularity: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  demand: {
    type: String,
    enum: ['low', 'medium', 'high', 'very_high'],
    default: 'medium'
  },

  relatedSkills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  prerequisiteSkills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill'
  }],

  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },

  isActive: {
    type: Boolean,
    default: true
  },
  verified: {
    type: Boolean,
    default: false
  },

  searchTerms: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, {
  timestamps: true
});

skillSchema.index({ name: 1 });
skillSchema.index({ category: 1 });
skillSchema.index({ displayName: 1 });
skillSchema.index({ aliases: 1 });
skillSchema.index({ popularity: -1 });
skillSchema.index({ usageCount: -1 });

skillSchema.virtual('searchText').get(function() {
  return [
    this.name,
    this.displayName,
    ...this.aliases,
    ...this.searchTerms
  ].join(' ').toLowerCase();
});

skillSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

skillSchema.methods.getRelatedSkills = async function(limit = 5) {
  return await mongoose.model('Skill').find({
    _id: { $in: this.relatedSkills },
    isActive: true
  }).limit(limit);
};

skillSchema.statics.searchSkills = function(query, category = null, limit = 20) {
  const searchRegex = new RegExp(query, 'i');
  const searchQuery = {
    isActive: true,
    $or: [
      { name: searchRegex },
      { displayName: searchRegex },
      { aliases: searchRegex },
      { searchTerms: searchRegex }
    ]
  };

  if (category) {
    searchQuery.category = category;
  }

  return this.find(searchQuery)
    .sort({ popularity: -1, usageCount: -1 })
    .limit(limit);
};

skillSchema.statics.getPopularSkills = function(category = null, limit = 10) {
  const query = { isActive: true };
  if (category) {
    query.category = category;
  }

  return this.find(query)
    .sort({ popularity: -1, usageCount: -1 })
    .limit(limit);
};

skillSchema.statics.getSkillsByCategory = function(category, limit = 50) {
  return this.find({ category, isActive: true })
    .sort({ popularity: -1, displayName: 1 })
    .limit(limit);
};

module.exports = mongoose.model('Skill', skillSchema);