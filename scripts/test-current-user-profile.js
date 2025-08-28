require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function testCurrentUserProfile() {
  try {
    console.log('\n🧪 Testing Current User Profile API...\n');
    
    // Get the most recent user (latest registered)
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const user = users[0];
    console.log(`📊 Testing with current user: ${user.email} (${user.id})`);
    
    // Create a test token
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
      
      console.log('✅ Current User Profile API Response:');
      const userData = profileResponse.data.data?.user;
      
      if (userData) {
        console.log('\n📋 Profile Data:');
        console.log(`  🆔 ID: ${userData.id}`);
        console.log(`  👤 Name: ${userData.fullName || userData.name || 'Not set'}`);
        console.log(`  📧 Email: ${userData.email}`);
        console.log(`  📖 Bio: ${userData.bio || 'Not set'}`);
        console.log(`  📍 Location: ${userData.current_address || userData.location || 'Not set'}`);
        console.log(`  📊 Completion: ${userData.profile_completion_percentage || userData.completionPercentage || 0}%`);
        console.log(`  ✅ Complete: ${userData.profile_complete || userData.profileCompleted || false}`);
        
        console.log('\n👨‍👩‍👧‍👦 Family Info:');
        if (userData.familyInfo && Object.keys(userData.familyInfo).length > 0) {
          Object.entries(userData.familyInfo).forEach(([key, value]) => {
            console.log(`    ${key}: ${value}`);
          });
        } else {
          console.log('    No family info available');
        }
        
        console.log('\n🎓 Education:');
        if (userData.education && Object.keys(userData.education).length > 0) {
          Object.entries(userData.education).forEach(([key, value]) => {
            console.log(`    ${key}: ${value}`);
          });
        } else {
          console.log('    No education info available');
        }
        
        console.log('\n🏠 Personal Info:');
        if (userData.personalInfo && Object.keys(userData.personalInfo).length > 0) {
          Object.entries(userData.personalInfo).forEach(([key, value]) => {
            console.log(`    ${key}: ${value}`);
          });
        } else {
          console.log('    No personal info available');
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

testCurrentUserProfile();