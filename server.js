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

// Check memory at startup
const totalMemory = require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024;
console.log(`📊 Heap limit: ${totalMemory} MB`);
if (totalMemory < 1024) {
  console.warn('⚠️ Low memory limit! Consider increasing node memory limit');
}

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
    
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};
app.use(cors(corsOptions));

// Memory monitoring middleware
app.use((req, res, next) => {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  
  if (heapUsedMB > 400) {
    console.warn(`⚠️ High memory usage: ${heapUsedMB.toFixed(2)} MB`);
  }
  
  // Set timeouts to prevent hanging requests
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health'
});
app.use('/api/', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});
app.use('/api/auth/', authLimiter);

// Body parsing middleware with limits
app.use(express.json({ limit: '5mb' })); // Reduced from 10mb
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection with optimized settings
let isConnected = false;

const connectDB = async (retryCount = 0) => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000, // Reduced from 45000
      family: 4,
      maxPoolSize: 5, // Reduced from 10
      minPoolSize: 1, // Reduced from 2
      maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
      heartbeatFrequencyMS: 10000,
      connectTimeoutMS: 10000
    });
    
    isConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🔗 Host: ${mongoose.connection.host}`);
    console.log(`📈 Pool Size: ${mongoose.connection.options.maxPoolSize}`);
  } catch (error) {
    isConnected = false;
    console.error(`❌ MongoDB Connection Error (attempt ${retryCount + 1}):`, error.message);
    
    if (retryCount < 3) { // Reduced from 5
      const delay = Math.min(5000 * Math.pow(2, retryCount), 15000);
      console.log(`Retrying connection in ${delay / 1000} seconds...`);
      setTimeout(() => connectDB(retryCount + 1), delay);
    } else {
      console.error('Failed to connect to MongoDB after 3 attempts');
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
    setTimeout(() => connectDB(0), 5000);
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

// Optional routes
try {
  adminRoutes = require('./routes/admin');
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.log('⚠️ Admin routes not found');
  adminRoutes = (req, res) => res.status(501).json({ error: 'Admin routes not implemented yet' });
}

try {
  userRoutes = require('./routes/users');
  console.log('✅ User routes loaded');
} catch (error) {
  console.log('⚠️ User routes not found');
  userRoutes = (req, res) => res.status(501).json({ error: 'User routes not implemented yet' });
}

try {
  paymentRoutes = require('./routes/payments');
  console.log('✅ Payment routes loaded');
} catch (error) {
  console.log('⚠️ Payment routes not found');
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
  const memoryUsage = process.memoryUsage();
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mongodbState: mongoose.STATES[mongoose.connection.readyState],
    memory: {
      heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      rss: (memoryUsage.rss / 1024 / 1024).toFixed(2) + ' MB'
    },
    version: process.version
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
    memory: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    status: 404,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global Error:', {
    message: err.message,
    url: req.url,
    method: req.method
  });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errors.slice(0, 5), // Limit error details
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
    status
  });
});

// Graceful shutdown
let server = null;

const gracefulShutdown = async (signal) => {
  console.log(`${signal} signal received: closing HTTP server`);
  
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed');
      
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
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// FIXED: Handle uncaught exceptions - DON'T shutdown, just log
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  // Don't exit - keep the server running
});

// FIXED: Handle unhandled rejections - DON'T shutdown, just log
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't call gracefulShutdown here - just log and continue
});

// Start server
const PORT = process.env.PORT || 5000;
server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📡 Root Endpoint: http://localhost:${PORT}/\n`);
  console.log(`💾 Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
});

module.exports = { app, server };