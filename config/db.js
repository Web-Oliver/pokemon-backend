const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection errors
    conn.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });

    conn.connection.on('disconnected', () => {
      console.log('MongoDB disconnected, attempting to reconnect...');
    });

    conn.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

  } catch (error) {
    console.error('Database connection error:', error.message);
    // Don't exit process for testing
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
