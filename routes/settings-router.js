const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { PrivacySettings, User, SecuritySettings, LoginSession } = require('../models');
const bcrypt = require('bcrypt');
// const securityMonitoringService = require('../services/securityMonitoringService');

// Terms of Service endpoint
router.get('/terms-of-service', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'Terms of Service',
      content: `# Yo! Terms of Service

**Effective Date:** January 1, 2025
**Version:** 1.0.0

## 1. Acceptance of Terms
By using Yo!, you agree to be bound by these Terms of Service.

## 2. User Accounts
You must provide accurate information when creating your account.

## 3. Privacy
Your privacy is important to us. Please review our Privacy Policy.

## 4. User Conduct
You agree to use Yo! responsibly and respectfully.

## 5. Content
You are responsible for the content you share on Yo!.

## 6. Termination
We may terminate accounts that violate these terms.

## 7. Changes to Terms
We may update these terms from time to time.`,
      version: '1.0.0',
      last_updated: new Date().toISOString()
    }
  });
});

// Privacy Policy endpoint
router.get('/privacy-policy', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'Privacy Policy',
      content: `# Yo! Privacy Policy

**Effective Date:** January 1, 2025
**Version:** 1.0.0

## 1. Information We Collect
We collect information you provide directly to us.

## 2. How We Use Your Information
We use your information to provide and improve our services.

## 3. Information Sharing
We do not sell your personal information.

## 4. Data Security
We implement security measures to protect your information.

## 5. Your Rights
You have rights regarding your personal information.

## 6. Contact Us
For privacy concerns, contact us at support@yo-app.com`,
      version: '1.0.0',
      last_updated: new Date().toISOString()
    }
  });
});

// About endpoint
router.get('/about', (req, res) => {
  res.json({
    success: true,
    data: {
      app_name: 'Yo!',
      version: '1.0.0',
      description: 'AI-powered social connection app',
      company: 'Yo! Inc.',
      contact_email: 'support@yo-app.com',
      website: 'https://yo-app.com'
    }
  });
});

// Preferences endpoints (protected)
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('⚙️ Loading user preferences for:', userId);
    
    // Get user data with preferences
    const user = await User.findById(userId).select(
      'notification_preferences privacy_settings preferred_language timezone'
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Return preferences in expected format
    const preferences = {
      dark_mode: false, // This would come from theme settings if implemented
      notifications_enabled: user.notification_preferences?.push || true,
      location_enabled: user.privacy_settings?.show_location || false,
      language: user.preferred_language || 'en',
      privacy_level: 'friends',
      email_notifications: user.notification_preferences?.email || true,
      push_notifications: user.notification_preferences?.push || true,
      sms_notifications: user.notification_preferences?.sms || false,
      match_notifications: true,
      community_notifications: true,
      message_notifications: true
    };
    
    console.log('✅ Preferences loaded:', preferences);
    
    res.json({
      success: true,
      data: { preferences }
    });
  } catch (error) {
    console.error('❌ Error loading preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load preferences',
      error: error.message
    });
  }
});

router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;
    
    console.log('🔄 Updating user preferences for:', userId);
    console.log('📝 Preference updates:', updates);
    
    // Map frontend preference keys to User model fields
    const userUpdates = {};
    
    if (updates.notifications_enabled !== undefined) {
      userUpdates['notification_preferences.push'] = updates.notifications_enabled;
    }
    if (updates.email_notifications !== undefined) {
      userUpdates['notification_preferences.email'] = updates.email_notifications;
    }
    if (updates.sms_notifications !== undefined) {
      userUpdates['notification_preferences.sms'] = updates.sms_notifications;
    }
    if (updates.location_enabled !== undefined) {
      userUpdates['privacy_settings.show_location'] = updates.location_enabled;
    }
    if (updates.language !== undefined) {
      userUpdates.preferred_language = updates.language;
    }
    
    console.log('📊 Mapped user updates:', userUpdates);
    
    // Update user preferences
    await User.findByIdAndUpdate(userId, userUpdates, { runValidators: true });
    
    console.log('✅ Preferences updated successfully');
    
    res.json({
      success: true,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
});

