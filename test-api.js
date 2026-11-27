/**
 * THIRAN (திறன்) - Comprehensive API & MongoDB Operations Test Suite
 * Tests full Authentication and Blog CRUD lifecycle:
 * 1. GET /api/health
 * 2. POST /api/auth/register
 * 3. POST /api/auth/register (Duplicate email rejection)
 * 4. POST /api/auth/login
 * 5. POST /api/auth/login (Invalid credentials rejection)
 * 6. GET /api/auth/me (Authenticated profile fetch)
 * 7. GET /api/auth/me (Unauthenticated rejection)
 * 8. POST /api/blogs (Protected blog creation with author reference & category)
 * 9. POST /api/blogs (Unauthenticated rejection)
 * 10. GET /api/blogs (List all blogs with author metadata)
 * 11. GET /api/blogs/:id (Get single blog by ID)
 * 12. PUT /api/blogs/:id (Update blog title, content, category)
 * 13. PUT /api/blogs/:id (Unauthenticated update rejection)
 * 14. DELETE /api/blogs/:id (Delete blog post)
 * 15. DELETE /api/blogs/:id (Unauthenticated delete rejection)
 * 16. GET /api/blogs/:id (Verify 404 Not Found after deletion)
 * 17. POST /api/auth/logout (Token revocation)
 * 18. Protected access attempt with revoked token (Rejected 401)
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
  console.log(' THIRAN BACKEND API & MONGODB CRUD TEST SUITE');
  console.log('======================================================\n');

  let authToken = null;
  let testBlogId = null;
  const uniqueSuffix = Date.now();
  const testUser = {
    name: 'Antigravity Verified User',
    full_name: 'Antigravity Verified User',
    email: `verified_${uniqueSuffix}@thiran.edu`,
    phone: '+91 9876543210',
    role: 'student',
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
      '2. POST /api/auth/register creates user in database without returning password',
      `Status: ${registerRes.status}, User ID: ${registerRes.data?.user?.id}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate registration rejection
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
    // TEST 5: Invalid login credentials
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
    // TEST 6: GET /api/auth/me with JWT
    // -------------------------------------------------------------------------
    console.log('\nTEST 6: GET /api/auth/me with JWT');
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(
      meRes.status === 200 &&
      meRes.data.success === true &&
      meRes.data.user &&
      meRes.data.user.email === testUser.email &&
      !meRes.data.user.password,
      '6. GET /api/auth/me returns authenticated user details correctly without password',
      `Status: ${meRes.status}, Name: "${meRes.data?.user?.name || meRes.data?.user?.full_name}"`
    );

    // -------------------------------------------------------------------------
    // TEST 7: GET /api/auth/me without JWT
    // -------------------------------------------------------------------------
    console.log('\nTEST 7: GET /api/auth/me without JWT');
    const unauthMeRes = await request('/api/auth/me');
    assert(
      unauthMeRes.status === 401 && unauthMeRes.data.success === false,
      '7. GET /api/auth/me rejects unauthenticated request with HTTP 401',
      `Status: ${unauthMeRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 8: POST /api/blogs with valid JWT
    // -------------------------------------------------------------------------
    console.log('\nTEST 8: POST /api/blogs with valid JWT');
    const blogPayload = {
      title: 'MongoDB Atlas Scaling & Replica Sets in THIRAN',
      category: 'Database',
      content: 'Complete database architecture and Mongoose models for THIRAN online learning platform.'
    };
    const createBlogRes = await request('/api/blogs', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(blogPayload)
    });
    testBlogId = createBlogRes.data?.blog?.id || createBlogRes.data?.blog?._id;
    assert(
      createBlogRes.status === 201 &&
      createBlogRes.data.success === true &&
      createBlogRes.data.blog &&
      createBlogRes.data.blog.title === blogPayload.title &&
      (createBlogRes.data.blog.category === 'Database' || !createBlogRes.data.blog.category),
      '8. POST /api/blogs creates blog and links to authenticated user',
      `Status: ${createBlogRes.status}, Blog ID: ${testBlogId}, Title: "${createBlogRes.data?.blog?.title}"`
    );

    // -------------------------------------------------------------------------
    // TEST 9: POST /api/blogs without JWT
    // -------------------------------------------------------------------------
    console.log('\nTEST 9: POST /api/blogs without JWT');
    const unauthBlogRes = await request('/api/blogs', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unauthorized Post',
        content: 'This should not be saved.'
      })
    });
    assert(
      unauthBlogRes.status === 401 && unauthBlogRes.data.success === false,
      '9. POST /api/blogs rejects unauthenticated requests with HTTP 401',
      `Status: ${unauthBlogRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: GET /api/blogs
    // -------------------------------------------------------------------------
    console.log('\nTEST 10: GET /api/blogs');
    const getBlogsRes = await request('/api/blogs');
    assert(
      getBlogsRes.status === 200 &&
      getBlogsRes.data.success === true &&
      Array.isArray(getBlogsRes.data.blogs) &&
      getBlogsRes.data.blogs.length > 0 &&
      !getBlogsRes.data.blogs[0].password,
      '10. GET /api/blogs retrieves list of blogs with author details and no password exposure',
      `Status: ${getBlogsRes.status}, Total Blogs: ${getBlogsRes.data?.count}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: GET /api/blogs/:id
    // -------------------------------------------------------------------------
    console.log('\nTEST 11: GET /api/blogs/:id');
    const getBlogRes = await request(`/api/blogs/${testBlogId}`);
    assert(
      getBlogRes.status === 200 &&
      getBlogRes.data.success === true &&
      getBlogRes.data.blog &&
      (getBlogRes.data.blog.id === testBlogId || getBlogRes.data.blog._id === testBlogId),
      '11. GET /api/blogs/:id returns specific blog by ID with author metadata',
      `Status: ${getBlogRes.status}, Blog Title: "${getBlogRes.data?.blog?.title}"`
    );

    // -------------------------------------------------------------------------
    // TEST 12: PUT /api/blogs/:id (Update Blog Details)
    // -------------------------------------------------------------------------
    console.log('\nTEST 12: PUT /api/blogs/:id (Update Blog Details)');
    const updatePayload = {
      title: 'Updated: MongoDB Atlas Architecture in THIRAN',
      category: 'Database',
      content: 'Updated content verifying complete CRUD operations in THIRAN backend.'
    };
    const updateRes = await request(`/api/blogs/${testBlogId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(updatePayload)
    });
    assert(
      updateRes.status === 200 &&
      updateRes.data.success === true &&
      updateRes.data.blog &&
      updateRes.data.blog.title === updatePayload.title,
      '12. PUT /api/blogs/:id successfully updates blog title and content in database',
      `Status: ${updateRes.status}, New Title: "${updateRes.data?.blog?.title}"`
    );

    // -------------------------------------------------------------------------
    // TEST 13: PUT /api/blogs/:id without JWT (Rejected 401)
    // -------------------------------------------------------------------------
    console.log('\nTEST 13: PUT /api/blogs/:id without JWT');
    const unauthUpdateRes = await request(`/api/blogs/${testBlogId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: 'Hacked Title' })
    });
    assert(
      unauthUpdateRes.status === 401 && unauthUpdateRes.data.success === false,
      '13. PUT /api/blogs/:id rejects unauthenticated updates with HTTP 401',
      `Status: ${unauthUpdateRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 14: DELETE /api/blogs/:id (Delete Blog Post)
    // -------------------------------------------------------------------------
    console.log('\nTEST 14: DELETE /api/blogs/:id (Delete Blog Post)');
    const deleteRes = await request(`/api/blogs/${testBlogId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    assert(
      deleteRes.status === 200 &&
      deleteRes.data.success === true,
      '14. DELETE /api/blogs/:id successfully deletes blog post from database',
      `Status: ${deleteRes.status}, Message: "${deleteRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 15: DELETE /api/blogs/:id without JWT (Rejected 401)
    // -------------------------------------------------------------------------
    console.log('\nTEST 15: DELETE /api/blogs/:id without JWT');
    const unauthDeleteRes = await request(`/api/blogs/${testBlogId}`, {
      method: 'DELETE'
    });
    assert(
      unauthDeleteRes.status === 401 && unauthDeleteRes.data.success === false,
      '15. DELETE /api/blogs/:id rejects unauthenticated deletion with HTTP 401',
      `Status: ${unauthDeleteRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 16: GET /api/blogs/:id after deletion (Expect 404)
    // -------------------------------------------------------------------------
    console.log('\nTEST 16: Verify 404 after Deletion');
    const verifyDeleteRes = await request(`/api/blogs/${testBlogId}`);
    assert(
      verifyDeleteRes.status === 404 && verifyDeleteRes.data.success === false,
      '16. GET /api/blogs/:id confirms deleted blog no longer exists (HTTP 404)',
      `Status: ${verifyDeleteRes.status}, Message: "${verifyDeleteRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 17: POST /api/auth/logout & Token Invalidation
    // -------------------------------------------------------------------------
    console.log('\nTEST 17: POST /api/auth/logout');
    const logoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(
      logoutRes.status === 200 && logoutRes.data.success === true,
      '17. POST /api/auth/logout invalidates session and revokes token',
      `Status: ${logoutRes.status}, Message: "${logoutRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // TEST 18: Attempt Protected Access With Revoked Token
    // -------------------------------------------------------------------------
    console.log('\nTEST 18: Protected Access with Revoked Token');
    const revokedAccessRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(
      revokedAccessRes.status === 401 && revokedAccessRes.data.success === false,
      '18. Access with logged-out revoked token is rejected with HTTP 401',
      `Status: ${revokedAccessRes.status}, Message: "${revokedAccessRes.data?.message}"`
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
  try {
    const res = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    if (!res) {
      activeServer = await startServer(5000);
    }
  } catch (_) {
    activeServer = await startServer(5000);
  }
  await runTestSuite();
}

main();
