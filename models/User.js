const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Please provide name'],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Please provide email'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Please provide password'],
    minlength: 6,
    select: false
  },
  role: { 
    type: String, 
    enum: ['school', 'pharmacy', 'company', 'admin'], 
    required: true 
  },
  companyName: { 
    type: String, 
    required: [true, 'Please provide company name'] 
  },
  phone: {
    type: String,
    match: [/^\+?[\d\s-]{10,}$/, 'Please provide valid phone number']
  },
  address: String,
  logo: String,
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLogin: Date
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);