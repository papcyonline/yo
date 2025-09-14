const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  answer: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'account', 'privacy', 'features', 'support', 'family', 'safety', 'security', 'billing', 'technical'],
    lowercase: true
  },
  order_index: {
    type: Number,
    default: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  views_count: {
    type: Number,
    default: 0
  },
  helpful_votes: {
    type: Number,
    default: 0
  },
  not_helpful_votes: {
    type: Number,
    default: 0
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow system-created FAQs
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true
});

// Indexes for performance
faqSchema.index({ category: 1, is_active: 1, order_index: 1 });
faqSchema.index({ is_active: 1, order_index: 1 });
faqSchema.index({
  question: 'text',
  answer: 'text',
  tags: 'text'
}, {
  weights: {
    question: 10,
    answer: 5,
    tags: 3
  }
});

// Static methods
faqSchema.statics.getFAQsByCategory = async function(category, isActive = true) {
  return this.find({
    category: category.toLowerCase(),
    is_active: isActive
  }).sort({ order_index: 1, createdAt: 1 });
};

faqSchema.statics.getAllActiveFAQs = async function() {
  return this.find({
    is_active: true
  }).sort({ category: 1, order_index: 1, createdAt: 1 });
};

faqSchema.statics.searchFAQs = async function(searchTerm) {
  return this.find({
    $text: { $search: searchTerm },
    is_active: true
  }, {
    score: { $meta: 'textScore' }
  }).sort({
    score: { $meta: 'textScore' }
  });
};

// Instance methods
faqSchema.methods.incrementViews = async function() {
  this.views_count += 1;
  return this.save();
};

faqSchema.methods.voteHelpful = async function(isHelpful) {
  if (isHelpful) {
    this.helpful_votes += 1;
  } else {
    this.not_helpful_votes += 1;
  }
  return this.save();
};

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;