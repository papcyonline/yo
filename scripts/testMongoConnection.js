require('dotenv').config();
const mongoose = require('mongoose');

// Test different MongoDB connection options
const testConnections = [
  'mongodb://localhost:27017/yofam',
  'mongodb://127.0.0.1:27017/yofam', 
  'mongodb://localhost:27017/yofam-dev',
  'mongodb://127.0.0.1:27017/yofam-dev'
];

const testMongoConnection = async () => {
  console.log('🔍 Testing MongoDB connections...\n');
  
  for (let i = 0; i < testConnections.length; i++) {
    const uri = testConnections[i];
    console.log(`📡 Testing connection ${i + 1}/${testConnections.length}: ${uri}`);
    
    try {
      // Create a new connection for each test
      const connection = await mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: 3000, // 3 second timeout
        connectTimeoutMS: 3000,
        socketTimeoutMS: 3000,
      });
      
      // Try to ping the database
      await connection.db.admin().ping();
      
      console.log('✅ Connection successful!');
      console.log(`📊 Database: ${connection.name}`);
      
      // Try to create a simple collection
      const testCollection = connection.collection('connection_test');
      await testCollection.insertOne({ 
        test: true, 
        timestamp: new Date(),
        message: 'MongoDB connection test successful' 
      });
      
      console.log('✅ Write test successful!');
      
      // Clean up test document
      await testCollection.deleteOne({ test: true });
      console.log('✅ Cleanup successful!');
      
      await connection.close();
      console.log('🎉 This connection works! Use this URI:', uri);
      console.log('💡 Open MongoDB Compass and connect to:', uri.replace('/yofam', ''));
      return uri;
      
    } catch (error) {
      console.log('❌ Connection failed:', error.message);
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('💔 All connection attempts failed.');
  console.log('');
  console.log('🔧 To fix this, you need to:');
  console.log('1. Install MongoDB Community Server from: https://www.mongodb.com/try/download/community');
  console.log('2. Start MongoDB service');
  console.log('3. Or use MongoDB Atlas cloud database');
  console.log('');
  console.log('📝 Alternative: Add MongoDB Atlas URI to .env file:');
  console.log('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/yofam');
  
  return null;
};

// Run the test
if (require.main === module) {
  testMongoConnection()
    .then((workingUri) => {
      if (workingUri) {
        console.log('\n🚀 Ready to initialize MongoDB with working connection!');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testMongoConnection };