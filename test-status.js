const io = require('socket.io-client');
const axios = require('axios');

const SERVER_URL = 'http://localhost:9000';

// Replace with actual test values
const TEST_TOKEN = 'your_jwt_token_here'; // You need to get this from login
const TEST_CHAT_ID = 'test_chat_id'; // Replace with actual chat ID
const TEST_USER_ID = 'test_user_id'; // Replace with actual user ID

async function testTypingStatus() {
  console.log('🧪 Testing Typing Status via REST API...\n');
  
  try {
    // Test starting typing
    console.log('📝 Sending typing start request...');
    const startResponse = await axios.post(
      `${SERVER_URL}/api/typing-status/${TEST_CHAT_ID}/typing`,
      { isTyping: true },
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    console.log('✅ Typing started:', startResponse.data);
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test stopping typing
    console.log('\n📝 Sending typing stop request...');
    const stopResponse = await axios.post(
      `${SERVER_URL}/api/typing-status/${TEST_CHAT_ID}/typing`,
      { isTyping: false },
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    console.log('✅ Typing stopped:', stopResponse.data);
    
  } catch (error) {
    console.error('❌ Error testing typing status:', error.response?.data || error.message);
  }
}

async function testRecordingStatus() {
  console.log('\n🧪 Testing Recording Status via REST API...\n');
  
  try {
    // Test starting recording
    console.log('🎤 Sending recording start request...');
    const startResponse = await axios.post(
      `${SERVER_URL}/api/typing-status/${TEST_CHAT_ID}/recording`,
      { isRecording: true },
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    console.log('✅ Recording started:', startResponse.data);
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test stopping recording
    console.log('\n🎤 Sending recording stop request...');
    const stopResponse = await axios.post(
      `${SERVER_URL}/api/typing-status/${TEST_CHAT_ID}/recording`,
      { isRecording: false },
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    console.log('✅ Recording stopped:', stopResponse.data);
    
  } catch (error) {
    console.error('❌ Error testing recording status:', error.response?.data || error.message);
  }
}

function testSocketEvents() {
  console.log('\n🧪 Testing Socket.io Events...\n');
  
  const socket = io(SERVER_URL, {
    auth: {
      token: TEST_TOKEN
    }
  });
  
  socket.on('connect', () => {
    console.log('✅ Connected to socket.io');
    
    // Join chat room
    socket.emit('join_chat', TEST_CHAT_ID);
    console.log(`📱 Joined chat ${TEST_CHAT_ID}`);
    
    // Test typing event
    console.log('\n📝 Emitting typing start...');
    socket.emit('typing', {
      chatId: TEST_CHAT_ID,
      isTyping: true
    });
    
    setTimeout(() => {
      console.log('📝 Emitting typing stop...');
      socket.emit('typing', {
        chatId: TEST_CHAT_ID,
        isTyping: false
      });
    }, 2000);
    
    // Test recording event
    setTimeout(() => {
      console.log('\n🎤 Emitting recording start...');
      socket.emit('recording', {
        chatId: TEST_CHAT_ID,
        isRecording: true
      });
    }, 4000);
    
    setTimeout(() => {
      console.log('🎤 Emitting recording stop...');
      socket.emit('recording', {
        chatId: TEST_CHAT_ID,
        isRecording: false
      });
    }, 6000);
    
    // Disconnect after tests
    setTimeout(() => {
      socket.disconnect();
      console.log('\n✅ All tests completed!');
      process.exit(0);
    }, 8000);
  });
  
  // Listen for status updates
  socket.on('user_typing', (data) => {
    console.log('📨 Received typing update:', data);
  });
  
  socket.on('user_recording', (data) => {
    console.log('📨 Received recording update:', data);
  });
  
  socket.on('user_status_change', (data) => {
    console.log('📨 Received status change:', data);
  });
  
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Status Tests\n');
  console.log('⚠️  Note: Update TEST_TOKEN, TEST_CHAT_ID, and TEST_USER_ID with actual values\n');
  
  // Uncomment these lines after updating the test values
  // await testTypingStatus();
  // await testRecordingStatus();
  // testSocketEvents();
  
  console.log('\n📌 To run tests:');
  console.log('1. Get a valid JWT token from login');
  console.log('2. Get a valid chat ID from your chats');
  console.log('3. Update the TEST_TOKEN and TEST_CHAT_ID variables');
  console.log('4. Uncomment the test function calls');
  console.log('5. Run: node test-status.js');
}

runTests();