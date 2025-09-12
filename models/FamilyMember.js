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
    required: false,
    trim: true,
    maxLength: 100,
    default: ''
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
  
  // AI Matching & Discovery
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
    lastMatched: Date,
    potentialMatches: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      confidence: Number,
      matchingFields: [String],
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'verified'],
        default: 'pending'
      },
      discoveredAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Ownership & Collaboration
  claimedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    claimedAt: {
      type: Date,
      default: Date.now
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'disputed'],
      default: 'unverified'
    },
    relationship: {
      type: String,
      enum: ['self', 'parent', 'child', 'sibling', 'spouse', 'relative', 'other'],
      required: true
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    evidence: {
      type: String,
      trim: true,
      maxLength: 1000
    }
  }],
  primaryClaimer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Privacy and Permissions
  isPrivate: {
    type: Boolean,
    default: false
  },
  visibility: {
    type: String,
    enum: ['public', 'family_only', 'claimers_only', 'private'],
    default: 'family_only'
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
  if (this.firstName) {
    // Construct name with optional lastName
    this.name = this.lastName ? 
      `${this.firstName} ${this.lastName}`.trim() : 
      this.firstName.trim();
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

// Method to check if user can claim this family member
FamilyMemberSchema.methods.canBeClaimed = function(userId) {
  // Check if already claimed by this user
  const existingClaim = this.claimedBy.find(claim => claim.userId.equals(userId));
  if (existingClaim) {
    return { canClaim: false, reason: 'already_claimed', claim: existingClaim };
  }
  
  // Check if member is already claimed and verified by someone else
  const verifiedClaim = this.claimedBy.find(claim => claim.verificationStatus === 'verified');
  if (verifiedClaim && verifiedClaim.relationship === 'self') {
    return { canClaim: false, reason: 'verified_by_another', claim: verifiedClaim };
  }
  
  return { canClaim: true };
};

// Method to add a claim
FamilyMemberSchema.methods.addClaim = function(userId, relationship, canEdit = false) {
  const claimCheck = this.canBeClaimed(userId);
  if (!claimCheck.canClaim) {
    throw new Error(`Cannot claim: ${claimCheck.reason}`);
  }
  
  const newClaim = {
    userId,
    relationship,
    canEdit,
    claimedAt: new Date(),
    verificationStatus: 'unverified'
  };
  
  this.claimedBy.push(newClaim);
  
  // If this is a self-claim and no primary claimer exists, make this the primary
  if (relationship === 'self' && !this.primaryClaimer) {
    this.primaryClaimer = userId;
    newClaim.canEdit = true;
    newClaim.verificationStatus = 'verified';
  }
  
  return newClaim;
};

// Method to check user permissions
FamilyMemberSchema.methods.getUserPermissions = function(userId) {
  // Check if user created this member
  if (this.createdBy && this.createdBy.equals(userId)) {
    return { canView: true, canEdit: true, role: 'creator' };
  }
  
  // Check if user is primary claimer
  if (this.primaryClaimer && this.primaryClaimer.equals(userId)) {
    return { canView: true, canEdit: true, role: 'primary_claimer' };
  }
  
  // Check if user has claimed this member
  const userClaim = this.claimedBy.find(claim => claim.userId.equals(userId));
  if (userClaim) {
    return {
      canView: true,
      canEdit: userClaim.canEdit,
      role: 'claimer',
      relationship: userClaim.relationship,
      verificationStatus: userClaim.verificationStatus
    };
  }
  
  // Check sharing permissions
  const sharedAccess = this.sharedWith.find(share => share.userId.equals(userId));
  if (sharedAccess) {
    return {
      canView: true,
      canEdit: sharedAccess.permissions === 'edit',
      role: 'shared'
    };
  }
  
  // Check visibility settings
  if (this.visibility === 'public') {
    return { canView: true, canEdit: false, role: 'public' };
  }
  
  return { canView: false, canEdit: false, role: 'none' };
};

// Static method to find potential matches for a user
FamilyMemberSchema.statics.findPotentialMatches = async function(userData) {
  const query = [];
  
  // Match by name similarity
  if (userData.firstName) {
    query.push({
      $or: [
        { firstName: new RegExp(userData.firstName, 'i') },
        { name: new RegExp(userData.firstName, 'i') }
      ]
    });
  }
  
  // Match by date of birth
  if (userData.dateOfBirth) {
    const birthDate = new Date(userData.dateOfBirth);
    const yearStart = new Date(birthDate.getFullYear(), 0, 1);
    const yearEnd = new Date(birthDate.getFullYear() + 1, 0, 1);
    
    query.push({
      dateOfBirth: {
        $gte: yearStart,
        $lt: yearEnd
      }
    });
  }
  
  // Match by location
  if (userData.placeOfBirth) {
    query.push({
      $or: [
        { placeOfBirth: new RegExp(userData.placeOfBirth, 'i') },
        { currentLocation: new RegExp(userData.placeOfBirth, 'i') }
      ]
    });
  }
  
  if (query.length === 0) return [];
  
  return this.find({
    $and: [
      { $or: query },
      { visibility: { $in: ['public', 'family_only'] } }
    ]
  }).populate('familyTreeId', 'name familySurname')
    .populate('claimedBy.userId', 'name profileImage')
    .sort({ matchConfidence: -1 });
};

module.exports = mongoose.model('FamilyMember', FamilyMemberSchema);