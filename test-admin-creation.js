// test-admin-creation.js
// Simple script to test the create-admin-user function

async function testAdminCreation() {
  try {
    console.log('Testing admin user creation...');
    
    const response = await fetch('http://localhost:54321/functions/v1/create-admin-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.success) {
      console.log('Admin user created/verified successfully!');
      console.log(`Email: ${data.adminEmail}`);
    } else {
      console.error('Failed to create admin user:', data.error);
    }
  } catch (error) {
    console.error('Error calling function:', error);
  }
}

testAdminCreation();