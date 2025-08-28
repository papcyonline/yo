const { PhoneVerification, EmailVerification } = require('./models');
const mongoose = require('mongoose');

async function checkVerifications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yo_app');
    console.log('🔍 Checking verification records...');
    
    const phoneVerifications = await PhoneVerification.find({}).limit(10);
    console.log('📱 Phone verifications:', phoneVerifications.length);
    
    phoneVerifications.forEach((verification, index) => {
      console.log(`  ${index + 1}. Phone: ${verification.phone}`);
      console.log(`     Name: ${verification.first_name} ${verification.last_name}`);
      console.log(`     Code: ${verification.code}`);
      console.log(`     Used: ${verification.used}`);
      console.log(`     Expires: ${verification.expires_at}`);
      console.log('');
    });
    
    const emailVerifications = await EmailVerification.find({}).limit(10);
    console.log('📧 Email verifications:', emailVerifications.length);
    
    emailVerifications.forEach((verification, index) => {
      console.log(`  ${index + 1}. Email: ${verification.email}`);
      console.log(`     User ID: ${verification.user_id}`);
      console.log(`     Used: ${verification.used}`);
      console.log(`     Expires: ${verification.expires_at}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkVerifications();