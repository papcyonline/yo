require('dotenv').config();
const { supabase } = require('../config/database');

async function syncProgressiveData() {
  try {
    console.log('\n🔄 Starting progressive data sync...\n');
    
    // Get all users with progressive profiles
    const { data: progressiveProfiles, error: fetchError } = await supabase
      .from('progressive_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('Error fetching progressive profiles:', fetchError);
      return;
    }
    
    console.log(`Found ${progressiveProfiles.length} progressive profiles to sync\n`);
    
    for (const profile of progressiveProfiles) {
      console.log(`\n📝 Syncing user ${profile.user_id}...`);
      
      const answers = profile.answers || {};
      const updates = {};
      
      // Map progressive fields to user table fields
      if (answers.personal_bio) {
        updates.bio = answers.personal_bio;
        console.log('  - Setting bio:', answers.personal_bio.substring(0, 50) + '...');
      }
      
      if (answers.profile_image) {
        updates.profile_picture_url = answers.profile_image;
        console.log('  - Setting profile picture');
      }
      
      if (answers.childhood_nickname || answers.nickname) {
        updates.nickname = answers.childhood_nickname || answers.nickname;
        console.log('  - Setting nickname:', updates.nickname);
      }
      
      if (answers.date_of_birth) {
        updates.date_of_birth = answers.date_of_birth;
        console.log('  - Setting date of birth:', updates.date_of_birth);
      }
      
      if (answers.gender) {
        updates.gender = answers.gender;
        console.log('  - Setting gender:', updates.gender);
      }
      
      if (answers.location || answers.current_location) {
        updates.location = answers.location || answers.current_location;
        console.log('  - Setting location:', updates.location);
      }
      
      // Handle name fields
      if (answers.full_name) {
        const nameParts = answers.full_name.split(' ');
        updates.first_name = nameParts[0] || '';
        updates.last_name = nameParts.slice(1).join(' ') || '';
        console.log('  - Setting name:', answers.full_name);
      }
      
      // Create JSONB fields for family and personal info
      const familyInfo = {};
      const personalInfo = {};
      const education = {};
      
      // Family info
      if (answers.father_name) familyInfo.father_name = answers.father_name;
      if (answers.mother_name) familyInfo.mother_name = answers.mother_name;
      if (answers.siblings_relatives) familyInfo.siblings = answers.siblings_relatives;
      if (answers.family_stories) familyInfo.origin_stories = answers.family_stories;
      if (answers.family_traditions) familyInfo.traditions = answers.family_traditions;
      
      // Personal info
      if (answers.childhood_memories) personalInfo.childhood_memories = answers.childhood_memories;
      if (answers.kindergarten_memories) personalInfo.kindergarten_memories = answers.kindergarten_memories;
      if (answers.childhood_friends) personalInfo.childhood_friends = answers.childhood_friends;
      if (answers.hobbies) personalInfo.hobbies = answers.hobbies;
      if (answers.languages_dialects) personalInfo.languages = answers.languages_dialects;
      if (answers.religious_background) personalInfo.religious_background = answers.religious_background;
      if (answers.profession) personalInfo.profession = answers.profession;
      
      // Education info
      if (answers.primary_school) education.primary_school = answers.primary_school;
      if (answers.secondary_school) education.high_school = answers.secondary_school;
      if (answers.university_college) education.university = answers.university_college;
      if (answers.educational_background) education.background = answers.educational_background;
      
      // Add JSONB fields if they have data
      if (Object.keys(familyInfo).length > 0) {
        updates.family_info = familyInfo;
        console.log('  - Setting family info with', Object.keys(familyInfo).length, 'fields');
      }
      
      if (Object.keys(personalInfo).length > 0) {
        updates.personal_info = personalInfo;
        console.log('  - Setting personal info with', Object.keys(personalInfo).length, 'fields');
      }
      
      if (Object.keys(education).length > 0) {
        updates.education = education;
        console.log('  - Setting education with', Object.keys(education).length, 'fields');
      }
      
      // Update the user record
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', profile.user_id);
        
        if (updateError) {
          console.error(`  ❌ Error updating user ${profile.user_id}:`, updateError.message);
          
          // Check if columns exist
          if (updateError.message.includes('column')) {
            console.log('\n  ⚠️  Some columns might be missing. Trying with basic fields only...');
            
            // Try again with only basic fields
            const basicUpdates = {
              bio: updates.bio,
              profile_picture_url: updates.profile_picture_url,
              nickname: updates.nickname,
              date_of_birth: updates.date_of_birth,
              gender: updates.gender,
              location: updates.location,
              first_name: updates.first_name,
              last_name: updates.last_name,
              updated_at: updates.updated_at
            };
            
            // Remove undefined fields
            Object.keys(basicUpdates).forEach(key => {
              if (basicUpdates[key] === undefined) delete basicUpdates[key];
            });
            
            const { error: basicUpdateError } = await supabase
              .from('users')
              .update(basicUpdates)
              .eq('id', profile.user_id);
            
            if (basicUpdateError) {
              console.error(`  ❌ Basic update also failed:`, basicUpdateError.message);
            } else {
              console.log('  ✅ Basic fields synced successfully!');
            }
          }
        } else {
          console.log('  ✅ User synced successfully!');
        }
      } else {
        console.log('  ⏭️  No fields to sync');
      }
    }
    
    console.log('\n✅ Sync complete!\n');
    
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    process.exit(0);
  }
}

syncProgressiveData();