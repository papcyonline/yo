require('dotenv').config();
const { supabase } = require('../config/database');

async function fixUserSync() {
  try {
    console.log('\n🔧 Fixing user profile sync...\n');
    
    // Get the progressive profile data
    const { data: profiles, error: fetchError } = await supabase
      .from('progressive_profiles')
      .select('*');
    
    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      return;
    }
    
    console.log(`Found ${profiles.length} profiles to sync\n`);
    
    for (const profile of profiles) {
      const userId = profile.user_id;
      const answers = profile.answers || {};
      
      console.log(`🔄 Processing user ${userId}...`);
      
      // First, get the current user data to see what columns exist
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userError) {
        console.log(`❌ Could not fetch user: ${userError.message}`);
        continue;
      }
      
      console.log(`📊 Current user data:`);
      console.log(`  - Bio: ${currentUser.bio || 'Not set'}`);
      console.log(`  - Picture: ${currentUser.profile_picture_url || 'Not set'}`);
      console.log(`  - Display name: ${currentUser.display_name || 'Not set'}`);
      
      // Create update object with only existing columns
      const updates = {};
      
      // Update bio if we have personal_bio
      if (answers.personal_bio && answers.personal_bio !== currentUser.bio) {
        updates.bio = answers.personal_bio;
        console.log(`✏️  Setting bio: \"${answers.personal_bio.substring(0, 30)}...\"`);
      }
      
      // Update profile picture if we have profile_image
      if (answers.profile_image && answers.profile_image !== currentUser.profile_picture_url) {
        updates.profile_picture_url = answers.profile_image;
        console.log(`📷 Setting profile picture`);
      }
      
      // Update display name if we have childhood_nickname
      if (answers.childhood_nickname && answers.childhood_nickname !== currentUser.display_name) {
        updates.display_name = answers.childhood_nickname;
        console.log(`👤 Setting display name: ${answers.childhood_nickname}`);
      }
      
      // Update completion percentage
      if (profile.completion_percentage && profile.completion_percentage !== currentUser.profile_completion_percentage) {
        updates.profile_completion_percentage = profile.completion_percentage;
        if (profile.completion_percentage >= 100) {
          updates.profile_complete = true;
        }
        console.log(`📈 Setting completion: ${profile.completion_percentage}%`);
      }
      
      // Only proceed if we have updates
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        
        console.log(`📤 Applying ${Object.keys(updates).length - 1} updates...`);
        
        // Use a different approach - direct SQL through RPC if available
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);
          
          if (updateError) {
            console.log(`❌ Direct update failed: ${updateError.message}`);
            
            // Try individual field updates
            for (const [key, value] of Object.entries(updates)) {
              if (key === 'updated_at') continue;
              
              try {
                const { error: fieldError } = await supabase
                  .from('users')
                  .update({ [key]: value, updated_at: new Date().toISOString() })
                  .eq('id', userId);
                
                if (fieldError) {
                  console.log(`  ❌ ${key}: ${fieldError.message}`);
                } else {
                  console.log(`  ✅ ${key}: Updated successfully`);
                }
              } catch (err) {
                console.log(`  ❌ ${key}: ${err.message}`);
              }
            }
          } else {
            console.log(`✅ All updates applied successfully!`);
            
            // Verify the update worked
            const { data: updatedUser } = await supabase
              .from('users')
              .select('bio, profile_picture_url, display_name, profile_completion_percentage')
              .eq('id', userId)
              .single();
            
            if (updatedUser) {
              console.log(`📝 Verified updated data:`);
              console.log(`  - Bio: ${updatedUser.bio || 'Still not set'}`);
              console.log(`  - Picture: ${updatedUser.profile_picture_url ? 'Set ✓' : 'Not set'}`);
              console.log(`  - Display name: ${updatedUser.display_name || 'Not set'}`);
              console.log(`  - Completion: ${updatedUser.profile_completion_percentage || 0}%`);
            }
          }
        } catch (error) {
          console.log(`❌ Update error: ${error.message}`);
        }
      } else {
        console.log(`⏭️  No updates needed`);
      }
      
      console.log('');
    }
    
    console.log('✅ Sync process complete!\n');
    
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    process.exit(0);
  }
}

fixUserSync();