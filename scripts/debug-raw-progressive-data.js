require('dotenv').config();
const { supabase } = require('../config/database');

async function debugRawProgressiveData() {
  try {
    console.log('\n🔍 Debugging Raw Progressive Profile Data...\n');
    
    // Get the current user (most recent registration)
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const user = users[0];
    console.log(`📊 Checking user: ${user.email} (${user.id})`);
    
    // Get raw progressive profile data
    const { data: progressiveProfile, error } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('\n🔍 RAW PROGRESSIVE PROFILE DATA:');
    console.log('================================');
    console.log('ID:', progressiveProfile.id);
    console.log('User ID:', progressiveProfile.user_id);
    console.log('Current Phase:', progressiveProfile.current_phase);
    console.log('Total Points:', progressiveProfile.total_points);
    console.log('Completion:', progressiveProfile.completion_percentage + '%');
    console.log('Answered Questions:', JSON.stringify(progressiveProfile.answered_questions, null, 2));
    console.log('\nRAW ANSWERS OBJECT:');
    console.log('===================');
    console.log(JSON.stringify(progressiveProfile.answers, null, 2));
    
    console.log('\n🔍 SPECIFIC FIELD CHECK:');
    console.log('========================');
    console.log('profession field exists?', 'profession' in progressiveProfile.answers);
    console.log('profession value:', progressiveProfile.answers.profession);
    console.log('profession type:', typeof progressiveProfile.answers.profession);
    console.log('location field exists?', 'location' in progressiveProfile.answers);
    console.log('location value:', progressiveProfile.answers.location);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugRawProgressiveData();