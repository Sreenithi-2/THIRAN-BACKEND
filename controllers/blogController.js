const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const User = require('../models/User');
const { pool } = require('../config/db');

/**
 * Format blog object consistently for API consumers
 */
function formatBlogResponse(blogDoc, authorDoc = null) {
  const author = authorDoc || blogDoc.author || blogDoc.user_id || {};
  const authorId = author._id ? author._id.toString() : (blogDoc.author || blogDoc.user_id || '').toString();
  const authorName = author.name || author.full_name || 'Anonymous Author';
  const authorEmail = author.email || '';
  const authorRole = author.role || 'Student';

  return {
    id: blogDoc._id ? blogDoc._id.toString() : (blogDoc.id || '').toString(),
    _id: blogDoc._id ? blogDoc._id.toString() : (blogDoc.id || '').toString(),
    title: blogDoc.title,
    content: blogDoc.content,
    category: blogDoc.category || 'General',
    author: authorId,
    author_id: authorId,
    author_name: authorName,
    author_email: authorEmail,
    author_role: authorRole,
    createdAt: blogDoc.createdAt || blogDoc.created_at,
    updatedAt: blogDoc.updatedAt || blogDoc.updated_at,
    created_at: blogDoc.created_at || blogDoc.createdAt,
    updated_at: blogDoc.updated_at || blogDoc.updatedAt
  };
}

/**
 * Create a new blog post
 * POST /api/blogs (Protected by authMiddleware)
 */
async function createBlog(req, res) {
  try {
    const { title, content, category } = req.body;
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
    const blogCategory = category ? category.trim() : 'General';

    // 1. MongoDB Primary Storage
    if (mongoose.connection.readyState === 1) {
      const authorObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : null;

      const newBlog = await Blog.create({
        author: authorObjectId,
        user_id: authorObjectId,
        title: trimmedTitle,
        content: trimmedContent,
        category: blogCategory,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const populatedBlog = await Blog.findById(newBlog._id).populate(
        'author',
        'name full_name email role'
      );

      return res.status(201).json({
        success: true,
        message: 'Blog post created successfully in MongoDB.',
        blog: formatBlogResponse(populatedBlog)
      });
    }

    // 2. MySQL / In-memory Fallback
    const [result] = await pool.query(
      'INSERT INTO blogs (user_id, title, content, category) VALUES (?, ?, ?, ?)',
      [userId, trimmedTitle, trimmedContent, blogCategory]
    );

    const blogId = result.insertId;

    const [rows] = await pool.query(
      `SELECT 
        b.id, 
        b.title, 
        b.content, 
        b.category,
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
    const { category, search } = req.query;

    // 1. MongoDB Primary Retrieval
    if (mongoose.connection.readyState === 1) {
      const query = {};
      if (category && category !== 'All') {
        query.category = new RegExp(`^${category}$`, 'i');
      }
      if (search && search.trim()) {
        const trimmedSearch = search.trim();
        query.title = { $regex: trimmedSearch, $options: 'i' };
      }

      const blogs = await Blog.find(query)
        .sort({ createdAt: -1, created_at: -1 })
        .populate('author', 'name full_name email role')
        .populate('user_id', 'name full_name email role');

      const formattedBlogs = blogs.map(b => formatBlogResponse(b));

      return res.status(200).json({
        success: true,
        count: formattedBlogs.length,
        blogs: formattedBlogs
      });
    }

    // 2. MySQL / In-memory Fallback
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

    let filteredBlogs = blogs;
    if (category && category !== 'All') {
      filteredBlogs = filteredBlogs.filter(b => (b.category || 'General').toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filteredBlogs = filteredBlogs.filter(b => (b.title || '').toLowerCase().includes(s));
    }

    return res.status(200).json({
      success: true,
      count: filteredBlogs.length,
      blogs: filteredBlogs
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
    const rawId = req.params.id;

    if (!rawId) {
      return res.status(400).json({
        success: false,
        message: 'Blog ID is required.'
      });
    }

    // 1. MongoDB Primary Retrieval
    if (mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(rawId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid blog ID format. Must be a 24-character hexadecimal ObjectId.'
        });
      }

      const blog = await Blog.findById(rawId)
        .populate('author', 'name full_name email role')
        .populate('user_id', 'name full_name email role');

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: `Blog with ID ${rawId} not found.`
        });
      }

      return res.status(200).json({
        success: true,
        blog: formatBlogResponse(blog)
      });
    }

    // 2. MySQL / In-memory Fallback
    const blogId = parseInt(rawId, 10);
    if (isNaN(blogId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID format.'
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

/**
 * Update blog details
 * PUT /api/blogs/:id (Protected by authMiddleware)
 */
async function updateBlog(req, res) {
  try {
    const rawId = req.params.id;
    const userId = req.user && req.user.id;
    const userRole = (req.user && req.user.role) || 'student';
    const { title, content, category } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User authentication required.'
      });
    }

    if (!rawId) {
      return res.status(400).json({
        success: false,
        message: 'Blog ID is required.'
      });
    }

    if (!title && !content && !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update (title, content, or category).'
      });
    }

    // 1. MongoDB Primary Update
    if (mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(rawId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid blog ID format. Must be a 24-character hexadecimal ObjectId.'
        });
      }

      const blog = await Blog.findById(rawId);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: `Blog with ID ${rawId} not found.`
        });
      }

      // Check author authorization
      const authorId = blog.author ? blog.author.toString() : (blog.user_id ? blog.user_id.toString() : '');
      const isAuthor = authorId === userId.toString();
      const isAdmin = userRole.toLowerCase() === 'admin';

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to modify this blog post.'
        });
      }

      if (title && title.trim()) blog.title = title.trim();
      if (content && content.trim()) blog.content = content.trim();
      if (category && category.trim()) blog.category = category.trim();
      blog.updatedAt = new Date();
      blog.updated_at = new Date();

      await blog.save();

      const populatedBlog = await Blog.findById(blog._id)
        .populate('author', 'name full_name email role')
        .populate('user_id', 'name full_name email role');

      return res.status(200).json({
        success: true,
        message: 'Blog post updated successfully in MongoDB.',
        blog: formatBlogResponse(populatedBlog)
      });
    }

    // 2. MySQL / In-memory Fallback
    const blogId = parseInt(rawId, 10);
    if (isNaN(blogId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID format.'
      });
    }

    const [rows] = await pool.query('SELECT * FROM blogs WHERE id = ?', [blogId]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Blog with ID ${blogId} not found.`
      });
    }

    const existingBlog = rows[0];
    if (existingBlog.user_id.toString() !== userId.toString() && userRole.toLowerCase() !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to modify this blog post.'
      });
    }

    const updatedTitle = title ? title.trim() : existingBlog.title;
    const updatedContent = content ? content.trim() : existingBlog.content;
    const updatedCategory = category ? category.trim() : (existingBlog.category || 'General');

    await pool.query(
      'UPDATE blogs SET title = ?, content = ?, category = ? WHERE id = ?',
      [updatedTitle, updatedContent, updatedCategory, blogId]
    );

    return res.status(200).json({
      success: true,
      message: 'Blog post updated successfully.',
      blog: {
        id: blogId,
        title: updatedTitle,
        content: updatedContent,
        category: updatedCategory,
        author_id: existingBlog.user_id,
        updated_at: new Date()
      }
    });
  } catch (error) {
    console.error('[Update Blog Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while updating blog post.',
      error: error.message
    });
  }
}

