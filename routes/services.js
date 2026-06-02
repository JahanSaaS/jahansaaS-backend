const express = require('express');
const Service = require('../models/Service');
const { protect, authorize, checkOwnership } = require('../middleware/auth');
const { validateService } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/services
// @desc    Get all services with filters, sorting, pagination
router.get('/', async (req, res) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      minRating,
      sortBy,
      page = 1,
      limit = 12,
      featured,
      isActive = true,
      providerId
    } = req.query;

    let query = { isActive: isActive === 'true' };

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Rating filter
    if (minRating) {
      query.rating = { $gte: Number(minRating) };
    }

    // Featured filter
    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Provider filter
    if (providerId) {
      query.providerId = providerId;
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Sorting
    let sort = {};
    switch (sortBy) {
      case 'price_asc':
        sort = { finalPrice: 1 };
        break;
      case 'price_desc':
        sort = { finalPrice: -1 };
        break;
      case 'rating':
        sort = { rating: -1 };
        break;
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'popular':
        sort = { totalSales: -1, views: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Pagination
    const skip = (page - 1) * limit;
    const total = await Service.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const services = await Service.find(query)
      .populate('providerId', 'name companyName logo rating')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      services,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1
      }
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/services/featured
// @desc    Get featured services
router.get('/featured', async (req, res) => {
  try {
    const services = await Service.find({ isFeatured: true, isActive: true })
      .populate('providerId', 'name companyName logo')
      .limit(6)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/services/:id
// @desc    Get single service by ID
router.get('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('providerId', 'name companyName email phone address bio logo socialLinks')
      .populate('reviews.userId', 'name');

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    // Increment view count
    service.views += 1;
    await service.save();

    // Get similar services
    const similarServices = await Service.find({
      category: service.category,
      _id: { $ne: service._id },
      isActive: true
    })
      .limit(4)
      .populate('providerId', 'name companyName logo');

    res.json({
      success: true,
      service,
      similarServices
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/services
// @desc    Create new service
router.post('/', protect, validateService, async (req, res) => {
  try {
    // Check subscription limits
    const userServicesCount = await Service.countDocuments({ providerId: req.user._id });
    const maxServices = req.user.subscription?.features?.maxServices || 5;

    if (userServicesCount >= maxServices && req.user.subscription?.plan === 'free') {
      return res.status(403).json({
        success: false,
        error: `You have reached your service limit (${maxServices}). Please upgrade your plan to add more services.`
      });
    }

    const service = new Service({
      ...req.body,
      providerId: req.user._id,
      status: 'published'
    });

    await service.save();

    res.status(201).json({
      success: true,
      service,
      message: 'Service created successfully'
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @route   PUT /api/services/:id
// @desc    Update service
router.put('/:id', protect, checkOwnership(Service), async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id;
    delete updates.providerId;
    delete updates.createdAt;

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      service,
      message: 'Service updated successfully'
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @route   DELETE /api/services/:id
// @desc    Delete service (soft delete)
router.delete('/:id', protect, checkOwnership(Service), async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive: false, status: 'suspended' },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Service deactivated successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/services/:id/reviews
// @desc    Add review to service
router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const { rating, title, comment } = req.body;
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    // Check if user already reviewed
    const alreadyReviewed = service.reviews.some(
      review => review.userId.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this service'
      });
    }

    const review = {
      userId: req.user._id,
      userName: req.user.name,
      rating: Number(rating),
      title,
      comment,
      createdAt: new Date()
    };

    service.reviews.push(review);
    service.calculateRating();
    await service.save();

    res.status(201).json({
      success: true,
      review,
      message: 'Review added successfully'
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;