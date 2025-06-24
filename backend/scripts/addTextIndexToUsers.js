const mongoose = require('mongoose');
const User = require('../src/models/userModel');

// Default local MongoDB connection string
const LOCAL_MONGO_URI = 'mongodb://localhost:27017/summrly';

// Use environment variable or fall back to local MongoDB
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || LOCAL_MONGO_URI;

console.log('Using MongoDB URI:', mongoUri);

async function addTextIndex() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    
    // Create the text index
    await User.collection.createIndex(
      { 
        username: 'text',
        email: 'text',
        name: 'text' 
      },
      {
        name: 'user_search_index',
        weights: {
          username: 3,
          name: 2,
          email: 1
        },
        default_language: 'english',
        language_override: 'search_language'
      }
    );
    
    console.log('Successfully created text index on users collection');
    process.exit(0);
  } catch (error) {
    console.error('Error creating text index:', error);
    process.exit(1);
  }
}

addTextIndex();
