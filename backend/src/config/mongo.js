const mongoose = require('mongoose');
const config = require('./config')();

async function cleanupLegacyUserIndexes() {
  try {
    const usersCollection = mongoose.connection.collection('users');
    const indexes = await usersCollection.indexes();
    const legacyProfileEmailIndex = indexes.find(
      (index) => index.name === 'profile.email_1'
    );
    if (legacyProfileEmailIndex) {
      await usersCollection.dropIndex('profile.email_1');
      console.log('Dropped legacy index users.profile.email_1');
    }
  } catch (error) {
    console.error('Legacy index cleanup warning:', error.message);
  }
}

async function connectMongo() {
  try {
    await mongoose.connect(config.mongoUri);
    await cleanupLegacyUserIndexes();
    console.log('MongoDB connected successfully to:', config.mongoUri);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
}

module.exports = { connectMongo };
