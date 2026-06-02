const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { protect } = require('../middleware/auth');

// @route   GET /api/bookings
// @desc    Get all bookings for the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      $or: [{ clientId: req.user._id }, { providerId: req.user._id }] 
    })
    .populate('serviceId', 'title price category images')
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
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('serviceId', 'title description price category images')
      .populate('clientId', 'name email phone companyName')
      .populate('providerId', 'name companyName email phone');
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check if user is authorized
    if (booking.clientId._id.toString() !== req.user._id.toString() && 
        booking.providerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }
    
    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/bookings
// @desc    Create a new booking
router.post('/', protect, async (req, res) => {
  try {
    const { serviceId, date, quantity, specialRequests, totalAmount } = req.body;
    
    // Validate service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Check if service is active
    if (!service.isActive) {
      return res.status(400).json({ error: 'This service is currently not available' });
    }
    
    // Calculate total amount if not provided
    const finalTotal = totalAmount || (service.price * (quantity || 1));
    
    // Create booking
    const booking = new Booking({
      serviceId,
      clientId: req.user._id,
      providerId: service.providerId,
      date: date || new Date(),
      quantity: quantity || 1,
      unitPrice: service.price,
      totalAmount: finalTotal,
      discountAmount: 0,
      finalAmount: finalTotal,
      specialRequests: specialRequests || '',
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
router.put('/:id', protect, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check authorization (only client or provider can update)
    if (booking.clientId.toString() !== req.user._id.toString() && 
        booking.providerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this booking' });
    }
    
    // Update fields
    if (status) {
      booking.addStatusHistory(status, `Status updated to ${status}`, req.user._id);
    }
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
router.delete('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Only client can cancel their booking
    if (booking.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the client can cancel this booking' });
    }
    
    // Check if booking is cancellable
    if (!booking.isCancellable()) {
      return res.status(400).json({ error: 'This booking cannot be cancelled at this time' });
    }
    
    // Soft delete - mark as cancelled
    booking.status = 'cancelled';
    booking.addStatusHistory('cancelled', 'Booking cancelled by client', req.user._id);
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
// @desc    Get user's own bookings (as client)
router.get('/my/bookings', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ clientId: req.user._id })
      .populate('serviceId', 'title price category images')
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
// @desc    Get bookings for user's services (as provider)
router.get('/my/services', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ providerId: req.user._id })
      .populate('serviceId', 'title price category images')
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