require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function testProfileUpdate() {
  try {
    console.log('\n🧪 Testing Profile Update API...\n');
    
    // Get a test user
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No users found for testing');
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
    
    // Test data to update (using timestamp to ensure unique username)
    const timestamp = Date.now();
    const updateData = {
      first_name: 'Updated',
      last_name: 'Name',
      bio: 'This is an updated bio'
    };
    
    console.log('📋 Update data:', updateData);
    
    // Make the API call
    const response = await axios.put('http://192.168.1.231:9000/api/users/profile', updateData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Update response:', response.data);
    
  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  } finally {
    process.exit(0);
  }
}

testProfileUpdate();