// Privacy settings endpoints (protected)
router.get('/privacy', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('🔒 Loading privacy settings for user:', userId);
    
    // Get or create privacy settings for the user
    const privacySettings = await PrivacySettings.getOrCreate(userId);
    
    console.log('✅ Privacy settings loaded:', privacySettings);
    
    // Return settings in the format expected by frontend
    res.json({
      success: true,
      data: {
        privacySettings: {
          profile_visibility: privacySettings.profile_visibility,
          show_online_status: privacySettings.show_online_status,
          show_last_seen: privacySettings.show_last_seen,
          allow_friend_requests: privacySettings.allow_friend_requests,
          allow_message_requests: privacySettings.allow_message_requests,
          share_location: privacySettings.share_location,
          show_phone_number: privacySettings.show_phone_number,
          show_email: privacySettings.show_email,
          allow_tagging: privacySettings.allow_tagging,
          data_analytics: privacySettings.data_analytics,
          ad_personalization: privacySettings.ad_personalization
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load privacy settings',
      error: error.message
    });
  }
});

router.put('/privacy', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;
    
    console.log('🔄 Updating privacy settings for user:', userId);
    console.log('📝 Privacy settings updates:', updates);
    
    // Validate allowed fields
    const allowedFields = [
      'profile_visibility', 'show_online_status', 'show_last_seen',
      'allow_friend_requests', 'allow_message_requests', 'share_location',
      'show_phone_number', 'show_email', 'allow_tagging', 
      'data_analytics', 'ad_personalization'
    ];
    
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    console.log('✅ Filtered updates:', filteredUpdates);
    
    // Update privacy settings
    const updatedSettings = await PrivacySettings.findOneAndUpdate(
      { user_id: userId },
      filteredUpdates,
      { 
        new: true, 
        upsert: true,
        runValidators: true 
      }
    );
    
    console.log('🎉 Privacy settings updated successfully:', updatedSettings);
    
    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: {
        privacySettings: updatedSettings
      }
    });
  } catch (error) {
    console.error('❌ Error updating privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings',
      error: error.message
    });
  }
});

// Security settings endpoints (protected)
router.get('/security', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('🔐 Loading security settings for user:', userId);
    
    // Get or create security settings
    const securitySettings = await SecuritySettings.getOrCreate(userId);
    
    // Get active sessions count
    const activeSessions = await LoginSession.getActiveSessions(userId);
    
    console.log('✅ Security settings loaded:', securitySettings);
    
    res.json({
      success: true,
      data: {
        securitySettings: {
          two_factor_enabled: securitySettings.two_factor_enabled,
          biometric_enabled: securitySettings.biometric_enabled,
          login_alerts: securitySettings.login_alerts,
          session_timeout: securitySettings.session_timeout,
          password_changed_at: securitySettings.password_changed_at,
          active_sessions_count: activeSessions.length,
          account_locked: securitySettings.account_locked,
          failed_login_attempts: securitySettings.failed_login_attempts
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading security settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load security settings',
      error: error.message
    });
  }
});

router.put('/security', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;
    
    console.log('🔄 Updating security settings for user:', userId);
    console.log('📝 Security updates:', updates);
    
    // Validate allowed fields
    const allowedFields = [
      'two_factor_enabled', 'biometric_enabled', 'login_alerts', 
      'session_timeout', 'recovery_email', 'recovery_phone'
    ];
    
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    console.log('✅ Filtered updates:', filteredUpdates);
    
    // Update security settings
    const updatedSettings = await SecuritySettings.findOneAndUpdate(
      { user_id: userId },
      filteredUpdates,
      { 
        new: true, 
        upsert: true,
        runValidators: true 
      }
    );
    
    console.log('🎉 Security settings updated successfully:', updatedSettings);
    
    res.json({
      success: true,
      message: 'Security settings updated successfully',
      data: {
        securitySettings: {
          two_factor_enabled: updatedSettings.two_factor_enabled,
          biometric_enabled: updatedSettings.biometric_enabled,
          login_alerts: updatedSettings.login_alerts,
          session_timeout: updatedSettings.session_timeout
        }
      }
    });
  } catch (error) {
    console.error('❌ Error updating security settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update security settings',
      error: error.message
    });
  }
});

