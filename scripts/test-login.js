const fetch = require('node-fetch') || globalThis.fetch;

async function testLogin() {
  const BASE_URL = 'https://resilient-heart-staging.up.railway.app';
  const url = `${BASE_URL}/api/v1/auth/login`;

  console.log(`[TEST] Login (POST ${url})...`);
  
  const body = {
    email: 'teacher@gmail.com',
    password: 'Teacher@1234'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const isOk = response.ok;
    
    let responseData = null;
    try {
      responseData = await response.json();
    } catch(e) {
      responseData = await response.text();
    }

    if (isOk) {
      console.log(`✅ SUCCESS [${response.status}]`);
      console.log(`   Response: ${JSON.stringify(responseData).substring(0, 500)}`);
    } else {
      console.error(`❌ FAILED [${response.status}]`);
      console.error(`   Error Response: ${JSON.stringify(responseData)}`);
    }
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
  }
}

testLogin();
