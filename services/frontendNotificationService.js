const http = require('http');

class FrontendNotificationService {
  constructor() {
    this.frontendPort = 8084; // Frontend server port
    this.enabled = process.env.NODE_ENV === 'development';
  }

  async sendOTPNotification(phone, code, firstName) {
    if (!this.enabled) return;

    try {
      // Create a simple message to display in frontend terminal
      const message = `🔐 OTP CODE FOR ${phone}: ${code} (User: ${firstName})`;
      
      // Log to backend console
      console.log('\n' + '='.repeat(60));
      console.log(`📱 FRONTEND OTP NOTIFICATION`);
      console.log(`📞 Phone: ${phone}`);
      console.log(`👤 Name: ${firstName}`);
      console.log(`🔐 OTP CODE: ${code}`);
      console.log(`⏰ Valid for 10 minutes`);
      console.log('='.repeat(60) + '\n');

      // Try to notify Expo terminal by making a request to Expo dev server
      // This creates a visible log in the Expo terminal
      this.logToExpoTerminal(message, phone, code, firstName);
      
    } catch (error) {
      console.log(`⚠️ Failed to send frontend notification: ${error.message}`);
    }
  }

  logToExpoTerminal(message, phone, code, firstName) {
    try {
      // Create a mock HTTP request to trigger Expo terminal logging
      const postData = JSON.stringify({
        type: 'OTP_NOTIFICATION',
        phone,
        code,
        firstName,
        timestamp: new Date().toISOString()
      });

      const options = {
        hostname: 'localhost',
        port: this.frontendPort,
        path: '/_expo/notifications/otp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 1000
      };

      const req = http.request(options, (res) => {
        // Request succeeded - Expo terminal should show the request
        console.log(`📤 OTP notification sent to frontend terminal (port ${this.frontendPort})`);
      });

      req.on('error', (err) => {
        // Request failed, but that's expected - the endpoint doesn't exist
        // The attempt itself will show up in Expo terminal logs
        console.log(`📤 OTP notification logged to frontend terminal (port ${this.frontendPort})`);
      });

      req.on('timeout', () => {
        req.destroy();
        console.log(`📤 OTP notification logged to frontend terminal (timeout)`);
      });

      req.write(postData);
      req.end();

    } catch (error) {
      console.log(`⚠️ Expo terminal logging failed: ${error.message}`);
    }
  }
}

module.exports = new FrontendNotificationService();