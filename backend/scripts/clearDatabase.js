require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../src/config/config')();

async function clearDatabase() {
  console.log('Connecting to MongoDB at:', config.mongoUri);
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB successfully.\n');

    const db = mongoose.connection.db;
    const collections = await db.collections();

    if (collections.length === 0) {
      console.log('No collections found. Database is already empty.');
    } else {
      console.log('--- Clearing Collections ---');
      for (const collection of collections) {
        const name = collection.collectionName;
        // Skip system collections if any
        if (name.startsWith('system.')) continue;

        const countBefore = await collection.countDocuments();
        await collection.deleteMany({});
        const countAfter = await collection.countDocuments();
        console.log(`- ${name}: deleted ${countBefore} documents (remaining: ${countAfter})`);
      }
    }

    // Optional: Clean up backend/uploads files
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let removedFiles = 0;
      for (const file of files) {
        if (file !== '.gitkeep') {
          const filePath = path.join(uploadsDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            removedFiles++;
          }
        }
      }
      console.log(`\n--- Cleaned Uploads Directory ---`);
      console.log(`Removed ${removedFiles} uploaded files.`);
    }

    console.log('\nDatabase has been completely cleared and reset to fresh state.');
  } catch (error) {
    console.error('Error while clearing database:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

clearDatabase();
