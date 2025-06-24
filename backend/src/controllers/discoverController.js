const ContentItem = require('../models/contentItemModel');
const asyncHandler = require('express-async-handler');

// @desc    Get discover content (public items from all users)
// @route   GET /api/content/discover
// @access  Private
const getDiscoverContent = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const type = req.query.type; // 'article', 'video', or undefined for all

  // Build query
  const query = { isPublic: true };
  if (type) {
    query.type = type;
  }

  // Get public content items with pagination
  const [items, total] = await Promise.all([
    ContentItem.find(query)
      .populate('userId', 'username profilePictureUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ContentItem.countDocuments(query)
  ]);

  res.json({
    items,
    page,
    pages: Math.ceil(total / limit),
    total,
  });
});

module.exports = {
  getDiscoverContent,
};
