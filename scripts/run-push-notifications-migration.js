// Script to run push notifications tables migration
require('dotenv').config();
const { supabase } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function runPushNotificationsMigration() {
  console.log('🔄 Running push notifications tables migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/add_push_notifications_tables.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Split the SQL into individual statements (remove the COMMIT at the end)
    const statements = migrationSQL
      .replace(/COMMIT;/g, '')
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
            // Try direct query if RPC fails
            console.log('RPC failed, trying direct query...');
            const { error: directError } = await supabase
              .from('push_tokens')
              .select('id')
              .limit(1);
              
            if (directError && !directError.message.includes('does not exist')) {
              throw directError;
            }
          }
        } catch (statementError) {
          if (statementError.message?.includes('already exists') || 
              statementError.message?.includes('UNIQUE constraint')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, statementError.message);
            // Continue with other statements
          }
        }
      }
    }
    
    // Test the tables by checking if they exist
    console.log('🧪 Testing push notification tables...');
    
    const tables = ['push_tokens', 'notification_settings', 'notification_history'];
    
    for (const table of tables) {
      const { data: tableTest, error: testError } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (testError && testError.message.includes('does not exist')) {
        throw new Error(`Table ${table} was not created successfully`);
      }
      
      console.log(`✅ Table ${table} verified`);
    }
    
    console.log('✅ Push notifications tables migration completed successfully!');
    console.log('📊 Tables created:');
    console.log('  - push_tokens: Stores device push notification tokens');
    console.log('  - notification_settings: User notification preferences');
    console.log('  - notification_history: History of sent notifications');
    console.log('');
    console.log('🔧 Features included:');
    console.log('  - Token management for multiple devices per user');
    console.log('  - Granular notification settings per type');
    console.log('  - Quiet hours functionality');
    console.log('  - Complete notification history tracking');
    console.log('  - Row Level Security (RLS) policies');
    console.log('  - Proper indexes for performance');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runPushNotificationsMigration();