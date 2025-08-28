require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function testAvatarDetection() {
  try {
    console.log('\n🔍 Testing Avatar Detection...\n');
    
    // Get the most recent user
    const { data: users } = await supabase
      .from('users')
      .select('id, email, profile_picture_url, profile_photo_url')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const user = users[0];
    console.log(`📊 Testing with user: ${user.email} (${user.id})`);
    console.log('📋 Avatar URLs in database:');
    console.log(`   profile_picture_url: ${user.profile_picture_url}`);
    console.log(`   profile_photo_url: ${user.profile_photo_url}`);
    
    // Create a test token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    // Test the profile API
    const profileResponse = await axios.get('http://192.168.1.231:9000/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const userData = profileResponse.data.data?.user;
    console.log('\n📋 Profile API avatar fields:');
    console.log(`   profile_picture_url: ${userData.profile_picture_url}`);
    console.log(`   profilePictureUrl: ${userData.profilePictureUrl}`);
    console.log(`   profilePhotoUrl: ${userData.profilePhotoUrl}`);
    console.log(`   avatarUrl: ${userData.avatarUrl}`);
    
    // Test if the URL is accessible
    if (userData.profile_picture_url && userData.profile_picture_url.startsWith('http')) {
      try {
        console.log('\n🔍 Testing avatar URL accessibility...');
        const avatarResponse = await axios.head(userData.profile_picture_url);
        console.log(`✅ Avatar URL is accessible (${avatarResponse.status})`);
      } catch (error) {
        console.log(`❌ Avatar URL is not accessible: ${error.message}`);
      }
    } else {
      console.log('\n⚠️ Avatar URL is not an HTTP URL:', userData.profile_picture_url);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    process.exit(0);
  }
}

testAvatarDetection();