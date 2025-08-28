require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function testUsersTableUpdate() {
  try {
    console.log('\n🔍 Testing Users Table Update...\n');
    
    // Get the most recent user
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, date_of_birth, gender, username, current_address')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const user = users[0];
    console.log(`📊 Testing with user: ${user.email} (${user.id})`);
    console.log('📋 BEFORE - Users table:');
    console.log(`   Date of birth: ${user.date_of_birth}`);
    console.log(`   Gender: ${user.gender}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Current address: ${user.current_address}`);
    
    // Create a test token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    // Test batch save with autoSaved flag
    const testData = {
      answers: {
        full_name: "Test Final User",
        username: "testfinal456",
        date_of_birth: "1985-03-15",
        location: "Sharjah, UAE", 
        gender: "male"
      },
      phase: 'essential',
      autoSaved: true  // This should trigger users table update
    };
    
    console.log('\n🔄 Sending batch save with autoSaved=true...');
    console.log('Data:', testData.answers);
    
    const response = await axios.post('http://192.168.1.231:9000/api/users/progressive/save-batch', testData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📤 Response:', response.data.success ? '✅ Success' : '❌ Failed');
    if (!response.data.success) {
      console.log('Error:', response.data);
      return;
    }
    
    // Wait a moment for database to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check users table again
    const { data: updatedUsers } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, date_of_birth, gender, username, current_address')
      .eq('id', user.id)
      .single();
    
    console.log('\n📋 AFTER - Users table:');
    console.log(`   First name: ${updatedUsers.first_name}`);
    console.log(`   Last name: ${updatedUsers.last_name}`);
    console.log(`   Date of birth: ${updatedUsers.date_of_birth}`);
    console.log(`   Gender: ${updatedUsers.gender}`);
    console.log(`   Username: ${updatedUsers.username}`);
    console.log(`   Current address: ${updatedUsers.current_address}`);
    
    // Show changes
    console.log('\n🔄 CHANGES DETECTED:');
    if (user.date_of_birth !== updatedUsers.date_of_birth) {
      console.log(`   ✅ Date of birth: ${user.date_of_birth} → ${updatedUsers.date_of_birth}`);
    } else {
      console.log(`   ❌ Date of birth: No change (${user.date_of_birth})`);
    }
    
    if (user.gender !== updatedUsers.gender) {
      console.log(`   ✅ Gender: ${user.gender} → ${updatedUsers.gender}`);
    } else {
      console.log(`   ❌ Gender: No change (${user.gender})`);
    }
    
    if (user.username !== updatedUsers.username) {
      console.log(`   ✅ Username: ${user.username} → ${updatedUsers.username}`);
    } else {
      console.log(`   ❌ Username: No change (${user.username})`);
    }
    
    if (user.current_address !== updatedUsers.current_address) {
      console.log(`   ✅ Address: ${user.current_address} → ${updatedUsers.current_address}`);
    } else {
      console.log(`   ❌ Address: No change (${user.current_address})`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
  } finally {
    process.exit(0);
  }
}

testUsersTableUpdate();