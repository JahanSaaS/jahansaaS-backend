const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: String,
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: String,
  comment: {
    type: String,
    required: true,
    maxlength: 500
  },
  images: [String],
  helpful: [{
    userId: mongoose.Schema.Types.ObjectId,
    votedAt: Date
  }],
  reported: [{
    userId: mongoose.Schema.Types.ObjectId,
    reason: String,
    reportedAt: Date
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const serviceSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a service title'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [150, 'Short description cannot exceed 150 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please provide a price'],
    min: [0, 'Price cannot be negative']
  },
  discountPrice: {
    type: Number,
    min: 0,
    validate: {
      validator: function(value) {
        return !value || value < this.price;
      },
      message: 'Discount price must be less than regular price'
    }
  },
  category: {
    type: String,
    enum: ['education', 'medical', 'business'],
    required: true
  },
  subcategory: {
    type: String,
    enum: [
      // Education
      'school_management', 'student_tracking', 'fee_management', 'online_classes', 'exam_management',
      // Medical
      'inventory_management', 'prescription_management', 'patient_records', 'billing_system',
      // Business
      'hr_management', 'payroll_system', 'attendance_tracking', 'performance_management', 'crm'
    ]
  },
  location: {
    type: String,
    trim: true
  },
  features: [{
    name: String,
    included: { type: Boolean, default: true }
  }],
  requirements: [String],
  faqs: [{
    question: String,
    answer: String
  }],
  images: [{
    url: String,
    publicId: String,
    isMain: { type: Boolean, default: false }
  }],
  videoUrl: String,
  tags: [String],
  deliveryTime: {
    min: Number,
    max: Number,
    unit: { type: String, enum: ['hours', 'days', 'weeks'], default: 'days' }
  },
  revisions: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  reviews: [reviewSchema],
  totalReviews: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'published', 'suspended'],
    default: 'draft'
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug from title
serviceSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  this.updatedAt = Date.now();
  next();
});

// Calculate average rating
serviceSchema.methods.calculateRating = function() {
  if (this.reviews.length === 0) {
    this.rating = 0;
    this.ratingCount = 0;
  } else {
    const total = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = total / this.reviews.length;
    this.ratingCount = this.reviews.length;
  }
  return this.rating;
};

// Virtual for final price
serviceSchema.virtual('finalPrice').get(function() {
  return this.discountPrice && this.discountPrice < this.price ? this.discountPrice : this.price;
});

// Indexes for search
serviceSchema.index({ title: 'text', description: 'text', tags: 'text' });
serviceSchema.index({ category: 1, price: 1 });
serviceSchema.index({ rating: -1 });
serviceSchema.index({ totalSales: -1 });

module.exports = mongoose.model('Service', serviceSchema);