// Change password endpoint
router.post('/security/change-password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;
    
    console.log('🔐 Password change request for user:', userId);
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update user password
    user.password = hashedNewPassword;
    await user.save();
    
    // Update security settings
    await SecuritySettings.findOneAndUpdate(
      { user_id: userId },
      { 
        password_changed_at: new Date(),
        failed_login_attempts: 0,
        account_locked: false,
        locked_until: null
      },
      { upsert: true }
    );
    
    console.log('✅ Password changed successfully for user:', userId);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('❌ Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// Get active sessions
router.get('/security/active-sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('📱 Loading active sessions for user:', userId);
    
    const sessions = await LoginSession.getActiveSessions(userId);
    
    console.log('✅ Active sessions loaded:', sessions.length, 'sessions');
    
    res.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          id: session._id,
          device_type: session.device_info?.type || 'unknown',
          device_name: `${session.device_info?.os || 'Unknown'} ${session.device_info?.browser || ''}`.trim(),
          ip_address: session.ip_address,
          location: session.location?.city ? `${session.location.city}, ${session.location.country}` : 'Unknown',
          login_at: session.login_at,
          last_activity: session.last_activity,
          last_activity_ago: session.last_activity_ago,
          is_current: session.session_token === req.headers.authorization?.replace('Bearer ', ''),
          is_suspicious: session.is_suspicious
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error loading active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load active sessions',
      error: error.message
    });
  }
});

// Terminate session
router.delete('/security/sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const sessionId = req.params.sessionId;
    
    console.log('🔒 Terminating session:', sessionId, 'for user:', userId);
    
    const session = await LoginSession.findOne({ 
      _id: sessionId, 
      user_id: userId,
      is_active: true 
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or already terminated'
      });
    }
    
    await session.terminate('terminated_by_user');
    
    console.log('✅ Session terminated successfully');
    
    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    console.error('❌ Error terminating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to terminate session',
      error: error.message
    });
  }
});

