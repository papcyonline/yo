const { User } = require('../../models');
const { enhancedMatchingService } = require('../../services/aiMatchingService');

// Analyze user data for AI matching
const analyzeUserData = async (req, res) => {
  try {
    console.log(`📊 Analyzing user data for: ${req.userId}`);
    
    // Get user profile data from MongoDB
    const user = await User.findById(req.userId)
      .select('-password -refresh_token');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate profile completeness
    const profileCompleteness = calculateProfileCompleteness(user);
    
    // Extract matching factors
    const matchingFactors = extractMatchingFactors(user);
    
    // Generate recommendations
    const recommendations = generateRecommendations(user);

    res.json({
      success: true,
      message: 'User data analyzed successfully',
      data: { 
        analysis: {
          profileCompleteness,
          matchingFactors,
          recommendations
        }
      }
    });

  } catch (error) {
    console.error('Analyze user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze user data'
    });
  }
};

// Get family matches
const getFamilyMatches = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.userId;
    
    console.log(`👨‍👩‍👧‍👦 Getting family matches for user: ${userId}`);
    
    // Use enhanced AI matching service (with automatic fallback)
    const result = await enhancedMatchingService.findMatches(userId, {
      matchTypes: ['all'],
      maxResults: 100,
      minConfidence: 0.3
    });
    const allMatches = result.matches || [];
    
    // Filter for family type matches
    const familyMatches = allMatches.filter(match => match.type === 'family');
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMatches = familyMatches.slice(startIndex, endIndex);
    
    console.log(`✅ Found ${familyMatches.length} family matches, returning ${paginatedMatches.length}`);
    
    res.json({
      success: true,
      data: {
        matches: paginatedMatches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: familyMatches.length,
          totalPages: Math.ceil(familyMatches.length / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get family matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family matches'
    });
  }
};

// Get friend matches
const getFriendMatches = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.userId;
    
    console.log(`👫 Getting friend matches for user: ${userId}`);
    
    // Use enhanced AI matching service (with automatic fallback)
    const result = await enhancedMatchingService.findMatches(userId, {
      matchTypes: ['all'],
      maxResults: 100,
      minConfidence: 0.3
    });
    const allMatches = result.matches || [];
    
    // Filter for friend and community type matches
    const friendMatches = allMatches.filter(match => 
      match.type === 'friend' || match.type === 'community'
    );
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMatches = friendMatches.slice(startIndex, endIndex);
    
    console.log(`✅ Found ${friendMatches.length} friend matches, returning ${paginatedMatches.length}`);
    
    res.json({
      success: true,
      data: {
        matches: paginatedMatches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: friendMatches.length,
          totalPages: Math.ceil(friendMatches.length / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get friend matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friend matches'
    });
  }
};

// Get all matches (combined)
const getAllMatches = async (req, res) => {
  try {
    const { page = 1, limit = 10, type = 'all' } = req.query;
    const userId = req.userId;
    
    console.log(`🎯 Getting ${type} matches for user: ${userId}`);
    
    // Use enhanced AI matching service (with automatic fallback)
    const result = await enhancedMatchingService.findMatches(userId, {
      matchTypes: ['all'],
      maxResults: 100,
      minConfidence: 0.3
    });
    const allMatches = result.matches || [];
    
    // Filter by type if specified
    let filteredMatches = allMatches;
    if (type !== 'all') {
      filteredMatches = allMatches.filter(match => match.type === type);
    }
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMatches = filteredMatches.slice(startIndex, endIndex);
    
    console.log(`✅ Found ${filteredMatches.length} ${type} matches, returning ${paginatedMatches.length}`);
    
    res.json({
      success: true,
      data: {
        matches: paginatedMatches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredMatches.length,
          totalPages: Math.ceil(filteredMatches.length / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get all matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch matches'
    });
  }
};

// Send friend request (connection request)
const sendFriendRequest = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { message } = req.body;
    const senderId = req.userId;
    
    console.log(`📬 Friend request from ${senderId} to ${targetUserId}`);
    
    // Check if users exist
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(targetUserId)
    ]);
    
    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if already connected
    const isAlreadyConnected = sender.connections?.some(
      conn => conn.toString() === targetUserId
    );
    
    if (isAlreadyConnected) {
      return res.status(400).json({
        success: false,
        message: 'Already connected with this user'
      });
    }
    
    // Check if request already exists
    const existingRequest = sender.sent_requests?.some(
      req => req.toString() === targetUserId
    );
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent'
      });
    }
    
    // Add to sent_requests for sender and received_requests for receiver
    await Promise.all([
      User.findByIdAndUpdate(senderId, {
        $addToSet: { sent_requests: targetUserId }
      }),
      User.findByIdAndUpdate(targetUserId, {
        $addToSet: { received_requests: senderId }
      })
    ]);
    
    // Create notification for receiver
    const { Notification } = require('../../models');
    await Notification.create({
      user_id: targetUserId,
      type: 'new_match',
      title: 'New Friend Request',
      message: `${sender.first_name} ${sender.last_name} sent you a friend request${message ? ': ' + message : ''}`,
      data: {
        sender_id: senderId,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        message
      }
    });
    
    res.json({
      success: true,
      message: 'Friend request sent successfully',
      data: {
        request: {
          sender_id: senderId,
          receiver_id: targetUserId,
          message,
          status: 'pending',
          created_at: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send friend request'
    });
  }
};

