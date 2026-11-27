// Configure DNS resolution before anything else
require('./config/dns');

const mongoose = require('mongoose');
const dns = require('dns').promises;
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Blog = require('./models/Blog');
const { connectMongoDB, getMongoStatus, disconnectMongoDB } = require('./config/mongodb');

dotenv.config();

async function runLiveAtlasTest() {
  console.log('======================================================');
  console.log(' THIRAN - MONGODB ATLAS LIVE RESOLUTION & CONNECTION TEST');
  console.log('======================================================');

  const uri = process.env.MONGODB_URI;
  const status = getMongoStatus();

  console.log('Database configured:', status.database);
  console.log('Is Atlas URI format:', status.isAtlas);

  // 1. Test DNS SRV Resolution for Atlas hostname
  const atlasHost = 'thiran-cluster.wah3khd.mongodb.net';
  console.log(`\nTesting DNS SRV resolution for '_mongodb._tcp.${atlasHost}'...`);
  try {
    const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${atlasHost}`);
    console.log(`[PASS] SRV Records successfully resolved (${srvRecords.length} shard targets):`);
    srvRecords.forEach(s => console.log(`  - Target: ${s.name}:${s.port} (weight: ${s.weight}, priority: ${s.priority})`));
  } catch (dnsErr) {
    console.error(`[FAIL] DNS SRV resolution failed: ${dnsErr.message} (${dnsErr.code})`);
    return;
  }

  // 2. Test DNS TXT Resolution for replica set parameters
  try {
    const txtRecords = await dns.resolveTxt(atlasHost);
    console.log(`[PASS] TXT Records successfully resolved:`, txtRecords[0] ? txtRecords[0].join('') : txtRecords);
  } catch (txtErr) {
    console.warn(`[WARN] TXT Record resolution note: ${txtErr.message}`);
  }

  // 3. Connect via Mongoose using the configured URI
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.log('\n[NOTICE] backend/.env contains placeholder credentials.');
    return;
  }

  console.log('\nConnecting to MongoDB Atlas with Mongoose...');
  const connected = await connectMongoDB(uri);

  console.log(`\nMongoose Connection State: ${mongoose.connection.readyState} (${
    mongoose.connection.readyState === 1 ? 'CONNECTED' : 'NOT CONNECTED'
  })`);

  if (!connected || mongoose.connection.readyState !== 1) {
    console.log('[RESULT] MongoDB Atlas DNS resolution SUCCEEDED, but connection could not be completed.');
    console.log('Connection error details:', status.error || 'Check IP whitelist or credentials.');
    return;
  }

  console.log('[PASS] Genuinely connected to live MongoDB Atlas cluster!');

  // Run live database operations
  try {
    const testEmail = `atlas_test_${Date.now()}@thiran.edu`;
    const hashedPassword = await bcrypt.hash('SecureAtlasPass2026!', 10);
    const testUser = await User.create({
      name: 'Atlas Test Student',
      full_name: 'Atlas Test Student',
      email: testEmail,
      password: hashedPassword,
      role: 'student'
    });
    console.log(`[PASS] Inserted test user: ID=${testUser._id}, Email=${testUser.email}`);

    const userInDb = await User.findById(testUser._id);
    const isHashed = userInDb.password.startsWith('$2') && userInDb.password !== 'SecureAtlasPass2026!';
    console.log(`[PASS] Verified user in MongoDB. Password hashed: ${isHashed}`);

    const testBlog = await Blog.create({
      title: 'Testing MongoDB Atlas Cloud Cluster in THIRAN',
      content: 'Live document insertion, indexing, and retrieval test.',
      category: 'Database',
      author: testUser._id
    });
    console.log(`[PASS] Inserted test blog: ID=${testBlog._id}, Title="${testBlog.title}"`);

    const allBlogs = await Blog.find().populate('author', 'name email role');
    console.log(`[PASS] Retrieved all blogs from Atlas. Count: ${allBlogs.length}`);

    const singleBlog = await Blog.findById(testBlog._id).populate('author', 'name email role');
    console.log(`[PASS] Retrieved blog by ID: "${singleBlog.title}", Author: ${singleBlog.author.name}`);

    singleBlog.title = 'Updated: Testing MongoDB Atlas Cloud Cluster in THIRAN';
    await singleBlog.save();
    const updatedBlog = await Blog.findById(testBlog._id);
    console.log(`[PASS] Updated blog in Atlas: New Title="${updatedBlog.title}"`);

    await Blog.findByIdAndDelete(testBlog._id);
    console.log(`[PASS] Deleted test blog.`);

    await User.findByIdAndDelete(testUser._id);
    console.log(`[PASS] Cleaned up temporary test user.`);

    await disconnectMongoDB();
    console.log('\n======================================================');
    console.log(' ALL ATLAS DATABASE OPERATIONS VERIFIED SUCCESSFULLY');
    console.log('======================================================');
  } catch (dbErr) {
    console.error('[Error during database operations]', dbErr.message);
  }
}

if (require.main === module) {
  runLiveAtlasTest();
}

module.exports = runLiveAtlasTest;
