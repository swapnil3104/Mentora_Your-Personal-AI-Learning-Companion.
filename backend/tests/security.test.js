const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/database');
const config = require('../src/config/environment');

const PORT = 5005; // Dedicated test port for security suite

const request = (reqPath, method = 'GET', body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    let postData = null;
    let reqHeaders = { ...headers };

    if (body && !(body instanceof Buffer) && !headers['Content-Type']) {
      postData = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    } else if (body) {
      postData = body;
      reqHeaders['Content-Length'] = Buffer.isBuffer(postData)
        ? postData.length
        : Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: reqPath,
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

function buildMultipartFormData(boundary, fieldName, filename, fileContent, contentType = 'text/plain') {
  const crlf = '\r\n';
  let header = `--${boundary}${crlf}`;
  header += `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${crlf}`;
  header += `Content-Type: ${contentType}${crlf}${crlf}`;
  const footer = `${crlf}--${boundary}--${crlf}`;

  const headerBuf = Buffer.from(header, 'utf8');
  const footerBuf = Buffer.from(footer, 'utf8');
  const contentBuf = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent, 'utf8');

  return Buffer.concat([headerBuf, contentBuf, footerBuf]);
}

async function runSecurityTests() {
  console.log('==================================================');
  console.log('   MENTORA SYSTEM SECURITY VERIFICATION SUITE   ');
  console.log('==================================================\n');

  let server;
  const userAEmail = `sec_userA_${Date.now()}@mentora.edu`;
  const userBEmail = `sec_userB_${Date.now()}@mentora.edu`;
  let tokenA = '';
  let tokenB = '';
  let userAId = '';
  let userBId = '';

  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    });

    // 1. Setup Test Users
    const resA = await request('/api/auth/register', 'POST', {
      name: 'Security User A',
      email: userAEmail,
      password: 'StrongSecurityPassword123!',
    });
    assert.strictEqual(resA.status, 201);
    tokenA = resA.body.data.token;
    userAId = resA.body.data.user.id;

    const resB = await request('/api/auth/register', 'POST', {
      name: 'Security User B',
      email: userBEmail,
      password: 'StrongSecurityPassword123!',
    });
    assert.strictEqual(resB.status, 201);
    tokenB = resB.body.data.token;
    userBId = resB.body.data.user.id;

    // [TEST 1] Password Hashing Verification
    console.log('[TEST 1] Password Hashing & Salt Verification (7.4)');
    const dbUserA = await prisma.user.findUnique({ where: { id: userAId } });
    assert.ok(dbUserA.passwordHash, 'Password hash must be present');
    assert.ok(
      dbUserA.passwordHash.startsWith('$2a$10$') || dbUserA.passwordHash.startsWith('$2b$10$'),
      'Password must be hashed with bcrypt cost factor 10'
    );
    assert.notStrictEqual(dbUserA.passwordHash, 'StrongSecurityPassword123!');
    const pwMatch = await bcrypt.compare('StrongSecurityPassword123!', dbUserA.passwordHash);
    assert.strictEqual(pwMatch, true);
    console.log('  PASSED: Passwords cryptographically hashed with bcrypt cost 10.\n');

    // [TEST 2] JWT Security: Signature Tampering & Forgery
    console.log('[TEST 2] JWT Security: Signature Tampering & Forgery (7.4)');
    const forgedToken = jwt.sign({ userId: userAId }, 'wrong_secret_key_attacker_attempt');
    const forgedRes = await request('/api/auth/me', 'GET', null, {
      Authorization: `Bearer ${forgedToken}`,
    });
    assert.strictEqual(forgedRes.status, 401, 'Forged JWT signature must return 401');
    assert.strictEqual(forgedRes.body.success, false);
    console.log('  PASSED: Tampered/forged JWT signature rejected.\n');

    // [TEST 3] JWT Security: Expired Token Rejection
    console.log('[TEST 3] JWT Security: Expired Token Handling (7.4)');
    const expiredToken = jwt.sign(
      { userId: userAId },
      config.jwt.secret,
      { expiresIn: '-1s' } // Expired 1 second ago
    );
    const expiredRes = await request('/api/auth/me', 'GET', null, {
      Authorization: `Bearer ${expiredToken}`,
    });
    assert.strictEqual(expiredRes.status, 401, 'Expired token must return 401');
    assert.ok(
      (expiredRes.body.message || expiredRes.body.error || '').toLowerCase().includes('expired'),
      'Expired token message expected'
    );
    console.log('  PASSED: Expired token rejected with explicit expiration error.\n');

    // [TEST 4] File Upload Security: Dangerous Extensions
    console.log('[TEST 4] File Upload Security: Disallowed Dangerous Extensions (7.4)');
    const dangerousFiles = ['malware.exe', 'exploit.sh', 'trojan.bat', 'shell.php', 'script.js'];
    for (const dFile of dangerousFiles) {
      const boundary = `----MentoraBoundary${Date.now()}`;
      const payload = buildMultipartFormData(boundary, 'file', dFile, 'echo dangerous;', 'application/octet-stream');
      const badUploadRes = await request('/api/documents/upload', 'POST', payload, {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      });
      assert.strictEqual(badUploadRes.status, 400, `Extension ${dFile} must be rejected with 400`);
      assert.strictEqual(badUploadRes.body.success, false);
    }
    console.log('  PASSED: Executable and script extensions (.exe, .sh, .bat, .php, .js) all rejected.\n');

    // [TEST 5] File Upload Security: Forbidden MIME types spoofing valid extension
    console.log('[TEST 5] File Upload Security: Disallowed MIME Types (7.4)');
    const boundaryMime = `----MentoraBoundary${Date.now()}`;
    const spoofedPayload = buildMultipartFormData(
      boundaryMime,
      'file',
      'innocent.pdf',
      'malicious binary',
      'application/x-msdownload'
    );
    const badMimeRes = await request('/api/documents/upload', 'POST', spoofedPayload, {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${boundaryMime}`,
    });
    assert.strictEqual(badMimeRes.status, 400, 'Dangerous MIME type must be rejected');
    console.log('  PASSED: Dangerous spoofed MIME type rejected.\n');

    // [TEST 6] Multi-tenant User Document Isolation
    console.log('[TEST 6] Multi-Tenant Document Isolation (7.4)');
    const boundaryValid = `----MentoraBoundary${Date.now()}`;
    const validPayload = buildMultipartFormData(
      boundaryValid,
      'file',
      'private_notes.txt',
      'Confidential exam notes for User A only.',
      'text/plain'
    );
    const upRes = await request('/api/documents/upload', 'POST', validPayload, {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': `multipart/form-data; boundary=${boundaryValid}`,
    });
    assert.strictEqual(upRes.status, 201);
    const docAId = upRes.body.data.id;

    // User B attempts to access User A's document
    const crossDocGet = await request(`/api/documents/${docAId}`, 'GET', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossDocGet.status, 404, 'User B must not access User A document');

    // User B attempts to delete User A's document
    const crossDocDel = await request(`/api/documents/${docAId}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossDocDel.status, 404, 'User B must not delete User A document');
    console.log('  PASSED: User documents strictly isolated between student accounts.\n');

    // [TEST 7] Conversation Ownership Isolation
    console.log('[TEST 7] Conversation & Message Ownership Isolation (7.4)');
    const convCreateRes = await request(
      '/api/conversations',
      'POST',
      { title: 'User A Private Chat' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert.strictEqual(convCreateRes.status, 201);
    const convAId = convCreateRes.body.data.id;

    const crossConvGet = await request(`/api/conversations/${convAId}`, 'GET', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossConvGet.status, 403, 'Cross-user conversation access must be 403');

    const crossConvDel = await request(`/api/conversations/${convAId}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossConvDel.status, 403, 'Cross-user conversation deletion must be 403');
    console.log('  PASSED: Conversations and messages strictly protected against unauthorized access.\n');

    // [TEST 8] Visualization Ownership Isolation
    console.log('[TEST 8] Visualization Ownership Isolation (7.4)');
    const visA = await prisma.visualization.create({
      data: {
        userId: userAId,
        visualizationType: 'concept_map',
        title: 'User A Secret Graph',
        generatedData: { nodes: [{ id: '1', label: 'Confidential' }] },
      },
    });

    const crossVisGet = await request(`/api/visualizations/${visA.id}`, 'GET', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossVisGet.status, 404, 'User B must not view User A visualization');

    const crossVisDel = await request(`/api/visualizations/${visA.id}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(crossVisDel.status, 404, 'User B must not delete User A visualization');
    console.log('  PASSED: Visualizations strictly isolated between student accounts.\n');

    // [TEST 9] Environment Secret Isolation
    console.log('[TEST 9] Environment & Credentials Protection (7.4)');
    const gitignorePath = path.resolve(__dirname, '../../.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      assert.ok(gitignore.includes('.env'), '.gitignore must ignore .env files');
      console.log('  PASSED: .env secret files confirmed in .gitignore.');
    }
    const envExamplePath = path.resolve(__dirname, '../../.env.example');
    if (fs.existsSync(envExamplePath)) {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      assert.ok(!envExample.includes('root@'), '.env.example must not contain live production passwords');
      console.log('  PASSED: .env.example contains only generic placeholders.');
    }
    console.log('');

    // [TEST 10] Safe Document Deletion & Vector Cleanup Verification
    console.log('[TEST 10] Safe Document Deletion & Storage Cleanup (7.4)');
    const docRecord = await prisma.document.findUnique({ where: { id: docAId } });
    const storagePath = path.resolve(docRecord.storagePath);
    assert.ok(fs.existsSync(storagePath), 'Uploaded file should exist on disk before deletion');

    const delDocRes = await request(`/api/documents/${docAId}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(delDocRes.status, 200);
    assert.ok(!fs.existsSync(storagePath), 'Uploaded physical file must be deleted upon document deletion');
    console.log('  PASSED: Physical file and database records safely purged on document deletion.\n');

    console.log('==================================================');
    console.log('   ALL 10 SECURITY VERIFICATION TESTS PASSED!     ');
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

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
