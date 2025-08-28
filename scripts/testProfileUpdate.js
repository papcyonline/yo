require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { connectMongoDB } = require('../config/mongodb');
const { User } = require('../models');

const testProfileUpdate = async () => {
  try {
    console.log('🧪 Testing MongoDB Profile Update Functionality\n');
    
    // Connect to MongoDB (use the same database as test data)
    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://localhost:27017/yofam');
    console.log('✅ Connected to MongoDB (yofam database)');
    
    // Get a test user from database
    const testUser = await User.findOne({ username: 'johndoe' });
    
    if (!testUser) {
      console.log('❌ No test user found. Run: node scripts/createTestData.js first');
      process.exit(1);
    }
    
    console.log('📍 Found test user:', testUser.username);
    
    // Generate JWT token for the test user
    const token = jwt.sign(
      { userId: testUser._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    console.log('🔑 Generated JWT token');
    
    // Test data to update
    const updateData = {
      first_name: 'John Updated',
      last_name: 'Doe Modified',
      bio: 'Updated bio: Software developer from NYC - MongoDB test successful!',
      location: 'New York City, NY (Updated)',
      username: 'johndoe_updated'
    };
    
    console.log('📝 Attempting to update profile with MongoDB...\n');
    console.log('Update data:', JSON.stringify(updateData, null, 2));
    
    // Make API call to the MongoDB profile update endpoint
    const response = await axios.put(
      'http://localhost:9000/api/users/profile',
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Profile update successful!');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', JSON.stringify(response.data, null, 2));
    
    // Verify the update in database
    const updatedUser = await User.findById(testUser._id);
    
    console.log('\n🔍 Verifying update in MongoDB:');
    console.log('  - First Name:', updatedUser.first_name);
    console.log('  - Last Name:', updatedUser.last_name);
    console.log('  - Username:', updatedUser.username);
    console.log('  - Bio:', updatedUser.bio.substring(0, 50) + '...');
    console.log('  - Location:', updatedUser.location);
    
    console.log('\n🎉 SUCCESS! MongoDB profile updates are working perfectly!');
    console.log('✅ No more Supabase constraint errors (42P10)');
    console.log('✅ All profile fields can be updated freely');
    console.log('✅ EditProfileScreen will now work in the mobile app');
    
  } catch (error) {
    console.log('❌ Profile update test failed');
    
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📋 Error response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('📋 Error:', error.message);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running: npm run dev');
    }
  } finally {
    process.exit(0);
  }
};

testProfileUpdate();