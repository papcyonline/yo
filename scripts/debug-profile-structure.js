require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function debugProfileStructure() {
  try {
    console.log('\n🔍 Debugging Profile Data Structure...\n');
    
    // Get the current user (most recent registration)
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
    console.log(`📊 Testing with user: ${user.email} (${user.id})`);
    
    // Create a test token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    // Test the profile endpoint and show exact JSON
    try {
      const profileResponse = await axios.get('http://192.168.1.231:9001/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const userData = profileResponse.data.data?.user;
      
      console.log('🔍 EXACT PROFILE API RESPONSE STRUCTURE:');
      console.log('=====================================');
      console.log(JSON.stringify(userData, null, 2));
      
      console.log('\n🔍 LOCATION FIELD ANALYSIS:');
      console.log('===========================');
      console.log(`userData.location: ${userData.location}`);
      console.log(`userData.current_address: ${userData.current_address}`);
      console.log(`userData.city: ${userData.city}`);
      console.log(`userData.state: ${userData.state}`);
      console.log(`userData.country: ${userData.country}`);
      
      console.log('\n🔍 PROFESSION FIELD ANALYSIS:');
      console.log('==============================');
      console.log(`userData.profession: ${userData.profession}`);
      console.log(`userData.personalInfo?.profession: ${userData.personalInfo?.profession}`);
      
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

debugProfileStructure();