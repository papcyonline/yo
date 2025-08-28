const { connectMongoDB } = require('./config/mongodb');
const { User } = require('./models');

(async () => {
  try {
    await connectMongoDB();
    const users = await User.find({}).select('first_name last_name phone email created_at').limit(20);
    console.log('=== EXISTING USERS IN DATABASE ===');
    console.log('Total users found:', users.length);
    console.log();
    users.forEach((user, i) => {
      console.log(`${i+1}. ${user.first_name} ${user.last_name}`);
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Created: ${user.created_at}`);
      console.log();
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();