# Frontend Typing Indicator Integration

## The Problem
Your typing indicators aren't working because your frontend app isn't emitting the required socket events when users type in chat inputs.

## Backend Status ✅
- Socket.io handlers: ✅ Listening for 'typing' events
- REST API fallback: ✅ Available at `/api/typing/:chatId/typing`  
- Event broadcasting: ✅ Emits to `chat_${chatId}` rooms
- Debugging logs: ✅ Shows "⌨️ SOCKET:" when events received

## Required Frontend Code

### 1. Socket Connection Setup
```javascript
import io from 'socket.io-client';

// Connect with authentication
const socket = io('http://localhost:9000', {
  auth: {
    token: yourAuthToken // JWT token
  }
});

// Join chat room when entering chat
socket.emit('join_chat', chatId);
```

### 2. Chat Input Component (CRITICAL)
```javascript
// In your chat input component
const [typingTimeout, setTypingTimeout] = useState(null);

const handleInputChange = (text) => {
  setMessage(text);
  
  // Emit typing started
  socket.emit('typing', {
    chatId: currentChatId,
    isTyping: true
  });
  
  // Clear previous timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  
  // Set timeout to stop typing after 1 second of no input
  const timeout = setTimeout(() => {
    socket.emit('typing', {
      chatId: currentChatId,
      isTyping: false
    });
  }, 1000);
  
  setTypingTimeout(timeout);
};

// Stop typing when input loses focus or user sends message
const stopTyping = () => {
  socket.emit('typing', {
    chatId: currentChatId,
    isTyping: false
  });
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    setTypingTimeout(null);
  }
};
```

### 3. Listen for Typing Events
```javascript
// In your chat component
const [typingUsers, setTypingUsers] = useState([]);

useEffect(() => {
  // Listen for typing updates
  socket.on('user_typing', (data) => {
    console.log('User typing:', data);
    
    if (data.isTyping && data.userId !== currentUserId) {
      // Add user to typing list
      setTypingUsers(prev => [...prev.filter(u => u !== data.userId), data.userId]);
    } else {
      // Remove user from typing list  
      setTypingUsers(prev => prev.filter(u => u !== data.userId));
    }
  });
  
  // Alternative event listener
  socket.on('typing_update', (data) => {
    console.log('Typing update:', data);
    setTypingUsers(data.typingUsers || []);
  });
  
  return () => {
    socket.off('user_typing');
    socket.off('typing_update');
  };
}, []);
```

### 4. Display Typing Indicator
```javascript
// In your chat UI
{typingUsers.length > 0 && (
  <View style={styles.typingIndicator}>
    <Text>
      {typingUsers.length === 1 
        ? `${getUserName(typingUsers[0])} is typing...`
        : `${typingUsers.length} users are typing...`
      }
    </Text>
  </View>
)}
```

## Testing Your Integration

### Test Backend (Available Now)
```bash
# Test if backend receives events
curl -X POST "http://localhost:9000/api/typing-test/test/CHAT_ID_HERE" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isTyping": true}'
```

### Debug Frontend
Add these console logs to verify:
```javascript
// Verify socket connection
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

// Verify typing emission
const emitTyping = (isTyping) => {
  console.log('📤 Emitting typing:', { chatId, isTyping });
  socket.emit('typing', { chatId, isTyping });
};
```

## Common Issues to Check

1. **Socket Not Connected**: Verify auth token and connection
2. **Not Joined Chat Room**: Must emit 'join_chat' when entering chat
3. **Event Name Mismatch**: Use exactly 'typing' (not 'user_typing')
4. **Missing chatId**: Ensure chatId is passed correctly
5. **Auth Token**: Socket needs valid JWT in auth.token

## Expected Backend Logs
When working, you should see:
```
⌨️ SOCKET: User 123 started typing in chat 456
📡 Broadcasted typing status to chat_456: typing
```

If you don't see these logs, the frontend isn't emitting events correctly.