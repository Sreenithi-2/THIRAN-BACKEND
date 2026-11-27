
const express = require('express');
const router = express.Router();

const blogController = require('../controllers/blogController');
const authenticateToken = require('../middleware/authMiddleware');

// Public: Get all blogs (supports search and category filters)
router.get('/', blogController.getAllBlogs);

// Public: Get a single blog
router.get('/:id', blogController.getBlogById);

// Protected: Create a blog
router.post('/', authenticateToken, blogController.createBlog);

// Protected: Update a blog
router.put('/:id', authenticateToken, blogController.updateBlog);

// Protected: Delete a blog
router.delete('/:id', authenticateToken, blogController.deleteBlog);

module.exports = router;
