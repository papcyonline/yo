const { User, FriendRequest, Connection } = require('../../models');

// ============================================
// FRIEND REQUESTS
// ============================================

// Send friend request
const sendFriendRequest = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.userId;

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    // Check if users exist
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender_id: senderId, receiver_id: receiverId },
        { sender_id: receiverId, receiver_id: senderId }
      ]
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already exists'
      });
    }

    // Check if already connected
    const existingConnection = await Connection.findOne({
      $or: [
        { user_id: senderId, connected_user_id: receiverId },
        { user_id: receiverId, connected_user_id: senderId }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({
        success: false,
        message: 'Already connected with this user'
      });
    }

    // Create friend request
    const friendRequest = new FriendRequest({
      sender_id: senderId,
      receiver_id: receiverId,
      message: message || '',
      status: 'pending'
    });

    await friendRequest.save();

    // Populate sender info for response
    await friendRequest.populate('sender_id', 'first_name last_name profile_picture_url');

    res.json({
      success: true,
      message: 'Friend request sent successfully',
      data: { request: friendRequest }
    });

  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send friend request'
    });
  }
};

// Get received friend requests
const getReceivedRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const requests = await FriendRequest.find({
      receiver_id: req.userId,
      status: 'pending'
    })
    .populate('sender_id', 'first_name last_name profile_picture_url bio location')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await FriendRequest.countDocuments({
      receiver_id: req.userId,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get received requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch friend requests'
    });
  }
};

// Get sent friend requests
const getSentRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const requests = await FriendRequest.find({
      sender_id: req.userId,
      status: 'pending'
    })
    .populate('receiver_id', 'first_name last_name profile_picture_url bio location')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await FriendRequest.countDocuments({
      sender_id: req.userId,
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sent requests'
    });
  }
};

// Accept friend request
const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const friendRequest = await FriendRequest.findOne({
      _id: requestId,
      receiver_id: req.userId,
      status: 'pending'
    }).populate('sender_id', 'first_name last_name');

    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Create bidirectional connections
    const connections = [
      new Connection({
        user_id: friendRequest.sender_id._id,
        connected_user_id: friendRequest.receiver_id,
        connection_type: 'friend',
        status: 'active'
      }),
      new Connection({
        user_id: friendRequest.receiver_id,
        connected_user_id: friendRequest.sender_id._id,
        connection_type: 'friend',
        status: 'active'
      })
    ];

    await Promise.all([
      Connection.insertMany(connections),
      FriendRequest.findByIdAndUpdate(requestId, { status: 'accepted' })
    ]);

    res.json({
      success: true,
      message: 'Friend request accepted',
      data: { 
        connection: connections[0],
        friend: friendRequest.sender_id
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

// Decline friend request
const declineFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const result = await FriendRequest.findOneAndUpdate(
      { _id: requestId, receiver_id: req.userId, status: 'pending' },
      { status: 'declined' }
    );

    if (!result) {
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

// ============================================
// CONNECTIONS
// ============================================

// Get user connections
const getConnections = async (req, res) => {
  try {
    const { page = 1, limit = 20, type = 'all' } = req.query;
    const skip = (page - 1) * limit;

    let query = { user_id: req.userId, status: 'active' };
    if (type !== 'all') {
      query.connection_type = type;
    }

    const connections = await Connection.find(query)
      .populate('connected_user_id', 'first_name last_name profile_picture_url bio location profession')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Connection.countDocuments(query);

    res.json({
      success: true,
      data: {
        connections: connections.map(conn => ({
          id: conn._id,
          connection_type: conn.connection_type,
          created_at: conn.created_at,
          user: conn.connected_user_id
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch connections'
    });
  }
};

// Remove connection
const removeConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await Connection.findOne({
      _id: connectionId,
      user_id: req.userId
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    // Remove both directions of the connection
    await Connection.deleteMany({
      $or: [
        { user_id: req.userId, connected_user_id: connection.connected_user_id },
        { user_id: connection.connected_user_id, connected_user_id: req.userId }
      ]
    });

    res.json({
      success: true,
      message: 'Connection removed successfully'
    });

  } catch (error) {
    console.error('Remove connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove connection'
    });
  }
};

// Block user
const blockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block yourself'
      });
    }

    // Remove any existing connections
    await Connection.deleteMany({
      $or: [
        { user_id: currentUserId, connected_user_id: targetUserId },
        { user_id: targetUserId, connected_user_id: currentUserId }
      ]
    });

    // Remove/cancel any friend requests
    await FriendRequest.deleteMany({
      $or: [
        { sender_id: currentUserId, receiver_id: targetUserId },
        { sender_id: targetUserId, receiver_id: currentUserId }
      ]
    });

    // Create block connection
    const blockConnection = new Connection({
      user_id: currentUserId,
      connected_user_id: targetUserId,
      connection_type: 'blocked',
      status: 'active'
    });

    await blockConnection.save();

    res.json({
      success: true,
      message: 'User blocked successfully'
    });

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block user'
    });
  }
};

// Unblock user
const unblockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;

    const result = await Connection.deleteOne({
      user_id: req.userId,
      connected_user_id: targetUserId,
      connection_type: 'blocked'
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User is not blocked'
      });
    }

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });

  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    });
  }
};

// Get blocked users
const getBlockedUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const blockedConnections = await Connection.find({
      user_id: req.userId,
      connection_type: 'blocked',
      status: 'active'
    })
    .populate('connected_user_id', 'first_name last_name profile_picture_url')
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Connection.countDocuments({
      user_id: req.userId,
      connection_type: 'blocked',
      status: 'active'
    });

    res.json({
      success: true,
      data: {
        blocked_users: blockedConnections.map(conn => ({
          id: conn._id,
          blocked_at: conn.created_at,
          user: conn.connected_user_id
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked users'
    });
  }
};

module.exports = {
  sendFriendRequest,
  getReceivedRequests,
  getSentRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getConnections,
  removeConnection,
  blockUser,
  unblockUser,
  getBlockedUsers
};