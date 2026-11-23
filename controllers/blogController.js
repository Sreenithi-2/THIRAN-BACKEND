const { pool } = require('../config/db');

/**
 * Create a new blog post
 * POST /api/blogs (Protected by authMiddleware)
 */
async function createBlog(req, res) {
  try {
    const { title, content } = req.body;
    const userId = req.user && req.user.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User authentication required.'
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Blog title is required and cannot be empty.'
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Blog content is required and cannot be empty.'
      });
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    // Insert blog post
    const [result] = await pool.query(
      'INSERT INTO blogs (user_id, title, content) VALUES (?, ?, ?)',
      [userId, trimmedTitle, trimmedContent]
    );

    const blogId = result.insertId;

    // Fetch created blog with author info
    const [rows] = await pool.query(
      `SELECT 
        b.id, 
        b.title, 
        b.content, 
        b.created_at, 
        b.updated_at,
        u.id AS author_id, 
        u.full_name AS author_name, 
        u.email AS author_email
      FROM blogs b
      INNER JOIN users u ON b.user_id = u.id
      WHERE b.id = ?`,
      [blogId]
    );

    return res.status(201).json({
      success: true,
      message: 'Blog post created successfully.',
      blog: rows[0]
    });
  } catch (error) {
    console.error('[Create Blog Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while creating blog post.',
      error: error.message
    });
  }
}

/**
 * Get all blogs with author information
 * GET /api/blogs
 */
async function getAllBlogs(req, res) {
  try {
    const [blogs] = await pool.query(
      `SELECT 
        b.id, 
        b.title, 
        b.content, 
        b.created_at, 
        b.updated_at,
        u.id AS author_id, 
        u.full_name AS author_name, 
        u.email AS author_email
      FROM blogs b
      INNER JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: blogs.length,
      blogs
    });
  } catch (error) {
    console.error('[Get All Blogs Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving blogs.',
      error: error.message
    });
  }
}

/**
 * Get single blog by ID
 * GET /api/blogs/:id
 */
async function getBlogById(req, res) {
  try {
    const blogId = parseInt(req.params.id, 10);

    if (isNaN(blogId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID provided.'
      });
    }

    const [rows] = await pool.query(
      `SELECT 
        b.id, 
        b.title, 
        b.content, 
        b.created_at, 
        b.updated_at,
        u.id AS author_id, 
        u.full_name AS author_name, 
        u.email AS author_email
      FROM blogs b
      INNER JOIN users u ON b.user_id = u.id
      WHERE b.id = ?`,
      [blogId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Blog with ID ${blogId} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      blog: rows[0]
    });
  } catch (error) {
    console.error('[Get Blog By ID Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while retrieving blog details.',
      error: error.message
    });
  }
}

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById
};
