const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Service = require('../models/Service'); // Moved outside to avoid circular dependency
const auth = require('../middleware/auth');

// @route   GET /api/bookings
// @desc    Get all bookings for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      $or: [{ clientId: req.userId }, { providerId: req.userId }] 
    })
    .populate('serviceId', 'title price category')
    .populate('clientId', 'name email companyName')
    .populate('providerId', 'name companyName')
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      bookings,
      count: bookings.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('serviceId', 'title description price category images')
      .populate('clientId', 'name email phone companyName')
      .populate('providerId', 'name companyName email phone');
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check if user is authorized to view this booking
    if (booking.clientId._id.toString() !== req.userId && 
        booking.providerId._id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }
    
    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/bookings
// @desc    Create a new booking
router.post('/', auth, async (req, res) => {
  try {
    const { serviceId, date, quantity, specialRequests, totalAmount } = req.body;
    
    // Get service to find providerId
    const service = await Service.findById(serviceId);
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const booking = new Booking({
      serviceId,
      clientId: req.userId,
      providerId: service.providerId,
      date: date || new Date(),
      quantity: quantity || 1,
      specialRequests,
      totalAmount: totalAmount || service.price * (quantity || 1),
      status: 'pending',
      paymentStatus: 'pending'
    });
    
    await booking.save();
    
    // Populate the saved booking
    await booking.populate('serviceId', 'title price');
    await booking.populate('clientId', 'name email');
    
    res.status(201).json({
      success: true,
      booking,
      message: 'Booking created successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/bookings/:id
// @desc    Update booking status
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check authorization (only client or provider can update)
    if (booking.clientId.toString() !== req.userId && 
        booking.providerId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to update this booking' });
    }
    
    // Update fields
    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;
    
    await booking.save();
    
    res.json({
      success: true,
      booking,
      message: 'Booking updated successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/bookings/:id
// @desc    Cancel/Delete booking
router.delete('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Only client can cancel their booking
    if (booking.clientId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only the client can cancel this booking' });
    }
    
    // Soft delete - just mark as cancelled
    booking.status = 'cancelled';
    await booking.save();
    
    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bookings/my/bookings
// @desc    Get user's own bookings (client)
router.get('/my/bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ clientId: req.userId })
      .populate('serviceId', 'title price category')
      .populate('providerId', 'name companyName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      bookings,
      count: bookings.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/bookings/my/services
// @desc    Get bookings for user's services (provider)
router.get('/my/services', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ providerId: req.userId })
      .populate('serviceId', 'title price category')
      .populate('clientId', 'name email companyName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      bookings,
      count: bookings.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;