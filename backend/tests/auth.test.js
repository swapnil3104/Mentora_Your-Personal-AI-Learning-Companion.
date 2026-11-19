const assert = require('assert');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/database');

const PORT = 5001; // Separate port for tests

const request = (path, method = 'GET', body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
      ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
    };

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

async function runTests() {
  console.log('==================================================');
  console.log('   MENTORA BACKEND & AUTH VERIFICATION TESTS');
  console.log('==================================================\n');

  let server;
  try {
    // Start test server
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, () => resolve(s));
    });

    const testEmail = `test_student_${Date.now()}@mentora.edu`;
    const testPassword = 'SecurePassword123!';
    const testName = 'Jane Doe';

    // 1. Health check
    console.log('[TEST 1] GET /api/health');
    const healthRes = await request('/api/health');
    assert.strictEqual(healthRes.status, 200, 'Health check should return 200');
    assert.strictEqual(healthRes.body.success, true, 'Health check should be successful');
    assert.strictEqual(healthRes.body.data.services.database, 'healthy', 'Database must be healthy');
    console.log('  PASSED: Health check and database connection confirmed.\n');

    // 2. User registration
    console.log('[TEST 2] POST /api/auth/register (Valid registration)');
    const regRes = await request('/api/auth/register', 'POST', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(regRes.status, 201, `Registration should return 201, got ${regRes.status}`);
    assert.strictEqual(regRes.body.success, true);
    assert.strictEqual(regRes.body.data.user.email, testEmail);
    assert.ok(regRes.body.data.token, 'Should return JWT token upon registration');
    console.log('  PASSED: User registered successfully with JWT token.\n');

    // 3. Duplicate registration rejection
    console.log('[TEST 3] POST /api/auth/register (Duplicate email rejection)');
    const dupRes = await request('/api/auth/register', 'POST', {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(dupRes.status, 409, `Duplicate email should return 409, got ${dupRes.status}`);
    assert.strictEqual(dupRes.body.success, false);
    console.log('  PASSED: Duplicate email correctly rejected with 409.\n');

    // 4. Invalid input validation
    console.log('[TEST 4] POST /api/auth/register (Short password validation)');
    const shortPassRes = await request('/api/auth/register', 'POST', {
      name: testName,
      email: 'invalid@mentora.edu',
      password: '123',
    });
    assert.strictEqual(shortPassRes.status, 400, 'Short password should be rejected with 400');
    console.log('  PASSED: Input validation rejected short password.\n');

    // 5. Valid Login
    console.log('[TEST 5] POST /api/auth/login (Valid credentials)');
    const loginRes = await request('/api/auth/login', 'POST', {
      email: testEmail,
      password: testPassword,
    });
    assert.strictEqual(loginRes.status, 200, `Login should return 200, got ${loginRes.status}`);
    assert.strictEqual(loginRes.body.success, true);
    assert.ok(loginRes.body.data.token, 'Login should return token');
    const authToken = loginRes.body.data.token;
    console.log('  PASSED: Login succeeded with valid token.\n');

    // 6. Invalid Login Password
    console.log('[TEST 6] POST /api/auth/login (Wrong password)');
    const wrongPassRes = await request('/api/auth/login', 'POST', {
      email: testEmail,
      password: 'WrongPassword!',
    });
    assert.strictEqual(wrongPassRes.status, 401, 'Wrong password should return 401');
    assert.strictEqual(wrongPassRes.body.success, false);
    console.log('  PASSED: Wrong password correctly rejected with 401.\n');

    // 7. Protected Route with Token
    console.log('[TEST 7] GET /api/auth/me (Authorized with Bearer token)');
    const meRes = await request('/api/auth/me', 'GET', null, {
      Authorization: `Bearer ${authToken}`,
    });
    assert.strictEqual(meRes.status, 200, `Protected route should return 200, got ${meRes.status}`);
    assert.strictEqual(meRes.body.success, true);
    assert.strictEqual(meRes.body.data.email, testEmail);
    console.log('  PASSED: User profile retrieved via protected route.\n');

    // 8. Protected Route without Token
    console.log('[TEST 8] GET /api/auth/me (Unauthorized access attempt)');
    const noTokenRes = await request('/api/auth/me', 'GET');
    assert.strictEqual(noTokenRes.status, 401, 'Request without token should return 401');
    assert.strictEqual(noTokenRes.body.success, false);
    console.log('  PASSED: Unauthorized access rejected with 401.\n');

    // 9. Protected Route with Invalid Token
    console.log('[TEST 9] GET /api/auth/me (Forged token)');
    const fakeTokenRes = await request('/api/auth/me', 'GET', null, {
      Authorization: 'Bearer invalid.token.payload',
    });
    assert.strictEqual(fakeTokenRes.status, 401, 'Forged token should return 401');
    console.log('  PASSED: Forged token rejected with 401.\n');

    // 10. Database Password Hash Verification
    console.log('[TEST 10] Security Check: Password hash in database');
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    assert.notStrictEqual(dbUser.passwordHash, testPassword, 'Database must never store plaintext passwords');
    assert.ok(dbUser.passwordHash.startsWith('$2'), 'Password must be hashed with bcrypt');
    console.log('  PASSED: Password is cryptographically hashed with bcrypt.\n');

    // Clean up test user
    await prisma.user.delete({ where: { email: testEmail } });
    console.log('Cleaned up test user from database.');

    console.log('\n==================================================');
    console.log('   ALL 10 BACKEND & AUTH TESTS PASSED!');
    console.log('==================================================');
  } catch (error) {
    console.error('\nTEST SUITE FAILED:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runTests();

