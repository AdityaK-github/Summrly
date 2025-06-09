const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/userModel');
const ContentItem = require('../models/contentItemModel');
const asyncHandler = require('express-async-handler');

// @desc    Search for users
// @route   GET /api/discover/users
// @access  Private
router.get('/users', protect, asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters long' });
  }

  // Case-insensitive search for username or name
  const users = await User.find({
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { name: { $regex: query, $options: 'i' } }
    ],
    _id: { $ne: req.user._id } // Exclude the current user
  }).select('-passwordHash -email -__v');

  res.json(users);
}));

// @desc    Follow a user
// @route   POST /api/discover/follow/:userId
// @access  Private
router.post('/follow/:userId', protect, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  if (userId === currentUserId.toString()) {
    return res.status(400).json({ message: 'You cannot follow yourself' });
  }

  const userToFollow = await User.findById(userId);
  if (!userToFollow) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Check if already following
  const currentUser = await User.findById(currentUserId);
  if (currentUser.following.includes(userId)) {
    return res.status(400).json({ message: 'Already following this user' });
  }

  // Add to following list
  currentUser.following.push(userId);
  currentUser.followingCount = currentUser.following.length;
  
  // Add to target user's followers
  userToFollow.followers.push(currentUserId);
  userToFollow.followersCount = userToFollow.followers.length;

  await currentUser.save();
  await userToFollow.save();

  res.status(200).json({ message: 'Successfully followed user' });
}));

// @desc    Unfollow a user
// @route   POST /api/discover/unfollow/:userId
// @access  Private
router.post('/unfollow/:userId', protect, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  const userToUnfollow = await User.findById(userId);
  if (!userToUnfollow) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Check if following
  const currentUser = await User.findById(currentUserId);
  if (!currentUser.following.includes(userId)) {
    return res.status(400).json({ message: 'Not following this user' });
  }

  // Remove from following list
  currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
  currentUser.followingCount = currentUser.following.length;
  
  // Remove from target user's followers
  userToUnfollow.followers = userToUnfollow.followers.filter(id => id.toString() !== currentUserId.toString());
  userToUnfollow.followersCount = userToUnfollow.followers.length;

  await currentUser.save();
  await userToUnfollow.save();

  res.status(200).json({ message: 'Successfully unfollowed user' });
}));

// @desc    Get feed of followed users' content
// @route   GET /api/discover/feed
// @access  Private
router.get('/feed', protect, asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user._id).populate('following');
  const followingIds = currentUser.following.map(user => user._id);

  // Get public content from followed users
  const feedItems = await ContentItem.find({
    userId: { $in: followingIds },
    isPublic: true
  })
  .sort({ createdAt: -1 })
  .populate('userId', 'username profilePictureUrl')
  .limit(50);

  res.json(feedItems);
}));

// @desc    Get user profile with their public content
// @route   GET /api/discover/profile/:username
// @access  Public (for viewing public profiles)
router.get('/profile/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  
  const user = await User.findOne({ username })
    .select('-passwordHash -email -__v -following -followers');
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const publicContent = await ContentItem.find({
    userId: user._id,
    isPublic: true
  })
  .sort({ createdAt: -1 })
  .limit(20);

  res.json({
    user,
    content: publicContent
  });
}));

module.exports = router;
