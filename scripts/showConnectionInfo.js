const mongoose = require('mongoose');

const showConnectionInfo = async () => {
  try {
    console.log('🔗 MongoDB Connection Information');
    console.log('================================\n');
    
    // Connect to show exact details
    await mongoose.connect('mongodb://localhost:27017/yofam');
    
    console.log('✅ Connection successful!');
    console.log('📍 Host:', mongoose.connection.host);
    console.log('📍 Port:', mongoose.connection.port);
    console.log('📍 Database:', mongoose.connection.name);
    console.log('📍 Full URI:', `mongodb://${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
    
    // List all databases
    const adminDb = mongoose.connection.db.admin();
    const databasesList = await adminDb.listDatabases();
    
    console.log('\n📋 All databases on this MongoDB server:');
    databasesList.databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // List collections in our database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📋 Collections in "${mongoose.connection.name}" database:`);
    
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`  - ${collection.name}: ${count} documents`);
      
      if (count > 0) {
        const sample = await mongoose.connection.db.collection(collection.name).findOne();
        console.log(`    Sample fields: ${Object.keys(sample).slice(0, 5).join(', ')}...`);
      }
    }
    
    console.log('\n🧭 MongoDB Compass Connection Steps:');
    console.log('1. Open MongoDB Compass');
    console.log('2. In the connection string field, enter:');
    console.log('   mongodb://localhost:27017');
    console.log('3. Click "Connect"');
    console.log('4. Look for database named "yofam"');
    console.log('5. Click on "yofam" to expand it');
    console.log('6. Click on "users" collection to see the 3 test users');
    
    console.log('\n🔧 If you don\'t see anything:');
    console.log('- Make sure you clicked "Connect" in Compass');
    console.log('- Check that you\'re looking at the "yofam" database');
    console.log('- Refresh the database list (right-click → Refresh)');
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    
    console.log('\n🔧 Try these connection strings in Compass:');
    console.log('1. mongodb://localhost:27017');
    console.log('2. mongodb://127.0.0.1:27017');
    console.log('3. mongodb://localhost:27017/yofam');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
};

showConnectionInfo();