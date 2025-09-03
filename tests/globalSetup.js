// Global setup for Jest tests
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Start MongoDB Memory Server for all tests
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      port: 27018, // Use different port to avoid conflicts
      dbName: 'yofam-test'
    }
  });
  
  const mongoUri = mongoServer.getUri();
  
  // Store the URI and server instance globally for tests to use
  global.__MONGO_URI__ = mongoUri;
  global.__MONGO_DB_NAME__ = 'yofam-test';
  global.__MONGO_SERVER__ = mongoServer;
  
  console.log(`✅ MongoDB Memory Server started at ${mongoUri}`);
};