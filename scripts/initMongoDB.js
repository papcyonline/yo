const { connectMongoDB } = require('../config/mongodb');
const { User, PhoneVerification, EmailVerification } = require('../models');

// Initialize MongoDB with test data
const initializeMongoDB = async () => {
  try {
    console.log('🚀 Starting MongoDB initialization...');
    
    // Connect to MongoDB
    const connected = await connectMongoDB();
    if (!connected) {
      console.error('❌ Failed to connect to MongoDB');
      process.exit(1);
    }
    
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database name:', process.env.NODE_ENV === 'production' ? 'yofam-prod' : 'yofam-dev');
    
    // Create indexes explicitly
    console.log('🔧 Creating database indexes...');
    
    // Create User indexes
    await User.createIndexes();
    console.log('✅ User indexes created');
    
    // Create PhoneVerification indexes  
    await PhoneVerification.createIndexes();
    console.log('✅ PhoneVerification indexes created');
    
    // Create EmailVerification indexes
    await EmailVerification.createIndexes();
    console.log('✅ EmailVerification indexes created');
    
    // Check if any users exist
    const userCount = await User.countDocuments();
    console.log(`📈 Current user count: ${userCount}`);
    
    // Create a test user if none exist
    if (userCount === 0) {
      console.log('👤 Creating test user...');
      
      const testUser = new User({
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        phone: '+1234567890',
        email: 'test@example.com',
        phone_verified: true,
        is_active: true,
        bio: 'This is a test user created during MongoDB initialization',
        location: 'Test City',
        date_of_birth: new Date('1990-01-01'),
        gender: 'Other'
      });
      
      await testUser.save();
      console.log('✅ Test user created:', testUser.username);
      console.log('🆔 User ID:', testUser._id);
    }
    
    // List all collections
    const collections = await User.db.listCollections().toArray();
    console.log('📋 Available collections:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    // Show database stats
    const stats = await User.db.stats();
    console.log('📊 Database statistics:');
    console.log(`  - Collections: ${stats.collections}`);
    console.log(`  - Data Size: ${(stats.dataSize / 1024).toFixed(2)} KB`);
    console.log(`  - Index Size: ${(stats.indexSize / 1024).toFixed(2)} KB`);
    
    console.log('🎉 MongoDB initialization completed successfully!');
    console.log('💡 You should now see "yofam-dev" database in MongoDB Compass');
    console.log('🔗 Connect to MongoDB Compass: mongodb://localhost:27017');
    
  } catch (error) {
    console.error('❌ MongoDB initialization failed:', error.message);
    console.error('📋 Full error:', error);
  } finally {
    process.exit(0);
  }
};

// Run initialization if this script is called directly
if (require.main === module) {
  initializeMongoDB();
}

module.exports = { initializeMongoDB };