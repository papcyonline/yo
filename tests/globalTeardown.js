// Global teardown for Jest tests
module.exports = async () => {
  // Stop MongoDB Memory Server after all tests
  if (global.__MONGO_SERVER__) {
    await global.__MONGO_SERVER__.stop();
    console.log('✅ MongoDB Memory Server stopped');
  }
  
  // Clean up any other global resources
  if (global.gc) {
    global.gc();
  }
};