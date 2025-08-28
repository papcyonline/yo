require('dotenv').config();
const { supabase } = require('../config/database');

async function syncBasicProfile() {
  try {
    console.log('\n🔄 Syncing basic profile data...\n');
    
    // Get all progressive profiles
    const { data: profiles, error: fetchError } = await supabase
      .from('progressive_profiles')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      return;
    }
    
    console.log(`Found ${profiles.length} profiles to sync\n`);
    
    for (const profile of profiles) {
      const answers = profile.answers || {};
      console.log(`\n📝 Processing user ${profile.user_id}:`);
      
      // First, check what columns exist in the users table
      const { data: currentUser, error: getUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', profile.user_id)
        .single();
      
      if (getUserError) {
        console.log(`  ❌ User not found: ${getUserError.message}`);
        continue;
      }
      
      const updates = {};
      
      // Only update fields that exist in the current schema
      if ('bio' in currentUser && answers.personal_bio) {
        updates.bio = answers.personal_bio;
        console.log(`  - Bio: "${answers.personal_bio.substring(0, 30)}..."`);
      }
      
      if ('profile_picture_url' in currentUser && answers.profile_image) {
        updates.profile_picture_url = answers.profile_image;
        console.log(`  - Profile picture: set`);
      }
      
      // Try to update name fields if they exist
      if (answers.full_name) {
        const nameParts = answers.full_name.split(' ');
        if ('first_name' in currentUser) {
          updates.first_name = nameParts[0] || currentUser.first_name;
        }
        if ('last_name' in currentUser) {
          updates.last_name = nameParts.slice(1).join(' ') || currentUser.last_name;
        }
        console.log(`  - Name: ${answers.full_name}`);
      }
      
      // Only proceed if we have updates
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        
        console.log(`  📤 Updating ${Object.keys(updates).length - 1} fields...`);
        
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', profile.user_id)
          .select()
          .single();
        
        if (updateError) {
          console.log(`  ❌ Update failed: ${updateError.message}`);
        } else {
          console.log(`  ✅ Successfully updated!`);
          
          // Show what was updated
          if (updatedUser) {
            console.log(`  📊 Current user data:`);
            console.log(`     - Name: ${updatedUser.first_name} ${updatedUser.last_name}`);
            console.log(`     - Bio: ${updatedUser.bio || 'Not set'}`);
            console.log(`     - Picture: ${updatedUser.profile_picture_url ? 'Set' : 'Not set'}`);
          }
        }
      } else {
        console.log(`  ⏭️  No compatible fields to update`);
      }
    }
    
    console.log('\n✅ Basic sync complete!\n');
    console.log('Note: Some fields could not be synced because the database columns are missing.');
    console.log('Please run the SQL migration in database/add_profile_columns.sql to add all fields.\n');
    
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    process.exit(0);
  }
}

syncBasicProfile();