// Accept friend request
const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId: senderId } = req.params; // requestId is actually the sender's userId
    const receiverId = req.userId;
    
    console.log(`✅ Accepting friend request from ${senderId} to ${receiverId}`);
    
    // Check if request exists
    const receiver = await User.findById(receiverId);
    const hasRequest = receiver.received_requests?.some(
      req => req.toString() === senderId
    );
    
    if (!hasRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }
    
    // Update both users - add to connections and remove from requests
    await Promise.all([
      // Update receiver
      User.findByIdAndUpdate(receiverId, {
        $addToSet: { connections: senderId },
        $pull: { received_requests: senderId }
      }),
      // Update sender
      User.findByIdAndUpdate(senderId, {
        $addToSet: { connections: receiverId },
        $pull: { sent_requests: receiverId }
      })
    ]);
    
    // Create notification for sender
    const sender = await User.findById(senderId);
    const { Notification } = require('../../models');
    await Notification.create({
      user_id: senderId,
      type: 'new_match',
      title: 'Friend Request Accepted',
      message: `${receiver.first_name} ${receiver.last_name} accepted your friend request`,
      data: {
        accepter_id: receiverId,
        accepter_name: `${receiver.first_name} ${receiver.last_name}`
      }
    });
    
    res.json({
      success: true,
      message: 'Friend request accepted',
      data: {
        connection: {
          user1: senderId,
          user2: receiverId,
          connected_at: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept friend request'
    });
  }
};

// Helper functions
function calculateProfileCompleteness(user) {
  const fields = [
    'first_name', 'last_name', 'email', 'phone', 'location',
    'date_of_birth', 'profession', 'bio', 'interests',
    'father_name', 'mother_name', 'family_origin',
    'cultural_background', 'primary_language'
  ];
  
  const filledFields = fields.filter(field => user[field]);
  const percentage = Math.round((filledFields.length / fields.length) * 100);
  
  return {
    percentage,
    filled: filledFields.length,
    total: fields.length,
    missing: fields.filter(field => !user[field])
  };
}

function extractMatchingFactors(user) {
  return {
    location: user.location || user.current_location,
    profession: user.profession,
    interests: user.interests || [],
    familyOrigin: user.family_origin,
    culturalBackground: user.cultural_background,
    languages: [user.primary_language].filter(Boolean),
    hasParentInfo: !!(user.father_name || user.mother_name),
    hasEducation: !!(user.schools_attended),
    profileStrength: user.first_name && user.last_name && user.location ? 'strong' : 'weak'
  };
}

function generateRecommendations(user) {
  const recommendations = [];
  
  if (!user.location && !user.current_location) {
    recommendations.push('Add your location for better local matches');
  }
  if (!user.profession) {
    recommendations.push('Add your profession to find professional connections');
  }
  if (!user.interests || user.interests.length === 0) {
    recommendations.push('Add interests to find like-minded people');
  }
  if (!user.father_name && !user.mother_name) {
    recommendations.push('Add parent names for better family matching');
  }
  if (!user.family_origin) {
    recommendations.push('Add family origin for heritage connections');
  }
  if (!user.bio) {
    recommendations.push('Add a bio to help others know you better');
  }
  
  return recommendations;
}

module.exports = {
  analyzeUserData,
  getFamilyMatches,
  getFriendMatches,
  getAllMatches,
  sendFriendRequest,
  acceptFriendRequest
};