const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://jahansaaS.com', 'https://www.jahansaaS.com', 'https://jahansaaS-frontend.vercel.app'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  // Don't exit process on MongoDB connection error in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Helper function to safely load routes
function loadRoute(routePath, routeName) {
  try {
    const route = require(routePath);
    if (route && typeof route === 'function') {
      console.log(`✅ ${routeName} loaded successfully`);
      return route;
    } else {
      console.error(`❌ ${routeName} is not a valid function (type: ${typeof route})`);
      return null;
    }
  } catch (err) {
    console.error(`❌ Failed to load ${routeName}:`, err.message);
    return null;
  }
}

// Routes with error handling
const authRoutes = loadRoute('./routes/auth', 'Auth routes');
const serviceRoutes = loadRoute('./routes/services', 'Service routes');
const bookingRoutes = loadRoute('./routes/bookings', 'Booking routes');
const contactRoutes = loadRoute('./routes/contact', 'Contact routes');

// Apply routes only if they are valid
if (authRoutes) app.use('/api/auth', authRoutes);
if (serviceRoutes) app.use('/api/services', serviceRoutes);
if (bookingRoutes) app.use('/api/bookings', bookingRoutes);
if (contactRoutes) app.use('/api/contact', contactRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to JahanSaaS API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      services: '/api/services',
      bookings: '/api/bookings',
      contact: '/api/contact'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});