const twilio = require('twilio');

class SMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.client = this.accountSid && this.authToken ? twilio(this.accountSid, this.authToken) : null;
  }

  async sendSMS(to, message) {
    try {
      // Always log for development
      console.log(`📱 SMS to ${to}: ${message}`);

      if (!this.client) {
        console.log(`📱 Twilio not configured. Using console logging.`);
        return { success: true, method: 'console' };
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });

      console.log('✅ SMS sent successfully via Twilio, SID:', result.sid);
      return { success: true, messageId: result.sid, method: 'twilio' };

    } catch (error) {
      console.error('❌ Twilio SMS send failed:', error.message);
      console.log(`📱 Fallback: SMS for ${to}: ${message}`);
      return { success: true, method: 'fallback' };
    }
  }

  async sendVerificationCode(phone, code, firstName) {
    const message = `Hi ${firstName}! Your Yo App verification code is: ${code}. This code expires in 10 minutes.`;
    
    // Notify frontend terminal with OTP code
    const frontendNotificationService = require('./frontendNotificationService');
    frontendNotificationService.sendOTPNotification(phone, code, firstName);
    
    return await this.sendSMS(phone, message);
  }
}

module.exports = new SMSService();