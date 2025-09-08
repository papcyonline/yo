const fetch = require('node-fetch');

async function testAuth() {
  const baseURL = 'http://192.168.1.231:3018/api';
  
  try {
    // Test login with demo credentials
    const loginResponse = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);

    if (loginData.success && loginData.data && loginData.data.token) {
      const token = loginData.data.token;
      console.log('JWT Token obtained:', token.substring(0, 20) + '...');

      // Test genealogy endpoint with token
      const genealogyResponse = await fetch(`${baseURL}/genealogy/trees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const genealogyData = await genealogyResponse.json();
      console.log('Genealogy API response:', genealogyData);
      
      if (genealogyData.success) {
        console.log('✅ Authentication working correctly!');
        console.log('Family trees:', genealogyData.data?.length || 0);
      } else {
        console.log('❌ Genealogy API error:', genealogyData.message);
      }
    } else {
      console.log('❌ Login failed:', loginData.message);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAuth();