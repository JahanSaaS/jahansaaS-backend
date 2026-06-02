const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
  hsts: false
}));

// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      process.env.CLIENT_URL_PROD,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://jahansaaS.vercel.app',
      'https://jahansaaS.com'
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(null, true); // Allow in development
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' // Skip rate limiting for health check
});
app.use('/api/', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per 15 minutes
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});
app.use('/api/auth/', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection with retry logic
let isConnected = false;

const connectDB = async (retryCount = 0) => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 2
    });
    
    isConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🔗 Host: ${mongoose.connection.host}`);
    console.log(`📈 Pool Size: ${mongoose.connection.options.maxPoolSize}`);
  } catch (error) {
    isConnected = false;
    console.error(`❌ MongoDB Connection Error (attempt ${retryCount + 1}):`, error.message);
    
    if (retryCount < 5) {
      const delay = Math.min(5000 * Math.pow(2, retryCount), 30000);
      console.log(`Retrying connection in ${delay / 1000} seconds...`);
      setTimeout(() => connectDB(retryCount + 1), delay);
    } else {
      console.error('Failed to connect to MongoDB after 5 attempts');
      console.error('Please check your MongoDB URI and network connectivity');
      process.exit(1);
    }
  }
};

// Connect to MongoDB
connectDB();

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
  if (!isConnected) {
    console.log('Attempting to reconnect...');
    setTimeout(connectDB, 5000);
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
  isConnected = false;
});

// Import Routes with error handling
let authRoutes, serviceRoutes, bookingRoutes, contactRoutes, dashboardRoutes, adminRoutes, userRoutes, paymentRoutes;

try {
  authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
  authRoutes = (req, res) => res.status(500).json({ error: 'Auth routes not available' });
}

try {
  serviceRoutes = require('./routes/services');
  console.log('✅ Service routes loaded');
} catch (error) {
  console.error('❌ Failed to load service routes:', error.message);
  serviceRoutes = (req, res) => res.status(500).json({ error: 'Service routes not available' });
}

try {
  bookingRoutes = require('./routes/bookings');
  console.log('✅ Booking routes loaded');
} catch (error) {
  console.error('❌ Failed to load booking routes:', error.message);
  bookingRoutes = (req, res) => res.status(500).json({ error: 'Booking routes not available' });
}

try {
  contactRoutes = require('./routes/contact');
  console.log('✅ Contact routes loaded');
} catch (error) {
  console.error('❌ Failed to load contact routes:', error.message);
  contactRoutes = (req, res) => res.status(500).json({ error: 'Contact routes not available' });
}

try {
  dashboardRoutes = require('./routes/dashboard');
  console.log('✅ Dashboard routes loaded');
} catch (error) {
  console.error('❌ Failed to load dashboard routes:', error.message);
  dashboardRoutes = (req, res) => res.status(500).json({ error: 'Dashboard routes not available' });
}

// Optional routes (create placeholder if not exists)
try {
  adminRoutes = require('./routes/admin');
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.log('⚠️ Admin routes not found, creating placeholder');
  adminRoutes = (req, res) => res.status(501).json({ error: 'Admin routes not implemented yet' });
}

try {
  userRoutes = require('./routes/users');
  console.log('✅ User routes loaded');
} catch (error) {
  console.log('⚠️ User routes not found, creating placeholder');
  userRoutes = (req, res) => res.status(501).json({ error: 'User routes not implemented yet' });
}

try {
  paymentRoutes = require('./routes/payments');
  console.log('✅ Payment routes loaded');
} catch (error) {
  console.log('⚠️ Payment routes not found, creating placeholder');
  paymentRoutes = (req, res) => res.status(501).json({ error: 'Payment routes not implemented yet' });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mongodbState: mongoose.STATES[mongoose.connection.readyState],
    memory: process.memoryUsage(),
    version: process.version,
    routes: {
      auth: '/api/auth',
      services: '/api/services',
      bookings: '/api/bookings',
      contact: '/api/contact',
      dashboard: '/api/dashboard'
    }
  };
  
  const statusCode = mongoose.connection.readyState === 1 ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'JahanSaaS API',
    version: '2.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV,
    documentation: '/api/health',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me'
      },
      services: {
        list: 'GET /api/services',
        detail: 'GET /api/services/:id',
        create: 'POST /api/services',
        update: 'PUT /api/services/:id',
        delete: 'DELETE /api/services/:id'
      },
      bookings: {
        list: 'GET /api/bookings',
        detail: 'GET /api/bookings/:id',
        create: 'POST /api/bookings',
        update: 'PUT /api/bookings/:id',
        cancel: 'DELETE /api/bookings/:id'
      },
      contact: {
        send: 'POST /api/contact'
      },
      dashboard: {
        stats: 'GET /api/dashboard/stats'
      }
    }
  });
});

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    status: 404,
    timestamp: new Date().toISOString()
  });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  console.error('Global Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errors,
      status: 400
    });
  }
  
  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      error: `Duplicate value for ${field}. Please use a different value.`,
      status: 400
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      status: 401
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      status: 401
    });
  }
  
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json({
    success: false,
    error: message,
    status,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} signal received: closing HTTP server`);
  
  // Close server first
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
      }
    }
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('Uncaught Exception');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('Unhandled Rejection');
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📡 Root Endpoint: http://localhost:${PORT}/\n`);
});

module.exports = { app, server };