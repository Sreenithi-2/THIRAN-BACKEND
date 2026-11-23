const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection, getDbStatus } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    project: 'THIRAN (திறன்) - Online Learning Platform',
    status: 'Running',
    version: '1.0.0',
    documentation: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login'
      },
      blogs: {
        list: 'GET /api/blogs',
        getById: 'GET /api/blogs/:id',
        create: 'POST /api/blogs (Bearer JWT required)'
      }
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = getDbStatus();
  res.status(200).json({
    status: 'OK',
    message: 'THIRAN backend service is operational.',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
    database: dbStatus.connected ? 'Connected (MySQL)' : 'Fallback Mode (MySQL configuration needed)',
    databaseDetails: dbStatus
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint '${req.method} ${req.originalUrl}' not found.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Global Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start Express Server
let server = null;

function startServer(port = PORT) {
  return new Promise((resolve) => {
    const s = app.listen(port, async () => {
      console.log('===================================================');
      console.log(` THIRAN (திறன்) Backend Server`);
      console.log(` Running on: http://localhost:${port}`);
      console.log(` Health Check: http://localhost:${port}/api/health`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('===================================================');

      // Verify database connectivity
      await testConnection();
      resolve(s);
    });
    server = s;
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
