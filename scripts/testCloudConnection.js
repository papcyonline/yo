require('dotenv').config();
const mongoose = require('mongoose');

const testCloudConnection = async () => {
  console.log('☁️  Testing MongoDB Atlas connection...\n');
  
  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI not found in .env file');
    console.log('📝 Please add your MongoDB Atlas connection string to .env:');
    console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/yofam\n');
    console.log('💡 Run: node scripts/setupCloudMongoDB.js for setup guide');
    return false;
  }
  
  const uri = process.env.MONGODB_URI;
  console.log('🔗 Testing connection to:', uri.replace(/:([^:@]{8})[^:@]*@/, ':****@')); // Hide password
  
  try {
    // Connect with timeout
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      connectTimeoutMS: 10000,
    });
    
    console.log('✅ MongoDB Atlas connection successful!');
    console.log('📊 Database:', mongoose.connection.name);
    
    // Test write operation
    const testCollection = mongoose.connection.collection('connection_test');
    const result = await testCollection.insertOne({ 
      test: true, 
      timestamp: new Date(),
      message: 'MongoDB Atlas connection test successful',
      server: 'cloud'
    });
    
    console.log('✅ Write test successful!');
    console.log('🆔 Test document ID:', result.insertedId);
    
    // Clean up
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('✅ Cleanup successful!');
    
    await mongoose.connection.close();
    console.log('🎉 MongoDB Atlas is ready to use!');
    console.log('🚀 Run: npm run init-mongo to initialize the database');
    
    return true;
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('');
    console.log('🔧 Common issues:');
    console.log('1. Check your username/password in the connection string');
    console.log('2. Ensure your IP is whitelisted (or use 0.0.0.0/0 for development)');
    console.log('3. Verify the cluster is running in Atlas dashboard');
    console.log('4. Check if the database user has proper permissions');
    console.log('');
    console.log('💡 Run: node scripts/setupCloudMongoDB.js for setup guide');
    
    return false;
  }
};

if (require.main === module) {
  testCloudConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCloudConnection };