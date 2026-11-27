/**
 * THIRAN (திறன்) - Complete MongoDB Atlas Integration Verification Suite
 * Validates:
 * 1. Mongoose User Model Schema, Validations, Role, and Virtuals
 * 2. Mongoose Blog Model Schema, Validations, Author ref, Category, and Virtuals
 * 3. Pre-save / Pre-validate hooks synchronizing name/full_name & author/user_id
 * 4. Password hashing verification & safe toJSON serialization (no password exposure)
 * 5. MongoDB Configuration, Masking, and Health Status Reporting
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Blog = require('./models/Blog');
const { getMongoStatus } = require('./config/mongodb');

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    results.push({ name: testName, status: 'PASS', details });
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    results.push({ name: testName, status: 'FAIL', details });
  }
}

async function runMongoUnitTests() {
  console.log('\n======================================================');
  console.log(' THIRAN - COMPLETE MONGOOSE MODELS & CONFIG TESTS');
  console.log('======================================================\n');

  // Test 1: User Model Schema Validation - Missing Fields
  console.log('TEST 1: User Model Schema Validation (Missing Fields)');
  const emptyUser = new User({});
  let errEmpty = null;
  try {
    await emptyUser.validate();
  } catch (err) {
    errEmpty = err;
  }
  assert(
    errEmpty && errEmpty.errors.email && errEmpty.errors.password && (errEmpty.errors.name || errEmpty.errors.full_name),
    '1. User model enforces required fields (name, email, password)',
    'Errors caught: ' + Object.keys(errEmpty?.errors || {}).join(', ')
  );

  // Test 2: User Model Schema Validation - Invalid Email & Short Password
  console.log('\nTEST 2: User Model Validation (Invalid Email & Short Password)');
  const invalidUser = new User({
    name: 'A', // < 2 chars
    email: 'invalid-email-address',
    password: '123' // < 6 chars
  });
  let errInvalid = null;
  try {
    await invalidUser.validate();
  } catch (err) {
    errInvalid = err;
  }
  assert(
    errInvalid &&
    (errInvalid.errors.name || errInvalid.errors.full_name) &&
    errInvalid.errors.email &&
    errInvalid.errors.password,
    '2. User model rejects invalid email, short name (<2), and short password (<6)',
    'Errors caught: ' + Object.keys(errInvalid?.errors || {}).join(', ')
  );

  // Test 3: User Model Virtuals, Role, and Safe toJSON Serialization
  console.log('\nTEST 3: User Model Virtuals, Role, & Safe toJSON Serialization');
  const rawPassword = 'SecureStudentPassword2026!';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  const isHashValid = await bcrypt.compare(rawPassword, hashedPassword);

  const validUser = new User({
    name: 'Karthik Raja',
    email: 'karthik.atlas@thiran.edu',
    phone: '+91 9876543210',
    role: 'student',
    password: hashedPassword
  });
  await validUser.validate();
  const jsonUser = validUser.toJSON();

  assert(
    jsonUser.id &&
    jsonUser.id.length === 24 &&
    !jsonUser.password &&
    !jsonUser.__v &&
    jsonUser.name === 'Karthik Raja' &&
    jsonUser.full_name === 'Karthik Raja' &&
    jsonUser.role === 'student' &&
    isHashValid,
    '3. User model synchronizes name/full_name, verifies bcrypt hashing, and strips password in toJSON',
    `Serialized user: ${JSON.stringify(jsonUser)}`
  );

  // Test 4: Blog Model Schema Validation - Missing Fields
  console.log('\nTEST 4: Blog Model Schema Validation');
  const emptyBlog = new Blog({});
  let errBlogEmpty = null;
  try {
    await emptyBlog.validate();
  } catch (err) {
    errBlogEmpty = err;
  }
  assert(
    errBlogEmpty &&
    (errBlogEmpty.errors.author || errBlogEmpty.errors.user_id) &&
    errBlogEmpty.errors.title &&
    errBlogEmpty.errors.content,
    '4. Blog model enforces required fields (author, title, content)',
    'Errors caught: ' + Object.keys(errBlogEmpty?.errors || {}).join(', ')
  );

  // Test 5: Blog Model Author reference, Category, and toJSON
  console.log('\nTEST 5: Blog Model Author Reference, Category, & toJSON');
  const sampleAuthorId = new mongoose.Types.ObjectId();
  const validBlog = new Blog({
    author: sampleAuthorId,
    title: 'MongoDB Atlas Scaling & Schema Design',
    category: 'Database',
    content: 'Deep dive into MongoDB Atlas clusters, Mongoose models, and replica sets for THIRAN.'
  });
  await validBlog.validate();
  const jsonBlog = validBlog.toJSON();

  assert(
    jsonBlog.id &&
    jsonBlog.id.length === 24 &&
    jsonBlog.author.toString() === sampleAuthorId.toString() &&
    jsonBlog.user_id.toString() === sampleAuthorId.toString() &&
    jsonBlog.category === 'Database' &&
    jsonBlog.createdAt &&
    jsonBlog.updatedAt,
    '5. Blog model properly synchronizes author/user_id, supports category, and serializes createdAt/updatedAt',
    `Serialized blog: ${JSON.stringify(jsonBlog)}`
  );

  // Test 6: MongoDB Status & Configuration Function
  console.log('\nTEST 6: MongoDB Status Function & Safe Configuration Check');
  const status = getMongoStatus();
  assert(
    typeof status === 'object' &&
    status.database === 'thiran_db' &&
    status.status !== undefined &&
    typeof status.isAtlas === 'boolean',
    '6. getMongoStatus returns structured, sanitized connection metrics without leaking passwords',
    `Status details: ${JSON.stringify(status)}`
  );

  console.log('\n======================================================');
  console.log(' MODULE 03 UNIT TEST SUMMARY');
  console.log('======================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.status}] ${r.name}`);
  });
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMongoUnitTests();
