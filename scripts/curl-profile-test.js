require('dotenv').config();
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');
const { exec } = require('child_process');

async function curlProfileTest() {
  try {
    console.log('\n🧪 Testing Profile API with Curl...\n');
    
    // Get the current user
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const user = users[0];
    console.log(`📊 Testing user: ${user.email} (${user.id})`);
    
    // Create token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    // Make curl request
    const curlCommand = `curl -X GET "http://192.168.1.231:9001/api/users/profile" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json"`;
    
    console.log('🌐 Making curl request...\n');
    
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Curl error:', error);
        process.exit(1);
      }
      
      if (stderr) {
        console.error('❌ Curl stderr:', stderr);
      }
      
      try {
        const response = JSON.parse(stdout);
        const userData = response.data?.user;
        
        console.log('✅ Raw Curl Response:');
        console.log('=====================');
        console.log('Location:', userData?.location);
        console.log('Profession (direct):', userData?.profession);
        console.log('Profession (personalInfo):', userData?.personalInfo?.profession);
        console.log('PersonalInfo object:', JSON.stringify(userData?.personalInfo, null, 2));
        
      } catch (parseError) {
        console.log('📄 Raw response:');
        console.log(stdout);
      }
      
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

curlProfileTest();