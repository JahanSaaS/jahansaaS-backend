const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function diagnose() {
  console.log('🔍 Starting Memory Diagnosis...\n');
  
  // Check initial memory
  const initialMemory = process.memoryUsage();
  console.log('📊 Initial Memory Usage:');
  console.log(`   Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB\n`);
  
  // Check Node.js memory limit
  const v8 = require('v8');
  const heapStats = v8.getHeapStatistics();
  console.log('📈 V8 Heap Statistics:');
  console.log(`   Heap Limit: ${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Total Available: ${(heapStats.total_available_size / 1024 / 1024).toFixed(2)} MB\n`);
  
  // Test MongoDB connection
  if (process.env.MONGODB_URI) {
    console.log('🔄 Testing MongoDB connection...');
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 5
      });
      
      console.log('✅ MongoDB connected successfully');
      
      const afterMemory = process.memoryUsage();
      console.log('\n📊 Memory After MongoDB Connection:');
      console.log(`   Heap Used: ${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Increase: ${((afterMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB\n`);
      
      // Check active connections
      const connectionState = mongoose.connection.readyState;
      const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      console.log(`📡 Connection State: ${states[connectionState]}`);
      console.log(`📊 Database: ${mongoose.connection.name}`);
      console.log(`🔗 Host: ${mongoose.connection.host}\n`);
      
      await mongoose.connection.close();
      console.log('✅ Connection closed successfully');
      
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
    }
  } else {
    console.log('⚠️ MONGODB_URI not set in environment');
  }
  
  // Check for event listeners
  console.log('📊 Active Resources:');
  console.log(`   Active Handles: ${process._getActiveHandles().length}`);
  console.log(`   Active Requests: ${process._getActiveRequests().length}\n`);
  
  console.log('✅ Diagnosis complete!');
  process.exit(0);
}

diagnose();