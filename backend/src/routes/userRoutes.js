const express = require('express');
const router = express.Router();

const { registerUser, loginUser, getUserProfile } = require('../controllers/userController');
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
      failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`,
      session: false 
    })(req, res, next);
  },
  (req, res) => {
    const token = generateToken(req.user._id);
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/success?token=${token}`);
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
    // Verify the state parameter
    if (!req.query.state || !req.session || req.query.state !== req.session.oauth2state) {
      return res.status(400).send('Invalid state parameter');
    }
    next();
  },
  (req, res, next) => {
    // Use the extension strategy
    passport.authenticate('google-extension', { 
      failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`,
      session: false 
    })(req, res, next);
  },
  (req, res) => {
    // Generate a JWT token
    const token = generateToken(req.user._id);
    
    // Create a simple HTML page that will close itself and send the token to the extension
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful - Summrly</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
          }
          .success-message {
            margin: 20px 0;
            color: #2e7d32;
          }
        </style>
      </head>
      <body>
        <h2>Authentication Successful</h2>
        <p class="success-message">You have successfully logged in to Summrly.</p>
        <p>You can close this window and return to the extension.</p>
        <script>
          // Send the token to the extension and close the window
          window.opener.postMessage({
            type: 'SUMMRLY_AUTH_SUCCESS',
            token: '${token}'
          }, '*');
          
          // Close the window after a short delay
          setTimeout(() => window.close(), 1000);
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  }
);

// @desc    Google OAuth callback for extension
// @route   GET /api/users/auth/google/extension-callback
// @access  Public
router.get('/auth/google/extension-callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`,
    session: false
  }),
  (req, res) => {
    const token = generateToken(req.user._id);
    
    // For extension, we'll return a simple HTML page that will close itself and pass the token to the extension
    res.send(`
      <html>
        <head>
          <title>Authentication Successful</title>
          <script>
            // Send the token to the extension and close the window
            window.opener.postMessage({
              type: 'AUTH_SUCCESS',
              token: '${token}'
            }, '*');
            window.close();
          </script>
        </head>
        <body>
          <p>Authentication successful! You can close this window.</p>
        </body>
      </html>
    `);
  }
);

module.exports = router;
