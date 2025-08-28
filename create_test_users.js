const axios = require('axios');

async function createTestUsers() {
  try {
    console.log('🧪 Creating test users...');
    
    const baseURL = 'http://localhost:9000/api';
    
    const testUsers = [
      {
        phone: '+1555000001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'TestPassword123!'
      },
      {
        phone: '+1555000002', 
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        password: 'TestPassword123!'
      }
    ];
    
    for (const userData of testUsers) {
      console.log(`\n👤 Creating user: ${userData.firstName} ${userData.lastName}`);
      
      // Step 1: Register phone
      console.log('📱 Step 1: Registering phone...');
      const registerResponse = await axios.post(`${baseURL}/auth/register/phone`, {
        phone: userData.phone,
        firstName: userData.firstName,
        lastName: userData.lastName
      });
      
      if (!registerResponse.data.success) {
        console.log('❌ Registration failed:', registerResponse.data.message);
        continue;
      }
      
      const verificationCode = registerResponse.data.data.testCode;
      console.log('✅ Phone registered, verification code:', verificationCode);
      
      // Step 2: Verify phone (creates user)
      console.log('✅ Step 2: Verifying phone...');
      const verifyResponse = await axios.post(`${baseURL}/auth/verify/phone`, {
        phone: userData.phone,
        code: verificationCode
      });
      
      if (!verifyResponse.data.success) {
        console.log('❌ Verification failed:', verifyResponse.data.message);
        continue;
      }
      
      const token = verifyResponse.data.data.token;
      const user = verifyResponse.data.data.user;
      console.log('✅ Phone verified, user created:', user.id);
      
      // Step 3: Add email and password
      console.log('📧 Step 3: Adding email and password...');
      const addEmailResponse = await axios.post(`${baseURL}/auth/add-email`, {
        email: userData.email,
        password: userData.password
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!addEmailResponse.data.success) {
        console.log('❌ Add email failed:', addEmailResponse.data.message);
        continue;
      }
      
      const emailVerificationCode = addEmailResponse.data.data.testCode;
      console.log('✅ Email added, verification code:', emailVerificationCode);
      
      // Step 4: Verify email
      console.log('✅ Step 4: Verifying email...');
      const verifyEmailResponse = await axios.post(`${baseURL}/auth/verify-email`, {
        email: userData.email,
        code: emailVerificationCode
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!verifyEmailResponse.data.success) {
        console.log('❌ Email verification failed:', verifyEmailResponse.data.message);
        continue;
      }
      
      console.log(`✅ User ${userData.firstName} ${userData.lastName} created successfully!`);
      console.log(`   Phone: ${userData.phone}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Password: ${userData.password}`);
    }
    
    console.log('\n🎉 Test user creation completed!');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

createTestUsers();