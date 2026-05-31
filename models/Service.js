const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  providerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { 
    type: String, 
    required: [true, 'Please provide service title'],
    trim: true 
  },
  description: { 
    type: String, 
    required: [true, 'Please provide description'] 
  },
  shortDescription: {
    type: String,
    maxlength: 150
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: Number,
  category: { 
    type: String, 
    enum: ['education', 'medical', 'business'],
    required: true 
  },
  subcategory: String,
  images: [String],
  features: [String],
  location: String,
  availability: {
    isAvailable: { type: Boolean, default: true },
    schedule: String
  },
  rating: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: Number,
    comment: String,
    date: { type: Date, default: Date.now }
  }],
  isFeatured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for search
ServiceSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Service', ServiceSchema);