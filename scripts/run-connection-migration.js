// Load environment variables first
require('dotenv').config();

const { supabase } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function runConnectionMigration() {
  try {
    console.log('🔧 Running connection tables migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/add_connection_tables.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    // Split into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
          // Continue with other statements
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} error:`, err.message);
        // Continue with other statements
      }
    }
    
    console.log('🎉 Migration completed!');
    
    // Test by checking if tables exist
    console.log('\n🔍 Verifying tables...');
    
    const tablesToCheck = [
      'friend_requests',
      'connections',
      'matches',
      'user_blocks',
      'user_reports',
      'media_files'
    ];
    
    for (const tableName of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (error) {
          console.log(`❌ Table ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ Table ${tableName}: OK`);
        }
      } catch (err) {
        console.log(`❌ Table ${tableName}: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runConnectionMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration script failed:', err);
      process.exit(1);
    });
}

module.exports = { runConnectionMigration };