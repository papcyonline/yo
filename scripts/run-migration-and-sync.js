require('dotenv').config();
const { supabase } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigrationAndSync() {
  try {
    console.log('\n🚀 Starting comprehensive profile data migration and sync...\n');
    
    // Step 1: Check current state
    console.log('📊 Checking current data state...');
    const { data: users } = await supabase
      .from('users')
      .select('id, email, bio, profile_picture_url, nickname')
      .order('created_at', { ascending: false });
    
    const { data: profiles } = await supabase
      .from('progressive_profiles')
      .select('*');
    
    console.log(`Found ${users?.length || 0} users and ${profiles?.length || 0} progressive profiles\n`);
    
    // Step 2: Direct sync without complex column operations
    console.log('🔄 Syncing progressive profile data to users table...\n');
    
    for (const profile of profiles || []) {
      if (!profile.answers) continue;
      
      const userId = profile.user_id;
      const answers = profile.answers;
      
      console.log(`Processing user ${userId}:`);
      
      // Prepare update data - only use columns we know exist
      const updateData = {
        updated_at: new Date().toISOString()
      };
      
      // Map the answers to user fields
      if (answers.personal_bio) {
        updateData.bio = answers.personal_bio;
        console.log(`  - Bio: "${answers.personal_bio.substring(0, 30)}..."`);
      }
      
      if (answers.profile_image) {
        updateData.profile_picture_url = answers.profile_image;
        console.log(`  - Profile picture: set`);
      }
      
      if (answers.childhood_nickname) {
        // We'll store this in the display_name field since nickname might not exist
        updateData.display_name = answers.childhood_nickname;
        console.log(`  - Display name: ${answers.childhood_nickname}`);
      }
      
      if (answers.date_of_birth) {
        updateData.date_of_birth = answers.date_of_birth;
        console.log(`  - Date of birth: ${answers.date_of_birth}`);
      }
      
      if (answers.gender) {
        updateData.gender = answers.gender;
        console.log(`  - Gender: ${answers.gender}`);
      }
      
      if (answers.location || answers.current_location) {
        updateData.location = answers.location || answers.current_location;
        console.log(`  - Location: ${updateData.location}`);
      }
      
      // Update profile completion
      if (profile.completion_percentage) {
        updateData.profile_completion_percentage = profile.completion_percentage;
        updateData.profile_complete = profile.completion_percentage >= 100;
        console.log(`  - Completion: ${profile.completion_percentage}%`);
      }
      
      // Perform the update
      try {
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single();
        
        if (updateError) {
          console.log(`  ❌ Update failed: ${updateError.message}`);
          
          // Try a simpler update with just bio
          if (answers.personal_bio) {
            const { error: bioError } = await supabase
              .from('users')
              .update({ 
                bio: answers.personal_bio,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId);
            
            if (!bioError) {
              console.log(`  ✅ At least bio was updated successfully`);
            }
          }
        } else {
          console.log(`  ✅ Successfully updated user profile!`);
          
          // Verify the update
          const { data: verifyUser } = await supabase
            .from('users')
            .select('bio, profile_picture_url, display_name, profile_completion_percentage')
            .eq('id', userId)
            .single();
          
          if (verifyUser) {
            console.log(`  📝 Verified data:`);
            console.log(`     - Bio: ${verifyUser.bio ? 'Set ✓' : 'Not set'}`);
            console.log(`     - Picture: ${verifyUser.profile_picture_url ? 'Set ✓' : 'Not set'}`);
            console.log(`     - Display name: ${verifyUser.display_name || 'Not set'}`);
            console.log(`     - Completion: ${verifyUser.profile_completion_percentage || 0}%`);
          }
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
      
      console.log('');
    }
    
    // Step 3: Final verification
    console.log('\n📋 Final verification:');
    const { data: finalUsers } = await supabase
      .from('users')
      .select('id, email, bio, profile_picture_url, display_name, profile_completion_percentage')
      .order('created_at', { ascending: false });
    
    for (const user of finalUsers || []) {
      console.log(`\nUser: ${user.email}`);
      console.log(`  - Bio: ${user.bio ? '✓ ' + user.bio.substring(0, 30) + '...' : '✗ Not set'}`);
      console.log(`  - Picture: ${user.profile_picture_url ? '✓ Set' : '✗ Not set'}`);
      console.log(`  - Display name: ${user.display_name || 'Not set'}`);
      console.log(`  - Completion: ${user.profile_completion_percentage || 0}%`);
    }
    
    console.log('\n✅ Migration and sync complete!');
    console.log('\n📝 Next steps:');
    console.log('1. If bio is still not showing, run the SQL migration manually in Supabase Dashboard');
    console.log('2. Copy the contents of: database/add_profile_columns.sql');
    console.log('3. Execute it in the SQL Editor');
    console.log('4. Restart your backend server');
    console.log('5. Refresh your app\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

runMigrationAndSync();