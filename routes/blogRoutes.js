const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const authenticateToken = require('../middleware/authMiddleware');

// Public: Get all blogs
router.get('/', blogController.getAllBlogs);

// Public: Get single blog by id
router.get('/:id', blogController.getBlogById);

// Protected: Create a new blog (requires JWT token)
router.post('/', authenticateToken, blogController.createBlog);

module.exports = router;
