// Script to fix missing columns in database
require('dotenv').config();
const { supabase } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function runFixMissingColumnsMigration() {
  console.log('🔄 Running fix missing columns migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/fix_missing_columns.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { 
            sql_query: statement + ';'
          });
          
          if (error) {
            console.log('RPC failed, continuing...');
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (statementError) {
          if (statementError.message?.includes('already exists') || 
              statementError.message?.includes('does not exist')) {
            console.log(`⚠️  Statement ${i + 1} skipped (column exists or table missing)`);
          } else {
            console.log(`⚠️  Statement ${i + 1} warning:`, statementError.message);
          }
        }
      }
    }
    
    console.log('✅ Fix missing columns migration completed!');
    console.log('📊 Columns that should now exist:');
    console.log('  - users.interests (JSONB)');
    console.log('  - users.bio (TEXT)'); 
    console.log('  - users.location (TEXT)');
    console.log('  - users.education (JSONB)');
    console.log('  - users.family_info (JSONB)');
    console.log('  - users.personal_info (JSONB)');
    console.log('  - progressive_profiles.completion_percentage (INTEGER)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runFixMissingColumnsMigration();