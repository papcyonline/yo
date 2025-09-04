const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { User } = require('../models');

/**
 * Check verification eligibility
 * GET /api/verification/eligibility
 */
router.get('/eligibility', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        can_apply_for_verification: user.can_apply_for_verification || false,
        verification_status: user.verification_status || 'not_eligible',
        verification_requested: user.verification_requested || false,
        is_verified: user.is_verified || false,
        profile_completion_percentage: user.profile_completion_percentage || 0,
        requirements_met: user.profile_completion_percentage >= 100
      }
    });

  } catch (error) {
    console.error('Verification eligibility check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check verification eligibility'
    });
  }
});

/**
 * Apply for blue check verification
 * POST /api/verification/apply
 */
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is eligible
    if (!user.can_apply_for_verification || user.profile_completion_percentage < 100) {
      return res.status(400).json({
        success: false,
        message: 'You must complete your profile 100% before applying for verification',
        data: {
          profile_completion_percentage: user.profile_completion_percentage || 0,
          requirements_met: false
        }
      });
    }

    // Check if already applied
    if (user.verification_requested && user.verification_status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for verification. Your request is pending review.'
      });
    }

    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Your account is already verified'
      });
    }

    // Apply for verification
    await User.findByIdAndUpdate(req.userId, {
      verification_requested: true,
      verification_requested_at: new Date(),
      verification_status: 'pending',
      updated_at: new Date()
    });

    console.log(`✅ User ${req.userId} applied for blue check verification`);

    res.json({
      success: true,
      message: 'Verification application submitted successfully! We will review your request and get back to you.',
      data: {
        verification_status: 'pending',
        verification_requested: true,
        verification_requested_at: new Date()
      }
    });

  } catch (error) {
    console.error('Verification application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit verification application'
    });
  }
});

/**
 * Get verification status
 * GET /api/verification/status
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        is_verified: user.is_verified || false,
        verification_status: user.verification_status || 'not_eligible',
        verification_requested: user.verification_requested || false,
        verification_requested_at: user.verification_requested_at,
        verified_at: user.verified_at,
        can_apply_for_verification: user.can_apply_for_verification || false,
        profile_completion_percentage: user.profile_completion_percentage || 0,
        rejection_reason: user.verification_rejection_reason
      }
    });

  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification status'
    });
  }
});

/**
 * Admin: Approve verification (admin only endpoint)
 * POST /api/verification/approve/:userId
 */
router.post('/approve/:userId', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin role check here
    const targetUserId = req.params.userId;
    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verification_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'User has not applied for verification or is not pending review'
      });
    }

    await User.findByIdAndUpdate(targetUserId, {
      is_verified: true,
      verified_at: new Date(),
      verification_status: 'approved',
      updated_at: new Date()
    });

    console.log(`🎉 User ${targetUserId} verification approved by admin ${req.userId}`);

    res.json({
      success: true,
      message: 'User verification approved successfully',
      data: {
        user_id: targetUserId,
        is_verified: true,
        verified_at: new Date(),
        verification_status: 'approved'
      }
    });

  } catch (error) {
    console.error('Verification approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve verification'
    });
  }
});

/**
 * Admin: Reject verification (admin only endpoint)
 * POST /api/verification/reject/:userId
 */
router.post('/reject/:userId', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin role check here
    const targetUserId = req.params.userId;
    const { reason } = req.body;
    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verification_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'User has not applied for verification or is not pending review'
      });
    }

    await User.findByIdAndUpdate(targetUserId, {
      verification_status: 'rejected',
      verification_rejection_reason: reason || 'Application did not meet verification criteria',
      verification_requested: false, // Allow them to reapply later
      updated_at: new Date()
    });

    console.log(`❌ User ${targetUserId} verification rejected by admin ${req.userId}`);

    res.json({
      success: true,
      message: 'User verification rejected',
      data: {
        user_id: targetUserId,
        verification_status: 'rejected',
        rejection_reason: reason || 'Application did not meet verification criteria'
      }
    });

  } catch (error) {
    console.error('Verification rejection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject verification'
    });
  }
});

module.exports = router;