const { connectMongoDB } = require('../config/mongodb');
const mongoose = require('mongoose');

const checkDatabase = async () => {
  try {
    console.log('🔍 Checking MongoDB database...');
    
    await connectMongoDB();
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      console.log(`  - ${collection.name}`);
      
      // Count documents in each collection
      const count = await db.collection(collection.name).countDocuments();
      console.log(`    Documents: ${count}`);
      
      // Show sample document if any exist
      if (count > 0) {
        const sample = await db.collection(collection.name).findOne();
        console.log(`    Sample:`, Object.keys(sample));
      }
    }
    
    // Database stats
    const stats = await db.stats();
    console.log(`\n📊 Database Statistics:`);
    console.log(`   Database: ${db.databaseName}`);
    console.log(`   Collections: ${stats.collections}`);
    console.log(`   Data Size: ${(stats.dataSize / 1024).toFixed(2)} KB`);
    
    console.log('\n🎉 MongoDB is working! Database is accessible.');
    console.log('💡 Open MongoDB Compass and connect to: mongodb://localhost:27017');
    console.log(`📂 You should see database: ${db.databaseName}`);
    
  } catch (error) {
    console.log('❌ Database check failed:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

checkDatabase();