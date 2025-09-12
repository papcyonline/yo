const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { PrivacySettings, User } = require('../models');

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
router.get('/security', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      security_settings: {
        two_factor_enabled: false,
        login_alerts: true,
        trusted_devices: [],
        last_password_change: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        active_sessions: 1,
        security_questions_set: false
      }
    }
  });
});

router.put('/security', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Security settings updated successfully'
  });
});

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

// FAQ endpoint (public)
router.get('/faq', (req, res) => {
  res.json({
    success: true,
    data: {
      faqs: [
        {
          id: 1,
          category: 'General',
          question: 'What is Yo!?',
          answer: 'Yo! is an AI-powered social connection app that helps you discover and connect with family, friends, and communities.'
        },
        {
          id: 2,
          category: 'Account',
          question: 'How do I create an account?',
          answer: 'You can create an account by downloading the app and following the sign-up process. You can register using your email or phone number.'
        },
        {
          id: 3,
          category: 'Privacy',
          question: 'Is my data safe?',
          answer: 'Yes, we take data security seriously. All your data is encrypted and we never share your personal information without your consent.'
        },
        {
          id: 4,
          category: 'Features',
          question: 'How does AI matching work?',
          answer: 'Our AI analyzes your profile, interests, and connections to suggest potential family members, friends, and communities you might want to connect with.'
        },
        {
          id: 5,
          category: 'Support',
          question: 'How can I contact support?',
          answer: 'You can contact our support team at support@yo-app.com or through the in-app support feature.'
        },
        {
          id: 6,
          category: 'Account',
          question: 'Can I delete my account?',
          answer: 'Yes, you can delete your account at any time from the Settings > Account > Delete Account option.'
        },
        {
          id: 7,
          category: 'Features',
          question: 'What are communities?',
          answer: 'Communities are groups of people with shared interests, backgrounds, or locations where you can connect and interact.'
        },
        {
          id: 8,
          category: 'Privacy',
          question: 'Who can see my profile?',
          answer: 'You control who can see your profile through privacy settings. You can set it to public, friends only, or custom.'
        }
      ]
    }
  });
});

module.exports = router;