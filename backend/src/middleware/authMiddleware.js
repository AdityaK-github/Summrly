const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header (Bearer tokenstring)
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token payload (id) and attach to request object
      // Exclude passwordHash from being returned with the user object
      req.user = await User.findById(decoded.id).select('-passwordHash');

      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      console.error('Token verification failed:', error.message);
      res.status(401);
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Not authorized, token failed (invalid signature)');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Not authorized, token expired');
      } else {
        throw new Error('Not authorized, token failed');
      }
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

module.exports = { protect };
