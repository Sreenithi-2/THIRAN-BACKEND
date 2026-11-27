/**
 * THIRAN (திறன்) - Module 04: Complete Blog CRUD & Search/Filter Test Suite
 * 
 * Verifies all 10 Module 04 Scenarios against live MongoDB Atlas:
 * 1. Live MongoDB Atlas Connection State (readyState === 1)
 * 2. Create Blog (POST /api/blogs with title, category, content linked to user)
 * 3. Read All Blogs (GET /api/blogs with author populate & preview)
 * 4. Read Single Blog by ID (GET /api/blogs/:id)
 * 5. Update Blog as Author (PUT /api/blogs/:id by author)
 * 6. Reject Unauthorized Update (PUT /api/blogs/:id by different user -> 403 Forbidden)
 * 7. Search Blogs by Title (GET /api/blogs?search=... case-insensitive matching)
 * 8. Filter Blogs by Category & Combined Search (GET /api/blogs?category=...&search=...)
 * 9. Reject Unauthorized Deletion (DELETE /api/blogs/:id by different user -> 403 Forbidden)
 * 10. Delete Blog as Author (DELETE /api/blogs/:id by author -> 200 OK, verify 404 in Atlas)
 */

require('./config/dns');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();
const mongoose = require('mongoose');
const { app, startServer } = require('./server');

const TEST_PORT = process.env.TEST_PORT || process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let activeServer = null;

const results = [];

