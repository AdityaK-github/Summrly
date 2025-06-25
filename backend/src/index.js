const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const passport = require('./config/passportConfig'); // Or just require('passport') if you init here
const session = require('express-session');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to database
connectDB();

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable CORS
// Configure CORS options as needed. For development, a simple setup is often fine.
// For production, restrict origins to your frontend's domain.
const corsOptions = {
  origin: process.env.CLIENT_URL || '*', // Allow all origins if CLIENT_URL is not set
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Session Middleware (required for Passport session, even if using JWTs for client auth after OAuth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'averysecretkeyfordev',
  resave: false,
  saveUninitialized: false, // Changed to false, common practice
  // cookie: { secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session()); // For persistent login sessions, works with serialize/deserializeUser

// Basic route for testing
app.get('/', (req, res) => {
  res.send('Summrly API is running...');
});

// Define Routes
const userRoutes = require('./routes/userRoutes');
const contentItemRoutes = require('./routes/contentItemRoutes');
const discoverRoutes = require('./routes/discoverRoutes');
const userDiscoveryRoutes = require('./routes/userDiscoveryRoutes');
const feedRoutes = require('./routes/feedRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

app.use('/api/users', userRoutes);
app.use('/api/contentitems', contentItemRoutes);
app.use('/api/content/discover', discoverRoutes);
app.use('/api/discover', userDiscoveryRoutes);
app.use('/api/feed', feedRoutes);

// Error Handling Middleware
// Should be after all your routes
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5003; // Fallback port if not defined in .env

const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
