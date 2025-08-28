const mongoose = require('mongoose');
const { User } = require('./models');

async function checkUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/yofam-dev');
    console.log('📊 Connected to database');
    
    const users = await User.find({})
      .select('first_name last_name father_name mother_name location profession schools_attended _id')
      .limit(10);
    
    console.log(`\n📋 Found ${users.length} users in database:\n`);
    
    users.forEach((user, i) => {
      console.log(`${i+1}. ${user.first_name || 'N/A'} ${user.last_name || 'N/A'} (ID: ${user._id})`);
      console.log(`   Father: ${user.father_name || 'N/A'}`);
      console.log(`   Mother: ${user.mother_name || 'N/A'}`);
      console.log(`   Location: ${user.location || 'N/A'}`);
      console.log(`   Profession: ${user.profession || 'N/A'}`);
      console.log(`   Schools: ${user.schools_attended || 'N/A'}`);
      console.log('');
    });
    
    // Check for potential matches - same parents
    console.log('🔍 Looking for potential family matches (same parents):');
    const usersWithParents = await User.find({
      $or: [
        { father_name: { $exists: true, $ne: null, $ne: '' } },
        { mother_name: { $exists: true, $ne: null, $ne: '' } }
      ]
    }).select('first_name last_name father_name mother_name location _id');
    
    const parentGroups = {};
    
    usersWithParents.forEach(user => {
      const fatherKey = user.father_name ? user.father_name.toLowerCase().trim() : '';
      const motherKey = user.mother_name ? user.mother_name.toLowerCase().trim() : '';
      const parentKey = `${fatherKey}|${motherKey}`;
      
      if (!parentGroups[parentKey]) {
        parentGroups[parentKey] = [];
      }
      parentGroups[parentKey].push(user);
    });
    
    // Show groups with multiple children (potential siblings)
    Object.entries(parentGroups).forEach(([parentKey, children]) => {
      if (children.length > 1 && parentKey !== '|') {
        const [father, mother] = parentKey.split('|');
        console.log(`👨‍👩‍👧‍👦 Potential siblings (Father: "${father || 'N/A'}", Mother: "${mother || 'N/A'}"):`);
        children.forEach(child => {
          console.log(`   - ${child.first_name} ${child.last_name} (${child._id})`);
        });
        console.log('');
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsers();