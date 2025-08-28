require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

async function testDataSaveFlow() {
  try {
    console.log('\n🧪 Testing Complete Data Save Flow...\n');
    
    // Get the most recent user
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, date_of_birth, gender, username')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    const user = users[0];
    console.log(`📊 Testing with user: ${user.email} (${user.id})`);
    console.log('📋 Current user data in users table:');
    console.log(`   - Name: ${user.first_name} ${user.last_name}`);
    console.log(`   - Username: ${user.username}`);
    console.log(`   - Date of birth: ${user.date_of_birth}`);
    console.log(`   - Gender: ${user.gender}`);
    
    // Create a test token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      'aa2db8aa8c394ac33dd043f32eafcbf1c4dfecf3c677eb2463b98fca110a00340f26e98e6e60253203df9dd3c21901f8c2ce1d2352fb4be9e186059ad9ef3510',
      { expiresIn: '1h' }
    );
    
    console.log('\n🔄 STEP 1: Testing Individual Answer Save...');
    
    // Test individual answer save (like Q&A Review does)
    const testAnswer = {
      questionId: 'profession',
      answer: 'Updated Software Engineer & AI Specialist',
      points: 5
    };
    
    console.log(`Saving: ${testAnswer.questionId} = "${testAnswer.answer}"`);
    
    const individualSaveResponse = await axios.post('http://192.168.1.231:9001/api/users/progressive/save-answer', testAnswer, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (individualSaveResponse.data.success) {
      console.log('✅ Individual answer saved successfully');
    } else {
      console.log('❌ Individual answer save failed:', individualSaveResponse.data);
    }
    
    console.log('\n🔄 STEP 2: Testing Batch Save (like registration does)...');
    
    // Test batch save (like registration signup does)
    const batchData = {
      answers: {
        full_name: "Test Updated User",
        username: "testupdated123",
        date_of_birth: "1990-12-25",
        location: "Abu Dhabi, UAE",
        gender: "female"
      },
      phase: 'essential',
      autoSaved: true
    };
    
    console.log('Batch data to save:', batchData.answers);
    
    const batchSaveResponse = await axios.post('http://192.168.1.231:9001/api/users/progressive/save-batch', batchData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (batchSaveResponse.data.success) {
      console.log('✅ Batch answers saved successfully');
    } else {
      console.log('❌ Batch save failed:', batchSaveResponse.data);
    }
    
    // Wait a moment for database to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n🔍 STEP 3: Checking Database After Saves...');
    
    // Check users table
    const { data: updatedUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    console.log('📋 Updated user data in users table:');
    console.log(`   - Name: ${updatedUser.first_name} ${updatedUser.last_name}`);
    console.log(`   - Username: ${updatedUser.username}`);
    console.log(`   - Date of birth: ${updatedUser.date_of_birth}`);
    console.log(`   - Gender: ${updatedUser.gender}`);
    console.log(`   - Location: ${updatedUser.current_address}`);
    
    // Check progressive_profiles table
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('answers, answered_questions, completion_percentage')
      .eq('user_id', user.id)
      .single();
    
    console.log('\n📋 Progressive profile data:');
    console.log('   Answers:', JSON.stringify(progressiveProfile.answers, null, 2));
    console.log(`   Answered questions: ${progressiveProfile.answered_questions?.length || 0}`);
    console.log(`   Completion: ${progressiveProfile.completion_percentage}%`);
    
    console.log('\n🔄 STEP 4: Testing Profile API Response...');
    
    // Test the profile API to see what gets returned
    const profileResponse = await axios.get('http://192.168.1.231:9001/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const userData = profileResponse.data.data?.user;
    console.log('📋 Profile API response:');
    console.log(`   - Date of birth: ${userData.date_of_birth || userData.dateOfBirth}`);
    console.log(`   - Gender: ${userData.gender}`);
    console.log(`   - Location: ${userData.location}`);
    console.log(`   - Username: ${userData.username}`);
    console.log(`   - Profession: ${userData.personalInfo?.profession}`);
    console.log(`   - Missing fields: ${JSON.stringify(userData.missingFields)}`);
    console.log(`   - Completion: ${userData.completionPercentage}%`);
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error.response?.data || error.message);
  } finally {
    process.exit(0);
  }
}

testDataSaveFlow();