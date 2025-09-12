const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Community = require('../models/Community');
const CommunityMembership = require('../models/CommunityMembership');
const User = require('../models/User');

// Get all communities
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { is_private: false }; // Only show public communities by default
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    // Get communities with creator info
    const communities = await Community.find(query)
      .populate('creator_id', 'first_name last_name profile_picture_url')
      .sort({ last_activity: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();
    
    // Get user memberships for these communities
    const communityIds = communities.map(c => c._id);
    const userMemberships = await CommunityMembership.find({
      user_id: req.user._id,
      community_id: { $in: communityIds }
    }).lean();
    
    // Create a map of community ID to membership for quick lookup
    const membershipMap = new Map();
    userMemberships.forEach(membership => {
      membershipMap.set(membership.community_id.toString(), membership);
    });

    // Transform to frontend format
    const transformedCommunities = communities.map(community => {
      const membership = membershipMap.get(community._id.toString());
      const isCreator = community.creator_id._id.toString() === req.user._id.toString();
      
      return {
        id: community._id.toString(),
        name: community.name,
        description: community.description,
        memberCount: community.member_count || 0,
        category: community.category,
        createdBy: community.creator_id?.first_name + ' ' + community.creator_id?.last_name || 'Unknown',
        posts: 0, // TODO: Calculate from posts collection
        recentActivity: community.last_activity ? new Date(community.last_activity).toLocaleDateString() : 'No recent activity',
        isJoined: !!membership,
        userRole: membership ? membership.role : (isCreator ? 'creator' : 'member'),
        avatar: community.avatar_url,
        coverImage: community.cover_image_url,
        isPrivate: community.is_private,
        isCreatedByUser: isCreator
      };
    });
    
    const total = await Community.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        communities: transformedCommunities,
        count: transformedCommunities.length,
        total: total,
        hasMore: skip + communities.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch communities'
    });
  }
});

// Create new community
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, category, isPrivate } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Community name is required'
      });
    }

    // Create new community in database
    const newCommunity = await Community.create({
      name: name.trim(),
      description: description?.trim() || '',
      category: category || 'General',
      is_private: isPrivate || false,
      creator_id: req.user._id,
      admins: [req.user._id],
      member_count: 1
    });

    // Also create the creator's membership
    await CommunityMembership.create({
      user_id: req.user._id,
      community_id: newCommunity._id,
      role: 'creator',
      joined_at: new Date()
    });

    // Transform to frontend format
    const transformedCommunity = {
      id: newCommunity._id.toString(),
      name: newCommunity.name,
      description: newCommunity.description,
      memberCount: 1,
      category: newCommunity.category,
      createdBy: 'You',
      posts: 0,
      recentActivity: 'Just created',
      isJoined: true,
      userRole: 'creator',
      isCreatedByUser: true
    };

    res.status(201).json({
      success: true,
      data: {
        community: transformedCommunity
      },
      message: 'Community created successfully'
    });
  } catch (error) {
    console.error('Error creating community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create community'
    });
  }
});

// Get community by ID
router.get('/:communityId', authMiddleware, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId)
      .populate('creator_id', 'first_name last_name profile_picture_url')
      .lean();
      
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }
    
    // Check if user is member
    const membership = await CommunityMembership.findOne({
      user_id: req.user._id,
      community_id: community._id
    });
    
    // Transform to frontend format
    const transformedCommunity = {
      id: community._id.toString(),
      name: community.name,
      description: community.description,
      memberCount: community.member_count || 0,
      category: community.category,
      createdBy: community.creator_id?.first_name + ' ' + community.creator_id?.last_name || 'Unknown',
      posts: 0, // TODO: Calculate from posts collection
      recentActivity: community.last_activity ? new Date(community.last_activity).toLocaleDateString() : 'No recent activity',
      isJoined: !!membership,
      userRole: membership?.role || 'member',
      avatar: community.avatar_url,
      coverImage: community.cover_image_url,
      isPrivate: community.is_private,
      isCreatedByUser: community.creator_id._id.toString() === req.user._id.toString()
    };
    
    res.json({
      success: true,
      data: {
        community: transformedCommunity
      }
    });
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch community'
    });
  }
});

// Join community
router.post('/:communityId/join', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id;

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Check if user is already a member
    const existingMembership = await CommunityMembership.findOne({
      user_id: userId,
      community_id: communityId
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        error: 'You are already a member of this community'
      });
    }

    // Create membership
    await CommunityMembership.create({
      user_id: userId,
      community_id: communityId,
      role: 'member',
      status: 'active'
    });

    // Update community member count
    await Community.findByIdAndUpdate(
      communityId,
      { $inc: { member_count: 1 } }
    );

    res.json({
      success: true,
      message: 'Successfully joined community'
    });
  } catch (error) {
    console.error('Error joining community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join community'
    });
  }
});

