require('dotenv').config();
const { supabase } = require('../config/database');

async function checkUsersTableStructure() {
  try {
    console.log('\n🔍 Checking Users Table Structure...\n');
    
    // First, let's try a simple select to see what fields exist
    const { data: sampleUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();
    
    if (selectError) {
      console.error('❌ Error selecting from users table:', selectError);
      return;
    }
    
    console.log('📋 Sample user structure:');
    console.log('Available fields:', Object.keys(sampleUser));
    
    // Test if the specific fields we're trying to update exist
    const fieldsToCheck = ['first_name', 'last_name', 'username', 'date_of_birth', 'gender', 'current_address'];
    console.log('\n🔍 Checking specific fields:');
    fieldsToCheck.forEach(field => {
      console.log(`   ${field}: ${field in sampleUser ? '✅ EXISTS' : '❌ MISSING'} (value: ${sampleUser[field]})`);
    });
    
    // Try a minimal update to see if it works
    console.log('\n🧪 Testing minimal update...');
    const testUserId = sampleUser.id;
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', testUserId);
    
    if (updateError) {
      console.error('❌ Minimal update failed:', updateError);
    } else {
      console.log('✅ Minimal update succeeded');
    }
    
    // Try updating a single field
    console.log('\n🧪 Testing single field update...');
    const { error: singleFieldError } = await supabase
      .from('users')
      .update({ bio: 'Test bio update' })
      .eq('id', testUserId);
    
    if (singleFieldError) {
      console.error('❌ Single field update failed:', singleFieldError);
    } else {
      console.log('✅ Single field update succeeded');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    process.exit(0);
  }
}

checkUsersTableStructure();