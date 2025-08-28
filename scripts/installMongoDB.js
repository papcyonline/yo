const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Download and install MongoDB Community Server
const installMongoDB = async () => {
  console.log('📦 MongoDB Installation for Windows');
  console.log('===================================\\n');
  
  console.log('Since MongoDB Compass is installed but no local server is running,');
  console.log('you need to install MongoDB Community Server.\\n');
  
  console.log('🔧 Quick Installation Options:\\n');
  
  console.log('Option 1: Manual Download (Recommended)');
  console.log('1. Go to: https://www.mongodb.com/try/download/community');
  console.log('2. Select "Windows" and "msi" package');
  console.log('3. Download and run the installer');
  console.log('4. Use default settings (installs as Windows service)');
  console.log('5. MongoDB will start automatically\\n');
  
  console.log('Option 2: Using Chocolatey (if you have it)');
  console.log('Run: choco install mongodb\\n');
  
  console.log('Option 3: Using winget (Windows Package Manager)');
  console.log('Run: winget install MongoDB.Server\\n');
  
  console.log('Option 4: Portable Installation');
  console.log('1. Download ZIP from MongoDB website');
  console.log('2. Extract to C:\\\\mongodb');
  console.log('3. Add C:\\\\mongodb\\\\bin to PATH');
  console.log('4. Create data directory');
  console.log('5. Run: mongod --dbpath C:\\\\data\\\\db\\n');
  
  // Try to check if we can install via winget
  console.log('🔍 Checking if winget is available...');
  
  try {
    const wingetProcess = spawn('winget', ['--version'], { stdio: 'pipe' });
    
    wingetProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ winget is available!');
        console.log('\\n🚀 To install MongoDB automatically, run:');
        console.log('winget install MongoDB.Server');
        console.log('\\nOr run this script with --install flag');
      } else {
        console.log('❌ winget not available');
        console.log('Please use manual installation method above');
      }
    });
    
    wingetProcess.on('error', () => {
      console.log('❌ winget not available');
      console.log('Please use manual installation method above');
    });
    
  } catch (error) {
    console.log('❌ winget not available');
    console.log('Please use manual installation method above');
  }
  
  // Check if user wants to install automatically
  if (process.argv.includes('--install')) {
    console.log('\\n🚀 Attempting automatic installation with winget...');
    
    const installProcess = spawn('winget', ['install', 'MongoDB.Server'], {
      stdio: 'inherit'
    });
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\\n✅ MongoDB installed successfully!');
        console.log('🔄 Starting MongoDB service...');
        
        // Try to start MongoDB service
        const startService = spawn('net', ['start', 'MongoDB'], {
          stdio: 'inherit'
        });
        
        startService.on('close', (serviceCode) => {
          if (serviceCode === 0) {
            console.log('\\n✅ MongoDB service started!');
            console.log('🚀 Now run: npm run mongo-init');
          } else {
            console.log('\\n⚠️  MongoDB installed but service failed to start');
            console.log('Try: net start MongoDB');
          }
        });
        
      } else {
        console.log('\\n❌ Installation failed');
        console.log('Please try manual installation');
      }
    });
    
    return;
  }
  
  console.log('\\n💡 After installation, you can:');
  console.log('1. Run: npm run mongo-test (to test connection)');
  console.log('2. Run: npm run mongo-init (to create database)');
  console.log('3. Open MongoDB Compass and connect to: mongodb://localhost:27017');
  console.log('\\n🎉 You will then see your "yofam-dev" database with collections!');
};

if (require.main === module) {
  installMongoDB();
}

module.exports = { installMongoDB };