require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function testProgressiveAPI() {
  try {
    console.log('\n🧪 Testing Progressive Profile API endpoints...\n');
    
    // Get the new user data  
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', 'yofamapp@gmail.com')
      .single();
    
    if (!users) {
      console.log('❌ New user not found');
      return;
    }
    
    console.log(`📊 Testing with new user: ${users.email} (${users.id})`);
    
    // Create a test token
    const token = jwt.sign(
      { userId: users.id, email: users.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test 1: Get progressive status
    console.log('🔍 Test 1: Get Progressive Status');
    try {
      const statusResponse = await axios.get('http://192.168.1.231:9001/api/users/progressive/status', { headers });
      console.log('✅ Progressive Status Response:');
      console.log(JSON.stringify(statusResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Progressive status failed:', error.response?.data || error.message);
    }
    
    // Test 2: Save a test answer
    console.log('\\n🔍 Test 2: Save Answer');
    try {
      const saveResponse = await axios.post('http://192.168.1.231:9001/api/users/progressive/save-answer', {
        questionId: 'personal_bio',
        answer: 'Test bio from API',
        points: 10
      }, { headers });
      console.log('✅ Save Answer Response:');
      console.log(JSON.stringify(saveResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Save answer failed:', error.response?.data || error.message);
    }
    
    // Test 3: Get answers
    console.log('\\n🔍 Test 3: Get Answers');
    try {
      const answersResponse = await axios.get('http://192.168.1.231:9001/api/users/progressive/answers', { headers });
      console.log('✅ Get Answers Response:');
      console.log(JSON.stringify(answersResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Get answers failed:', error.response?.data || error.message);
    }
    
    // Test 4: Save batch answers
    console.log('\\n🔍 Test 4: Save Batch Answers');
    try {
      const batchResponse = await axios.post('http://192.168.1.231:9001/api/users/progressive/save-batch', {
        answers: {
          'father_name': 'Test Father',
          'mother_name': 'Test Mother',
          'personal_bio': 'I am testing the API',
          'childhood_nickname': 'Tester'
        }
      }, { headers });
      console.log('✅ Save Batch Response:');
      console.log(JSON.stringify(batchResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Save batch failed:', error.response?.data || error.message);
    }
    
    // Test 5: Check database for saved data
    console.log('\\n🔍 Test 5: Check Database');
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', users.id)
      .single();
    
    if (progressiveProfile) {
      console.log('✅ Progressive profile found in database:');
      console.log(`  - Total Points: ${progressiveProfile.total_points}`);
      console.log(`  - Answered Questions: ${progressiveProfile.answered_questions?.length || 0}`);
      console.log(`  - Completion: ${progressiveProfile.completion_percentage || 0}%`);
      console.log(`  - Saved Answers:`, Object.keys(progressiveProfile.answers || {}));
    } else {
      console.log('❌ No progressive profile found in database');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    process.exit(0);
  }
}

testProgressiveAPI();