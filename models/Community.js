const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxLength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['Family', 'Heritage', 'Location', 'Surname', 'DNA Research', 'General'],
    default: 'Family'
  },
  
  // Community Type - Family Tree communities are auto-created
  type: {
    type: String,
    enum: ['regular', 'family_tree'],
    default: 'regular'
  },
  
  // Link to family tree if this is a family tree community
  familyTreeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyTree',
    index: true
  },
  
  // Community settings
  is_private: {
    type: Boolean,
    default: false
  },
  require_approval: {
    type: Boolean,
    default: false
  },
  
  // Creator and admin info
  creator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Member stats
  member_count: {
    type: Number,
    default: 0
  },
  
  // Media
  avatar_url: {
    type: String,
    trim: true
  },
  cover_image_url: {
    type: String,
    trim: true
  },
  
  // Location info
  location: {
    country: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Community rules
  rules: [{
    type: String,
    maxLength: 200
  }],
  
  // Tags for discovery
  tags: [{
    type: String,
    trim: true,
    maxLength: 50
  }],
  
  // Activity tracking
  last_activity: {
    type: Date,
    default: Date.now
  },
  
  // Family tree specific settings
  family_settings: {
    auto_invite_family: {
      type: Boolean,
      default: true
    },
    share_tree_updates: {
      type: Boolean,
      default: true
    },
    allow_member_additions: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
CommunitySchema.index({ creator_id: 1 });
CommunitySchema.index({ category: 1, is_private: 1 });
CommunitySchema.index({ familyTreeId: 1 });
CommunitySchema.index({ name: 'text', description: 'text' });

// Virtual for member count (could be calculated from memberships)
CommunitySchema.virtual('actualMemberCount', {
  ref: 'CommunityMembership',
  localField: '_id',
  foreignField: 'community_id',
  count: true
});

// Static method to find or create family tree community
CommunitySchema.statics.findOrCreateFamilyTreeCommunity = async function(familyTreeId, creatorId, familyName) {
  // Check if community already exists for this family tree
  let community = await this.findOne({ 
    familyTreeId: familyTreeId,
    type: 'family_tree' 
  });
  
  if (!community) {
    // Create new family tree community
    community = await this.create({
      name: `${familyName} Family Chat`,
      description: `Family discussion group for the ${familyName} family tree. Share memories, discuss genealogy research, and stay connected with family members.`,
      category: 'Family',
      type: 'family_tree',
      familyTreeId: familyTreeId,
      creator_id: creatorId,
      admins: [creatorId],
      is_private: true,
      require_approval: false,
      rules: [
        'Be respectful to all family members',
        'Share relevant family history and memories',
        'Help with genealogy research when possible',
        'Keep discussions family-friendly'
      ],
      family_settings: {
        auto_invite_family: true,
        share_tree_updates: true,
        allow_member_additions: true
      }
    });
  }
  
  return community;
};

// Method to check if user can join (for family tree communities)
CommunitySchema.methods.canUserJoin = function(userId) {
  // For regular communities, check privacy settings
  if (this.type === 'regular') {
    return !this.is_private || this.require_approval;
  }
  
  // For family tree communities, user must be part of the family tree
  // This would need to be checked against FamilyMember model
  return true; // Simplified for now
};

// Method to get community stats
CommunitySchema.methods.getStats = async function() {
  const CommunityMembership = mongoose.model('CommunityMembership');
  
  const stats = await CommunityMembership.aggregate([
    { $match: { community_id: this._id } },
    {
      $group: {
        _id: null,
        totalMembers: { $sum: 1 },
        admins: {
          $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
        },
        moderators: {
          $sum: { $cond: [{ $eq: ['$role', 'moderator'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || { totalMembers: 0, admins: 0, moderators: 0 };
};

module.exports = mongoose.model('Community', CommunitySchema);