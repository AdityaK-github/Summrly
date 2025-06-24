const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400);
    throw new Error('Please add all fields: username, email, password');
  }

  // Check if user with email already exists
  const userExistsByEmail = await User.findOne({ email });
  if (userExistsByEmail) {
    res.status(400);
    throw new Error('User with this email already exists');
  }

  // Check if user with username already exists
  const userExistsByUsername = await User.findOne({ username });
  if (userExistsByUsername) {
    res.status(400);
    throw new Error('Username is already taken');
  }

  // Create user - password will be hashed by the pre-save hook in userModel
  const user = await User.create({
    username,
    email,
    passwordHash: password, // Pass the plain password here, model will hash it
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Authenticate user & get token (login)
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  // Find user by email and explicitly select the passwordHash
  const user = await User.findOne({ email }).select('+passwordHash');

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      token: generateToken(user._id),
    });
  } else {
    res.status(401); // Unauthorized
    throw new Error('Invalid email or password');
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
// @desc    Get all users (paginated)
// @route   GET /api/users
// @access  Private
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const users = await User.find({ _id: { $ne: req.user._id } })
    .select('-passwordHash -__v')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments({ _id: { $ne: req.user._id } });

  res.json({
    users,
    page,
    pages: Math.ceil(total / limit),
    total,
  });
});

// @desc    Search users by username or email
// @route   GET /api/users/search
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const { query } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    res.status(400);
    throw new Error('Please provide a valid search query');
  }

  // Split the search query into individual terms
  const searchTerms = query.trim().split(/\s+/).filter(term => term.length > 0);
  
  // Create a search string with each term wrapped in quotes for exact matching
  // and add fuzzy search with ~ to each term
  const searchString = searchTerms
    .map(term => `"${term}" ${term}~`)
    .join(' ');

  // First, try text search with the full query for best matches
  const searchQuery = {
    $and: [
      { _id: { $ne: req.user._id } },
      { $text: { $search: searchString } }
    ]
  };

  // If no results from text search, fall back to regex search
  let users = await User.find(searchQuery)
    .select('-passwordHash -__v')
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit);

  let total = await User.countDocuments(searchQuery);

  // Fallback to regex search if no results from text search
  if (users.length === 0) {
    const searchRegex = new RegExp(searchTerms.join('|'), 'i');
    const regexQuery = {
      _id: { $ne: req.user._id },
      $or: [
        { username: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { name: { $regex: searchRegex } }
      ]
    };

    users = await User.find(regexQuery)
      .select('-passwordHash -__v')
      .sort({ username: 1 })
      .skip(skip)
      .limit(limit);

    total = await User.countDocuments(regexQuery);
  }

  res.json({
    users,
    page,
    pages: Math.ceil(total / limit),
    total,
  });
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  // req.user is set by the protect middleware
  if (req.user) {
    res.json({
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      profilePictureUrl: req.user.profilePictureUrl,
      bio: req.user.bio,
      followersCount: req.user.followersCount,
      followingCount: req.user.followingCount,
      // Do not send the token again here, it's for login/register
    });
  } else {
    // This case should ideally not be reached if protect middleware is working correctly
    res.status(404);
    throw new Error('User not found');
  }
});

module.exports = { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  getAllUsers,
  searchUsers,
};
