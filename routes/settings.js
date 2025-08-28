const { User } = require('../../models');
const UserPreference = require('../../models/UserPreference');
const bcrypt = require('bcryptjs');

// Get user preferences
const getPreferences = async (req, res) => {
  try {
    let preferences = await UserPreference.findOne({ user_id: req.userId });

    // If no preferences exist, create default ones
    if (!preferences) {
      const defaultPreferences = {
        user_id: req.userId,
        dark_mode: false,
        notifications_enabled: true,
        location_enabled: true,
        language: 'en',
        privacy_level: 'friends',
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        match_notifications: true,
        message_notifications: true,
        friend_request_notifications: true
      };

      preferences = new UserPreference(defaultPreferences);
      await preferences.save();
    }

    res.json({
      success: true,
      data: { preferences }
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences'
    });
  }
};

// Update user preferences
const updatePreferences = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // Remove non-updatable fields
    delete updates.user_id;
    delete updates.created_at;
    delete updates.updated_at;

    const preferences = await UserPreference.findOneAndUpdate(
      { user_id: req.userId },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
};

// Delete user account
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.userId;

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
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }
    }

    // Soft delete - deactivate account
    await User.findByIdAndUpdate(userId, {
      $set: {
        is_active: false,
        deleted_at: new Date(),
        email: user.email ? `deleted_${userId}_${user.email}` : undefined
      }
    });

    // Delete user preferences
    await UserPreference.deleteOne({ user_id: userId });

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    if (user.password_hash) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await User.findByIdAndUpdate(userId, {
      $set: { password_hash: hashedNewPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// Get privacy settings
const getPrivacySettings = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('privacy_settings profile_visibility location_sharing');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const privacySettings = {
      profile_visibility: user.profile_visibility || 'friends',
      location_sharing: user.location_sharing || 'friends',
      ...(user.privacy_settings || {})
    };

    res.json({
      success: true,
      data: { privacy_settings: privacySettings }
    });

  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch privacy settings'
    });
  }
};

// Update privacy settings
const updatePrivacySettings = async (req, res) => {
  try {
    const { profile_visibility, location_sharing, ...otherSettings } = req.body;

    const updates = {};
    if (profile_visibility) updates.profile_visibility = profile_visibility;
    if (location_sharing) updates.location_sharing = location_sharing;
    if (Object.keys(otherSettings).length > 0) {
      updates.privacy_settings = otherSettings;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, select: 'privacy_settings profile_visibility location_sharing' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: { privacy_settings: { ...user.privacy_settings, profile_visibility: user.profile_visibility, location_sharing: user.location_sharing } }
    });

  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings'
    });
  }
};

// Get Terms of Service (public)
const getTermsOfService = async (req, res) => {
  try {
    const currentVersion = '1.0.0'; // Update this when terms change
    res.json({
      success: true,
      data: {
        title: 'Terms of Service',
        content: `
# YoFam Terms of Service

**Effective Date:** January 1, 2025
**Version:** ${currentVersion}

## 1. Acceptance of Terms
By using YoFam, you agree to be bound by these Terms of Service.

## 2. User Accounts
You must provide accurate information when creating your account.

## 3. Privacy
Your privacy is important to us. Please review our Privacy Policy.

## 4. User Conduct
You agree to use YoFam responsibly and respectfully.

## 5. Content
You are responsible for the content you share on YoFam.

## 6. Termination
We may terminate accounts that violate these terms.

## 7. Changes to Terms
We may update these terms from time to time.

For questions, contact: support@yofam.com
        `,
        version: currentVersion,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch terms of service'
    });
  }
};

// Get Privacy Policy (public)
const getPrivacyPolicy = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        title: 'Privacy Policy',
        content: 'YoFam Privacy Policy content goes here...',
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch privacy policy'
    });
  }
};

// Get About info (public)
const getAboutInfo = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        app_name: 'YoFam',
        version: '1.0.0',
        description: 'AI-powered family connection and heritage discovery app',
        company: 'YoFam Inc.',
        contact_email: 'support@yofam.com',
        website: 'https://yofam.com',
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch about information'
    });
  }
};

// Accept Terms of Service (authenticated)
const acceptTermsOfService = async (req, res) => {
  try {
    const userId = req.userId;
    const currentVersion = '1.0.0'; // Must match getTermsOfService version
    
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          terms_accepted: true,
          terms_accepted_at: new Date(),
          terms_version: currentVersion
        }
      },
      { new: true, select: 'terms_accepted terms_accepted_at terms_version' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Terms of Service accepted successfully',
      data: {
        terms_accepted: user.terms_accepted,
        terms_accepted_at: user.terms_accepted_at,
        terms_version: user.terms_version
      }
    });

  } catch (error) {
    console.error('Accept terms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept terms of service'
    });
  }
};

// Accept Privacy Policy (authenticated)
const acceptPrivacyPolicy = async (req, res) => {
  try {
    const userId = req.userId;
    const currentVersion = '1.0.0'; // Must match getPrivacyPolicy version
    
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          privacy_policy_accepted: true,
          privacy_policy_accepted_at: new Date(),
          privacy_policy_version: currentVersion
        }
      },
      { new: true, select: 'privacy_policy_accepted privacy_policy_accepted_at privacy_policy_version' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Privacy Policy accepted successfully',
      data: {
        privacy_policy_accepted: user.privacy_policy_accepted,
        privacy_policy_accepted_at: user.privacy_policy_accepted_at,
        privacy_policy_version: user.privacy_policy_version
      }
    });

  } catch (error) {
    console.error('Accept privacy policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept privacy policy'
    });
  }
};

// Get user's acceptance status
const getAcceptanceStatus = async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId)
      .select('terms_accepted terms_accepted_at terms_version privacy_policy_accepted privacy_policy_accepted_at privacy_policy_version');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentTermsVersion = '1.0.0';
    const currentPrivacyVersion = '1.0.0';

    // Check if user needs to re-accept updated terms
    const needsTermsUpdate = !user.terms_accepted || user.terms_version !== currentTermsVersion;
    const needsPrivacyUpdate = !user.privacy_policy_accepted || user.privacy_policy_version !== currentPrivacyVersion;

    res.json({
      success: true,
      data: {
        terms_accepted: user.terms_accepted || false,
        terms_accepted_at: user.terms_accepted_at,
        terms_version: user.terms_version,
        needs_terms_update: needsTermsUpdate,
        current_terms_version: currentTermsVersion,
        
        privacy_policy_accepted: user.privacy_policy_accepted || false,
        privacy_policy_accepted_at: user.privacy_policy_accepted_at,
        privacy_policy_version: user.privacy_policy_version,
        needs_privacy_update: needsPrivacyUpdate,
        current_privacy_version: currentPrivacyVersion,
        
        requires_action: needsTermsUpdate || needsPrivacyUpdate
      }
    });

  } catch (error) {
    console.error('Get acceptance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get acceptance status'
    });
  }
};

module.exports = {
  getPreferences,
  updatePreferences,
  deleteAccount,
  changePassword,
  getPrivacySettings,
  updatePrivacySettings,
  getTermsOfService,
  getPrivacyPolicy,
  getAboutInfo,
  acceptTermsOfService,
  acceptPrivacyPolicy,
  getAcceptanceStatus
};