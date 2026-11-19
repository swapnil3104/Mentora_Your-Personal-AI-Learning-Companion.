const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const prisma = require('../src/config/database');

const PORT = 5002; // Dedicated test port

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
        hostname: 'localhost',
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

  return Buffer.concat([
    Buffer.from(header, 'utf-8'),
    Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent, 'utf-8'),
    Buffer.from(footer, 'utf-8'),
  ]);
}

async function runTests() {
  console.log('==================================================');
  console.log('   MENTORA BACKEND DOCUMENT MANAGEMENT TESTS');
  console.log('==================================================\n');

  let server;
  try {
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, () => resolve(s));
    });

    // Create User A & User B
    const userAEmail = `doc_test_userA_${Date.now()}@mentora.edu`;
    const userBEmail = `doc_test_userB_${Date.now()}@mentora.edu`;

    const regA = await request('/api/auth/register', 'POST', {
      name: 'User A',
      email: userAEmail,
      password: 'Password123!',
    });
    const tokenA = regA.body.data.token;

    const regB = await request('/api/auth/register', 'POST', {
      name: 'User B',
      email: userBEmail,
      password: 'Password123!',
    });
    const tokenB = regB.body.data.token;

    // [TEST 1] Unauthorized access rejected
    console.log('[TEST 1] GET /api/documents without auth token');
    const unauthRes = await request('/api/documents');
    assert.strictEqual(unauthRes.status, 401, 'Should reject with 401 Unauthorized');
    console.log('  PASSED: Unauthorized access rejected with 401.\n');

    // [TEST 2] Upload valid academic text document
    console.log('[TEST 2] POST /api/documents/upload (Valid TXT file)');
    const boundary = '----MentoraBoundary' + Date.now();
    const txtContent = 'Operating System Process Management: A process is a program in execution.';
    const multipartBody = buildMultipartFormData(boundary, 'file', 'os_syllabus.txt', txtContent, 'text/plain');

    const uploadRes = await request('/api/documents/upload', 'POST', multipartBody, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${tokenA}`,
    });

    assert.strictEqual(uploadRes.status, 201, `Upload should return 201, got ${uploadRes.status}`);
    assert.strictEqual(uploadRes.body.success, true);
    assert.strictEqual(uploadRes.body.data.filename, 'os_syllabus.txt');
    assert.strictEqual(uploadRes.body.data.fileType, 'txt');
    assert.strictEqual(uploadRes.body.data.processingStatus, 'UPLOADED');
    const documentId = uploadRes.body.data.id;
    console.log(`  PASSED: Document uploaded successfully with ID: ${documentId}\n`);

    // [TEST 3] List user documents
    console.log('[TEST 3] GET /api/documents (List user documents)');
    const listRes = await request('/api/documents', 'GET', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.success, true);
    assert.ok(Array.isArray(listRes.body.data));
    assert.strictEqual(listRes.body.data.length, 1);
    assert.strictEqual(listRes.body.data[0].id, documentId);
    console.log('  PASSED: Document listed correctly for User A.\n');

    // [TEST 4] Search documents by keyword
    console.log('[TEST 4] GET /api/documents?search=syllabus');
    const searchRes = await request('/api/documents?search=syllabus', 'GET', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.data.length, 1);

    const noMatchRes = await request('/api/documents?search=nonexistent_xyz', 'GET', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(noMatchRes.body.data.length, 0);
    console.log('  PASSED: Search query filtering works as expected.\n');

    // [TEST 5] Strict User-Level Document Isolation
    console.log('[TEST 5] GET /api/documents/:id (Cross-user access denial)');
    // User B tries to access User A's document
    const isolationRes = await request(`/api/documents/${documentId}`, 'GET', null, {
      Authorization: `Bearer ${tokenB}`,
    });
    assert.strictEqual(isolationRes.status, 404, 'User B must not be able to access User A document');
    console.log('  PASSED: User B access denied with 404.\n');

    // [TEST 6] Rejection of unsupported file extension
    console.log('[TEST 6] POST /api/documents/upload (Reject invalid extension .exe)');
    const invalidBoundary = '----MentoraBoundaryInvalid' + Date.now();
    const badBody = buildMultipartFormData(invalidBoundary, 'file', 'malware.exe', 'binary_content', 'application/octet-stream');

    const badExtRes = await request('/api/documents/upload', 'POST', badBody, {
      'Content-Type': `multipart/form-data; boundary=${invalidBoundary}`,
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(badExtRes.status, 400, 'Unsupported extension must return 400');
    console.log('  PASSED: Unsupported file format rejected with 400.\n');

    // [TEST 7] Document Deletion
    console.log('[TEST 7] DELETE /api/documents/:id');
    const delRes = await request(`/api/documents/${documentId}`, 'DELETE', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);

    // Verify it is gone
    const checkGone = await request(`/api/documents/${documentId}`, 'GET', null, {
      Authorization: `Bearer ${tokenA}`,
    });
    assert.strictEqual(checkGone.status, 404, 'Document should no longer exist after deletion');
    console.log('  PASSED: Document deleted and cleaned up successfully.\n');

    console.log('==================================================');
    console.log('   ALL BACKEND DOCUMENT TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================');

    // Cleanup users
    await prisma.user.deleteMany({
      where: { email: { in: [userAEmail, userBEmail] } },
    });
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

