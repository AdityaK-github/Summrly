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

module.exports = { registerUser, loginUser, getUserProfile };
