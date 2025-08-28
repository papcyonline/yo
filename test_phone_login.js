const axios = require('axios');

async function testPhoneLogin() {
  try {
    console.log('🧪 Testing Phone Login...');
    
    const baseURL = 'http://localhost:9000/api';
    
    // Try phone login (no password required for phone-only users)
    const phoneCredentials = [
      { phone: '+1234567890' }, // Test User
      { phone: '+1234567891' }, // John Smith
      { phone: '+2348123456789' }, // James Wilson
      { phone: '+2348123456790' } // Mary Johnson
    ];
    
    let loginResponse = null;
    for (const creds of phoneCredentials) {
      try {
        console.log(`   Trying phone: ${creds.phone}`);
        loginResponse = await axios.post(`${baseURL}/auth/login`, creds);
        if (loginResponse.data.success) {
          console.log(`✅ Login successful with: ${creds.phone}`);
          break;
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${creds.phone} - ${error.response?.data?.message || 'Unknown error'}`);
      }
    }
    
    if (!loginResponse || !loginResponse.data.success) {
      console.log('❌ All phone login attempts failed');
      return;
    }
    
    const token = loginResponse.data.data.token;
    const user = loginResponse.data.data.user;
    console.log(`✅ Login successful. User: ${user.firstName} ${user.lastName}`);
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test getting chats
    console.log('💬 Testing get chats...');
    const chatsResponse = await axios.get(`${baseURL}/chats`, { headers });
    
    if (!chatsResponse.data.success) {
      console.log('❌ Get chats failed:', chatsResponse.data.message);
      return;
    }
    
    console.log(`✅ Got ${chatsResponse.data.data.chats.length} chats`);
    
    // If no chats, try to create one with another user
    if (chatsResponse.data.data.chats.length === 0) {
      console.log('💬 No chats found, creating one...');
      
      // Get list of users to chat with
      const usersResponse = await axios.get(`${baseURL}/users`, { headers });
      const otherUsers = usersResponse.data.data.users.filter(u => u._id !== user.id);
      
      if (otherUsers.length > 0) {
        const targetUser = otherUsers[0];
        console.log(`👤 Creating chat with: ${targetUser.first_name} ${targetUser.last_name}`);
        
        const chatResponse = await axios.post(`${baseURL}/chats/direct`, {
          targetUserId: targetUser._id
        }, { headers });
        
        if (chatResponse.data.success) {
          const chat = chatResponse.data.data.chat;
          console.log(`✅ Chat created: ${chat._id}`);
          
          // Now test sending a message
          console.log('📤 Testing send message...');
          const messageResponse = await axios.post(`${baseURL}/chats/${chat._id}/messages`, {
            text: 'Hello! This is a test message from phone login.'
          }, { headers });
          
          if (messageResponse.data.success) {
            console.log('✅ Message sent successfully!');
            console.log('📝 Message content:', messageResponse.data.data.message.content.text);
          } else {
            console.log('❌ Message sending failed:', messageResponse.data.message);
          }
        } else {
          console.log('❌ Chat creation failed:', chatResponse.data.message);
        }
      }
    }
    
    console.log('\\n🎉 Phone login test completed!');
    
  } catch (error) {
    console.error('❌ Phone login test failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testPhoneLogin();