// Leave community
router.delete('/:communityId/leave', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id;

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Check if user is a member
    const membership = await CommunityMembership.findOne({
      user_id: userId,
      community_id: communityId
    });

    if (!membership) {
      return res.status(400).json({
        success: false,
        error: 'You are not a member of this community'
      });
    }

    // Prevent creator from leaving their own community
    if (membership.role === 'creator') {
      return res.status(400).json({
        success: false,
        error: 'Community creators cannot leave their own community. Delete the community instead.'
      });
    }

    // Remove membership
    await CommunityMembership.deleteOne({
      user_id: userId,
      community_id: communityId
    });

    // Update community member count
    await Community.findByIdAndUpdate(
      communityId,
      { $inc: { member_count: -1 } }
    );

    res.json({
      success: true,
      message: 'Successfully left community'
    });
  } catch (error) {
    console.error('Error leaving community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave community'
    });
  }
});

// Delete community (creator only)
router.delete('/:communityId', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id;

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Check if user is the creator
    if (community.creator_id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only the community creator can delete this community'
      });
    }

    // Delete all memberships first
    await CommunityMembership.deleteMany({ community_id: communityId });

    // Delete the community
    await Community.findByIdAndDelete(communityId);

    res.json({
      success: true,
      message: 'Community deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete community'
    });
  }
});

// Get community members
router.get('/:communityId/members', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Check if user is a member
    const userMembership = await CommunityMembership.findOne({
      user_id: req.user._id,
      community_id: communityId
    });

    if (!userMembership) {
      return res.status(403).json({
        success: false,
        error: 'You must be a member to view community members'
      });
    }

    // Get all members with user details
    const memberships = await CommunityMembership.find({
      community_id: communityId,
      status: 'active'
    }).populate('user_id', 'first_name last_name profile_picture_url last_seen is_online')
      .lean();

    // Transform to frontend format
    const members = memberships.map(membership => ({
      id: membership.user_id._id.toString(),
      name: `${membership.user_id.first_name} ${membership.user_id.last_name}`,
      role: membership.role,
      isOnline: membership.user_id.is_online || false,
      lastSeen: membership.user_id.last_seen ? new Date(membership.user_id.last_seen).toLocaleDateString() : 'Recently',
      profileImage: membership.user_id.profile_picture_url,
      joinedDate: membership.joined_at ? new Date(membership.joined_at).toLocaleDateString() : 'Unknown'
    }));

    // Sort members by role priority (creator, admin, member)
    const sortedMembers = members.sort((a, b) => {
      const roleOrder = { creator: 0, admin: 1, member: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });

    res.json({
      success: true,
      data: {
        members: sortedMembers,
        total: sortedMembers.length
      }
    });
  } catch (error) {
    console.error('Error fetching community members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch community members'
    });
  }
});

// Add members to community (admin/creator only)
router.post('/:communityId/add-members', authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { userIds } = req.body;
    const requestingUserId = req.user._id;

    // Validate input
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User IDs array is required'
      });
    }

    // Check if community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Check if requesting user is admin or creator
    const requestingUserMembership = await CommunityMembership.findOne({
      user_id: requestingUserId,
      community_id: communityId
    });

    const isCreator = community.creator_id.toString() === requestingUserId.toString();
    const isAdmin = requestingUserMembership && (requestingUserMembership.role === 'admin' || requestingUserMembership.role === 'creator');

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only admins and creators can add members to this community'
      });
    }

    // Check which users are already members
    const existingMemberships = await CommunityMembership.find({
      user_id: { $in: userIds },
      community_id: communityId
    });

    const existingMemberIds = existingMemberships.map(m => m.user_id.toString());
    const newUserIds = userIds.filter(id => !existingMemberIds.includes(id));

    if (newUserIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All selected users are already members of this community'
      });
    }

    // Create memberships for new users
    const newMemberships = newUserIds.map(userId => ({
      user_id: userId,
      community_id: communityId,
      role: 'member',
      status: 'active',
      joined_at: new Date()
    }));

    await CommunityMembership.insertMany(newMemberships);

    // Update community member count
    await Community.findByIdAndUpdate(
      communityId,
      { $inc: { member_count: newUserIds.length } }
    );

    res.json({
      success: true,
      message: `Successfully added ${newUserIds.length} member${newUserIds.length > 1 ? 's' : ''} to the community`,
      data: {
        addedMembers: newUserIds.length,
        alreadyMembers: existingMemberIds.length
      }
    });
  } catch (error) {
    console.error('Error adding members to community:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add members to community'
    });
  }
});

module.exports = router;