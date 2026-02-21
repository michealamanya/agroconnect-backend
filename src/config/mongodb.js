const mongoose = require('mongoose');
const dns = require('dns');
const dotenv = require('dotenv');

dotenv.config();

let isConnected = false;

const connectMongoDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      console.warn('⚠️  MONGODB_URI not set in .env — image uploads to MongoDB disabled');
      return;
    }

    // Use Google DNS to fix SRV lookup issues on some networks
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    isConnected = true;
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('⚠️  MongoDB connection failed:', error.message);
    console.error('   Image uploads to MongoDB will not work.');
    console.error('   The server will continue running with Firebase only.');
    console.error('\n   Troubleshooting:');
    console.error('   1. Go to MongoDB Atlas > Network Access > Add IP > Allow Access from Anywhere');
    console.error('   2. Check your MONGODB_URI credentials in .env');
    console.error('   3. Make sure Atlas cluster is active (not paused)');
    // Don't exit — server can still work with Firebase
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  MongoDB disconnected');
});

const isMongoConnected = () => isConnected;

module.exports = { connectMongoDB, isMongoConnected };
