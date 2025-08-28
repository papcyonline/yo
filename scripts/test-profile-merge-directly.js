require('dotenv').config();
const { supabase } = require('../config/database');

async function testProfileMerge() {
  try {
    console.log('\n🧪 Testing Profile Merge Logic Directly...\n');
    
    // Get the current user (most recent registration)  
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const user = users[0];
    console.log(`📊 Testing user: ${user.email} (${user.id})`);
    
    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, username, email, phone, date_of_birth,
        gender, profile_picture_url, bio, location, city, state, country,
        preferred_language, timezone, email_verified, phone_verified, 
        is_active, created_at, updated_at, display_name, profile_completion_percentage,
        profile_complete
      `)
      .eq('id', user.id)
      .single();
    
    // Get progressive profile
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    console.log('🔍 MERGE SIMULATION:');
    console.log('====================');
    
    const mergedUser = { ...userProfile };
    
    if (progressiveProfile && progressiveProfile.answers) {
      const answers = progressiveProfile.answers;
      
      console.log('\n📝 Available answers:', Object.keys(answers));
      console.log('📝 Profession in answers?', 'profession' in answers);
      console.log('📝 Profession value:', answers.profession);
      
      // Add rich profile data
      mergedUser.familyInfo = {};
      mergedUser.personalInfo = {};
      mergedUser.education = {};
      
      // Personal info - exactly as in the real code
      if (answers.childhood_memories) {
        mergedUser.personalInfo.childhood_memories = answers.childhood_memories;
        console.log('✅ Added childhood_memories');
      }
      if (answers.childhood_friends) {
        mergedUser.personalInfo.childhood_friends = answers.childhood_friends;
        console.log('✅ Added childhood_friends');
      }
      if (answers.languages_dialects) {
        mergedUser.personalInfo.languages = answers.languages_dialects;
        console.log('✅ Added languages');
      }
      if (answers.kindergarten_memories) {
        mergedUser.personalInfo.kindergarten_memories = answers.kindergarten_memories;
        console.log('✅ Added kindergarten_memories');
      }
      if (answers.profession) {
        mergedUser.personalInfo.profession = answers.profession;
        console.log('✅ Added profession:', answers.profession);
      } else {
        console.log('❌ Profession not added - condition failed');
        console.log('   - answers.profession exists?', 'profession' in answers);
        console.log('   - answers.profession value:', answers.profession);
        console.log('   - answers.profession truthy?', !!answers.profession);
      }
    }
    
    console.log('\n🔍 FINAL personalInfo:');
    console.log('======================');
    console.log(JSON.stringify(mergedUser.personalInfo, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testProfileMerge();