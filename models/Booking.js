const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service ID is required']
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client ID is required']
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Provider ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Booking date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date();
      },
      message: 'Booking date cannot be in the past'
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  finalAmount: {
    type: Number,
    required: true,
    min: [0, 'Final amount cannot be negative']
  },
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters'],
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'],
      message: 'Invalid status value'
    },
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded']
    },
    note: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'failed', 'refunded', 'partial'],
      message: 'Invalid payment status'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'stripe', 'razorpay', 'cash'],
      message: 'Invalid payment method'
    },
    default: 'credit_card'
  },
  paymentId: {
    type: String,
    trim: true
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  refundAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  refundId: {
    type: String,
    trim: true
  },
  refundedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deliveryDate: {
    type: Date
  },
  notes: [{
    note: {
      type: String,
      required: true,
      trim: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  },
  reminderCount: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    trim: true,
    maxlength: [1000, 'Review cannot exceed 1000 characters']
  },
  reviewedAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
bookingSchema.index({ bookingNumber: 1 });
bookingSchema.index({ clientId: 1, createdAt: -1 });
bookingSchema.index({ providerId: 1, createdAt: -1 });
bookingSchema.index({ serviceId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ createdAt: -1 });

// Virtual for duration until booking
bookingSchema.virtual('timeUntilBooking').get(function() {
  const now = new Date();
  const bookingDate = new Date(this.date);
  const diffMs = bookingDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for isPastBooking
bookingSchema.virtual('isPastBooking').get(function() {
  return new Date(this.date) < new Date();
});

// Virtual for canBeCancelled
bookingSchema.virtual('canBeCancelled').get(function() {
  const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  return ['pending', 'confirmed'].includes(this.status) && hoursSinceCreation < 24 && !this.isPastBooking;
});

// Virtual for canBeReviewed
bookingSchema.virtual('canBeReviewed').get(function() {
  return this.status === 'completed' && !this.rating && this.isPastBooking;
});

// Pre-save middleware
bookingSchema.pre('save', async function(next) {
  // Generate unique booking number if not exists
  if (!this.bookingNumber) {
    const generateUniqueNumber = async () => {
      const prefix = 'JBN';
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const timestamp = Date.now().toString().slice(-6);
      
      let bookingNum = `${prefix}${year}${month}${day}${timestamp}${random}`;
      
      // Check for uniqueness
      const existing = await mongoose.model('Booking').findOne({ bookingNumber: bookingNum });
      if (existing) {
        return generateUniqueNumber();
      }
      return bookingNum;
    };
    
    this.bookingNumber = await generateUniqueNumber();
  }
  
  // Calculate final amount if discount applied
  if (this.discountAmount > 0) {
    this.finalAmount = this.totalAmount - this.discountAmount;
  } else {
    this.finalAmount = this.totalAmount;
  }
  
  // Ensure final amount is not negative
  if (this.finalAmount < 0) {
    this.finalAmount = 0;
  }
  
  this.updatedAt = Date.now();
  next();
});

// Pre-validate middleware
bookingSchema.pre('validate', function(next) {
  // Ensure unit price matches service price if not set
  if (this.unitPrice === undefined && this.serviceId) {
    // This will be handled in the route
  }
  next();
});

// Methods
bookingSchema.methods.addStatusHistory = function(status, note, userId) {
  if (!status) return;
  
  this.statusHistory.push({
    status: status,
    note: note || `Status changed to ${status}`,
    updatedBy: userId,
    updatedAt: new Date()
  });
  this.status = status;
  
  // Handle specific status changes
  if (status === 'cancelled') {
    this.cancelledAt = new Date();
    if (note) this.cancellationReason = note;
    if (userId) this.cancelledBy = userId;
  }
  
  if (status === 'completed') {
    this.completedAt = new Date();
    if (userId) this.completedBy = userId;
  }
  
  if (status === 'refunded') {
    this.refundedAt = new Date();
  }
};

bookingSchema.methods.isCancellable = function() {
  const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  const isPendingOrConfirmed = ['pending', 'confirmed'].includes(this.status);
  const isNotPast = new Date(this.date) > new Date();
  return isPendingOrConfirmed && hoursSinceCreation < 24 && isNotPast;
};

bookingSchema.methods.addNote = async function(note, userId) {
  if (!note || !userId) return false;
  
  this.notes.push({
    note: note,
    addedBy: userId,
    addedAt: new Date()
  });
  
  await this.save();
  return true;
};

bookingSchema.methods.addReview = async function(rating, review, userId) {
  if (!rating || rating < 1 || rating > 5) return false;
  if (this.clientId.toString() !== userId.toString()) return false;
  if (this.status !== 'completed') return false;
  if (this.rating) return false; // Already reviewed
  
  this.rating = rating;
  this.review = review;
  this.reviewedAt = new Date();
  
  await this.save();
  
  // Update service rating
  const Service = mongoose.model('Service');
  const service = await Service.findById(this.serviceId);
  if (service) {
    const allRatings = await mongoose.model('Booking').aggregate([
      { $match: { serviceId: service._id, rating: { $exists: true } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    
    if (allRatings.length > 0) {
      service.rating = allRatings[0].avgRating;
      service.ratingCount = allRatings[0].count;
      await service.save();
    }
  }
  
  return true;
};

bookingSchema.methods.sendReminder = async function() {
  this.reminderSent = true;
  this.reminderSentAt = new Date();
  this.reminderCount += 1;
  await this.save();
  return true;
};

bookingSchema.methods.processPayment = async function(paymentId, paymentDetails) {
  this.paymentId = paymentId;
  this.paymentDetails = paymentDetails;
  this.paymentStatus = 'paid';
  this.status = 'confirmed';
  this.addStatusHistory('confirmed', 'Payment received and booking confirmed', this.clientId);
  await this.save();
  return true;
};

bookingSchema.methods.processRefund = async function(refundId, refundAmount, reason) {
  this.refundId = refundId;
  this.refundAmount = refundAmount;
  this.paymentStatus = 'refunded';
  this.status = 'refunded';
  this.cancellationReason = reason;
  this.addStatusHistory('refunded', `Refund processed: ${reason}`, this.clientId);
  await this.save();
  return true;
};

// Static methods
bookingSchema.statics.getUserBookings = async function(userId, role = 'client') {
  const query = role === 'client' ? { clientId: userId } : { providerId: userId };
  return this.find(query)
    .populate('serviceId', 'title price category images')
    .populate('clientId', 'name email companyName')
    .populate('providerId', 'name companyName')
    .sort({ createdAt: -1 });
};

bookingSchema.statics.getBookingStats = async function(userId, role = 'client') {
  const query = role === 'client' ? { clientId: userId } : { providerId: userId };
  
  const stats = await this.aggregate([
    { $match: query },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalAmount: { $sum: '$finalAmount' }
    }}
  ]);
  
  const totalBookings = await this.countDocuments(query);
  const totalSpent = await this.aggregate([
    { $match: { ...query, paymentStatus: 'paid' } },
    { $group: { _id: null, total: { $sum: '$finalAmount' } } }
  ]);
  
  return {
    totalBookings,
    totalSpent: totalSpent[0]?.total || 0,
    byStatus: stats,
    pending: stats.find(s => s._id === 'pending')?.count || 0,
    confirmed: stats.find(s => s._id === 'confirmed')?.count || 0,
    completed: stats.find(s => s._id === 'completed')?.count || 0,
    cancelled: stats.find(s => s._id === 'cancelled')?.count || 0
  };
};

// Export the model
module.exports = mongoose.model('Booking', bookingSchema);