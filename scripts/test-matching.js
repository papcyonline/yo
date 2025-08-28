const mongoose = require('mongoose');
const { User } = require('../models');
const { enhancedMatchingService } = require('../services/aiMatchingService');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/yofam-dev', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testMatching() {
  try {
    console.log('🧪 Testing AI Matching System...\n');
    
    // Get John Smith test user (we know this ID exists)
    const testUser = await User.findById('68a59ce752b17f5ddd70f46e');
    if (!testUser) {
      console.log('❌ John Smith test user not found');
      process.exit(1);
    }
    
    console.log('📋 Test User:');
    console.log(`   Name: ${testUser.first_name} ${testUser.last_name}`);
    console.log(`   Location: ${testUser.location}`);
    console.log(`   Profession: ${testUser.profession}`);
    console.log(`   Father: ${testUser.father_name}`);
    console.log(`   Mother: ${testUser.mother_name}`);
    console.log(`   Family Origin: ${testUser.family_origin}`);
    console.log(`   ID: ${testUser._id}\n`);
    
    // Test enhanced AI matching
    console.log('🧠 Running Enhanced AI Matching System...');
    const result = await enhancedMatchingService.findMatches(testUser._id, {
      matchTypes: ['all'],
      maxResults: 20,
      minConfidence: 0.3
    });
    const matches = result.matches || [];
    
    console.log(`\n✅ Found ${matches.length} matches:\n`);
    
    matches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.name || `User ${match.userId}`}`);
      console.log(`   Type: ${match.type}`);
      console.log(`   Score: ${match.score}% confidence`);
      console.log(`   Reason: ${match.reason}`);
      console.log(`   AI Enhanced: ${match.aiEnhanced ? '✅' : '❌'}`);
      console.log(`   User ID: ${match.userId}`);
      console.log('');
    });
    
    // Show AI processing info
    if (result.aiEnhanced) {
      console.log(`🧠 AI Processing: Enhanced (${result.processingTime?.toFixed(1)}ms)`);
      console.log(`📊 Model Version: ${result.model_version}`);
    } else if (result.fallback) {
      console.log(`🔧 AI Processing: Fallback (${result.reason || result.error})`);
    }
    
    if (matches.length === 0) {
      console.log('ℹ️  No matches found. This could mean:');
      console.log('   - Not enough test users in database');
      console.log('   - Matching criteria too strict');
      console.log('   - Test data needs more variety');
    }
    
    console.log('🎯 Matching test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Matching test failed:', error);
    process.exit(1);
  }
}

testMatching();