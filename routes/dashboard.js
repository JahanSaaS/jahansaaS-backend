const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Booking = require('../models/Booking');
const Service = require('../models/Service');

// Get dashboard stats
router.get('/stats', protect, async (req, res) => {
  try {
    const totalServices = await Service.countDocuments({ providerId: req.user._id });
    const totalBookings = await Booking.countDocuments({ 
      $or: [{ clientId: req.user._id }, { providerId: req.user._id }] 
    });
    const completedBookings = await Booking.countDocuments({ 
      $or: [{ clientId: req.user._id }, { providerId: req.user._id }],
      status: 'completed'
    });
    
    res.json({
      success: true,
      stats: {
        totalServices,
        totalBookings,
        completedBookings,
        pendingBookings: totalBookings - completedBookings
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;