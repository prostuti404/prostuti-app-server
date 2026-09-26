const fs = require('fs');

async function testApi(name, url, method = 'GET', body = null) {
  try {
    console.log(`[TEST] ${name} (${method} ${url})...`);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const isOk = response.ok;
    
    let responseData = null;
    try {
      responseData = await response.json();
    } catch(e) {
      responseData = await response.text();
    }

    if (isOk) {
      console.log(`✅ SUCCESS [${response.status}]`);
      console.log(`   Response: ${JSON.stringify(responseData).substring(0, 100)}...`);
    } else {
      console.error(`❌ FAILED [${response.status}]`);
      console.error(`   Error Response: ${JSON.stringify(responseData)}`);
    }
    console.log('---');
    return isOk;
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    console.log('---');
    return false;
  }
}

async function runAllTests() {
  const BASE_URL = 'https://resilient-heart-staging.up.railway.app';
  console.log(`Starting tests against ${BASE_URL}\n`);
  
  let passed = 0;
  let total = 0;

  const run = async (name, path) => {
    total++;
    const success = await testApi(name, `${BASE_URL}${path}`);
    if (success) passed++;
  };

  await run('Health Check (Root)', '/health');
  await run('Get Categories', '/api/v1/category');
  await run('Get Courses', '/api/v1/course/all-courses');
  await run('Get Notices', '/api/v1/notice');
  
  console.log(`\n🎉 Test Summary: ${passed}/${total} passed.`);
}

runAllTests();
