const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

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
router.get('/preferences', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      preferences: {
        dark_mode: true,
        notifications_enabled: true,
        location_enabled: false,
        language: 'en',
        privacy_level: 'friends'
      }
    }
  });
});

router.put('/preferences', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Preferences updated successfully'
  });
});

// Privacy settings endpoints (protected)
router.get('/privacy', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      privacy_settings: {
        profile_visibility: 'friends',
        location_sharing: 'none',
        show_online_status: true
      }
    }
  });
});

router.put('/privacy', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Privacy settings updated successfully'
  });
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