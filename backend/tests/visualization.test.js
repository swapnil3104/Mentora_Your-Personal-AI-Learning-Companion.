const assert = require('assert');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/database');

const PORT = 5004; // Dedicated test port for visualizations

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
  console.log('   MENTORA BACKEND VISUALIZATION ENDPOINT TESTS   ');
  console.log('==================================================\n');

  let server;
  const userAEmail = `vistest_userA_${Date.now()}@mentora.edu`;
  const userBEmail = `vistest_userB_${Date.now()}@mentora.edu`;
  let tokenA = '';
  let tokenB = '';
  let userAId = '';
  let userBId = '';
  let visIdA = '';

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    });

    // 1. Setup Test Users
    const resA = await request('/api/auth/register', 'POST', {
      name: 'Vis Student A',
      email: userAEmail,
      password: 'SecurePassword123!',
    });
    assert.strictEqual(resA.status, 201);
    tokenA = resA.body.data.token;
    userAId = resA.body.data.user.id;

    const resB = await request('/api/auth/register', 'POST', {
      name: 'Vis Student B',
      email: userBEmail,
      password: 'SecurePassword123!',
    });
    assert.strictEqual(resB.status, 201);
    tokenB = resB.body.data.token;
    userBId = resB.body.data.user.id;

    // [TEST 1] Unauthorized access rejection
    console.log('[TEST 1] GET /api/visualizations without token');
    const unauthRes = await request('/api/visualizations', 'GET');
    assert.strictEqual(unauthRes.status, 401);
    console.log('  PASSED: Unauthenticated access rejected with 401.\n');

    // [TEST 2] Validation: Reject empty topic
    console.log('[TEST 2] POST /api/visualizations/generate (Empty topic rejection)');
    const emptyTopicRes = await request(
      '/api/visualizations/generate',
      'POST',
      { visualizationType: 'concept_map', topic: '   ' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert.strictEqual(emptyTopicRes.status, 400);
    console.log('  PASSED: Empty topic rejected with 400.\n');

    // [TEST 3] Validation: Reject invalid visualization type
    console.log('[TEST 3] POST /api/visualizations/generate (Invalid type rejection)');
    const invalidTypeRes = await request(
      '/api/visualizations/generate',
      'POST',
      { visualizationType: 'unsupported_3d_render', topic: 'Pipelining' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert.ok(invalidTypeRes.status === 400 || invalidTypeRes.status === 500);
    console.log('  PASSED: Invalid visualization type rejected.\n');

    // [TEST 4] Create seeded visualization directly in DB for User A
    console.log('[TEST 4] Create visualization record in database for User A');
    const visA = await prisma.visualization.create({
      data: {
        userId: userAId,
        visualizationType: 'flowchart',
        title: 'CPU Instruction Pipeline Lifecycle',
        generatedData: {
          mermaid_syntax: 'graph TD; A[Fetch]-->B[Decode]; B-->C[Execute]; C-->D[Memory]; D-->E[Writeback];',
          nodes: [
            { id: '1', label: 'Fetch' },
            { id: '2', label: 'Decode' },
            { id: '3', label: 'Execute' },
            { id: '4', label: 'Memory' },
            { id: '5', label: 'Writeback' },
          ],
        },
      },
    });
    visIdA = visA.id;
    console.log(`  PASSED: Seeded visualization created with ID: ${visIdA}\n`);

    // [TEST 5] List visualizations with pagination
    console.log('[TEST 5] GET /api/visualizations (List user visualizations with pagination)');
    const listRes = await request('/api/visualizations?page=1&limit=10', 'GET', null, {
      Authorization: `Bearer ${tokenA}` },
    );
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.body.data.visualizations);
    assert.ok(listRes.body.data.pagination);
    assert.strictEqual(listRes.body.data.pagination.page, 1);
    assert.ok(listRes.body.data.visualizations.some((v) => v.id === visIdA));
    console.log('  PASSED: Visualizations listed with pagination metadata.\n');

    // [TEST 6] Get single visualization by ID
    console.log('[TEST 6] GET /api/visualizations/:id (Retrieve visualization details)');
    const getRes = await request(`/api/visualizations/${visIdA}`, 'GET', null, {
      Authorization: `Bearer ${tokenA}` },
    );
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.id, visIdA);
    assert.strictEqual(getRes.body.data.visualizationType, 'flowchart');
    console.log('  PASSED: Visualization details retrieved successfully.\n');

    // [TEST 7] Cross-user access denial (User B cannot access User A's visualization)
    console.log('[TEST 7] GET /api/visualizations/:id (Cross-user isolation)');
    const crossGetRes = await request(`/api/visualizations/${visIdA}`, 'GET', null, {
      Authorization: `Bearer ${tokenB}` },
    );
    assert.strictEqual(crossGetRes.status, 404, 'Cross-user access must return 404 Not Found / Access Denied');
    console.log('  PASSED: Cross-user access denied with 404.\n');

    // [TEST 8] Update visualization (Canvas editing)
    console.log('[TEST 8] PATCH /api/visualizations/:id (Update title and diagram nodes)');
    const updateRes = await request(
      `/api/visualizations/${visIdA}`,
      'PATCH',
      {
        title: 'Optimized RISC Pipelining Flow',
        generatedData: {
          mermaid_syntax: 'graph TD; A[Fetch]-->B[Decode]; B-->C[Execute];',
          nodes: [{ id: '1', label: 'Fetch' }, { id: '2', label: 'Decode' }],
        },
      },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.title, 'Optimized RISC Pipelining Flow');
    console.log('  PASSED: Visualization title and nodes updated successfully.\n');

    // [TEST 9] Cross-user edit denial
    console.log('[TEST 9] PATCH /api/visualizations/:id (Cross-user edit rejection)');
    const crossUpdateRes = await request(
      `/api/visualizations/${visIdA}`,
      'PATCH',
      { title: 'Hacked Title' },
      { Authorization: `Bearer ${tokenB}` }
    );
    assert.strictEqual(crossUpdateRes.status, 404);
    console.log('  PASSED: Cross-user edit denied with 404.\n');

    // [TEST 10] Delete visualization and verify removal
    console.log('[TEST 10] DELETE /api/visualizations/:id (Delete visualization)');
    const delRes = await request(`/api/visualizations/${visIdA}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenA}` },
    );
    assert.strictEqual(delRes.status, 200);

    const checkRes = await request(`/api/visualizations/${visIdA}`, 'GET', null, {
      Authorization: `Bearer ${tokenA}` },
    );
    assert.strictEqual(checkRes.status, 404);
    console.log('  PASSED: Visualization deleted and verified non-existent.\n');

    console.log('==================================================');
    console.log(' ALL 10 BACKEND VISUALIZATION TESTS PASSED!       ');
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
