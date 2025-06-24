const express = require('express');
const router = express.Router();
const { getDiscoverContent } = require('../controllers/discoverController');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get discover content (public items from all users)
// @route   GET /api/content/discover
// @access  Private
router.get('/', protect, getDiscoverContent);

module.exports = router;
