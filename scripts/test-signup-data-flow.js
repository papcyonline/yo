require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function testSignupDataFlow() {
  try {
    console.log('\n🧪 Testing Signup Data Flow...\n');
    
    // Get the most recent user
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No users found');
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
    
    // Simulate the signup data that should be saved
    const signupData = {
      full_name: "Test User",
      username: "testuser123",
      date_of_birth: "1995-06-15",
      location: "Dubai, UAE",
      gender: "male"
    };
    
    console.log('📝 Simulating signup data save...');
    console.log('Data to save:', signupData);
    
    // Call the save-batch endpoint to simulate what registrationDataService does
    const saveResponse = await axios.post('http://192.168.1.231:9001/api/users/progressive/save-batch', {
      answers: signupData,
      phase: 'essential',
      autoSaved: true
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (saveResponse.data.success) {
      console.log('✅ Signup data saved successfully');
      
      // Now test the profile endpoint to see if the data appears
      const profileResponse = await axios.get('http://192.168.1.231:9001/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const userData = profileResponse.data.data?.user;
      console.log('\n🔍 Profile API Response:');
      console.log('=======================');
      console.log(`Date of birth: ${userData.date_of_birth || userData.dateOfBirth}`);
      console.log(`Gender: ${userData.gender}`);
      console.log(`Location: ${userData.location}`);
      console.log(`Username: ${userData.username}`);
      console.log(`Missing fields: ${JSON.stringify(userData.missingFields)}`);
      
    } else {
      console.log('❌ Failed to save signup data:', saveResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
  } finally {
    process.exit(0);
  }
}

testSignupDataFlow();