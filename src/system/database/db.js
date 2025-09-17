// src/Infrastructure/Configuration/db.js

import mongoose from 'mongoose';

/**
 * Connects to the MongoDB database using the URI from environment variables.
 * @async
 * @function connectDB
 */
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 10000
        });


        // Handle connection errors
        conn.connection.on('error', err => {
            console.error('❌ MongoDB connection error:', err);
        });

        conn.connection.on('disconnected', () => {
        });

        conn.connection.on('reconnected', () => {
        });

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        // Don't exit process for testing
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
    }
};

export default connectDB;
