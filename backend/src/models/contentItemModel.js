const mongoose = require('mongoose');

const contentItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Content item must belong to a user'],
    index: true
  },
  type: {
    type: String,
    enum: ['article', 'video'],
    required: [true, 'Please specify the content type (article or video)'],
    index: true
  },
  originalUrl: {
    type: String,
    required: [true, 'Please add the original URL'],
    trim: true,
    // Consider adding a regex for URL validation if needed
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true
  },
  summary: {
    type: String // LLM generated, will be optional for now
  },
  sourceDomain: {
    type: String,
    trim: true
    // This could be automatically extracted from originalUrl on save
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    index: true
  }],
  isPublic: {
    type: Boolean,
    default: true,
    index: true
  },
  consumedAt: {
    type: Date,
    default: Date.now // Timestamp when the user logged/consumed this item
  },
  llmEngineUsed: {
    type: String
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  commentsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Compound index to prevent a user from adding the same URL multiple times
contentItemSchema.index({ userId: 1, originalUrl: 1 }, { unique: true });

// Pre-save hook to extract sourceDomain from originalUrl if not provided
contentItemSchema.pre('save', function(next) {
  if (this.isModified('originalUrl') || !this.sourceDomain) {
    try {
      const url = new URL(this.originalUrl);
      this.sourceDomain = url.hostname.replace(/^www\./, ''); // Remove 'www.' if present
    } catch (error) {
      // If URL is invalid, don't set sourceDomain or let validation handle it
      // console.warn('Could not parse URL to extract domain:', this.originalUrl);
    }
  }
  next();
});

const ContentItem = mongoose.model('ContentItem', contentItemSchema);

module.exports = ContentItem;
