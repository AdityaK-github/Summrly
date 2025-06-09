const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getFeed, getUserProfile, searchContent } = require('../controllers/feedController');

// @desc    Get user's feed (summaries from followed users)
// @route   GET /api/feed
// @access  Private
router.get('/', protect, getFeed);

// @desc    Get user profile with their content
// @route   GET /api/feed/profile/:username
// @access  Public
router.get('/profile/:username', getUserProfile);

// @desc    Search for content
// @route   GET /api/feed/search
// @access  Private
router.get('/search', protect, searchContent);

module.exports = router;
