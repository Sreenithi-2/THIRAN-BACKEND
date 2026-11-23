/**
 * THIRAN (திறன்) - Comprehensive API Test Suite
 * Tests all 9 backend endpoints specified in project requirements:
 * 1. GET /api/health
 * 2. POST /api/auth/register
 * 3. Duplicate registration (POST /api/auth/register)
 * 4. POST /api/auth/login
 * 5. Invalid login (POST /api/auth/login)
 * 6. POST /api/blogs with valid JWT
 * 7. POST /api/blogs without JWT
 * 8. GET /api/blogs
 * 9. GET /api/blogs/:id
 */

const { app, startServer } = require('./server');

const BASE_URL = 'http://127.0.0.1:5000';
let activeServer = null;

const testResults = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    testResults.push({ name: testName, status: 'PASS', details });
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    testResults.push({ name: testName, status: 'FAIL', details });
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const { headers, ...restOptions } = options;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {})
    },
    ...restOptions
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log(' THIRAN BACKEND API TEST SUITE - 9 ENDPOINTS CHECK');
  console.log('======================================================\n');

  let authToken = null;
  let testBlogId = null;
  const uniqueSuffix = Date.now();
  const testUser = {
    full_name: 'Antigravity Test User',
    email: `testuser_${uniqueSuffix}@thiran.edu`,
    phone: '+91 9876543210',
    password: 'password123',
    confirm_password: 'password123'
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: GET /api/health
    // -------------------------------------------------------------------------
    console.log('TEST 1: GET /api/health');
    const healthRes = await request('/api/health');
    assert(
      healthRes.status === 200 && healthRes.data.status === 'OK',
      '1. GET /api/health returns HTTP 200 and operational status',
      JSON.stringify(healthRes.data)
    );

    // -------------------------------------------------------------------------
    // TEST 2: POST /api/auth/register
    // -------------------------------------------------------------------------
    console.log('\nTEST 2: POST /api/auth/register');
    const registerRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });
    assert(
      registerRes.status === 201 &&
      registerRes.data.success === true &&
      registerRes.data.user &&
      registerRes.data.user.email === testUser.email &&
      !registerRes.data.user.password, // Never expose password
      '2. POST /api/auth/register successfully creates user without returning password',
      `Status: ${registerRes.status}, User ID: ${registerRes.data?.user?.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate registration
    // -------------------------------------------------------------------------
    console.log('\nTEST 3: Duplicate Registration Handling');
    const dupRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });
    assert(
      dupRes.status === 409 && dupRes.data.success === false,
      '3. POST /api/auth/register rejects duplicate email with HTTP 409',
      `Status: ${dupRes.status}, Message: "${dupRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 4: POST /api/auth/login
    // -------------------------------------------------------------------------
    console.log('\nTEST 4: POST /api/auth/login');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    authToken = loginRes.data?.token;
    assert(
      loginRes.status === 200 &&
      loginRes.data.success === true &&
      typeof authToken === 'string' &&
      authToken.length > 20 &&
      loginRes.data.user &&
      !loginRes.data.user.password,
      '4. POST /api/auth/login validates credentials and issues JWT token',
      `Status: ${loginRes.status}, Token Prefix: ${authToken ? authToken.substring(0, 15) + '...' : 'none'}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Invalid login
    // -------------------------------------------------------------------------
    console.log('\nTEST 5: Invalid Login Credentials');
    const invalidLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: 'wrong_password_999'
      })
    });
    assert(
      invalidLoginRes.status === 401 && invalidLoginRes.data.success === false,
      '5. POST /api/auth/login rejects incorrect password with HTTP 401',
      `Status: ${invalidLoginRes.status}, Message: "${invalidLoginRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 6: POST /api/blogs with valid JWT
    // -------------------------------------------------------------------------
    console.log('\nTEST 6: POST /api/blogs with valid JWT');
    const blogPayload = {
      title: 'Building Modern Full-Stack Learning Platforms with Node & MySQL',
      content: 'THIRAN (திறன்) is an engineering platform delivering interactive learning with secure REST APIs.'
    };
    const createBlogRes = await request('/api/blogs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(blogPayload)
    });
    testBlogId = createBlogRes.data?.blog?.id;
    assert(
      createBlogRes.status === 201 &&
      createBlogRes.data.success === true &&
      createBlogRes.data.blog &&
      createBlogRes.data.blog.title === blogPayload.title &&
      createBlogRes.data.blog.author_name === testUser.full_name,
      '6. POST /api/blogs with JWT creates blog and associates with authenticated user',
      `Status: ${createBlogRes.status}, Blog ID: ${testBlogId}, Author: "${createBlogRes.data?.blog?.author_name}"`
    );

    // -------------------------------------------------------------------------
    // TEST 7: POST /api/blogs without JWT (Should be rejected)
    // -------------------------------------------------------------------------
    console.log('\nTEST 7: POST /api/blogs without JWT');
    const unauthBlogRes = await request('/api/blogs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unauthorized Post',
        content: 'This should not be saved.'
      })
    });
    assert(
      unauthBlogRes.status === 401 && unauthBlogRes.data.success === false,
      '7. POST /api/blogs rejects unauthenticated requests with HTTP 401',
      `Status: ${unauthBlogRes.status}, Message: "${unauthBlogRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 8: GET /api/blogs
    // -------------------------------------------------------------------------
    console.log('\nTEST 8: GET /api/blogs');
    const getBlogsRes = await request('/api/blogs');
    assert(
      getBlogsRes.status === 200 &&
      getBlogsRes.data.success === true &&
      Array.isArray(getBlogsRes.data.blogs) &&
      getBlogsRes.data.blogs.length > 0 &&
      getBlogsRes.data.blogs[0].author_name &&
      !getBlogsRes.data.blogs[0].password,
      '8. GET /api/blogs retrieves list of blogs with author details and no password exposure',
      `Status: ${getBlogsRes.status}, Total Blogs: ${getBlogsRes.data?.count}`
    );

    // -------------------------------------------------------------------------
    // TEST 9: GET /api/blogs/:id
    // -------------------------------------------------------------------------
    console.log('\nTEST 9: GET /api/blogs/:id');
    const getBlogRes = await request(`/api/blogs/${testBlogId}`);
    assert(
      getBlogRes.status === 200 &&
      getBlogRes.data.success === true &&
      getBlogRes.data.blog &&
      getBlogRes.data.blog.id === testBlogId &&
      getBlogRes.data.blog.author_email === testUser.email,
      '9. GET /api/blogs/:id returns specific blog by ID with full author metadata',
      `Status: ${getBlogRes.status}, Blog Title: "${getBlogRes.data?.blog?.title}"`
    );

  } catch (error) {
    console.error('[Test Execution Error]', error);
  } finally {
    // Summary
    console.log('\n======================================================');
    console.log(' FINAL TEST REPORT');
    console.log('======================================================');
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
    testResults.forEach((r, idx) => {
      console.log(`  ${idx + 1}. [${r.status}] ${r.name}`);
    });
    console.log('======================================================\n');

    // Close server
    if (activeServer) {
      activeServer.close(() => {
        process.exit(failed === 0 ? 0 : 1);
      });
    } else {
      process.exit(failed === 0 ? 0 : 1);
    }
  }
}

// Allow server to listen before running tests
async function main() {
  activeServer = await startServer(5000);
  await runTestSuite();
}

main();
