require('dotenv').config();
const mongoose = require('mongoose');

// Quick MongoDB setup for development
const quickMongoSetup = async () => {
  console.log('🚀 Quick MongoDB Setup for Yo! Fam Backend');
  console.log('===============================================\n');
  
  console.log('Option 1: 🖥️  Local MongoDB (Recommended for development)');
  console.log('1. Download MongoDB Compass from: https://www.mongodb.com/try/download/compass');
  console.log('2. Install and open MongoDB Compass');
  console.log('3. Click "Connect" with default localhost:27017');
  console.log('4. This will start a local MongoDB instance\n');
  
  console.log('Option 2: ☁️  MongoDB Atlas (Cloud - Free)');
  console.log('1. Go to: https://cloud.mongodb.com/');
  console.log('2. Sign up for free');
  console.log('3. Create a cluster');
  console.log('4. Get connection string\n');
  
  console.log('Option 3: 🔧 Install MongoDB Community Server');
  console.log('1. Download from: https://www.mongodb.com/try/download/community');
  console.log('2. Choose "Windows" and "msi" package');
  console.log('3. Install with default settings');
  console.log('4. MongoDB will start automatically\n');
  
  // Try to create a simple test connection to see what works
  const testUris = [
    'mongodb://localhost:27017/yofam-test',
    'mongodb://127.0.0.1:27017/yofam-test'
  ];
  
  console.log('🧪 Testing possible connections...\n');
  
  for (const uri of testUris) {
    try {
      console.log(`Testing: ${uri}`);
      const connection = await mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000
      });
      
      await connection.db.admin().ping();
      console.log('✅ Connection works!');
      
      // Create a simple test document to show in Compass
      const testCollection = connection.collection('test_setup');
      await testCollection.insertOne({
        message: 'MongoDB is working!',
        timestamp: new Date(),
        database: 'yofam-test',
        status: 'active'
      });
      
      console.log('🎉 Test document created! You should see "yofam-test" database in MongoDB Compass');
      console.log('💡 Connect to MongoDB Compass: mongodb://localhost:27017\n');
      
      await connection.close();
      return true;
      
    } catch (error) {
      console.log(`❌ ${error.message}`);
    }
  }
  
  console.log('\n📝 No local MongoDB found. Please:');
  console.log('1. Install MongoDB Compass (easiest): https://www.mongodb.com/try/download/compass');
  console.log('2. Or install MongoDB Community Server: https://www.mongodb.com/try/download/community');
  console.log('3. Or use MongoDB Atlas cloud database\n');
  
  console.log('Once MongoDB is running, run: npm run mongo-init');
  
  return false;
};

if (require.main === module) {
  quickMongoSetup()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { quickMongoSetup };