const axios = require('axios');

class EmailService {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@papcy.com';
  }

  async sendVerificationEmail(email, code, firstName) {
    try {
      // Always log the code for development
      console.log(`📧 Verification code for ${email}: ${code}`);
      
      if (!this.apiKey) {
        console.log(`📧 Email service not configured. Using console logging.`);
        return { success: true, method: 'console' };
      }

      const emailData = {
        from: this.fromEmail,
        to: email,
        subject: 'Verify Your Email - Yo App',
        html: this.getVerificationEmailTemplate(firstName, code)
      };

      const response = await axios.post(
        'https://api.resend.com/emails',
        emailData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000, // 30 second timeout
          family: 4 // Force IPv4
        }
      );

      console.log('✅ Email sent successfully via Resend:', response.data);
      return { success: true, messageId: response.data.id };

    } catch (error) {
      console.error('❌ Email send failed:', error.response?.data || error.message);
      console.log(`📧 Fallback: Verification code for ${email}: ${code}`);
      return { success: true, method: 'fallback' }; // Don't fail the registration
    }
  }

  async sendWelcomeEmail(email, firstName) {
    try {
      if (!this.apiKey) {
        console.log(`📧 Welcome email not sent (service not configured) for ${email}`);
        return { success: false, error: 'Email service not configured' };
      }

      const emailData = {
        from: this.fromEmail,
        to: email,
        subject: 'Welcome to Yo App! 🎉',
        html: this.getWelcomeEmailTemplate(firstName)
      };

      const response = await axios.post(
        'https://api.resend.com/emails',
        emailData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000, // 30 second timeout
          family: 4 // Force IPv4
        }
      );

      console.log('✅ Welcome email sent:', response.data);
      return { success: true, messageId: response.data.id };

    } catch (error) {
      console.error('❌ Welcome email failed:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  getVerificationEmailTemplate(firstName, code) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 40px 30px; 
                text-align: center; 
            }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .content { padding: 40px 30px; }
            .code-container { 
                background: #f8fafc; 
                border: 2px dashed #667eea; 
                padding: 30px; 
                text-align: center; 
                margin: 30px 0; 
                border-radius: 12px; 
            }
            .code-text { 
                font-size: 36px; 
                font-weight: bold; 
                color: #667eea; 
                letter-spacing: 8px; 
                font-family: 'Courier New', monospace;
            }
            .footer { 
                background: #f8fafc; 
                padding: 20px 30px; 
                text-align: center; 
                font-size: 14px; 
                color: #6b7280; 
                border-top: 1px solid #e5e7eb;
            }
            .highlight { color: #667eea; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Welcome to Yo App!</h1>
                <p>Verify your email to get started</p>
            </div>
            <div class="content">
                <h2>Hi ${firstName}!</h2>
                <p>Thanks for signing up for Yo App! To complete your registration, please use the verification code below:</p>
                
                <div class="code-container">
                    <div class="code-text">${code}</div>
                </div>
                
                <p><strong class="highlight">Important:</strong> This code will expire in 30 minutes for security reasons.</p>
                
                <p>If you didn't create an account with us, please ignore this email.</p>
                
                <p>Best regards,<br><strong>The Yo App Team</strong></p>
            </div>
            <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async sendPasswordResetEmail(email, code, firstName) {
    try {
      // Always log the code for development
      console.log(`🔑 Password reset code for ${email}: ${code}`);
      
      if (!this.apiKey) {
        console.log(`📧 Email service not configured. Using console logging.`);
        return { success: true, method: 'console' };
      }

      const emailData = {
        from: this.fromEmail,
        to: email,
        subject: 'Reset Your Password - Yo App',
        html: this.getPasswordResetTemplate(firstName, code)
      };

      const response = await axios.post(
        'https://api.resend.com/emails',
        emailData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000, // 30 second timeout
          family: 4 // Force IPv4
        }
      );

      console.log('✅ Password reset email sent via Resend');
      return { success: true, messageId: response.data.id };

    } catch (error) {
      console.error('❌ Password reset email failed:', error.response?.data || error.message);
      console.log(`🔑 Fallback: Password reset code for ${email}: ${code}`);
      return { success: true, method: 'fallback' };
    }
  }

  getPasswordResetTemplate(firstName, code) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); 
                color: white; 
                padding: 40px 30px; 
                text-align: center; 
            }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .content { padding: 40px 30px; }
            .code-container { 
                background: #f8fafc; 
                border: 2px dashed #ef4444; 
                padding: 30px; 
                text-align: center; 
                margin: 30px 0; 
                border-radius: 12px; 
            }
            .code-text { 
                font-size: 36px; 
                font-weight: bold; 
                color: #ef4444; 
                letter-spacing: 8px; 
                font-family: 'Courier New', monospace;
            }
            .footer { 
                background: #f8fafc; 
                padding: 20px 30px; 
                text-align: center; 
                font-size: 14px; 
                color: #6b7280; 
                border-top: 1px solid #e5e7eb;
            }
            .warning { color: #ef4444; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔑 Reset Your Password</h1>
                <p>Use this code to reset your password</p>
            </div>
            <div class="content">
                <h2>Hi ${firstName}!</h2>
                <p>You requested to reset your password for your Yo App account. Use the code below to proceed:</p>
                
                <div class="code-container">
                    <div class="code-text">${code}</div>
                </div>
                
                <p><strong class="warning">Important:</strong> This code will expire in 15 minutes for security reasons.</p>
                
                <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
                
                <p>Best regards,<br><strong>The Yo App Team</strong></p>
            </div>
            <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

module.exports = new EmailService();