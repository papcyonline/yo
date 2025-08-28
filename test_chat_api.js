const axios = require('axios');

async function testChatAPI() {
  try {
    console.log('🧪 Testing Chat API directly...');
    
    const baseURL = 'http://localhost:9000/api';
    
    // Step 1: Try multiple login credentials to find working ones
    console.log('🔐 Step 1: Testing login credentials...');
    
    const testCredentials = [
      { email: 'fameisnotfun@gmail.com', password: 'TestPassword123!' },
      { email: 'papcyai@gmail.com', password: 'TestPassword123!' },
      { email: 'papcynfor@gmail.com', password: 'TestPassword123!' },
      { email: 'hoikmanbcasdxa@gmail.com', password: 'TestPassword123!' },
      { email: 'alex.smith@test.com', password: 'TestPassword123!' }
    ];
    
    let loginResponse = null;
    for (const creds of testCredentials) {
      try {
        console.log(`   Trying: ${creds.email}`);
        loginResponse = await axios.post(`${baseURL}/auth/login`, creds);
        if (loginResponse.data.success) {
          console.log(`✅ Login successful with: ${creds.email}`);
          break;
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${creds.email} - ${error.response?.data?.message || 'Unknown error'}`);
      }
    }
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.message);
      return;
    }
    
    const token = loginResponse.data.data.token;
    const user = loginResponse.data.data.user;
    console.log(`✅ Login successful. User: ${user.first_name} ${user.last_name}`);
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Step 2: Create chat with another user
    console.log('💬 Step 2: Create chat...');
    const users = await axios.get(`${baseURL}/users`, { headers });
    const otherUsers = users.data.data.users.filter(u => u._id !== user._id);
    
    if (otherUsers.length === 0) {
      console.log('❌ No other users found');
      return;
    }
    
    const targetUser = otherUsers[0];
    console.log(`👤 Target user: ${targetUser.first_name} ${targetUser.last_name}`);
    
    const chatResponse = await axios.post(`${baseURL}/chats/direct`, {
      targetUserId: targetUser._id
    }, { headers });
    
    if (!chatResponse.data.success) {
      console.log('❌ Chat creation failed:', chatResponse.data.message);
      return;
    }
    
    const chat = chatResponse.data.data.chat;
    console.log(`✅ Chat created/retrieved: ${chat._id}`);
    
    // Step 3: Send text message
    console.log('📤 Step 3: Send text message...');
    const messageResponse = await axios.post(`${baseURL}/chats/${chat._id}/messages`, {
      text: 'Hello! This is a test message from API testing script.'
    }, { headers });
    
    if (!messageResponse.data.success) {
      console.log('❌ Message sending failed:', messageResponse.data.message);
      return;
    }
    
    const message = messageResponse.data.data.message;
    console.log(`✅ Message sent successfully: ${message._id}`);
    console.log(`📝 Message content: "${message.content.text}"`);
    
    // Step 4: Get messages to verify
    console.log('📥 Step 4: Get messages...');
    const messagesResponse = await axios.get(`${baseURL}/chats/${chat._id}/messages`, { headers });
    
    if (!messagesResponse.data.success) {
      console.log('❌ Getting messages failed:', messagesResponse.data.message);
      return;
    }
    
    const messages = messagesResponse.data.data.messages;
    console.log(`✅ Retrieved ${messages.length} messages`);
    
    messages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.senderName}: ${msg.content.text} (${msg.status})`);
    });
    
    console.log('\n🎉 Chat API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Chat API test failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testChatAPI();