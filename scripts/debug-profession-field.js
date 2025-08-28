require('dotenv').config();
const { supabase } = require('../config/database');

async function debugProfessionField() {
  try {
    console.log('\n🔍 Debugging Profession Field Specifically...\n');
    
    // Get the current user
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const user = users[0];
    console.log(`📊 Testing user: ${user.email} (${user.id})`);
    
    // Get progressive profile
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (progressiveProfile && progressiveProfile.answers) {
      const answers = progressiveProfile.answers;
      const profession = answers.profession;
      
      console.log('🔍 PROFESSION FIELD ANALYSIS:');
      console.log('=============================');
      console.log('Field exists:', 'profession' in answers);
      console.log('Raw value:', JSON.stringify(profession));
      console.log('Type:', typeof profession);
      console.log('Length:', profession ? profession.length : 'N/A');
      console.log('Truthy?', !!profession);
      console.log('Empty string?', profession === '');
      console.log('Null?', profession === null);
      console.log('Undefined?', profession === undefined);
      console.log('Trimmed value:', profession ? `"${profession.trim()}"` : 'N/A');
      console.log('Trimmed length:', profession ? profession.trim().length : 'N/A');
      
      // Test the exact condition from the backend
      console.log('\n🧪 TESTING BACKEND CONDITIONS:');
      console.log('==============================');
      
      const testConditions = {
        'answers.profession': !!answers.profession,
        'answers.profession (strict)': answers.profession !== null && answers.profession !== undefined && answers.profession !== '',
        'String(profession).trim()': profession ? String(profession).trim() : 'N/A',
        'String(profession).trim().length > 0': profession ? String(profession).trim().length > 0 : false
      };
      
      for (const [test, result] of Object.entries(testConditions)) {
        console.log(`${test}: ${result}`);
      }
      
      // Test the exact if condition
      console.log('\n🎯 EXACT IF CONDITION TEST:');
      console.log('===========================');
      if (answers.profession) {
        console.log('✅ if (answers.profession) - TRUE');
        console.log('   Profession would be added:', answers.profession);
      } else {
        console.log('❌ if (answers.profession) - FALSE');
        console.log('   Profession would NOT be added');
        console.log('   Reason: Value is falsy');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugProfessionField();