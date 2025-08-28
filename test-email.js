const axios = require('axios');
require('dotenv').config();

async function testEmail() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  console.log('Testing Resend email with:');
  console.log('API Key:', apiKey ? '✅ Found' : '❌ Missing');
  console.log('From Email:', fromEmail);
  
  const emailData = {
    from: fromEmail,
    to: 'papcynfor@gmail.com',
    subject: 'Test Email from Yo App',
    html: `
      <h1>Test Email</h1>
      <p>This is a test email from your Yo App backend.</p>
      <p>Your OTP code for testing: <strong>123456</strong></p>
    `
  };

  try {
    console.log('\n📧 Sending test email...');
    const response = await axios.post(
      'https://api.resend.com/emails',
      emailData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Email sent successfully!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Error sending email:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testEmail();