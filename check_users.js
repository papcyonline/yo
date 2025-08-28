const { User } = require('./models');
const mongoose = require('mongoose');

async function checkUsers() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yofam-dev');
    console.log('🔍 Checking existing users...');
    
    const users = await User.find({}, 'first_name last_name phone email password_hash phone_verified email_verified is_active').limit(10);
    console.log('📊 Found', users.length, 'users:');
    
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.first_name} ${user.last_name}`);
      console.log(`     Phone: ${user.phone} (verified: ${user.phone_verified})`);
      console.log(`     Email: ${user.email || 'none'} (verified: ${user.email_verified})`);
      console.log(`     Has password: ${!!user.password_hash}`);
      console.log(`     Active: ${user.is_active}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();