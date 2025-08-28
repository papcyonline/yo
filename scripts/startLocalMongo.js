const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Try to start MongoDB using different methods
const startLocalMongoDB = async () => {
  console.log('🚀 Attempting to start local MongoDB...\n');
  
  // Method 1: Try to find MongoDB installation
  const possiblePaths = [
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\5.0\\bin\\mongod.exe',
    'C:\\Program Files (x86)\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
    'C:\\Program Files (x86)\\MongoDB\\Server\\6.0\\bin\\mongod.exe',
    'C:\\tools\\mongodb\\bin\\mongod.exe',
    'mongod' // If in PATH
  ];
  
  console.log('🔍 Looking for MongoDB server...');
  
  for (const mongoPath of possiblePaths) {
    try {
      if (mongoPath !== 'mongod' && !fs.existsSync(mongoPath)) {
        continue;
      }
      
      console.log(`✅ Found MongoDB at: ${mongoPath}`);
      
      // Create data directory
      const dataDir = path.join(process.cwd(), 'data', 'db');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`📁 Created data directory: ${dataDir}`);
      }
      
      // Start MongoDB server
      console.log('🚀 Starting MongoDB server...');
      const mongodProcess = spawn(mongoPath, [
        '--dbpath', dataDir,
        '--port', '27017',
        '--bind_ip', 'localhost'
      ], {
        stdio: 'pipe',
        detached: true
      });
      
      mongodProcess.stdout.on('data', (data) => {
        console.log(`MongoDB: ${data.toString().trim()}`);
        if (data.toString().includes('waiting for connections')) {
          console.log('✅ MongoDB is ready for connections!');
          console.log('🔗 Connect via: mongodb://localhost:27017');
          console.log('💡 Run: npm run mongo-init to initialize database');
        }
      });
      
      mongodProcess.stderr.on('data', (data) => {
        console.log(`MongoDB Error: ${data.toString().trim()}`);
      });
      
      mongodProcess.on('error', (error) => {
        console.log(`❌ Failed to start MongoDB: ${error.message}`);
      });
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\\n🛑 Stopping MongoDB...');
        mongodProcess.kill();
        process.exit(0);
      });
      
      return true;
      
    } catch (error) {
      continue;
    }
  }
  
  console.log('❌ MongoDB server not found on this system.');
  console.log('');
  console.log('📦 To install MongoDB Community Server:');
  console.log('1. Go to: https://www.mongodb.com/try/download/community');
  console.log('2. Choose "Windows" and "msi" package');
  console.log('3. Install with default settings');
  console.log('4. MongoDB will start automatically');
  console.log('');
  console.log('🔄 Alternative: Use MongoDB Atlas (cloud database)');
  console.log('Run: npm run mongo-setup');
  
  return false;
};

if (require.main === module) {
  startLocalMongoDB()
    .then((started) => {
      if (!started) {
        process.exit(1);
      }
      // Keep process alive if MongoDB started
    })
    .catch(error => {
      console.error('Failed to start MongoDB:', error);
      process.exit(1);
    });
}

module.exports = { startLocalMongoDB };