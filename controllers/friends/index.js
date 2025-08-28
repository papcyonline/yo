const { User, Friendship } = require('../../models');

// Get user's friends list
const getFriends = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const friendships = await Friendship.find({
      user_id: req.userId,
      status: 'accepted'
    })
    .populate('friend_id', 'first_name last_name profile_picture_url bio location')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Friendship.countDocuments({
      user_id: req.userId,
      status: 'accepted'
    });

    const friends = friendships.map(friendship => ({
      id: friendship._id,
      created_at: friendship.created_at,
      friend: friendship.friend_id
    }));

    res.json({
      success: true,
      data: {
        friends,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friends'
    });
  }
};

// Get friend requests (received)
const getFriendRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const requests = await Friendship.find({
      friend_id: req.userId,
      status: 'pending'
    })
    .populate('user_id', 'first_name last_name profile_picture_url bio location')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Friendship.countDocuments({
      friend_id: req.userId,
      status: 'pending'
    });

    const friendRequests = requests.map(request => ({
      id: request._id,
      created_at: request.created_at,
      requester: request.user_id
    }));

    res.json({
      success: true,
      data: {
        requests: friendRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friend requests'
    });
  }
};

// Send friend request
const sendFriendRequest = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;

    if (userId === friendId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    // Check if friend exists
    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if friendship already exists
    const existingFriendship = await Friendship.findOne({
      $or: [
        { user_id: userId, friend_id: friendId },
        { user_id: friendId, friend_id: userId }
      ]
    });

    if (existingFriendship) {
      let message = 'Friend request already exists';
      if (existingFriendship.status === 'accepted') {
        message = 'Already friends with this user';
      }
      return res.status(400).json({
        success: false,
        message
      });
    }

    // Create friendship record
    const friendship = new Friendship({
      user_id: userId,
      friend_id: friendId,
      status: 'pending'
    });

    await friendship.save();

    res.json({
      success: true,
      message: 'Friend request sent successfully',
      data: { friendship }
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
    const { requestId } = req.params;
    const userId = req.userId;

    const friendship = await Friendship.findOne({
      _id: requestId,
      friend_id: userId,
      status: 'pending'
    });

    if (!friendship) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Update status to accepted
    friendship.status = 'accepted';
    await friendship.save();

    // Create reciprocal friendship
    const reciprocalFriendship = new Friendship({
      user_id: userId,
      friend_id: friendship.user_id,
      status: 'accepted'
    });

    await reciprocalFriendship.save();

    res.json({
      success: true,
      message: 'Friend request accepted',
      data: { friendship }
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept friend request'
    });
  }
};

// Decline friend request
const declineFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.userId;

    const result = await Friendship.deleteOne({
      _id: requestId,
      friend_id: userId,
      status: 'pending'
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    res.json({
      success: true,
      message: 'Friend request declined'
    });

  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline friend request'
    });
  }
};

// Remove friend
const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;

    // Remove both friendship records
    await Friendship.deleteMany({
      $or: [
        { user_id: userId, friend_id: friendId },
        { user_id: friendId, friend_id: userId }
      ],
      status: 'accepted'
    });

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });

  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove friend'
    });
  }
};

// Get friendship status with specific user
const getFriendshipStatus = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;

    if (currentUserId === targetUserId) {
      return res.json({
        success: true,
        data: { status: 'self' }
      });
    }

    const friendship = await Friendship.findOne({
      $or: [
        { user_id: currentUserId, friend_id: targetUserId },
        { user_id: targetUserId, friend_id: currentUserId }
      ]
    });

    let status = 'none';
    let canSendRequest = true;

    if (friendship) {
      status = friendship.status;
      canSendRequest = false;

      // Check who sent the request if pending
      if (friendship.status === 'pending') {
        status = friendship.user_id.toString() === currentUserId ? 'sent' : 'received';
      }
    }

    res.json({
      success: true,
      data: {
        status,
        canSendRequest,
        friendship: friendship ? {
          id: friendship._id,
          created_at: friendship.created_at
        } : null
      }
    });

  } catch (error) {
    console.error('Get friendship status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get friendship status'
    });
  }
};

module.exports = {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriendshipStatus
};