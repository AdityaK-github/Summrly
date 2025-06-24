const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: function() { return !this.googleId && !this.isNew; }, // Username required if not Google sign-up and not a new doc (for updates)
    // For new Google users, username might be set from Google profile or prompted later
    // For existing users being updated, this allows username to remain as is if not modified.
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please add a valid email']
  },
  passwordHash: {
    type: String,
    required: function() { return !this.googleId; }, // Password required only if not signing up with Google
    select: false // Do not return password by default when querying users
  },
  profilePictureUrl: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],
  followersCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  contentItemsCount: { type: Number, default: 0 }, // Number of content items user has created
  summariesCreatedCount: { type: Number, default: 0 }, // Number of summaries generated for the user's items
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows multiple documents to have a null/missing googleId
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Pre-save hook to hash password before saving a new user
// Note: Using a regular function here to ensure 'this' refers to the document
userSchema.pre('save', async function (next) {
  // Only hash the password if it's present and has been modified (or is new)
  if (!this.passwordHash || !this.isModified('passwordHash')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare entered password with hashed password in DB
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Create indexes
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ name: 1 }); // Add index for name field for search

// Create a compound sparse index to prevent duplicate follows
userSchema.index(
  { _id: 1, following: 1 },
  { unique: true, sparse: true }
);

// Create a text index for fuzzy search
userSchema.index(
  { 
    username: 'text',
    email: 'text',
    name: 'text' 
  },
  {
    weights: {
      username: 3,    // Highest weight to username
      name: 2,        // Medium weight to name
      email: 1        // Lower weight to email
    },
    name: 'user_search_index',
    default_language: 'english',
    language_override: 'search_language'
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