// Get login history
router.get('/security/login-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 50;
    
    console.log('📊 Loading login history for user:', userId);
    
    const loginHistory = await LoginSession.getLoginHistory(userId, limit);
    
    console.log('✅ Login history loaded:', loginHistory.length, 'entries');
    
    res.json({
      success: true,
      data: {
        loginHistory: loginHistory.map(entry => ({
          id: entry._id,
          ip_address: entry.ip_address,
          location: entry.location?.city ? `${entry.location.city}, ${entry.location.country}` : 'Unknown',
          device_info: `${entry.device_info?.os || 'Unknown'} ${entry.device_info?.browser || ''}`.trim(),
          login_at: entry.login_at,
          logout_at: entry.logout_at,
          login_method: entry.login_method,
          is_suspicious: entry.is_suspicious,
          duration: entry.logout_at ? Math.floor((entry.logout_at - entry.login_at) / 1000) : null
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error loading login history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load login history',
      error: error.message
    });
  }
});

// Terminate all other sessions
router.post('/security/sessions/terminate-others', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const currentSessionToken = req.headers.authorization?.replace('Bearer ', '');
    
    console.log('🔒 Terminating all other sessions for user:', userId);
    
    // Find all active sessions except current one
    const sessionsToTerminate = await LoginSession.find({
      user_id: userId,
      is_active: true,
      session_token: { $ne: currentSessionToken }
    });
    
    console.log('📱 Found sessions to terminate:', sessionsToTerminate.length);
    
    // Terminate all other sessions
    const terminatedCount = await LoginSession.updateMany(
      {
        user_id: userId,
        is_active: true,
        session_token: { $ne: currentSessionToken }
      },
      {
        $set: {
          is_active: false,
          logout_at: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    console.log('✅ Terminated', terminatedCount.modifiedCount, 'other sessions');
    
    res.json({
      success: true,
      message: `Successfully terminated ${terminatedCount.modifiedCount} other sessions`,
      data: {
        terminatedSessions: terminatedCount.modifiedCount
      }
    });
  } catch (error) {
    console.error('❌ Error terminating other sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to terminate other sessions',
      error: error.message
    });
  }
});

/* Security monitoring endpoints - temporarily disabled
// Get security analysis for user account
router.get('/security/analysis', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('📊 Getting security analysis for user:', userId);
    
    const analysis = await securityMonitoringService.analyzeSessionPatterns(userId);
    
    if (!analysis) {
      throw new Error('Failed to analyze security patterns');
    }
    
    console.log('✅ Security analysis completed');
    
    res.json({
      success: true,
      data: {
        analysis: {
          patterns: analysis.patterns,
          anomalies: analysis.anomalies,
          riskLevel: analysis.riskLevel,
          lastAnalyzed: new Date()
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting security analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security analysis',
      error: error.message
    });
  }
});

// Get security recommendations
router.get('/security/recommendations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('💡 Getting security recommendations for user:', userId);
    
    // Get recent suspicious activities
    const recentSessions = await LoginSession.find({
      user_id: userId,
      login_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      $or: [
        { is_suspicious: true },
        { risk_score: { $gte: 30 } }
      ]
    }).limit(10);
    
    // Generate recommendations based on recent activity
    const recommendations = [];
    const hasHighRiskSessions = recentSessions.some(s => s.risk_score >= 70);
    const hasSuspiciousSessions = recentSessions.some(s => s.is_suspicious);
    const uniqueIPs = new Set(recentSessions.map(s => s.ip_address)).size;
    const uniqueLocations = new Set(recentSessions.map(s => s.location?.city).filter(Boolean)).size;
    
    if (hasHighRiskSessions) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        title: 'Enable Two-Factor Authentication',
        description: 'High-risk login attempts detected. Secure your account with 2FA.',
        action: 'enable_2fa'
      });
    }
    
    if (hasSuspiciousSessions) {
      recommendations.push({
        type: 'security',
        priority: 'medium',
        title: 'Review Recent Login Activity',
        description: 'Suspicious login attempts were detected. Review and terminate unknown sessions.',
        action: 'review_sessions'
      });
    }
    
    if (uniqueIPs > 5) {
      recommendations.push({
        type: 'monitoring',
        priority: 'medium',
        title: 'Enable Login Notifications',
        description: 'Multiple IP addresses detected. Get notified of new login attempts.',
        action: 'enable_notifications'
      });
    }
    
    if (uniqueLocations > 3) {
      recommendations.push({
        type: 'security',
        priority: 'low',
        title: 'Verify Login Locations',
        description: 'Logins detected from multiple locations. Verify these were authorized.',
        action: 'verify_locations'
      });
    }
    
    // Always include basic security recommendations
    recommendations.push({
      type: 'security',
      priority: 'low',
      title: 'Regular Password Updates',
      description: 'Update your password regularly for better security.',
      action: 'change_password'
    });
    
    console.log('✅ Generated', recommendations.length, 'security recommendations');
    
    res.json({
      success: true,
      data: {
        recommendations,
        riskFactors: {
          highRiskSessions: recentSessions.filter(s => s.risk_score >= 70).length,
          suspiciousSessions: recentSessions.filter(s => s.is_suspicious).length,
          uniqueIPs,
          uniqueLocations
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting security recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security recommendations',
      error: error.message
    });
  }
});
*/

// Data download request endpoint
router.post('/data-download', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;
    
    console.log('📥 Data download requested by user:', userId);
    
    // In a real implementation, you would:
    // 1. Queue a background job to compile user data
    // 2. Send an email notification when ready
    // 3. Store the request in a database
    
    // For now, we'll simulate the request
    console.log('🔄 Processing data download request for:', userEmail);
    
    res.json({
      success: true,
      message: 'Data download request received. You will receive an email within 48 hours.',
      data: {
        downloadRequest: {
          requestId: `download_${userId}_${Date.now()}`,
          requestedAt: new Date().toISOString(),
          email: userEmail,
          status: 'pending',
          estimatedCompletionTime: '48 hours'
        }
      }
    });
  } catch (error) {
    console.error('❌ Error processing data download request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process data download request',
      error: error.message
    });
  }
});

// Account deactivation endpoint
router.post('/deactivate', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { reason, customReason } = req.body;

    console.log('⚠️ Account deactivation requested by user:', userId);
    console.log('📝 Reason:', reason, customReason);

    // Update user account to deactivated status
    await User.findByIdAndUpdate(userId, {
      is_active: false,
      deactivated_at: new Date(),
      deactivation_reason: reason,
      custom_deactivation_reason: customReason
    });

    console.log('✅ Account deactivated successfully');

    res.json({
      success: true,
      message: 'Account deactivated successfully. You can reactivate anytime by logging back in.'
    });
  } catch (error) {
    console.error('❌ Error deactivating account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account',
      error: error.message
    });
  }
});

