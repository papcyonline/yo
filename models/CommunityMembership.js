const mongoose = require('mongoose');

const CommunityMembershipSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  community_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },
  
  // Member role in community
  role: {
    type: String,
    enum: ['member', 'moderator', 'admin', 'creator'],
    default: 'member'
  },
  
  // Join status
  status: {
    type: String,
    enum: ['active', 'pending', 'banned', 'left'],
    default: 'active'
  },
  
  // Timestamps
  joined_at: {
    type: Date,
    default: Date.now
  },
  invited_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Family tree specific data
  family_member_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember'
  },
  family_relationship: {
    type: String,
    enum: ['self', 'parent', 'child', 'sibling', 'spouse', 'grandparent', 'grandchild', 'relative', 'other']
  },
  
  // Permissions
  can_invite_members: {
    type: Boolean,
    default: false
  },
  can_moderate_posts: {
    type: Boolean,
    default: false
  },
  
  // Notification preferences
  notifications: {
    new_messages: {
      type: Boolean,
      default: true
    },
    member_joins: {
      type: Boolean,
      default: true
    },
    family_updates: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Compound index to ensure unique membership per user per community
CommunityMembershipSchema.index({ user_id: 1, community_id: 1 }, { unique: true });

// Index for efficient queries
CommunityMembershipSchema.index({ community_id: 1, role: 1 });
CommunityMembershipSchema.index({ user_id: 1, joined_at: -1 });

// Static method to add member to family tree community
CommunityMembershipSchema.statics.addFamilyMember = async function(communityId, userId, familyMemberId, relationship, invitedBy) {
  try {
    const membership = await this.create({
      user_id: userId,
      community_id: communityId,
      role: 'member',
      status: 'active',
      family_member_id: familyMemberId,
      family_relationship: relationship,
      invited_by: invitedBy,
      can_invite_members: false,
      notifications: {
        new_messages: true,
        member_joins: true,
        family_updates: true
      }
    });
    
    // Update community member count
    await mongoose.model('Community').findByIdAndUpdate(
      communityId,
      { $inc: { member_count: 1 } }
    );
    
    return membership;
  } catch (error) {
    // If membership already exists, update it
    if (error.code === 11000) {
      return await this.findOneAndUpdate(
        { user_id: userId, community_id: communityId },
        { 
          status: 'active',
          family_member_id: familyMemberId,
          family_relationship: relationship
        },
        { new: true }
      );
    }
    throw error;
  }
};

// Method to check if user has permission
CommunityMembershipSchema.methods.hasPermission = function(permission) {
  switch (permission) {
    case 'invite_members':
      return this.can_invite_members || this.role === 'admin' || this.role === 'moderator';
    case 'moderate_posts':
      return this.can_moderate_posts || this.role === 'admin' || this.role === 'moderator';
    case 'admin':
      return this.role === 'admin';
    default:
      return false;
  }
};

// Pre-save middleware to update community stats
CommunityMembershipSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Update last activity for community
    await mongoose.model('Community').findByIdAndUpdate(
      this.community_id,
      { last_activity: new Date() }
    );
  }
  next();
});

// Pre-remove middleware to update community member count
CommunityMembershipSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  await mongoose.model('Community').findByIdAndUpdate(
    this.community_id,
    { $inc: { member_count: -1 } }
  );
  next();
});

module.exports = mongoose.model('CommunityMembership', CommunityMembershipSchema);