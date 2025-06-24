const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');

const { registerUser, loginUser, getUserProfile, getAllUsers, searchUsers } = require('../controllers/userController');
const generateToken = require('../utils/generateToken'); // Correctly import generateToken
const passport = require('../config/passportConfig');
const { protect } = require('../middleware/authMiddleware');

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
router.post('/register', registerUser);

// @desc    Authenticate user & get token (login)
// @route   POST /api/users/login
// @access  Public
router.post('/login', loginUser);

// @desc    Get all users (paginated)
// @route   GET /api/users
// @access  Private
router.get('/', protect, getAllUsers);

// @desc    Search users by username or email
// @route   GET /api/users/search
// @access  Private
router.get('/search', protect, searchUsers);

// @desc    Follow a user
// @route   POST /api/users/:userId/follow
// @access  Private
router.post('/:userId/follow', protect, asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Prevent self-follow
    if (userId === currentUserId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    // Check if user exists and not already following
    const [currentUser, userToFollow] = await Promise.all([
      User.findById(currentUserId),
      User.findById(userId)
    ]);

    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following using atomic operation
    const result = await User.updateOne(
      { 
        _id: currentUserId, 
        following: { $ne: userId } 
      },
      { 
        $addToSet: { following: userId },
        $inc: { followingCount: 1 }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Update the target user's followers
    await User.updateOne(
      { _id: userId },
      { 
        $addToSet: { followers: currentUserId },
        $inc: { followersCount: 1 }
      }
    );

    // Get updated followers count
    const updatedUser = await User.findById(userId, 'followersCount');

    res.status(200).json({ 
      message: 'Successfully followed user',
      following: true,
      followersCount: updatedUser.followersCount
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ 
      message: 'Error following user',
      error: error.message 
    });
  }
}));

// @desc    Unfollow a user
// @route   DELETE /api/users/:userId/follow
// @access  Private
router.delete('/:userId/follow', protect, asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Check if user exists and is being followed
    const userToUnfollow = await User.findById(userId);
    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from following using atomic operation
    const result = await User.updateOne(
      { 
        _id: currentUserId, 
        following: userId 
      },
      { 
        $pull: { following: userId },
        $inc: { followingCount: -1 }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // Update the target user's followers
    await User.updateOne(
      { _id: userId },
      { 
        $pull: { followers: currentUserId },
        $inc: { followersCount: -1 }
      }
    );

    // Get updated followers count
    const updatedUser = await User.findById(userId, 'followersCount');

    res.status(200).json({ 
      message: 'Successfully unfollowed user',
      following: false,
      followersCount: Math.max(0, updatedUser.followersCount)
    });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ 
      message: 'Error unfollowing user',
      error: error.message 
    });
  }
}));

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, getUserProfile);

// --- Google OAuth Routes ---

// @desc    Authenticate with Google (redirects to Google)
// @route   GET /api/users/auth/google
// @access  Public
router.get('/auth/google', (req, res, next) => {
  const strategy = req.query.extension === 'true' ? 'google-extension' : 'google-web';
  const state = req.query.state || '';
  
  passport.authenticate(strategy, {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    state: state // Pass the state parameter through
  })(req, res, next);
});

