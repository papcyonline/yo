const mongoose = require('mongoose');
const { User } = require('../models');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/yofam-dev', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const testUsers = [
  {
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.smith@example.com',
    phone: '+1234567001',
    password: 'password123',
    location: 'New York, NY',
    current_location: 'New York, NY',
    profession: 'Software Engineer',
    father_name: 'Robert Smith',
    mother_name: 'Mary Smith',
    family_origin: 'Ireland',
    cultural_background: 'Irish-American',
    primary_language: 'English',
    interests: ['Technology', 'Sports', 'Music'],
    bio: 'Software engineer passionate about family heritage and technology.',
    is_active: true
  },
  {
    first_name: 'Sarah',
    last_name: 'Smith',
    email: 'sarah.smith@example.com',
    phone: '+1234567002',
    password: 'password123',
    location: 'New York, NY',
    current_location: 'New York, NY',
    profession: 'Teacher',
    father_name: 'Robert Smith',
    mother_name: 'Mary Smith',
    family_origin: 'Ireland',
    cultural_background: 'Irish-American',
    primary_language: 'English',
    interests: ['Education', 'Reading', 'Travel'],
    bio: 'Elementary school teacher who loves exploring family history.',
    is_active: true
  },
  {
    first_name: 'Michael',
    last_name: 'Johnson',
    email: 'michael.johnson@example.com',
    phone: '+1234567003',
    password: 'password123',
    location: 'Los Angeles, CA',
    current_location: 'Los Angeles, CA',
    profession: 'Doctor',
    father_name: 'David Johnson',
    mother_name: 'Jennifer Johnson',
    family_origin: 'England',
    cultural_background: 'British-American',
    primary_language: 'English',
    interests: ['Medicine', 'Hiking', 'Photography'],
    bio: 'Physician interested in genealogy and outdoor activities.',
    is_active: true
  },
  {
    first_name: 'Emily',
    last_name: 'Davis',
    email: 'emily.davis@example.com',
    phone: '+1234567004',
    password: 'password123',
    location: 'Chicago, IL',
    current_location: 'Chicago, IL',
    profession: 'Marketing Manager',
    father_name: 'Thomas Davis',
    mother_name: 'Linda Davis',
    family_origin: 'Germany',
    cultural_background: 'German-American',
    primary_language: 'English',
    interests: ['Marketing', 'Art', 'Cooking'],
    bio: 'Marketing professional with a passion for family traditions.',
    is_active: true
  },
  {
    first_name: 'James',
    last_name: 'Smith',
    email: 'james.smith@example.com',
    phone: '+1234567005',
    password: 'password123',
    location: 'Boston, MA',
    current_location: 'Boston, MA',
    profession: 'Lawyer',
    father_name: 'William Smith',
    mother_name: 'Patricia Smith',
    family_origin: 'Ireland',
    cultural_background: 'Irish-American',
    primary_language: 'English',
    interests: ['Law', 'History', 'Golf'],
    bio: 'Attorney specializing in family law and genealogy research.',
    is_active: true
  }
];

async function createTestUsers() {
  try {
    console.log('🧪 Creating test users for matching system...');
    
    // Clear existing test users first
    await User.deleteMany({ 
      email: { $in: testUsers.map(u => u.email) }
    });
    
    // Create new test users
    const createdUsers = await User.insertMany(testUsers);
    
    console.log(`✅ Created ${createdUsers.length} test users:`);
    createdUsers.forEach(user => {
      console.log(`   - ${user.first_name} ${user.last_name} (${user._id})`);
    });
    
    console.log('\n🎯 Test matching scenarios:');
    console.log('   - John & Sarah Smith (siblings - same parents)');
    console.log('   - Smith family members (same last name, Irish heritage)');
    console.log('   - Location matches (New York area)');
    console.log('   - Professional connections (various professions)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  }
}

createTestUsers();