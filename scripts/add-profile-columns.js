require('dotenv').config();
const { supabase } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function addProfileColumns() {
  try {
    console.log('\n🔧 Adding missing profile columns to users table...\n');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'database', 'add_profile_columns.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL statements and execute them one by one
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      
      try {
        // Use raw SQL through Supabase RPC or direct query
        // Since Supabase JS client doesn't support DDL directly, we'll use a workaround
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // If RPC doesn't exist, try alternative approach
          console.log('  ⚠️  Direct execution not available, trying alternative...');
          
          // For Supabase, we need to use the Dashboard or CLI to run DDL
          console.log('  📝 SQL Statement to run manually:');
          console.log('  ', statement + ';');
        } else {
          console.log('  ✅ Success');
        }
      } catch (err) {
        console.log('  ⚠️  Could not execute directly:', err.message);
        console.log('  📝 Please run this SQL manually in Supabase Dashboard:');
        console.log('  ', statement + ';');
      }
    }
    
    console.log('\n📋 Summary:');
    console.log('The SQL statements have been generated. Since Supabase requires DDL statements');
    console.log('to be run through the Dashboard or CLI, please:');
    console.log('\n1. Go to your Supabase Dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of:');
    console.log(`   ${sqlPath}`);
    console.log('4. Execute the SQL\n');
    
    console.log('Alternatively, use Supabase CLI:');
    console.log('supabase db push < database/add_profile_columns.sql\n');
    
    // Let's try a simpler approach - just update with basic fields
    console.log('🔄 Attempting to sync data with existing columns only...\n');
    
    const { data: profiles } = await supabase
      .from('progressive_profiles')
      .select('*');
    
    for (const profile of profiles || []) {
      const answers = profile.answers || {};
      const updates = {};
      
      // Only use fields we know exist
      if (answers.personal_bio) updates.bio = answers.personal_bio;
      if (answers.profile_image) updates.profile_picture_url = answers.profile_image;
      
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        
        const { error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', profile.user_id);
        
        if (error) {
          console.log(`❌ Failed to update user ${profile.user_id}:`, error.message);
        } else {
          console.log(`✅ Updated user ${profile.user_id} with basic fields`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

addProfileColumns();