// @desc    Google OAuth callback for web
// @route   GET /api/users/auth/google/callback
// @access  Public
router.get('/auth/google/callback', 
  (req, res, next) => {
    // Use the appropriate strategy based on the callback URL
    const strategy = req.originalUrl.includes('extension-callback') ? 'google-extension' : 'google-web';
    
    passport.authenticate(strategy, { 
      failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google_auth_failed`,
      session: false 
    })(req, res, next);
  },
  (req, res) => {
    const token = generateToken(req.user._id);
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Redirect to root with token as URL parameter
    // The frontend will detect the token and handle the login
    res.redirect(`${frontendUrl}/?token=${token}`);
  }
);

// @desc    Initiate Google OAuth for extension
// @route   GET /api/users/auth/google/extension
// @access  Public
router.get('/auth/google/extension', (req, res) => {
  // Generate a state parameter to prevent CSRF
  const state = Math.random().toString(36).substring(2);
  
  // Store the state in the session
  req.session.oauth2state = state;
  
  // Generate the authorization URL
  const authUrl = `http://localhost:5003/api/users/auth/google?state=${state}&extension=true`;
  
  // Return the URL to the extension
  res.json({ url: authUrl });
});

// @desc    Google OAuth callback for extension
// @route   GET /api/users/auth/google/extension-callback
// @access  Public
router.get('/auth/google/extension-callback',
  (req, res, next) => {
    // For extension, we'll verify the state parameter against the one stored in the session
    const state = req.query.state;
    
    // Get the stored state from the session
    const storedState = req.session?.oauth2state;
    
    console.log('Extension callback - State verification:', { 
      receivedState: state,
      storedState: storedState,
      sessionId: req.sessionID
    });
    
    // Verify state parameter exists and matches the one we stored
    if (!state || !storedState || state !== storedState) {
      console.error('Invalid or missing state parameter');
      // For extension, we'll redirect with an error in the URL
      const redirectUrl = new URL(process.env.CLIENT_URL || 'http://localhost:3000');
      redirectUrl.searchParams.append('error', 'invalid_state');
      return res.redirect(redirectUrl.toString());
    }
    
    // State is valid, continue with authentication
    next();
  },
  (req, res, next) => {
    // Use the google-extension strategy
    passport.authenticate('google-extension', {
      failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`,
      session: false
    })(req, res, next);
  },
  (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken(req.user._id);
      
      console.log('OAuth successful, generating response for extension');
      
      // For extension, we'll return a simple HTML page that will close itself and pass the token to the extension
      // This page will be opened in a popup by the extension
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 200px;
              margin: 0;
              background-color: #f5f5f5;
              color: #333;
            }
            .container {
              text-align: center;
              padding: 20px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .success-icon {
              color: #10B981;
              font-size: 48px;
              margin-bottom: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h2>Authentication Successful</h2>
            <p>You can now close this window.</p>
          </div>
          <script>
            // Send the token and user info back to the extension
            // The extension's background script will handle this message
            const userData = ${JSON.stringify({
              id: req.user._id.toString(),
              name: req.user.name || '',
              email: req.user.email || '',
              profilePictureUrl: req.user.profilePictureUrl || ''
            }).replace(/</g, '\\u003c')};
            
            // Escape single quotes in the token
            const safeToken = '${token.replace(/'/g, "\\'")}';
            
            window.opener.postMessage({
              type: 'AUTH_SUCCESS',
              token: safeToken,
              user: userData
            }, '*');
            
            // Close the window after a short delay
            setTimeout(() => {
              window.close();
            }, 1000);
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      
      // Return an error response that the extension can handle
      const errorMessage = error.message || 'An error occurred during authentication';
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              text-align: center;
            }
            .error {
              color: #DC2626;
              margin: 20px 0;
            }
            button {
              background-color: #4F46E5;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            }
            button:hover {
              background-color: #4338CA;
            }
          </style>
        </head>
        <body>
          <h2>Authentication Failed</h2>
          <p class="error">${errorMessage.replace(/'/g, "\\'")}</p>
          <p>Please try again or contact support if the issue persists.</p>
          <button onclick="window.close()">Close Window</button>
          <script>
            // Notify the extension about the error
            try {
              window.opener.postMessage({
                type: 'AUTH_ERROR',
                error: '${errorMessage.replace(/'/g, "\\'")}'
              }, '*');
            } catch (e) {
              console.error('Failed to send error to opener:', e);
            }
          </script>
        </body>
        </html>
      `;
      
      res.status(400).send(errorHtml);
    }
  }
);

module.exports = router;
