const { supabase } = require('../config/database');

async function addMissingColumns() {
  try {
    console.log('🔄 Adding missing columns to users table...');
    
    const columns = [
      { name: 'current_address', type: 'VARCHAR(500)' },
      { name: 'father_name', type: 'VARCHAR(200)' },
      { name: 'mother_name', type: 'VARCHAR(200)' },
      { name: 'profession', type: 'VARCHAR(200)' },
      { name: 'university', type: 'VARCHAR(300)' },
      { name: 'full_name', type: 'VARCHAR(300)' }
    ];
    
    for (const column of columns) {
      try {
        // Check if column exists
        const { data: columnExists } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', 'users')
          .eq('column_name', column.name)
          .single();
        
        if (!columnExists) {
          console.log(`Adding column: ${column.name}`);
          
          // Add the column using raw SQL
          const { error } = await supabase.sql`
            ALTER TABLE users ADD COLUMN ${column.name} ${column.type}
          `;
          
          if (error) {
            console.error(`Error adding ${column.name}:`, error);
          } else {
            console.log(`✅ Added ${column.name} column`);
          }
        } else {
          console.log(`✅ Column ${column.name} already exists`);
        }
      } catch (error) {
        console.log(`Column ${column.name} might already exist or error occurred:`, error.message);
      }
    }
    
    console.log('✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
  
  process.exit(0);
}

addMissingColumns();