/**
 * Delete a blog post
 * DELETE /api/blogs/:id (Protected by authMiddleware)
 */
async function deleteBlog(req, res) {
  try {
    const rawId = req.params.id;
    const userId = req.user && req.user.id;
    const userRole = (req.user && req.user.role) || 'student';

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User authentication required.'
      });
    }

    if (!rawId) {
      return res.status(400).json({
        success: false,
        message: 'Blog ID is required.'
      });
    }

    // 1. MongoDB Primary Deletion
    if (mongoose.connection.readyState === 1) {
      if (!mongoose.Types.ObjectId.isValid(rawId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid blog ID format. Must be a 24-character hexadecimal ObjectId.'
        });
      }

      const blog = await Blog.findById(rawId);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: `Blog with ID ${rawId} not found.`
        });
      }

      const authorId = blog.author ? blog.author.toString() : (blog.user_id ? blog.user_id.toString() : '');
      const isAuthor = authorId === userId.toString();
      const isAdmin = userRole.toLowerCase() === 'admin';

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to delete this blog post.'
        });
      }

      await Blog.findByIdAndDelete(rawId);

      return res.status(200).json({
        success: true,
        message: 'Blog post deleted successfully from MongoDB.',
        id: rawId
      });
    }

    // 2. MySQL / In-memory Fallback
    const blogId = parseInt(rawId, 10);
    if (isNaN(blogId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID format.'
      });
    }

    const [rows] = await pool.query('SELECT * FROM blogs WHERE id = ?', [blogId]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Blog with ID ${blogId} not found.`
      });
    }

    const existingBlog = rows[0];
    if (existingBlog.user_id.toString() !== userId.toString() && userRole.toLowerCase() !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to delete this blog post.'
      });
    }

    await pool.query('DELETE FROM blogs WHERE id = ?', [blogId]);

    return res.status(200).json({
      success: true,
      message: 'Blog post deleted successfully.',
      id: blogId
    });
  } catch (error) {
    console.error('[Delete Blog Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while deleting blog post.',
      error: error.message
    });
  }
}

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog
};
