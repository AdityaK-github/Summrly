const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

// Function to create Google strategy with dynamic callback URL
const createGoogleStrategy = (callbackURL) => {
  return new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL,
    scope: ['profile', 'email'],
    passReqToCallback: true // Pass the request to the callback function
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      // profile object contains user information from Google
      const { id, displayName, emails, photos } = profile;
      const email = emails && emails.length > 0 ? emails[0].value : null;

      if (!email) {
        return done(new Error('Email not provided by Google'), null);
      }

      let user = await User.findOne({ googleId: id });

      if (user) {
        // User already exists with this Google ID
        return done(null, user);
      } else {
        // Check if user exists with this email (e.g., signed up traditionally before)
        user = await User.findOne({ email: email });
        if (user) {
          // User exists with this email, link Google ID
          user.googleId = id;
          // Optionally update profile picture or username if empty
          if (!user.profilePictureUrl && photos && photos.length > 0) {
            user.profilePictureUrl = photos[0].value;
          }
          if (!user.username && displayName) {
              user.username = displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
          }
          await user.save();
          return done(null, user);
        } else {
          // New user: Create user with Google profile info
          const newUsername = displayName ? displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000) : `user${Date.now()}`;
          const newUser = new User({
            googleId: id,
            email: email,
            username: newUsername, // Create a simple unique username
            profilePictureUrl: photos && photos.length > 0 ? photos[0].value : '',
            // Password is not set for Google OAuth users
          });
          await newUser.save();
          return done(null, newUser);
        }
      }
    } catch (error) {
      return done(error, null);
    }
  });
};

// Create strategies for web and extension
passport.use('google-web', createGoogleStrategy('/api/users/auth/google/callback'));
passport.use('google-extension', createGoogleStrategy('/api/users/auth/google/extension-callback'));

// Serialize user to store in session (just the ID)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session (fetch user by ID)
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
