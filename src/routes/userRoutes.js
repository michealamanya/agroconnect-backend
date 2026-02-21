const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getProfile, updateProfile, getUserById } = require('../controllers/userController');

// All user routes require authentication
router.use(authenticate);

// GET /api/users/profile - Get current user's profile
router.get('/profile', getProfile);

// PUT /api/users/profile - Update current user's profile
router.put('/profile', updateProfile);

// GET /api/users/:id - Get a user's public profile
router.get('/:id', getUserById);

module.exports = router;
