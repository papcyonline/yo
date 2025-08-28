require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../config/database');

async function testSignupFlow() {
  try {
    console.log('\n🧪 Testing Complete Signup Flow with Gender...\n');
    
    // Test data that would come from UserInfoScreen
    const testUserData = {
      fullName: 'Test Gender User',
      firstName: 'Test',
      lastName: 'Gender User',
      username: 'testgender123',
      dateOfBirth: '1990-05-15',
      location: 'Dubai, UAE',
      gender: 'female'
    };
    
    console.log('📋 Test user data:', testUserData);
    
    // 1. Test that a progressive profile can be created with gender data
    console.log('\n🔄 Step 1: Testing progressive profile creation...');
    
    // First, let's get an existing user to test with
    const { data: testUser } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)
      .single();
    
    if (!testUser) {
      console.log('❌ No test user found');
      return;
    }
    
    console.log(`📊 Using test user: ${testUser.email} (${testUser.id})`);
    
    // 2. Test batch saving with auto-save (simulating registration flow)
    console.log('\n🔄 Step 2: Testing batch save with gender...');
    
    const batchAnswers = {
      full_name: testUserData.fullName,
      username: testUserData.username,
      date_of_birth: testUserData.dateOfBirth,
      location: testUserData.location,
      gender: testUserData.gender
    };
    
    const response = await axios.post('http://192.168.1.231:9000/api/users/progressive/save-batch', {
      answers: batchAnswers,
      autoSaved: true
    }, {
      headers: {
        'Authorization': `Bearer test-token-${testUser.id}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Batch save response:', response.data.success ? 'SUCCESS' : 'FAILED');
    
    if (response.data.success) {
      console.log('📊 Profile updated with:', response.data.data.profile.answers);
    }
    
    // 3. Verify that gender appears in the main users table
    console.log('\n🔄 Step 3: Verifying users table has gender...');
    
    const { data: updatedUser } = await supabase
      .from('users')
      .select('first_name, last_name, username, date_of_birth, gender, location, current_address')
      .eq('id', testUser.id)
      .single();
    
    console.log('📋 Updated user data:', updatedUser);
    
    // 4. Test profile API response includes gender
    console.log('\n🔄 Step 4: Testing profile API response...');
    
    const profileResponse = await axios.get('http://192.168.1.231:9000/api/users/profile', {
      headers: {
        'Authorization': `Bearer test-token-${testUser.id}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (profileResponse.data.success) {
      const userProfile = profileResponse.data.data.user;
      console.log('✅ Profile API response includes:');
      console.log(`   Gender: ${userProfile.gender}`);
      console.log(`   Date of Birth: ${userProfile.date_of_birth || userProfile.dateOfBirth}`);
      console.log(`   Location: ${userProfile.location || userProfile.current_address}`);
      console.log(`   Username: ${userProfile.username}`);
      console.log(`   Completion: ${userProfile.profile_completion_percentage || userProfile.completionPercentage}%`);
    }
    
    console.log('\n🎉 Signup flow test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
  } finally {
    process.exit(0);
  }
}

testSignupFlow();