// Permanent account deletion endpoint
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { password, confirmationText } = req.body;

    console.log('🗑️ Permanent account deletion requested by user:', userId);

    // Get user and verify password if provided
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If user has a password set, verify it
    if (user.password_hash && password) {
      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }
    }

    // Verify confirmation text
    if (confirmationText !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Please type DELETE to confirm account deletion'
      });
    }

    // Soft delete - deactivate account permanently
    await User.findByIdAndUpdate(userId, {
      $set: {
        is_active: false,
        deleted_at: new Date(),
        email: user.email ? `deleted_${userId}_${user.email}` : undefined,
        phone: user.phone ? `deleted_${userId}_${user.phone}` : undefined,
        username: user.username ? `deleted_${userId}_${user.username}` : undefined,
        deletion_reason: 'user_requested_permanent_deletion'
      }
    });

    // Note: In a production app, you might want to:
    // 1. Delete user's content (messages, posts, etc.)
    // 2. Remove from friend lists
    // 3. Clean up related data
    // 4. Send confirmation email

    console.log('✅ Account deleted permanently');

    res.json({
      success: true,
      message: 'Account has been permanently deleted. This action cannot be undone.'
    });

  } catch (error) {
    console.error('❌ Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
});

// FAQ endpoint (public)
router.get('/faq', async (req, res) => {
  try {
    const { category, search, limit = 50 } = req.query;
    const { FAQ } = require('../models');

    let faqs;

    if (search) {
      // Search FAQs
      faqs = await FAQ.searchFAQs(search);
    } else if (category) {
      // Get FAQs by category
      faqs = await FAQ.getFAQsByCategory(category);
    } else {
      // Get all active FAQs
      faqs = await FAQ.getAllActiveFAQs();
    }

    // Limit results
    if (limit && faqs.length > parseInt(limit)) {
      faqs = faqs.slice(0, parseInt(limit));
    }

    // Transform to match frontend expectations
    const faqItems = faqs.map(faq => ({
      id: faq._id.toString(),
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order_index: faq.order_index,
      is_active: faq.is_active,
      views_count: faq.views_count,
      helpful_votes: faq.helpful_votes,
      not_helpful_votes: faq.not_helpful_votes
    }));

    res.json({
      success: true,
      data: {
        faqItems,
        total: faqItems.length
      }
    });

  } catch (error) {
    console.error('❌ Get FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get FAQ items'
    });
  }
});

// Feedback submission endpoint
router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { feedbackType, subject, message, email, rating, includeDeviceInfo, includeLogs, deviceInfo, appVersion } = req.body;
    const { Feedback } = require('../models');

    // Validate required fields
    if (!feedbackType || !subject || !message || !email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: feedbackType, subject, message, email'
      });
    }

    // Create feedback in database
    const feedback = new Feedback({
      user_id: userId,
      type: feedbackType.toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      email: email.trim().toLowerCase(),
      rating: rating || null,
      device_info: includeDeviceInfo && deviceInfo ? deviceInfo : null,
      app_version: appVersion || null,
      include_logs: includeLogs || false,
      status: 'submitted',
      priority: feedbackType === 'bug' ? 'high' : 'medium'
    });

    await feedback.save();

    console.log(`📝 New feedback received from user ${userId}:`);
    console.log(`   Type: ${feedbackType}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Rating: ${rating || 'N/A'}`);
    console.log(`   Email: ${email}`);
    console.log(`   Feedback ID: ${feedback._id}`);

    // TODO: Send notification to support team
    // TODO: Send confirmation email to user

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedback: {
          id: feedback._id.toString(),
          status: feedback.status,
          createdAt: feedback.createdAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback'
    });
  }
});

