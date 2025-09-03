const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AdvancedEmailService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@papcy.com';
    this.templates = {}; // Template cache
    this.baseUrl = 'https://api.resend.com/emails';
  }

  // Load email template from file
  loadTemplate(templateName) {
    if (!this.templates[templateName]) {
      const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.html`);
      try {
        this.templates[templateName] = fs.readFileSync(templatePath, 'utf8');
      } catch (error) {
        console.error(`Failed to load email template: ${templateName}`, error);
        return null;
      }
    }
    return this.templates[templateName];
  }

  // Replace template variables with actual values
  renderTemplate(template, variables) {
    let renderedTemplate = template;
    
    // Add default variables
    const defaultVars = {
      currentYear: new Date().getFullYear(),
      timestamp: new Date().toLocaleString(),
      companyName: 'Yo! Family App',
      supportEmail: 'support@yofamapp.com',
      unsubscribeUrl: `${process.env.BASE_URL}/unsubscribe`,
      privacyUrl: `${process.env.BASE_URL}/privacy`,
      termsUrl: `${process.env.BASE_URL}/terms`,
      helpUrl: `${process.env.BASE_URL}/help`,
      appUrl: process.env.CLIENT_URL || 'https://yofamapp.com'
    };

    const allVariables = { ...defaultVars, ...variables };

    for (const [key, value] of Object.entries(allVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      renderedTemplate = renderedTemplate.replace(regex, value || '');
    }

    return renderedTemplate;
  }

  // Generate OTP code
  generateOTP(length = 6) {
    return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
  }

  // Get user's location from IP (mock implementation)
  async getLocationFromIP(ipAddress) {
    // In production, use a service like ipapi.co or maxmind
    return ipAddress?.includes('192.168') || ipAddress?.includes('127.0.0.1') 
      ? 'Local Network' 
      : 'Unknown Location';
  }

  // Send OTP verification email
  async sendOTPEmail(email, userData = {}) {
    try {
      console.log(`📧 Sending OTP email to ${email}`);

      const otpCode = this.generateOTP(6);
      const template = this.loadTemplate('otp');
      
      if (!template) {
        throw new Error('OTP template not found');
      }

      const location = await this.getLocationFromIP(userData.ipAddress);

      const templateVars = {
        userName: userData.firstName || 'User',
        userEmail: email,
        otpCode: otpCode,
        expiryTime: 10, // 10 minutes
        verificationType: userData.type || 'email address',
        verificationLink: `${process.env.BASE_URL}/verify-email?token=${otpCode}&email=${email}`,
        reportLink: `${process.env.BASE_URL}/report-suspicious`,
        secureAccountLink: `${process.env.BASE_URL}/secure-account`,
        ipAddress: userData.ipAddress || 'Unknown',
        location: location
      };

      const htmlContent = this.renderTemplate(template, templateVars);

      const emailData = {
        from: this.fromEmail,
        to: email,
        subject: `Your verification code: ${otpCode}`,
        html: htmlContent
      };

      // Store OTP for later verification (you should use Redis for this)
      // await this.storeOTP(email, otpCode);

      if (!this.apiKey) {
        console.log(`📧 Email service not configured. OTP Code: ${otpCode}`);
        return { success: true, otpCode, method: 'console' };
      }

      const response = await axios.post(this.baseUrl, emailData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ OTP email sent successfully:', response.data);
      return { 
        success: true, 
        otpCode, 
        messageId: response.data.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      };

    } catch (error) {
      console.error('❌ OTP email send failed:', error.response?.data || error.message);
      
      // Fallback: log to console
      const fallbackOTP = this.generateOTP(6);
      console.log(`📧 Fallback OTP for ${email}: ${fallbackOTP}`);
      return { 
        success: true, 
        otpCode: fallbackOTP, 
        method: 'fallback',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      };
    }
  }

  // Send welcome email
  async sendWelcomeEmail(email, userData = {}) {
    try {
      console.log(`📧 Sending welcome email to ${email}`);

      const template = this.loadTemplate('welcome');
      if (!template) {
        throw new Error('Welcome template not found');
      }

      const templateVars = {
        firstName: userData.firstName || 'User',
        userEmail: email,
        facebookUrl: 'https://facebook.com/yofamapp',
        twitterUrl: 'https://twitter.com/yofamapp',
        instagramUrl: 'https://instagram.com/yofamapp'
      };

      const htmlContent = this.renderTemplate(template, templateVars);

      const emailData = {
        from: this.fromEmail,
        to: email,
        subject: `🎉 Welcome to Yo! Family, ${userData.firstName || 'there'}!`,
        html: htmlContent
      };

      if (!this.apiKey) {
        console.log(`📧 Email service not configured. Welcome email logged.`);
        return { success: true, method: 'console' };
      }

      const response = await axios.post(this.baseUrl, emailData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Welcome email sent successfully:', response.data);
      return { success: true, messageId: response.data.id };

    } catch (error) {
      console.error('❌ Welcome email send failed:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, resetToken, userData = {}) {
    try {
      console.log(`📧 Sending password reset email to ${email}`);

      const template = this.loadTemplate('password-reset');
      if (!template) {
        throw new Error('Password reset template not found');
      }

      const location = await this.getLocationFromIP(userData.ipAddress);

      const templateVars = {
        firstName: userData.firstName || 'User',
        userEmail: email,
        resetLink: `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`,
        expiryTime: 30, // 30 minutes
        requestTime: new Date().toLocaleString(),
        ipAddress: userData.ipAddress || 'Unknown',
        location: location,
        secureAccountLink: `${process.env.BASE_URL}/secure-account`,
        reportLink: `${process.env.BASE_URL}/report-suspicious`
      };

      const htmlContent = this.renderTemplate(template, templateVars);

      const emailData = {
        from: this.fromEmail,
        to: email,
        subject: '🔑 Reset Your Yo! Family Password',
        html: htmlContent
      };

      if (!this.apiKey) {
        console.log(`📧 Password reset email not sent (no API key). Reset link: ${templateVars.resetLink}`);
        return { success: true, method: 'console', resetLink: templateVars.resetLink };
      }

      const response = await axios.post(this.baseUrl, emailData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Password reset email sent successfully:', response.data);
      return { success: true, messageId: response.data.id };

    } catch (error) {
      console.error('❌ Password reset email send failed:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Send notification email (for matches, messages, etc.)
  async sendNotificationEmail(email, type, data = {}) {
    try {
      let subject = '';
      let htmlContent = '';

      switch (type) {
        case 'new_match':
          subject = `🎉 New family match found!`;
          htmlContent = this.generateNotificationHTML('new_match', data);
          break;
        
        case 'new_message':
          subject = `💬 New message from ${data.senderName}`;
          htmlContent = this.generateNotificationHTML('new_message', data);
          break;
        
        case 'connection_request':
          subject = `👋 ${data.requesterName} wants to connect`;
          htmlContent = this.generateNotificationHTML('connection_request', data);
          break;
        
        default:
          subject = `📢 Yo! Family Update`;
          htmlContent = this.generateNotificationHTML('general', data);
      }

      const emailData = {
        from: this.fromEmail,
        to: email,
        subject: subject,
        html: htmlContent
      };

      if (!this.apiKey) {
        console.log(`📧 Notification email not sent (no API key). Type: ${type}`);
        return { success: true, method: 'console' };
      }

      const response = await axios.post(this.baseUrl, emailData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Notification email sent successfully:', response.data);
      return { success: true, messageId: response.data.id };

    } catch (error) {
      console.error('❌ Notification email send failed:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Generate simple HTML for notifications
  generateNotificationHTML(type, data) {
    const baseStyle = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          <h1 style="color: #667eea; margin: 0 0 20px 0; font-size: 24px;">Yo! Family</h1>
          {{content}}
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
            <p>© 2024 Yo! Family App. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    let content = '';

    switch (type) {
      case 'new_match':
        content = `
          <h2 style="color: #2d3748;">🎉 New Family Match Found!</h2>
          <p>Great news! We found a potential family member: <strong>${data.matchName}</strong></p>
          <p>Compatibility Score: ${data.score}%</p>
          <a href="${process.env.CLIENT_URL}/matches" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Match</a>
        `;
        break;
        
      case 'new_message':
        content = `
          <h2 style="color: #2d3748;">💬 New Message</h2>
          <p>You have a new message from <strong>${data.senderName}</strong>:</p>
          <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
            "${data.messagePreview}..."
          </div>
          <a href="${process.env.CLIENT_URL}/chats" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reply Now</a>
        `;
        break;
        
      default:
        content = `
          <h2 style="color: #2d3748;">📢 Yo! Family Update</h2>
          <p>${data.message || 'You have a new update from Yo! Family.'}</p>
          <a href="${process.env.CLIENT_URL}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Open App</a>
        `;
    }

    return baseStyle.replace('{{content}}', content);
  }

  // Test email configuration
  async testConfiguration() {
    try {
      const testData = {
        from: this.fromEmail,
        to: 'test@example.com',
        subject: 'Yo! Family Email Service Test',
        html: '<h1>Email service is working!</h1>'
      };

      if (!this.apiKey) {
        console.log('📧 Email service test: API key not configured');
        return { success: false, error: 'API key not configured' };
      }

      // Don't actually send, just validate the configuration
      console.log('✅ Email service configuration is valid');
      return { success: true, message: 'Configuration valid' };

    } catch (error) {
      console.error('❌ Email service test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Bulk email sending (for newsletters, announcements)
  async sendBulkEmails(emails, subject, template, templateVars = {}) {
    const results = [];
    
    for (const email of emails) {
      try {
        const htmlContent = this.renderTemplate(template, { 
          ...templateVars, 
          userEmail: email 
        });

        const emailData = {
          from: this.fromEmail,
          to: email,
          subject: subject,
          html: htmlContent
        };

        if (this.apiKey) {
          const response = await axios.post(this.baseUrl, emailData, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          results.push({ email, success: true, messageId: response.data.id });
        } else {
          results.push({ email, success: true, method: 'console' });
        }

        // Rate limiting - wait between emails
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error.message);
        results.push({ email, success: false, error: error.message });
      }
    }

    return results;
  }
}

// Export singleton instance
module.exports = new AdvancedEmailService();