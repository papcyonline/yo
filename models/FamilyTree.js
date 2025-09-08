const mongoose = require('mongoose');

const FamilyTreeSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200,
    default: 'My Family Tree'
  },
  description: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  
  // Owner and Permissions
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: Date
  }],
  
  // Tree Configuration
  rootMember: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember'
  },
  familySurname: {
    type: String,
    trim: true,
    maxLength: 100
  },
  originLocation: {
    type: String,
    trim: true,
    maxLength: 200
  },
  
  // Privacy Settings
  isPublic: {
    type: Boolean,
    default: false
  },
  isSearchable: {
    type: Boolean,
    default: true
  },
  allowCollaboration: {
    type: Boolean,
    default: true
  },
  
  // AI and Research Settings
  enableAIMatching: {
    type: Boolean,
    default: true
  },
  aiResearchSources: [{
    type: String,
    enum: ['ancestry', 'familysearch', 'myheritage', 'geni', 'findmypast']
  }],
  lastAIResearch: Date,
  
  // Statistics (cached for performance)
  stats: {
    totalMembers: {
      type: Number,
      default: 0
    },
    generations: {
      type: Number,
      default: 0
    },
    completeness: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastUpdated: Date
  },
  
  // Tree Layout and Visualization
  layout: {
    type: {
      type: String,
      enum: ['hierarchical', 'radial', 'network'],
      default: 'hierarchical'
    },
    centerNode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyMember'
    },
    customPositions: [{
      memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FamilyMember'
      },
      x: Number,
      y: Number
    }]
  },
  
  // Media and Documentation
  photos: [{
    url: String,
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  documents: [{
    filename: String,
    url: String,
    type: {
      type: String,
      enum: ['certificate', 'document', 'photo', 'record', 'other']
    },
    description: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  },
  tags: [{
    type: String,
    trim: true,
    maxLength: 50
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
FamilyTreeSchema.index({ owner: 1 });
FamilyTreeSchema.index({ 'collaborators.userId': 1 });
FamilyTreeSchema.index({ isPublic: 1, isSearchable: 1 });
FamilyTreeSchema.index({ familySurname: 1 });
FamilyTreeSchema.index({ tags: 1 });

// Virtual for member count
FamilyTreeSchema.virtual('memberCount', {
  ref: 'FamilyMember',
  localField: '_id',
  foreignField: 'familyTreeId',
  count: true
});

// Method to check if user has access to this tree
FamilyTreeSchema.methods.hasAccess = function(userId, requiredRole = 'viewer') {
  // Owner always has access
  if (this.owner.equals(userId)) {
    return { hasAccess: true, role: 'owner' };
  }
  
  // Check collaborators
  const collaborator = this.collaborators.find(c => c.userId.equals(userId));
  if (collaborator) {
    const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
    const userRole = roleHierarchy[collaborator.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];
    
    return {
      hasAccess: userRole >= requiredRoleLevel,
      role: collaborator.role
    };
  }
  
  // Check if public
  if (this.isPublic && requiredRole === 'viewer') {
    return { hasAccess: true, role: 'public' };
  }
  
  return { hasAccess: false, role: null };
};

// Method to update statistics
FamilyTreeSchema.methods.updateStats = async function() {
  const FamilyMember = mongoose.model('FamilyMember');
  const members = await FamilyMember.find({ familyTreeId: this._id });
  
  if (members.length === 0) {
    this.stats = {
      totalMembers: 0,
      generations: 0,
      completeness: 0,
      lastUpdated: new Date()
    };
  } else {
    const generations = Math.max(...members.map(m => m.generation)) - Math.min(...members.map(m => m.generation)) + 1;
    const withPhotos = members.filter(m => m.photo).length;
    const withBios = members.filter(m => m.bio).length;
    const completeness = Math.round((withBios + withPhotos) / (members.length * 2) * 100);
    
    this.stats = {
      totalMembers: members.length,
      generations,
      completeness,
      lastUpdated: new Date()
    };
  }
  
  await this.save();
  return this.stats;
};

// Static method to find trees accessible to a user
FamilyTreeSchema.statics.findAccessible = function(userId, role = 'viewer') {
  return this.find({
    $or: [
      { owner: userId },
      { 'collaborators.userId': userId },
      { isPublic: true }
    ]
  }).populate([
    { path: 'owner', select: 'name profileImage' },
    { path: 'collaborators.userId', select: 'name profileImage' }
  ]);
};

// Method to add collaborator
FamilyTreeSchema.methods.addCollaborator = function(userId, role = 'viewer', invitedBy) {
  // Check if already exists
  const existingIndex = this.collaborators.findIndex(c => c.userId.equals(userId));
  
  if (existingIndex > -1) {
    // Update existing collaborator
    this.collaborators[existingIndex].role = role;
    this.collaborators[existingIndex].invitedBy = invitedBy;
    this.collaborators[existingIndex].invitedAt = new Date();
  } else {
    // Add new collaborator
    this.collaborators.push({
      userId,
      role,
      invitedBy,
      invitedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to remove collaborator
FamilyTreeSchema.methods.removeCollaborator = function(userId) {
  this.collaborators = this.collaborators.filter(c => !c.userId.equals(userId));
  return this.save();
};

module.exports = mongoose.model('FamilyTree', FamilyTreeSchema);