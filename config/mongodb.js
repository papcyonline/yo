const mongoose = require('mongoose');

// MongoDB connection configuration
const connectMongoDB = async () => {
  try {
    // MongoDB connection string - supports local and cloud
    const mongoUri = process.env.MONGODB_URI || 
                     process.env.MONGODB_ATLAS_URI || 
                     'mongodb://127.0.0.1:27017/yofam';
    
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    console.log('🔗 Connecting to MongoDB...');
    console.log('📍 URI:', mongoUri);
    
    await mongoose.connect(mongoUri, options);
    
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    return false;
  }
};

// Test MongoDB connection
const testMongoConnection = async () => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    if (!isConnected) {
      await connectMongoDB();
    }
    
    // Try to access database
    await mongoose.connection.db.admin().ping();
    console.log('✅ MongoDB connection test passed');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection test failed:', error.message);
    return false;
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('📴 MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = {
  connectMongoDB,
  testMongoConnection,
  mongoose
};