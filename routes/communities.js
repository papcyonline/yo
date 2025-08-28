const { User, Community, CommunityMembership } = require('../../models');
const { v4: uuidv4 } = require('uuid');

// Get user's joined communities
const getMyCommunities = async (req, res) => {
  try {
    const memberships = await CommunityMembership.find({ user_id: req.userId })
      .populate('community_id', 'name description category member_count cover_image_url location created_at')
      .sort({ joined_at: -1 });

    const communities = memberships.map(m => ({
      ...m.community_id.toObject(),
      userRole: m.role,
      joinedAt: m.joined_at
    }));

    res.json({
      success: true,
      data: { communities }
    });

  } catch (error) {
    console.error('Get my communities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communities'
    });
  }
};

// Discover communities (AI-suggested)
const discoverCommunities = async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    const skip = (page - 1) * limit;

    let query = { is_private: false };
    if (category) {
      query.category = category;
    }

    const communities = await Community.find(query)
      .populate('creator_id', 'first_name last_name profile_picture_url')
      .sort({ member_count: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Community.countDocuments(query);

    res.json({
      success: true,
      data: {
        communities: communities.map(c => ({
          ...c.toObject(),
          creator: c.creator_id
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Discover communities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to discover communities'
    });
  }
};

// Create new community
const createCommunity = async (req, res) => {
  try {
    const { name, description, category, isPrivate = false, location } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name and description are required'
      });
    }

    // Create community
    const community = new Community({
      name,
      description,
      category,
      creator_id: req.userId,
      is_private: isPrivate,
      location,
      member_count: 1
    });

    await community.save();

    // Add creator as owner/member
    const membership = new CommunityMembership({
      community_id: community._id,
      user_id: req.userId,
      role: 'owner'
    });

    await membership.save();

    res.json({
      success: true,
      message: 'Community created successfully',
      data: { community }
    });

  } catch (error) {
    console.error('Create community error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create community'
    });
  }
};

// Get community details
const getCommunityDetails = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId)
      .populate('creator_id', 'first_name last_name profile_picture_url');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is a member
    const membership = await CommunityMembership.findOne({
      community_id: communityId,
      user_id: req.userId
    });

    res.json({
      success: true,
      data: {
        community: {
          ...community.toObject(),
          creator: community.creator_id,
          userRole: membership?.role || null,
          isMember: !!membership
        }
      }
    });

  } catch (error) {
    console.error('Get community details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community details'
    });
  }
};

// Join community
const joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;

    // Check if already a member
    const existingMembership = await CommunityMembership.findOne({
      community_id: communityId,
      user_id: req.userId
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this community'
      });
    }

    // Add membership
    const membership = new CommunityMembership({
      community_id: communityId,
      user_id: req.userId,
      role: 'member'
    });

    await membership.save();

    // Update member count
    await Community.findByIdAndUpdate(communityId, {
      $inc: { member_count: 1 }
    });

    res.json({
      success: true,
      message: 'Successfully joined community'
    });

  } catch (error) {
    console.error('Join community error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join community'
    });
  }
};

// Leave community
const leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;

    // Remove membership
    await CommunityMembership.deleteOne({
      community_id: communityId,
      user_id: req.userId
    });

    // Update member count
    await Community.findByIdAndUpdate(communityId, {
      $inc: { member_count: -1 }
    });

    res.json({
      success: true,
      message: 'Successfully left community'
    });

  } catch (error) {
    console.error('Leave community error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave community'
    });
  }
};

// Get community categories
const getCategories = async (req, res) => {
  try {
    const categories = [
      'Family & Heritage',
      'Local Community',
      'Hobbies & Interests',
      'Professional',
      'Cultural',
      'Educational',
      'Support Groups',
      'Sports & Recreation',
      'Travel',
      'Food & Cooking',
      'Arts & Crafts',
      'Technology',
      'Health & Wellness',
      'Parenting',
      'Senior Living'
    ];

    res.json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

module.exports = {
  getMyCommunities,
  discoverCommunities,
  createCommunity,
  getCommunityDetails,
  joinCommunity,
  leaveCommunity,
  getCategories
};