const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    unique: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  specialRequests: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
  }],
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'stripe', 'razorpay'],
    default: 'credit_card'
  },
  paymentId: String,
  paymentDetails: mongoose.Schema.Types.Mixed,
  cancellationReason: String,
  cancelledAt: Date,
  refundAmount: Number,
  refundId: String,
  completedAt: Date,
  deliveryDate: Date,
  notes: [{
    note: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }],
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate unique booking number
bookingSchema.pre('save', async function(next) {
  if (!this.bookingNumber) {
    const prefix = 'JBN';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.bookingNumber = `${prefix}${timestamp}${random}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Add status change to history
bookingSchema.methods.addStatusHistory = function(status, note, userId) {
  this.statusHistory.push({
    status,
    note,
    updatedBy: userId,
    updatedAt: new Date()
  });
  this.status = status;
};

// Check if booking is cancellable
bookingSchema.methods.isCancellable = function() {
  const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  return this.status === 'pending' && hoursSinceCreation < 24;
};

module.exports = mongoose.model('Booking', bookingSchema);