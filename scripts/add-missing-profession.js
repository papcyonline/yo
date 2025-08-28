require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function addMissingProfession() {
  try {
    console.log('\n🧪 Adding Profession to User Profile...\n');
    
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
    console.log(`📊 Adding profession for user: ${user.email} (${user.id})`);
    
    // Create a test token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    // Add profession via progressive profile API
    try {
      const saveResponse = await axios.post('http://192.168.1.231:9001/api/users/progressive/save-answer', {
        questionId: 'profession',
        answer: 'Software Developer & AI Engineer',
        points: 10
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Profession Added Successfully:');
      console.log(`   Answer: "Software Developer & AI Engineer"`);
      console.log(`   New Completion: ${saveResponse.data.data.profile.completion_percentage}%`);
      
    } catch (error) {
      console.log('❌ Failed to add profession:', error.response?.data || error.message);
      return;
    }
    
    // Verify the profession is now in the profile API
    try {
      const profileResponse = await axios.get('http://192.168.1.231:9001/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const userData = profileResponse.data.data?.user;
      console.log('\n📋 Updated Profile:');
      console.log(`  💼 Profession: ${userData.personalInfo?.profession || userData.profession || 'Still not set'}`);
      console.log(`  📍 Location: ${userData.location || userData.current_address || 'Not set'}`);
      console.log(`  📊 Completion: ${userData.profile_completion_percentage || 0}%`);
      
    } catch (error) {
      console.log('❌ Failed to fetch updated profile:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    process.exit(0);
  }
}

addMissingProfession();