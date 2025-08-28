const Call = require('../../models/Call');
const Chat = require('../../models/Chat');
const User = require('../../models/User');
const mongoose = require('mongoose');

const callController = {
  /**
   * Initiate a new call
   * POST /api/calls/initiate
   */
  async initiateCall(req, res) {
    try {
      const { targetUserId, callType = 'voice', chatId } = req.body;
      const initiatorId = req.userId;

      console.log('📞 Initiating call:', { initiatorId, targetUserId, callType, chatId });

      // Validate input
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'Target user ID is required'
        });
      }

      if (targetUserId === initiatorId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot call yourself'
        });
      }

      // Check if target user exists
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'Target user not found'
        });
      }

      // Check if either user has an active call
      const existingCall = await Call.findActiveCall(initiatorId);
      if (existingCall) {
        return res.status(409).json({
          success: false,
          message: 'You already have an active call'
        });
      }

      const targetActiveCall = await Call.findActiveCall(targetUserId);
      if (targetActiveCall) {
        return res.status(409).json({
          success: false,
          message: 'Target user is busy'
        });
      }

      // Find or create chat
      let chat;
      if (chatId) {
        chat = await Chat.findById(chatId);
      } else {
        // Find existing direct chat or create new one
        chat = await Chat.findOne({
          chatType: 'direct',
          participants: { $all: [initiatorId, targetUserId] }
        });

        if (!chat) {
          chat = new Chat({
            chatType: 'direct',
            participants: [initiatorId, targetUserId],
            createdBy: initiatorId
          });
          await chat.save();
        }
      }

      // Create call record
      const call = new Call({
        initiator: initiatorId,
        recipient: targetUserId,
        chatId: chat._id,
        callType,
        status: 'initiating',
        metadata: {
          userAgent: req.headers['user-agent'],
          platform: req.body.platform || 'unknown'
        }
      });

      await call.save();

      // Populate call data for response
      await call.populate([
        { path: 'initiator', select: 'first_name last_name profile_photo_url' },
        { path: 'recipient', select: 'first_name last_name profile_photo_url' }
      ]);

      console.log('✅ Call created:', call.callId);

      res.json({
        success: true,
        data: {
          call: {
            callId: call.callId,
            _id: call._id,
            chatId: call.chatId,
            callType: call.callType,
            status: call.status,
            initiator: call.initiator,
            recipient: call.recipient,
            createdAt: call.createdAt
          }
        },
        message: 'Call initiated successfully'
      });

    } catch (error) {
      console.error('❌ Error initiating call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate call',
        error: error.message
      });
    }
  },

  /**
   * Accept an incoming call
   * POST /api/calls/:callId/accept
   */
  async acceptCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.userId;

      console.log('📞 Accepting call:', { callId, userId });

      const call = await Call.findOne({ callId });
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      // Verify user is the recipient
      if (call.recipient.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to accept this call'
        });
      }

      // Check if call is in acceptable state
      if (!['initiating', 'ringing'].includes(call.status)) {
        return res.status(409).json({
          success: false,
          message: `Call cannot be accepted in current state: ${call.status}`
        });
      }

      // Update call status
      await call.updateStatus('connecting');

      console.log('✅ Call accepted:', callId);

      res.json({
        success: true,
        data: { call },
        message: 'Call accepted successfully'
      });

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to accept call',
        error: error.message
      });
    }
  },

  /**
   * Decline an incoming call
   * POST /api/calls/:callId/decline
   */
  async declineCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.userId;
      const { reason = 'declined' } = req.body;

      console.log('📞 Declining call:', { callId, userId, reason });

      const call = await Call.findOne({ callId });
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      // Verify user is the recipient
      if (call.recipient.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to decline this call'
        });
      }

      // Update call status
      await call.updateStatus('declined', { endReason: reason });

      console.log('✅ Call declined:', callId);

      res.json({
        success: true,
        data: { call },
        message: 'Call declined successfully'
      });

    } catch (error) {
      console.error('❌ Error declining call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to decline call',
        error: error.message
      });
    }
  },

  /**
   * End an active call
   * POST /api/calls/:callId/end
   */
  async endCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.userId;
      const { reason = 'completed', quality } = req.body;

      console.log('📞 Ending call:', { callId, userId, reason });

      const call = await Call.findOne({ callId });
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      // Verify user is participant
      const isParticipant = call.initiator.toString() === userId || call.recipient.toString() === userId;
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to end this call'
        });
      }

      // Update call status with quality data if provided
      const updateData = { endReason: reason };
      if (quality) {
        updateData.quality = quality;
      }

      await call.updateStatus('ended', updateData);

      console.log('✅ Call ended:', callId, `Duration: ${call.duration}s`);

      res.json({
        success: true,
        data: { 
          call: {
            callId: call.callId,
            status: call.status,
            duration: call.duration,
            endReason: call.endReason
          }
        },
        message: 'Call ended successfully'
      });

    } catch (error) {
      console.error('❌ Error ending call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end call',
        error: error.message
      });
    }
  },

  /**
   * Get call details
   * GET /api/calls/:callId
   */
  async getCall(req, res) {
    try {
      const { callId } = req.params;
      const userId = req.userId;

      const call = await Call.findOne({ callId })
        .populate('initiator', 'first_name last_name profile_photo_url')
        .populate('recipient', 'first_name last_name profile_photo_url');

      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      // Verify user is participant
      const isParticipant = call.initiator._id.toString() === userId || call.recipient._id.toString() === userId;
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to view this call'
        });
      }

      res.json({
        success: true,
        data: { call },
        message: 'Call retrieved successfully'
      });

    } catch (error) {
      console.error('❌ Error getting call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get call',
        error: error.message
      });
    }
  },

  /**
   * Get call history for user
   * GET /api/calls/history
   */
  async getCallHistory(req, res) {
    try {
      const userId = req.userId;
      const { limit = 50, offset = 0, callType } = req.query;

      console.log('📞 Getting call history:', { userId, limit, offset, callType });

      let query = {
        $or: [
          { initiator: userId },
          { recipient: userId }
        ],
        status: { $in: ['ended', 'missed', 'declined'] }
      };

      if (callType) {
        query.callType = callType;
      }

      const calls = await Call.find(query)
        .populate('initiator', 'first_name last_name profile_photo_url')
        .populate('recipient', 'first_name last_name profile_photo_url')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

      const total = await Call.countDocuments(query);

      res.json({
        success: true,
        data: {
          calls,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > (parseInt(offset) + parseInt(limit))
          }
        },
        message: 'Call history retrieved successfully'
      });

    } catch (error) {
      console.error('❌ Error getting call history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get call history',
        error: error.message
      });
    }
  },

  /**
   * Get missed calls count
   * GET /api/calls/missed/count
   */
  async getMissedCallsCount(req, res) {
    try {
      const userId = req.userId;

      const count = await Call.countDocuments({
        recipient: userId,
        status: 'missed'
      });

      res.json({
        success: true,
        data: { count },
        message: 'Missed calls count retrieved successfully'
      });

    } catch (error) {
      console.error('❌ Error getting missed calls count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get missed calls count',
        error: error.message
      });
    }
  },

  /**
   * Update call status (internal use)
   * PUT /api/calls/:callId/status
   */
  async updateCallStatus(req, res) {
    try {
      const { callId } = req.params;
      const { status, additionalData = {} } = req.body;
      const userId = req.userId;

      const call = await Call.findOne({ callId });
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Call not found'
        });
      }

      // Verify user is participant
      const isParticipant = call.initiator.toString() === userId || call.recipient.toString() === userId;
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to update this call'
        });
      }

      await call.updateStatus(status, additionalData);

      res.json({
        success: true,
        data: { call },
        message: 'Call status updated successfully'
      });

    } catch (error) {
      console.error('❌ Error updating call status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update call status',
        error: error.message
      });
    }
  }
};

module.exports = callController;