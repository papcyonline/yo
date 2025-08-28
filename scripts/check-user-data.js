require('dotenv').config();
const { supabase } = require('../config/database');

async function checkUserData() {
  try {
    console.log('\n🔍 Checking all users in database...\n');
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log(`Found ${users.length} users:\n`);
    
    for (const user of users) {
      console.log('----------------------------------------');
      console.log(`User ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Username: ${user.username || 'Not set'}`);
      console.log(`Name: ${user.first_name || ''} ${user.last_name || ''}`);
      console.log(`Bio: ${user.bio || 'Not set'}`);
      console.log(`Profile Picture: ${user.profile_picture_url || 'Not set'}`);
      console.log(`Location: ${user.location || 'Not set'}`);
      console.log(`Gender: ${user.gender || 'Not set'}`);
      console.log(`Date of Birth: ${user.date_of_birth || 'Not set'}`);
      console.log(`Created: ${user.created_at}`);
      console.log(`Updated: ${user.updated_at}`);
      
      // Check progressive profile
      const { data: progressiveProfile } = await supabase
        .from('progressive_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (progressiveProfile) {
        console.log('\n📊 Progressive Profile:');
        console.log(`  - Total Points: ${progressiveProfile.total_points}`);
        console.log(`  - Current Phase: ${progressiveProfile.current_phase}`);
        console.log(`  - Answered Questions: ${progressiveProfile.answered_questions?.length || 0}`);
        console.log(`  - Completion: ${progressiveProfile.completion_percentage || 0}%`);
        
        if (progressiveProfile.answers) {
          console.log('\n  📝 Saved Answers:');
          for (const [key, value] of Object.entries(progressiveProfile.answers)) {
            console.log(`    - ${key}: ${JSON.stringify(value).substring(0, 50)}...`);
          }
        }
      } else {
        console.log('\n❌ No progressive profile found');
      }
    }
    
    console.log('\n========================================\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkUserData();