const assert = require('assert');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/database');

const PORT = 5003; // Dedicated test port for chat

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
        hostname: '127.0.0.1',
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
  console.log('   MENTORA BACKEND CHAT & CONVERSATION TESTS');
  console.log('==================================================\n');

  let server;
  const userAEmail = `chattest_userA_${Date.now()}@mentora.edu`;
  const userBEmail = `chattest_userB_${Date.now()}@mentora.edu`;
  let tokenA = '';
  let tokenB = '';
  let convIdA = '';

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    });

    // 1. Setup Test Users
    const resA = await request('/api/auth/register', 'POST', {
      name: 'Chat Student A',
      email: userAEmail,
      password: 'SecurePassword123!',
    });
    assert.strictEqual(resA.status, 201);
    tokenA = resA.body.data.token;

    const resB = await request('/api/auth/register', 'POST', {
      name: 'Chat Student B',
      email: userBEmail,
      password: 'SecurePassword123!',
    });
    assert.strictEqual(resB.status, 201);
    tokenB = resB.body.data.token;

    // [TEST 1] Unauthorized access rejection
    console.log('[TEST 1] GET /api/conversations without token');
    const unauthRes = await request('/api/conversations', 'GET');
    assert.strictEqual(unauthRes.status, 401);
    console.log('  PASSED: Unauthenticated access rejected with 401.\n');

    // [TEST 2] Create conversation
    console.log('[TEST 2] POST /api/conversations (Create conversation)');
    const createRes = await request(
      '/api/conversations',
      'POST',
      { title: 'Computer Architecture Discussion' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.success, true);
    convIdA = createRes.body.data.id;
    assert.strictEqual(createRes.body.data.title, 'Computer Architecture Discussion');
    console.log(`  PASSED: Conversation created with ID: ${convIdA}\n`);

    // [TEST 3] List user conversations
    console.log('[TEST 3] GET /api/conversations (List user conversations)');
    const listRes = await request('/api/conversations', 'GET', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.data));
    assert.ok(listRes.body.data.some((c) => c.id === convIdA));
    console.log('  PASSED: Conversations listed for User A.\n');

    // [TEST 4] Get conversation by ID with messages
    console.log('[TEST 4] GET /api/conversations/:id (Retrieve conversation details)');
    const getRes = await request(`/api/conversations/${convIdA}`, 'GET', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.id, convIdA);
    assert.ok(Array.isArray(getRes.body.data.messages));
    console.log('  PASSED: Conversation retrieved successfully with messages array.\n');

    // [TEST 5] Update conversation title
    console.log('[TEST 5] PATCH /api/conversations/:id (Update conversation title)');
    const updateRes = await request(
      `/api/conversations/${convIdA}`,
      'PATCH',
      { title: 'Advanced RISC Pipelining' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.title, 'Advanced RISC Pipelining');
    console.log('  PASSED: Conversation title updated successfully.\n');

    // [TEST 6] Cross-user access denial (User B attempts to get User A's conversation)
    console.log('[TEST 6] GET /api/conversations/:id (Cross-user access control)');
    const crossGetRes = await request(`/api/conversations/${convIdA}`, 'GET', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossGetRes.status, 403, 'Cross-user retrieval must return 403 Forbidden');
    console.log('  PASSED: User B access denied with 403 Forbidden.\n');

    // [TEST 7] Cross-user title update denial
    console.log('[TEST 7] PATCH /api/conversations/:id (Cross-user edit control)');
    const crossUpdateRes = await request(
      `/api/conversations/${convIdA}`,
      'PATCH',
      { title: 'Hacked Title' },
      { Authorization: `Bearer ${tokenB}` }
    );
    assert.strictEqual(crossUpdateRes.status, 403, 'Cross-user update must return 403 Forbidden');
    console.log('  PASSED: User B title modification denied with 403.\n');

    // [TEST 8] Cross-user deletion denial
    console.log('[TEST 8] DELETE /api/conversations/:id (Cross-user delete control)');
    const crossDelRes = await request(`/api/conversations/${convIdA}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossDelRes.status, 403, 'Cross-user deletion must return 403 Forbidden');
    console.log('  PASSED: User B deletion denied with 403.\n');

    // [TEST 9] Invalid request handling (Empty title update)
    console.log('[TEST 9] PATCH /api/conversations/:id (Empty title rejection)');
    const emptyTitleRes = await request(
      `/api/conversations/${convIdA}`,
      'PATCH',
      { title: '   ' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert.strictEqual(emptyTitleRes.status, 400);
    console.log('  PASSED: Empty title correctly rejected with 400.\n');

    // [TEST 10] Delete conversation and verify cascade
    console.log('[TEST 10] DELETE /api/conversations/:id (Delete conversation)');
    const delRes = await request(`/api/conversations/${convIdA}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(delRes.status, 200);

    const checkRes = await request(`/api/conversations/${convIdA}`, 'GET', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(checkRes.status, 404);
    console.log('  PASSED: Conversation deleted and verified non-existent.\n');

    console.log('==================================================');
    console.log('   ALL 10 BACKEND CHAT TESTS PASSED SUCCESSFULLY! ');
    console.log('==================================================');

    // Cleanup users
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