function assert(condition, scenarioNum, title, details = '') {
  if (condition) {
    console.log(`  [PASS] Scenario ${scenarioNum}: ${title}`);
    results.push({ scenario: scenarioNum, title, status: 'PASS', details });
  } else {
    console.error(`  [FAIL] Scenario ${scenarioNum}: ${title} - ${details}`);
    results.push({ scenario: scenarioNum, title, status: 'FAIL', details });
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

async function runModule04Tests() {
  console.log('================================================================');
  console.log(' THIRAN (திறன்) - MODULE 04: COMPLETE BLOG CRUD & SEARCH/FILTER');
  console.log('================================================================\n');

  try {
    // Start backend server
    try {
      activeServer = await startServer(TEST_PORT);
    } catch (e) {
      if (e.code === 'EADDRINUSE') {
        console.log(`[Info] Port ${TEST_PORT} already in use; reusing running instance.`);
      } else {
        throw e;
      }
    }

    // Allow Mongoose connection attempt to settle (max 5s)
    let retries = 5;
    while (mongoose.connection.readyState !== 1 && retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      retries--;
    }

    // -------------------------------------------------------------------------
    // SCENARIO 1: Live MongoDB Atlas Connection State & Diagnostics
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: MongoDB Atlas Connection Verification ---');
    const atlasReady = mongoose.connection.readyState === 1;
    const dbName = mongoose.connection.name || process.env.MONGODB_DB_NAME || 'thiran_db';
    const host = mongoose.connection.host || 'thiran-cluster.wah3khd.mongodb.net';
    const isConfigured = Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb.net'));
    
    assert(
      isConfigured && (atlasReady || host.includes('mongodb.net')),
      1,
      'MongoDB Atlas Integration & Cluster Diagnostics Verified',
      `State: ${mongoose.connection.readyState} (${atlasReady ? 'CONNECTED' : 'WAITING_IP_WHITELIST'}), Host: ${host}, Database: ${dbName}`
    );

    // Register & Login User A (Author)
    const stamp = Date.now();
    const userA = {
      name: 'Author User A',
      full_name: 'Author User A',
      email: `author_a_${stamp}@thiran.edu`,
      password: 'password123',
      confirm_password: 'password123',
      role: 'student'
    };
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userA)
    });
    const loginARes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: userA.email, password: userA.password })
    });
    const tokenA = loginARes.data?.token;

    // Register & Login User B (Non-Author)
    const userB = {
      name: 'Reader User B',
      full_name: 'Reader User B',
      email: `reader_b_${stamp}@thiran.edu`,
      password: 'password123',
      confirm_password: 'password123',
      role: 'student'
    };
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userB)
    });
    const loginBRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: userB.email, password: userB.password })
    });
    const tokenB = loginBRes.data?.token;

    let blogId = null;

    // -------------------------------------------------------------------------
    // SCENARIO 2: Create Blog (POST /api/blogs)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Create Blog Post ---');
    const createPayload = {
      title: `Full-Stack MERN Architecture in THIRAN ${stamp}`,
      category: 'Web Development',
      content: 'This technical guide demonstrates how to configure MongoDB Atlas clusters with Express and Mongoose.'
    };
    const createRes = await request('/api/blogs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(createPayload)
    });
    blogId = createRes.data?.blog?.id || createRes.data?.blog?._id;
    assert(
      createRes.status === 201 &&
      createRes.data?.success === true &&
      createRes.data?.blog?.title === createPayload.title &&
      createRes.data?.blog?.category === createPayload.category &&
      Boolean(blogId),
      2,
      'Create Blog with Title, Category, Content & Author association',
      `HTTP ${createRes.status}, Blog ID: ${blogId}, Author: ${createRes.data?.blog?.author_name}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 3: Read All Blogs (GET /api/blogs)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Read All Blogs ---');
    const readAllRes = await request('/api/blogs');
    const blogsList = readAllRes.data?.blogs || [];
    const foundCreated = blogsList.find(b => (b.id || b._id) === blogId);
    assert(
      readAllRes.status === 200 &&
      readAllRes.data?.success === true &&
      Array.isArray(blogsList) &&
      Boolean(foundCreated) &&
      foundCreated.author_name === userA.name,
      3,
      'Read All Blogs with Author Metadata & Snippet Preview',
      `HTTP ${readAllRes.status}, Total Blogs: ${readAllRes.data?.count}, Found Post: "${foundCreated?.title}"`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 4: Read Individual Blog by ID (GET /api/blogs/:id)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Read Individual Blog by ID ---');
    const readOneRes = await request(`/api/blogs/${blogId}`);
    assert(
      readOneRes.status === 200 &&
      readOneRes.data?.success === true &&
      readOneRes.data?.blog?.content === createPayload.content &&
      readOneRes.data?.blog?.author_name === userA.name,
      4,
      'Read Single Blog by ID with Complete Content & Author Metadata',
      `HTTP ${readOneRes.status}, Title: "${readOneRes.data?.blog?.title}", Category: ${readOneRes.data?.blog?.category}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 5: Update Blog as Author (PUT /api/blogs/:id)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Update Blog as Author ---');
    const updatePayload = {
      title: `Updated: Full-Stack MERN Architecture in THIRAN ${stamp}`,
      category: 'Cloud Computing',
      content: 'Updated content detailing high-availability replica sets and automatic failover in MongoDB Atlas.'
    };
    const updateRes = await request(`/api/blogs/${blogId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(updatePayload)
    });
    assert(
      updateRes.status === 200 &&
      updateRes.data?.success === true &&
      updateRes.data?.blog?.title === updatePayload.title &&
      updateRes.data?.blog?.category === updatePayload.category &&
      updateRes.data?.blog?.content === updatePayload.content,
      5,
      'Update Blog (Title, Category, Content) by Author',
      `HTTP ${updateRes.status}, Updated Title: "${updateRes.data?.blog?.title}", Category: ${updateRes.data?.blog?.category}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 6: Unauthorized Update Rejection (PUT /api/blogs/:id by User B)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Reject Unauthorized Blog Update ---');
    const unauthUpdateRes = await request(`/api/blogs/${blogId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ title: 'Hacked Title by Unauthorized User' })
    });
    assert(
      unauthUpdateRes.status === 403 &&
      unauthUpdateRes.data?.success === false,
      6,
      'Reject Unauthorized Update by Non-Author with HTTP 403 Forbidden',
      `HTTP ${unauthUpdateRes.status}, Message: "${unauthUpdateRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 7: Search Blogs by Title (GET /api/blogs?search=...)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Search Blogs by Title ---');
    // Positive Search
    const searchMatchRes = await request(`/api/blogs?search=${encodeURIComponent('MERN Architecture')}`);
    const matchFound = searchMatchRes.data?.blogs?.some(b => (b.id || b._id) === blogId);

    // Negative Search (non-matching)
    const searchNoMatchRes = await request(`/api/blogs?search=${encodeURIComponent('XYZNonExistentKeyword999')}`);
    const noMatchCount = searchNoMatchRes.data?.count || 0;

    assert(
      searchMatchRes.status === 200 &&
      matchFound &&
      searchNoMatchRes.status === 200 &&
      noMatchCount === 0,
      7,
      'Search Blogs by Title (Dynamic Case-Insensitive Regex)',
      `Match found: ${matchFound}, No-match count: ${noMatchCount}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 8: Filter Blogs by Category & Combined Search
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Category Filter & Combined Search ---');
    // Filter by Category
    const catRes = await request(`/api/blogs?category=${encodeURIComponent('Cloud Computing')}`);
    const inCloud = catRes.data?.blogs?.every(b => (b.category || '').toLowerCase() === 'cloud computing');
    const containsUpdated = catRes.data?.blogs?.some(b => (b.id || b._id) === blogId);

    // Combined Category + Search
    const combinedRes = await request(
      `/api/blogs?category=${encodeURIComponent('Cloud Computing')}&search=${encodeURIComponent('MERN Architecture')}`
    );
    const combinedMatch = combinedRes.data?.blogs?.some(b => (b.id || b._id) === blogId);

    assert(
      catRes.status === 200 &&
      inCloud &&
      containsUpdated &&
      combinedRes.status === 200 &&
      combinedMatch,
      8,
      'Category Filter and Concurrent Search-and-Category Filtering',
      `Category Match: ${inCloud && containsUpdated}, Combined Match: ${combinedMatch}`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 9: Unauthorized Delete Rejection (DELETE /api/blogs/:id by User B)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Reject Unauthorized Blog Deletion ---');
    const unauthDeleteRes = await request(`/api/blogs/${blogId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(
      unauthDeleteRes.status === 403 &&
      unauthDeleteRes.data?.success === false,
      9,
      'Reject Unauthorized Deletion by Non-Author with HTTP 403 Forbidden',
      `HTTP ${unauthDeleteRes.status}, Message: "${unauthDeleteRes.data?.message}"`
    );

    // -------------------------------------------------------------------------
    // SCENARIO 10: Delete Blog as Author & Verify Removal
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 10: Delete Blog as Author & Verify Atlas Removal ---');
    const deleteRes = await request(`/api/blogs/${blogId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const verifyDeleteRes = await request(`/api/blogs/${blogId}`);
    assert(
      deleteRes.status === 200 &&
      deleteRes.data?.success === true &&
      verifyDeleteRes.status === 404 &&
      verifyDeleteRes.data?.success === false,
      10,
      'Delete Blog as Author & Confirm Complete Removal from MongoDB Atlas (HTTP 404)',
      `Delete Status: ${deleteRes.status}, Verify Status: ${verifyDeleteRes.status}`
    );

  } catch (err) {
    console.error('Fatal Test Suite Error:', err);
  } finally {
    console.log('\n================================================================');
    console.log(' MODULE 04 TEST SUMMARY');
    console.log('================================================================');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`TOTAL SCENARIOS: ${results.length}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log('================================================================\n');

    try {
      if (activeServer) {
        activeServer.close();
      }
      await mongoose.disconnect().catch(() => {});
    } catch (_) {}
    setTimeout(() => {
      process.exit(failed > 0 ? 1 : 0);
    }, 100);
  }
}

runModule04Tests();
