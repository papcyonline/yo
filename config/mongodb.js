const mongoose = require('mongoose');

// MongoDB connection configuration
const connectMongoDB = async () => {
  try {
    // First try cloud connection, then fall back to local
    let mongoUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    };

    console.log('🔗 Attempting MongoDB connection...');

    if (mongoUri) {
      console.log('📍 Trying cloud URI first...');
      try {
        await mongoose.connect(mongoUri, options);
        console.log('✅ MongoDB Cloud connected successfully');
        console.log('📊 Database:', mongoose.connection.name);
        return true;
      } catch (cloudError) {
        console.warn('⚠️ Cloud MongoDB connection failed:', cloudError.message);
        console.log('🔄 Falling back to local MongoDB...');
      }
    }

    // Fallback to local MongoDB
    mongoUri = 'mongodb://127.0.0.1:27017/yofam';
    console.log('📍 Connecting to local MongoDB:', mongoUri);

    await mongoose.connect(mongoUri, {
      ...options,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Local MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);

    return true;
  } catch (error) {
    console.error('❌ All MongoDB connections failed:', error.message);
    console.warn('🚨 Server will continue without database (limited functionality)');
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