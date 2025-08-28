const { supabase } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔧 Running database migration...');
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../database/migrations/add_completed_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try direct approach instead
      console.log('🔄 Trying direct approach...');
      
      const { data: addColumnResult, error: addColumnError } = await supabase
        .from('progressive_profiles')
        .select('completed')
        .limit(1);
        
      if (addColumnError && addColumnError.message.includes('column "completed" does not exist')) {
        console.log('✅ Confirmed: completed column is missing. Adding it now...');
        
        // Use raw SQL query to add the column
        const { error: rawError } = await supabase
          .rpc('exec_sql', { 
            sql: 'ALTER TABLE public.progressive_profiles ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;'
          });
          
        if (rawError) {
          console.error('❌ Failed to add column:', rawError);
        } else {
          console.log('✅ Successfully added completed column!');
        }
      } else {
        console.log('✅ Column already exists or different error');
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }
    
    // Test the column exists now
    const { data: testData, error: testError } = await supabase
      .from('progressive_profiles')
      .select('completed')
      .limit(1);
      
    if (testError) {
      console.error('❌ Column test failed:', testError);
    } else {
      console.log('✅ Column test passed - completed column is available!');
    }
    
  } catch (error) {
    console.error('❌ Migration script error:', error);
  }
}

// Run the migration
runMigration();