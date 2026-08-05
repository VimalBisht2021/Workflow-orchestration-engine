/* eslint-disable */
const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Test 1: Create ---');
  let res = await request('POST', '/workflows', { name: 'E2E Test Workflow', owner: 'e2e' });
  console.log('Status:', res.status);
  console.log('Body:', res.data);
  const id = res.data.id;

  console.log('\n--- Test 2: Validate ---');
  res = await request('POST', `/workflows/${id}/validate`);
  console.log('Status:', res.status);
  console.log('Body:', res.data);

  console.log('\n--- Test 3: Publish ---');
  res = await request('POST', `/workflows/${id}/publish`);
  console.log('Status:', res.status);
  console.log('Body:', res.data);

  console.log('\n--- Test 4: Publish Again ---');
  res = await request('POST', `/workflows/${id}/publish`);
  console.log('Status:', res.status);
  console.log('Body:', res.data);

  console.log('\n--- Test 5: Unknown Workflow ---');
  res = await request('POST', `/workflows/unknown-id/validate`);
  console.log('Status:', res.status);
  console.log('Body:', res.data);
}

runTests().catch(console.error);
