require('dotenv').config();

// Setup guide for MongoDB Atlas (Cloud)
const setupCloudMongoDB = () => {
  console.log('☁️  MongoDB Atlas (Cloud) Setup Guide');
  console.log('=====================================\n');
  
  console.log('🔗 Step 1: Go to MongoDB Atlas');
  console.log('   https://cloud.mongodb.com/\n');
  
  console.log('📝 Step 2: Create a free account');
  console.log('   - Click "Sign up" if you don\'t have an account');
  console.log('   - Or "Sign in" if you already have one\n');
  
  console.log('🏗️  Step 3: Create a new project');
  console.log('   - Click "Create Project"');
  console.log('   - Name: "YoFam Backend"');
  console.log('   - Click "Next" → "Create Project"\n');
  
  console.log('🗄️  Step 4: Create a database cluster');
  console.log('   - Click "Build a Database"');
  console.log('   - Choose "FREE" tier (M0 Sandbox)');
  console.log('   - Select any region (closest to you)');
  console.log('   - Cluster name: "YoFam-Cluster"');
  console.log('   - Click "Create"\n');
  
  console.log('👤 Step 5: Create database user');
  console.log('   - Username: "yofam-user"');
  console.log('   - Password: Generate a strong password');
  console.log('   - Save the password safely!');
  console.log('   - Click "Create User"\n');
  
  console.log('🌐 Step 6: Configure network access');
  console.log('   - Click "Add IP Address"');
  console.log('   - Click "Allow Access from Anywhere" (for development)');
  console.log('   - Click "Confirm"\n');
  
  console.log('🔗 Step 7: Get connection string');
  console.log('   - Click "Connect"');
  console.log('   - Choose "Drivers"');
  console.log('   - Copy the connection string');
  console.log('   - Replace <password> with your actual password\n');
  
  console.log('📝 Step 8: Add to .env file');
  console.log('   Add this line to your .env file:');
  console.log('   MONGODB_URI=mongodb+srv://yofam-user:<password>@yofam-cluster.xxxxx.mongodb.net/yofam');
  console.log('   (Replace <password> and xxxxx with your actual values)\n');
  
  console.log('🧪 Step 9: Test connection');
  console.log('   Run: node scripts/testCloudConnection.js\n');
  
  console.log('💡 Alternative: Use MongoDB Compass locally');
  console.log('   1. Download: https://www.mongodb.com/try/download/compass');
  console.log('   2. Install and open');
  console.log('   3. Connect to: mongodb://localhost:27017');
  console.log('   4. This will create a local MongoDB instance\n');
  
  console.log('🚀 Once connected, run: npm run init-mongo');
};

if (require.main === module) {
  setupCloudMongoDB();
}

module.exports = { setupCloudMongoDB };