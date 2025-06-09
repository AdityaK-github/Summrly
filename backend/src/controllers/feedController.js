const User = require('../models/userModel');
const ContentItem = require('../models/contentItemModel');
const asyncHandler = require('express-async-handler');

// @desc    Get user's feed (summaries from followed users)
// @route   GET /api/feed
// @access  Private
const getFeed = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const user = await User.findById(req.user._id).populate('following');
  const followingIds = user.following.map(user => user._id);
  followingIds.push(req.user._id); // Include user's own content in feed

  const contentItems = await ContentItem.find({
    userId: { $in: followingIds },
    isPublic: true
  })
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .populate('userId', 'username profilePictureUrl')
  .populate('likes', 'username profilePictureUrl')
  .populate({
    path: 'comments',
    populate: {
      path: 'userId',
      select: 'username profilePictureUrl'
    },
    options: { sort: { createdAt: -1 }, limit: 3 }
  });

  const totalItems = await ContentItem.countDocuments({
    userId: { $in: followingIds },
    isPublic: true
  });

  res.json({
    items: contentItems,
    page,
    pages: Math.ceil(totalItems / limit),
    total: totalItems
  });
});

// @desc    Get user's profile with their content
// @route   GET /api/profile/:username
// @access  Public
const getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const user = await User.findOne({ username })
    .select('-passwordHash -email -__v -following -followers');
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if the requesting user is following this profile
  let isFollowing = false;
  if (req.user) {
    const currentUser = await User.findById(req.user._id);
    isFollowing = currentUser.following.includes(user._id);
  }

  // Get user's public content with pagination
  const [contentItems, totalItems] = await Promise.all([
    ContentItem.find({
      userId: user._id,
      isPublic: true
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('likes', 'username profilePictureUrl')
    .populate({
      path: 'comments',
      populate: {
        path: 'userId',
        select: 'username profilePictureUrl'
      },
      options: { sort: { createdAt: -1 }, limit: 3 }
    }),
    
    ContentItem.countDocuments({
      userId: user._id,
      isPublic: true
    })
  ]);

  // Get user's followers and following count
  const [followersCount, followingCount] = await Promise.all([
    User.countDocuments({ following: user._id }),
    User.countDocuments({ _id: { $in: user.following } })
  ]);

  res.json({
    user: {
      ...user.toObject(),
      followersCount,
      followingCount,
      isFollowing
    },
    content: {
      items: contentItems,
      page,
      pages: Math.ceil(totalItems / limit),
      total: totalItems
    }
  });
});

// @desc    Search for content items
// @route   GET /api/search
// @access  Private
const searchContent = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  if (!q) {
    res.status(400);
    throw new Error('Search query is required');
  }

  // Search in title, summary, and tags
  const searchQuery = {
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { summary: { $regex: q, $options: 'i' } },
      { tags: { $in: [new RegExp(q, 'i')] } }
    ],
    isPublic: true // Only search public content
  };

  const [results, total] = await Promise.all([
    ContentItem.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username profilePictureUrl'),
    ContentItem.countDocuments(searchQuery)
  ]);

  res.json({
    results,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    total
  });
});

module.exports = {
  getFeed,
  getUserProfile,
  searchContent
};
