const mongoose = require('mongoose');

const FamilyMemberSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  
  // Life Details
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value <= new Date();
      },
      message: 'Birth date cannot be in the future'
    }
  },
  placeOfBirth: {
    type: String,
    trim: true,
    maxLength: 200
  },
  dateOfDeath: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || !this.dateOfBirth || value > this.dateOfBirth;
      },
      message: 'Death date must be after birth date'
    }
  },
  burialPlace: {
    type: String,
    trim: true,
    maxLength: 200
  },
  isAlive: {
    type: Boolean,
    default: true
  },
  currentLocation: {
    type: String,
    trim: true,
    maxLength: 200
  },
  profession: {
    type: String,
    trim: true,
    maxLength: 200
  },
  
  // Biography and Story
  bio: {
    type: String,
    trim: true,
    maxLength: 5000
  },
  achievements: [{
    type: String,
    trim: true,
    maxLength: 500
  }],
  
  // Media
  photo: {
    type: String,
    trim: true
  },
  photos: [{
    type: String,
    trim: true
  }],
  
  // Family Relationships
  parents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember'
  }],
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember'
  }],
  siblings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember'
  }],
  spouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember'
  },
  
  // Tree Structure
  generation: {
    type: Number,
    required: true,
    min: 0
  },
  familyTreeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyTree',
    required: true
  },
  
  // User Association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  isCurrentUser: {
    type: Boolean,
    default: false
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  
  // AI Matching
  isAIMatched: {
    type: Boolean,
    default: false
  },
  matchConfidence: {
    type: Number,
    min: 0,
    max: 100
  },
  aiMatchingData: {
    sources: [String],
    matchedRecords: [String],
    lastMatched: Date
  },
  
  // Privacy and Permissions
  isPrivate: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permissions: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view'
    }
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
FamilyMemberSchema.index({ userId: 1, familyTreeId: 1 });
FamilyMemberSchema.index({ familyTreeId: 1, generation: 1 });
FamilyMemberSchema.index({ isCurrentUser: 1 });
FamilyMemberSchema.index({ createdBy: 1 });

// Virtual for full name
FamilyMemberSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age calculation
FamilyMemberSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const endDate = this.dateOfDeath || new Date();
  const diffTime = Math.abs(endDate - this.dateOfBirth);
  const age = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
  
  return age;
});

// Pre-save middleware to update name field
FamilyMemberSchema.pre('save', function(next) {
  if (this.firstName && this.lastName) {
    this.name = `${this.firstName} ${this.lastName}`.trim();
  }
  
  // Update isAlive based on dateOfDeath
  if (this.dateOfDeath) {
    this.isAlive = false;
  }
  
  next();
});

// Static method to get family tree statistics
FamilyMemberSchema.statics.getTreeStats = async function(familyTreeId) {
  const members = await this.find({ familyTreeId });
  
  if (members.length === 0) return null;
  
  const generations = Math.max(...members.map(m => m.generation)) - Math.min(...members.map(m => m.generation)) + 1;
  const aiMatched = members.filter(m => m.isAIMatched).length;
  const withPhotos = members.filter(m => m.photo).length;
  const withBios = members.filter(m => m.bio).length;
  
  return {
    totalMembers: members.length,
    generations,
    aiMatched,
    withPhotos,
    withBios,
    completeness: Math.round((withBios + withPhotos) / (members.length * 2) * 100)
  };
};

// Method to get family relationships
FamilyMemberSchema.methods.getRelationships = async function() {
  await this.populate([
    { path: 'parents', select: 'name photo isAlive' },
    { path: 'children', select: 'name photo isAlive' },
    { path: 'siblings', select: 'name photo isAlive' },
    { path: 'spouse', select: 'name photo isAlive' }
  ]);
  
  return {
    parents: this.parents || [],
    children: this.children || [],
    siblings: this.siblings || [],
    spouse: this.spouse
  };
};

module.exports = mongoose.model('FamilyMember', FamilyMemberSchema);