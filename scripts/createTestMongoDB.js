require('dotenv').config();
const mongoose = require('mongoose');

// Use MongoDB Atlas demo database for testing
const createTestMongoDB = async () => {
  console.log('🧪 Creating test MongoDB database...');
  console.log('=====================================\n');
  
  // Use a demo MongoDB Atlas URI that should work
  const testUris = [
    // Local fallback
    'mongodb://localhost:27017/yofam-dev',
    // MongoDB Atlas free cluster (if user has one)
    process.env.MONGODB_URI
  ].filter(Boolean);
  
  if (testUris.length === 0) {
    console.log('⚠️  No MongoDB URI found.');
    console.log('Creating a development database setup...\n');
    
    // Create a memory-based approach using mongoose without actual MongoDB
    try {
      // Try to use in-memory MongoDB for testing
      const { MongoMemoryServer } = require('mongodb-memory-server');
      
      console.log('🚀 Starting in-memory MongoDB for testing...');
      const mongod = await MongoMemoryServer.create({
        instance: {
          dbName: 'yofam-test',
          port: 27017
        }
      });
      
      const uri = mongod.getUri();
      console.log('✅ In-memory MongoDB started:', uri);
      
      // Connect and create test data
      await mongoose.connect(uri);
      
      // Create test collections
      const testCollection = mongoose.connection.collection('users');
      await testCollection.insertOne({
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date(),
        message: 'Test MongoDB database created successfully!'
      });
      
      console.log('✅ Test database created with sample data');
      console.log('💡 Connect to MongoDB Compass: ' + uri);
      console.log('🎉 You should now see the "yofam-test" database');
      
      return { success: true, uri, mongod };
      
    } catch (error) {
      console.log('❌ Could not create in-memory MongoDB:', error.message);
    }
  }
  
  // Try existing URIs
  for (const uri of testUris) {
    console.log(`🔗 Testing: ${uri.replace(/:([^:@]{8})[^:@]*@/, ':****@')}`);
    
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
      });
      
      console.log('✅ Connected successfully!');
      
      // Create test data
      const collections = ['users', 'phoneverifications', 'emailverifications'];
      
      for (const collectionName of collections) {
        const collection = mongoose.connection.collection(collectionName);
        await collection.insertOne({
          test: true,
          message: `${collectionName} collection initialized`,
          timestamp: new Date(),
          database: mongoose.connection.name
        });
        console.log(`✅ Created test data in: ${collectionName}`);
      }
      
      console.log(`🎉 Database "${mongoose.connection.name}" created with test data!`);
      console.log('💡 Open MongoDB Compass and connect to see your data');
      
      return { success: true, uri };
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      continue;
    }
  }
  
  // If all else fails, provide setup instructions
  console.log('\n💡 To create a MongoDB database that shows in Compass:');
  console.log('');
  console.log('Option 1 - MongoDB Atlas (Free Cloud Database):');
  console.log('1. Go to https://cloud.mongodb.com/');
  console.log('2. Sign up for free');
  console.log('3. Create a new project: "YoFam"');
  console.log('4. Create a cluster (choose FREE tier)');
  console.log('5. Add database user and whitelist IP');
  console.log('6. Get connection string');
  console.log('7. Add to .env: MONGODB_URI=mongodb+srv://...');
  console.log('8. Run: npm run mongo-init');
  console.log('');
  console.log('Option 2 - Local MongoDB:');
  console.log('1. Download: https://www.mongodb.com/try/download/community');
  console.log('2. Install MongoDB Community Server');
  console.log('3. Start MongoDB service');
  console.log('4. Run: npm run mongo-init');
  console.log('');
  console.log('Option 3 - MongoDB Compass with local server:');
  console.log('1. Download MongoDB Compass: https://www.mongodb.com/try/download/compass');
  console.log('2. Install and open Compass');
  console.log('3. Connect to: mongodb://localhost:27017');
  console.log('4. Run: npm run mongo-init');
  
  return { success: false };
};

if (require.main === module) {
  createTestMongoDB()
    .then((result) => {
      if (!result.success) {
        console.log('\n🔧 Next steps: Set up MongoDB and run npm run mongo-init');
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Failed to create test database:', error);
      process.exit(1);
    });
}

module.exports = { createTestMongoDB };