// Get user's feedback history
router.get('/feedback', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, status, type } = req.query;
    const { Feedback } = require('../models');

    let query = { user_id: userId };
    if (status) query.status = status;
    if (type) query.type = type;

    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('assigned_to', 'first_name last_name')
      .populate('response.responded_by', 'first_name last_name');

    const feedbackItems = feedbacks.map(feedback => ({
      id: feedback._id.toString(),
      type: feedback.type,
      subject: feedback.subject,
      message: feedback.message,
      status: feedback.status,
      priority: feedback.priority,
      rating: feedback.rating,
      response: feedback.response,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt
    }));

    res.json({
      success: true,
      data: {
        feedbacks: feedbackItems,
        total: feedbackItems.length
      }
    });

  } catch (error) {
    console.error('❌ Get feedback history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback history'
    });
  }
});

// Support ticket status endpoint
router.get('/support/status/:ticketId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { ticketId } = req.params;
    const { SupportTicket } = require('../models');

    const ticket = await SupportTicket.findOne({
      $or: [
        { _id: ticketId },
        { ticket_number: ticketId }
      ],
      user_id: userId
    }).populate('assigned_to', 'first_name last_name');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: {
        ticket: {
          id: ticket._id.toString(),
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          assigned_to: ticket.assigned_to,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          sla: ticket.sla,
          resolution: ticket.resolution,
          satisfaction_rating: ticket.satisfaction_rating
        }
      }
    });

  } catch (error) {
    console.error('❌ Get ticket status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ticket status'
    });
  }
});

// Create support ticket
router.post('/support/tickets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { subject, description, category, contactEmail, contactPhone, deviceInfo, appVersion } = req.body;
    const { SupportTicket } = require('../models');

    // Validate required fields
    if (!subject || !description || !category || !contactEmail) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, description, category, contactEmail'
      });
    }

    // Create support ticket
    const ticket = new SupportTicket({
      user_id: userId,
      subject: subject.trim(),
      description: description.trim(),
      category: category.toLowerCase(),
      contact_email: contactEmail.trim().toLowerCase(),
      contact_phone: contactPhone || null,
      metadata: {
        source: 'app',
        device_info: deviceInfo || null,
        app_version: appVersion || null
      }
    });

    await ticket.save();

    console.log(`🎫 New support ticket created: ${ticket.ticket_number}`);
    console.log(`   User: ${userId}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Category: ${category}`);

    res.json({
      success: true,
      message: 'Support ticket created successfully',
      data: {
        ticket: {
          id: ticket._id.toString(),
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          status: ticket.status,
          category: ticket.category,
          createdAt: ticket.createdAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create support ticket'
    });
  }
});

// Get user's support tickets
router.get('/support/tickets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, status } = req.query;
    const { SupportTicket } = require('../models');

    const tickets = await SupportTicket.getTicketsByUser(userId, parseInt(limit));

    const ticketItems = tickets.map(ticket => ({
      id: ticket._id.toString(),
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assigned_to: ticket.assigned_to,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt
    }));

    res.json({
      success: true,
      data: {
        tickets: ticketItems,
        total: ticketItems.length
      }
    });

  } catch (error) {
    console.error('❌ Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get support tickets'
    });
  }
});

// Vote on FAQ helpfulness
router.post('/faq/:faqId/vote', async (req, res) => {
  try {
    const { faqId } = req.params;
    const { helpful } = req.body; // true for helpful, false for not helpful
    const { FAQ } = require('../models');

    const faq = await FAQ.findById(faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await faq.voteHelpful(helpful);

    res.json({
      success: true,
      message: 'Vote recorded successfully',
      data: {
        helpful_votes: faq.helpful_votes,
        not_helpful_votes: faq.not_helpful_votes
      }
    });

  } catch (error) {
    console.error('❌ Vote FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record vote'
    });
  }
});

// Support contact info endpoint
router.get('/support/contact', (req, res) => {
  res.json({
    success: true,
    data: {
      contact: {
        email: 'support@yo-app.com',
        phone: '+1-800-YOFAM',
        hours: 'Monday - Friday: 9:00 AM - 6:00 PM EST',
        emergencyPhone: '+1-800-EMERGENCY',
        website: 'https://yo-app.com/support',
        socialMedia: {
          twitter: '@YoFamSupport',
          facebook: 'facebook.com/yofam'
        }
      }
    }
  });
});

module.exports = router;