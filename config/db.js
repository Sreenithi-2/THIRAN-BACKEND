const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'thiran_db',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Create real MySQL pool
let realPool = null;
let isDbConnected = false;
let connectionErrorMessage = '';

try {
  realPool = mysql.createPool(dbConfig);
} catch (err) {
  console.warn('[Database] Initial MySQL pool creation notice:', err.message);
}

// In-memory persistent data store for graceful fallback when MySQL requires configuration
const fallbackStore = {
  users: [],
  blogs: [],
  userNextId: 1,
  blogNextId: 1
};

/**
 * Fallback query engine: supports parameterized SQL statements
 */
function executeFallbackQuery(sql, params = []) {
  const normalizedSql = sql.trim().replace(/\s+/g, ' ');

  // 1. SELECT id FROM users WHERE email = ?
  if (/^SELECT id FROM users WHERE email = \?/i.test(normalizedSql)) {
    const email = (params[0] || '').toLowerCase();
    const rows = fallbackStore.users.filter(u => u.email.toLowerCase() === email);
    return [rows.map(u => ({ id: u.id }))];
  }

  // 2. INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)
  if (/^INSERT INTO users/i.test(normalizedSql)) {
    const [full_name, email, phone, password] = params;
    const newUser = {
      id: fallbackStore.userNextId++,
      full_name,
      email: email.toLowerCase(),
      phone: phone || null,
      password,
      created_at: new Date()
    };
    fallbackStore.users.push(newUser);
    return [{ insertId: newUser.id, affectedRows: 1 }];
  }

  // 3. SELECT id, full_name, email, phone, created_at FROM users WHERE id = ?
  if (/^SELECT id, full_name, email, phone, created_at FROM users WHERE id = \?/i.test(normalizedSql)) {
    const id = parseInt(params[0], 10);
    const user = fallbackStore.users.find(u => u.id === id);
    if (!user) return [[]];
    const { password, ...safe } = user;
    return [[safe]];
  }

  // 4. SELECT id, full_name, email, phone, password, created_at FROM users WHERE email = ?
  if (/^SELECT id, full_name, email, phone, password, created_at FROM users WHERE email = \?/i.test(normalizedSql)) {
    const email = (params[0] || '').toLowerCase();
    const user = fallbackStore.users.find(u => u.email.toLowerCase() === email);
    return user ? [[{ ...user }]] : [[]];
  }

  // 5. INSERT INTO blogs (user_id, title, content) VALUES (?, ?, ?)
  if (/^INSERT INTO blogs/i.test(normalizedSql)) {
    const [user_id, title, content] = params;
    const newBlog = {
      id: fallbackStore.blogNextId++,
      user_id: parseInt(user_id, 10),
      title,
      content,
      created_at: new Date(),
      updated_at: new Date()
    };
    fallbackStore.blogs.push(newBlog);
    return [{ insertId: newBlog.id, affectedRows: 1 }];
  }

  // 6. SELECT ... FROM blogs b JOIN/INNER JOIN users u ... WHERE b.id = ?
  if (/FROM blogs b (?:INNER )?JOIN users u .* WHERE b\.id = \?/i.test(normalizedSql)) {
    const id = parseInt(params[0], 10);
    const blog = fallbackStore.blogs.find(b => b.id === id);
    if (!blog) return [[]];
    const user = fallbackStore.users.find(u => u.id === blog.user_id) || { full_name: 'Unknown', email: '' };
    return [[{
      id: blog.id,
      title: blog.title,
      content: blog.content,
      created_at: blog.created_at,
      updated_at: blog.updated_at,
      author_id: blog.user_id,
      author_name: user.full_name,
      author_email: user.email
    }]];
  }

  // 7. SELECT ... FROM blogs b JOIN/INNER JOIN users u ORDER BY b.created_at DESC
  if (/FROM blogs b (?:INNER )?JOIN users u .* ORDER BY b\.created_at DESC/i.test(normalizedSql)) {
    const blogs = [...fallbackStore.blogs]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(b => {
        const user = fallbackStore.users.find(u => u.id === b.user_id) || { full_name: 'Unknown', email: '' };
        return {
          id: b.id,
          title: b.title,
          content: b.content,
          created_at: b.created_at,
          updated_at: b.updated_at,
          author_id: b.user_id,
          author_name: user.full_name,
          author_email: user.email
        };
      });
    return [blogs];
  }

  console.warn('[Database Fallback] Unhandled fallback query:', normalizedSql);
  return [[]];
}

/**
 * Unified pool interface
 */
const pool = {
  async query(sql, params) {
    if (isDbConnected && realPool) {
      try {
        return await realPool.query(sql, params);
      } catch (err) {
        console.error('[MySQL Query Error]', err.message);
        throw err;
      }
    } else {
      // Use fallback store
      return executeFallbackQuery(sql, params);
    }
  },

  async getConnection() {
    if (isDbConnected && realPool) {
      return await realPool.getConnection();
    }
    // Return dummy connection object for health check
    return {
      release: () => {}
    };
  }
};

/**
 * Test real MySQL connectivity
 */
async function testConnection() {
  if (!realPool) {
    isDbConnected = false;
    connectionErrorMessage = 'MySQL pool not initialized';
    return false;
  }

  try {
    const connection = await realPool.getConnection();
    isDbConnected = true;
    connectionErrorMessage = '';
    console.log(`[Database] Successfully connected to MySQL at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    connection.release();
    return true;
  } catch (error) {
    isDbConnected = false;
    connectionErrorMessage = error.message;
    console.warn(`[Database Notice] Could not connect to MySQL Server (${error.code || error.message}).`);
    console.warn('[Database Notice] Operating in fallback memory mode. Configure MySQL credentials in backend/.env to connect to live MySQL.');
    return false;
  }
}

function getDbStatus() {
  return {
    connected: isDbConnected,
    mode: isDbConnected ? 'MySQL Live' : 'Fallback Mode (Configure MySQL in .env)',
    error: connectionErrorMessage || null,
    config: {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    }
  };
}

module.exports = {
  pool,
  testConnection,
  getDbStatus
};
