const express = require('express');
const router = express.Router();

const {
  createContentItem,
  getContentItems,
  getContentItemsByUser,
  getContentItemById,
  updateContentItem,
  deleteContentItem,
} = require('../controllers/contentItemController');
const { protect } = require('../middleware/authMiddleware');

// @desc    Create a new content item
// @route   POST /api/contentitems
// @access  Private
router.post('/', protect, createContentItem);

// @desc    Get all content items for the logged-in user
// @route   GET /api/contentitems
// @access  Private
router.get('/', protect, getContentItems);

// @desc    Get content items by user ID (public items only unless requesting user's own content)
// @route   GET /api/contentitems/user/:userId
// @access  Public (for public items), Private (for private user content)
router.get('/user/:userId', protect, getContentItemsByUser);

// @desc    Get a single content item by ID
// @route   GET /api/contentitems/:id
// @access  Private (conditionally, based on item ownership if not public)
router.get('/:id', protect, getContentItemById);

// @desc    Update a content item
// @route   PUT /api/contentitems/:id
// @access  Private (user must own the item)
router.put('/:id', protect, updateContentItem);

// @desc    Delete a content item
// @route   DELETE /api/contentitems/:id
// @access  Private (user must own the item)
router.delete('/:id', protect, deleteContentItem);

module.exports = router;
