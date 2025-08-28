// Quick test to check if Status model works
const mongoose = require('mongoose');
const Status = require('./models/Status');

async function testStatusModel() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/yofam-dev');
    console.log('✅ Connected to MongoDB');

    // Test creating a simple status
    const testStatus = new Status({
      user_id: new mongoose.Types.ObjectId('68a4896926a9f582eaa75b57'),
      content: {
        text: 'Hello World - Test Status',
        type: 'text'
      },
      visibility: 'friends'
    });

    console.log('💾 Saving test status...');
    const savedStatus = await testStatus.save();
    console.log('✅ Status saved:', savedStatus._id);

    // Test querying statuses
    console.log('🔍 Querying all statuses...');
    const allStatuses = await Status.find().limit(5);
    console.log('📊 Total statuses found:', allStatuses.length);
    
    if (allStatuses.length > 0) {
      console.log('📄 Sample status:', {
        id: allStatuses[0]._id,
        text: allStatuses[0].content.text,
        type: allStatuses[0].content.type,
        user: allStatuses[0].user_id
      });
    }

    // Clean up test status
    await Status.deleteOne({ _id: savedStatus._id });
    console.log('🗑️ Cleaned up test status');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

testStatusModel();