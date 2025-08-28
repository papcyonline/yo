const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Chat, Message } = require('./models/Chat');
const { User } = require('./models');
const ChatService = require('./services/ChatService');

async function testChatSystem() {
  try {
    console.log('🧪 Testing Chat System...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/yofam-dev');
    console.log('✅ Connected to MongoDB');
    
    // Get two test users
    const users = await User.find().limit(2);
    if (users.length < 2) {
      console.log('❌ Need at least 2 users in database');
      return;
    }
    
    const user1 = users[0];
    const user2 = users[1];
    console.log(`👤 User 1: ${user1.first_name} ${user1.last_name} (${user1._id})`);
    console.log(`👤 User 2: ${user2.first_name} ${user2.last_name} (${user2._id})`);
    
    // Create mock IO object for ChatService
    const mockIO = {
      to: (room) => ({
        emit: (event, data) => {
          console.log(`📡 Socket emit to ${room}: ${event}`, data);
        }
      })
    };
    
    // Initialize ChatService
    const chatService = new ChatService(mockIO);
    
    // Test 1: Create or get chat between users
    console.log('\n🔍 Test 1: Create/Get Chat');
    const chat = await chatService.createOrGetChat(user1._id, user2._id);
    console.log(`✅ Chat created/retrieved: ${chat._id}`);
    
    // Test 2: Send text message
    console.log('\n📝 Test 2: Send Text Message');
    const messageData = {
      messageType: 'text',
      content: { text: 'Hello! This is a test message from the rebuilt chat system.' }
    };
    
    const message = await chatService.sendMessage(chat._id, user1._id, messageData);
    console.log(`✅ Message sent: ${message._id}`);
    console.log(`📤 Message content: "${message.content.text}"`);
    
    // Test 3: Get chat messages
    console.log('\n📥 Test 3: Get Chat Messages');
    const messagesResult = await chatService.getChatMessages(chat._id, user1._id);
    console.log(`✅ Retrieved ${messagesResult.messages.length} messages`);
    
    // Test 4: Send another message from user2
    console.log('\n📝 Test 4: Send Reply Message');
    const replyData = {
      messageType: 'text',
      content: { text: 'Hi there! This is a reply to test the chat system.' }
    };
    
    const reply = await chatService.sendMessage(chat._id, user2._id, replyData);
    console.log(`✅ Reply sent: ${reply._id}`);
    
    // Test 5: Mark messages as read
    console.log('\n👀 Test 5: Mark Messages as Read');
    await chatService.markMessagesAsRead(chat._id, user2._id, [message._id]);
    console.log('✅ Messages marked as read');
    
    // Test 6: Get user chats
    console.log('\n📋 Test 6: Get User Chats');
    const chatsResult = await chatService.getUserChats(user1._id);
    console.log(`✅ User has ${chatsResult.chats.length} chats`);
    
    // Test 7: Send an image message (simulate)
    console.log('\n🖼️ Test 7: Send Image Message (Simulated)');
    const imageData = {
      messageType: 'image',
      content: { 
        text: '📸 Photo',
        mediaUrl: '/uploads/test-image.jpg',
        mediaType: 'image/jpeg',
        mediaSize: 1024000
      }
    };
    
    const imageMessage = await chatService.sendMessage(chat._id, user1._id, imageData);
    console.log(`✅ Image message sent: ${imageMessage._id}`);
    
    console.log('\n🎉 All chat tests completed successfully!');
    
    // Final summary
    const finalMessages = await chatService.getChatMessages(chat._id, user1._id);
    console.log(`\n📊 Final Summary:`);
    console.log(`- Chat ID: ${chat._id}`);
    console.log(`- Total messages: ${finalMessages.messages.length}`);
    console.log(`- Messages:`);
    finalMessages.messages.forEach((msg, index) => {
      const senderName = msg.senderId === user1._id.toString() ? 
        `${user1.first_name} ${user1.last_name}` : 
        `${user2.first_name} ${user2.last_name}`;
      console.log(`  ${index + 1}. ${senderName}: ${msg.content.text || msg.content.mediaUrl || 'Media message'} (${msg.messageType})`);
    });
    
  } catch (error) {
    console.error('❌ Chat test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Disconnected from MongoDB');
  }
}

// Run the test
testChatSystem();