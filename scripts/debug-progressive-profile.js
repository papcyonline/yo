require('dotenv').config();
const { supabase } = require('../config/database');

async function debugProgressiveProfile() {
  try {
    console.log('\n🔍 Debugging Progressive Profile Data...\n');
    
    // Get the most recent user
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, date_of_birth, gender')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    const user = users[0];
    console.log(`📊 User from users table: ${user.email} (${user.id})`);
    console.log(`📅 Date of birth in users table: ${user.date_of_birth}`);
    console.log(`👤 Gender in users table: ${user.gender}`);
    
    // Get progressive profile data for this user
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (!progressiveProfile) {
      console.log('❌ No progressive profile found');
      return;
    }
    
    console.log('\n📋 Progressive profile answers:');
    console.log('===============================');
    console.log(JSON.stringify(progressiveProfile.answers, null, 2));
    
    console.log('\n🔍 Signup data specifically:');
    console.log('============================');
    console.log(`full_name: ${progressiveProfile.answers?.full_name}`);
    console.log(`username: ${progressiveProfile.answers?.username}`);
    console.log(`date_of_birth: ${progressiveProfile.answers?.date_of_birth}`);
    console.log(`location: ${progressiveProfile.answers?.location}`);
    console.log(`gender: ${progressiveProfile.answers?.gender}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugProgressiveProfile();