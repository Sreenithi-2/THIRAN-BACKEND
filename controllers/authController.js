const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { pool } = require('../config/db');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'thiran_fallback_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { full_name, email, phone, password, confirm_password } = req.body;

    // 1. Validate required fields
    if (!full_name || !email || !password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'All fields (full_name, email, password, confirm_password) are required.'
      });
    }

    const trimmedName = full_name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone ? phone.trim() : null;

    if (trimmedName.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be at least 3 characters long.'
      });
    }

    // 2. Validate email format
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // 3. Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // 4. Validate confirm_password
    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    // 5. Check if email already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [trimmedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // 6. Hash password with bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 7. Save user in MySQL
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)',
      [trimmedName, trimmedEmail, trimmedPhone, hashedPassword]
    );

    const newUserId = result.insertId;

    // Fetch created user without password
    const [newUsers] = await pool.query(
      'SELECT id, full_name, email, phone, created_at FROM users WHERE id = ?',
      [newUserId]
    );

    const safeUser = newUsers[0];

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: safeUser
    });
  } catch (error) {
    console.error('[Registration Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred during user registration.',
      error: error.message
    });
  }
}

/**
 * Log in an existing user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // 1. Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 2. Fetch user from database
    const [users] = await pool.query(
      'SELECT id, full_name, email, phone, password, created_at FROM users WHERE email = ? LIMIT 1',
      [trimmedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];

    // 3. Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // 4. Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    // 5. Return safe user info (never expose password or password hash)
    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at
    };

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('[Login Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred during login.',
      error: error.message
    });
  }
}

module.exports = {
  register,
  login
};
