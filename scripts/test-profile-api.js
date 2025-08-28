require('dotenv').config();
const axios = require('axios');

async function testProfileAPI() {
  try {
    console.log('\n🧪 Testing Profile API endpoint...\n');
    
    // Test the health endpoint first
    try {
      const healthResponse = await axios.get('http://192.168.1.231:9001/health');
      console.log('✅ Backend is running:', healthResponse.data);
    } catch (error) {
      console.log('❌ Backend health check failed:', error.message);
      return;
    }
    
    // We need a valid token for the profile endpoint
    // Let's check if we can get a user's token from the database first
    const { supabase } = require('../config/database');
    
    // Get user info
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const user = users[0];
    console.log(`📊 Testing with user: ${user.email} (${user.id})`);
    
    // Create a test token (in production this would be from login)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    // Test the profile endpoint
    try {
      const profileResponse = await axios.get('http://192.168.1.231:9001/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Profile API Response:');
      console.log(JSON.stringify(profileResponse.data, null, 2));
      
      // Check specific fields we care about
      const userData = profileResponse.data.data?.user;
      if (userData) {
        console.log('\n📋 Profile Summary:');
        console.log(`  - Name: ${userData.fullName || userData.name || 'Not set'}`);
        console.log(`  - Bio: ${userData.bio || 'Not set'}`);
        console.log(`  - Profile Picture: ${userData.profile_picture_url ? 'Set ✓' : 'Not set'}`);
        console.log(`  - Display Name: ${userData.display_name || 'Not set'}`);
        console.log(`  - Completion: ${userData.profile_completion_percentage || 0}%`);
        
        // Check for rich data
        if (userData.familyInfo) {
          console.log(`  - Family Info: ${Object.keys(userData.familyInfo).length} fields`);
        }
        if (userData.personalInfo) {
          console.log(`  - Personal Info: ${Object.keys(userData.personalInfo).length} fields`);
        }
        if (userData.education) {
          console.log(`  - Education: ${Object.keys(userData.education).length} fields`);
        }
      }
      
    } catch (error) {
      console.log('❌ Profile API request failed:');
      if (error.response) {
        console.log(`Status: ${error.response.status}`);
        console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    process.exit(0);
  }
}

testProfileAPI();