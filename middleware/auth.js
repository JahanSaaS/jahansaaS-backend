const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
      
      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Your account has been deactivated'
        });
      }
      
      next();
    } catch (error) {
      console.error('Auth error:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired, please login again'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Not authorized'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, no token provided'
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if user owns the resource
const checkOwnership = (model) => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params.id);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }
      
      const isOwner = resource.providerId?.toString() === req.user._id.toString() ||
                      resource.clientId?.toString() === req.user._id.toString() ||
                      resource.userId?.toString() === req.user._id.toString();
      
      if (!isOwner && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to access this resource'
        });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
};

module.exports = { protect, authorize, checkOwnership };