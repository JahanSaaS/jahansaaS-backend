const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const auth = require('../middleware/auth');

// @route   GET /api/services
// @desc    Get all services with filters
router.get('/', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, featured, limit = 10, page = 1 } = req.query;
    
    let query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (featured === 'true') {
      query.isFeatured = true;
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    const skip = (page - 1) * limit;
    
    const services = await Service.find(query)
      .populate('providerId', 'name companyName logo rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Service.countDocuments(query);
    
    res.json({
      success: true,
      services,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/services/:id
// @desc    Get single service
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('providerId', 'name companyName logo phone email rating');
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Increment views
    service.views += 1;
    await service.save();
    
    res.json({ success: true, service });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/services
// @desc    Create new service
router.post('/', auth, async (req, res) => {
  try {
    const service = new Service({
      ...req.body,
      providerId: req.userId
    });
    
    await service.save();
    res.status(201).json({ success: true, service });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/services/:id
// @desc    Update service
router.put('/:id', auth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    if (service.providerId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to update this service' });
    }
    
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json({ success: true, service: updatedService });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/services/:id
// @desc    Delete service
router.delete('/:id', auth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    if (service.providerId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this service' });
    }
    
    await service.deleteOne();
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;