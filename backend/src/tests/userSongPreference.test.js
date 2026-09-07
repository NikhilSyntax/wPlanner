const assert = require('assert');
const mongoose = require('mongoose');
const Song = require('../models/Song');
const Church = require('../models/Church');
const User = require('../models/User');
const UserSongPreference = require('../models/UserSongPreference');
const songController = require('../controllers/songController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wplanner_test_pref';

async function runPreferenceTests() {
  console.log('=== Starting Per-User Transposed Key & Chords Preference Test Suite ===\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB test database.');

  // Clean collections
  await Church.deleteMany({});
  await Song.deleteMany({});
  await User.deleteMany({});
  await UserSongPreference.deleteMany({});

  const testChurch = await Church.create({
    name: 'Grace Community Church',
    churchCode: 'GCC001',
    plan: 'enterprise',
  });

  const userA = await User.create({
    name: 'Guitarist Alice',
    email: 'alice@example.com',
    password: 'hashedpassword',
    role: 'Guitarist',
    churchId: testChurch._id,
    approvalStatus: 'approved',
  });

  const userB = await User.create({
    name: 'Vocalist Bob',
    email: 'bob@example.com',
    password: 'hashedpassword',
    role: 'Singer',
    churchId: testChurch._id,
    approvalStatus: 'approved',
  });

  // Create church master song in Key of C
  const originalSong = await Song.create({
    churchId: testChurch._id,
    title: '10,000 Reasons (Bless The Lord)',
    artist: 'Matt Redman',
    key: 'C',
    bpm: 73,
    timeSignature: '4/4',
    content: {
      chords: '[C]Bless the [G]Lord O my [F]soul [C]O my soul\n[F]Worship His [C]holy [G]name',
    },
  });

  try {
    // -------------------------------------------------------------
    // Test 1: User A saves personal key (Key of E, transpose: 4)
    // -------------------------------------------------------------
    console.log('Test 1: User A saves personal key preference');
    const reqA = {
      user: { _id: userA._id, churchId: testChurch._id },
      params: { id: originalSong._id.toString() },
      body: {
        key: 'E',
        transpose: 4,
        capo: 2,
        chords: '[E]Bless the [B]Lord O my [A]soul [E]O my soul\n[A]Worship His [E]holy [B]name',
      },
    };
    let resA = {};
    const mockResA = {
      status: (code) => ({ json: (data) => { resA = { code, ...data }; } }),
      json: (data) => { resA = data; },
    };

    await songController.saveUserSongPreference(reqA, mockResA);
    assert.strictEqual(resA.success, true);
    assert.strictEqual(resA.userPreference.key, 'E');
    assert.strictEqual(resA.userPreference.transpose, 4);
    assert.strictEqual(resA.userPreference.capo, 2);

    // -------------------------------------------------------------
    // Test 2: User A retrieves song via getSong -> receives personal preference
    // -------------------------------------------------------------
    console.log('Test 2: User A retrieves song with attached personal preference');
    let fetchedA = null;
    await songController.getSong(
      { user: { _id: userA._id, churchId: testChurch._id }, params: { id: originalSong._id.toString() } },
      { json: (data) => { fetchedA = data; }, status: () => ({ json: () => {} }) }
    );
    assert.ok(fetchedA, 'Song should be returned for User A');
    assert.strictEqual(fetchedA.key, 'C', 'Church master key in Song model must remain C');
    assert.ok(fetchedA.userPreference, 'userPreference must be present for User A');
    assert.strictEqual(fetchedA.userPreference.key, 'E', 'User A preference key should be E');
    assert.strictEqual(fetchedA.userPreference.transpose, 4);
    assert.ok(fetchedA.userPreference.chords.includes('[E]Bless the [B]Lord'));

    // -------------------------------------------------------------
    // Test 3: User B retrieves the exact same song -> NO preference, sees original key C
    // -------------------------------------------------------------
    console.log('Test 3: User B retrieves the exact same song and sees church original key C without User A preferences');
    let fetchedB = null;
    await songController.getSong(
      { user: { _id: userB._id, churchId: testChurch._id }, params: { id: originalSong._id.toString() } },
      { json: (data) => { fetchedB = data; }, status: () => ({ json: () => {} }) }
    );
    assert.ok(fetchedB, 'Song should be returned for User B');
    assert.strictEqual(fetchedB.key, 'C', 'User B must see the church master key C');
    assert.strictEqual(fetchedB.userPreference, undefined, 'User B must NOT have User A preference');

    // -------------------------------------------------------------
    // Test 4: Master Song document in DB remained completely unaltered
    // -------------------------------------------------------------
    console.log('Test 4: Verify master Song document in MongoDB remains strictly unchanged');
    const songInDb = await Song.findById(originalSong._id);
    assert.strictEqual(songInDb.key, 'C');
    assert.strictEqual(songInDb.content.chords, originalSong.content.chords);

    // -------------------------------------------------------------
    // Test 5: User B saves their OWN independent personal key (Key of G)
    // -------------------------------------------------------------
    console.log('Test 5: User B saves an independent personal key (Key of G)');
    let resB = {};
    await songController.saveUserSongPreference(
      {
        user: { _id: userB._id, churchId: testChurch._id },
        params: { id: originalSong._id.toString() },
        body: {
          key: 'G',
          transpose: 7,
          capo: 0,
          chords: '[G]Bless the [D]Lord O my [C]soul',
        },
      },
      { json: (data) => { resB = data; }, status: () => ({ json: () => {} }) }
    );
    assert.strictEqual(resB.userPreference.key, 'G');

    // Both users now have distinct preferences
    const prefA = await UserSongPreference.findOne({ userId: userA._id, songId: originalSong._id });
    const prefB = await UserSongPreference.findOne({ userId: userB._id, songId: originalSong._id });
    assert.strictEqual(prefA.key, 'E');
    assert.strictEqual(prefB.key, 'G');

    // -------------------------------------------------------------
    // Test 6: User A updates personal key to D
    // -------------------------------------------------------------
    console.log('Test 6: User A updates personal key to D');
    let resUpdateA = {};
    await songController.saveUserSongPreference(
      {
        user: { _id: userA._id, churchId: testChurch._id },
        params: { id: originalSong._id.toString() },
        body: {
          key: 'D',
          transpose: 2,
          capo: 0,
          chords: '[D]Bless the [A]Lord',
        },
      },
      { json: (data) => { resUpdateA = data; }, status: () => ({ json: () => {} }) }
    );
    assert.strictEqual(resUpdateA.userPreference.key, 'D');
    assert.strictEqual(resUpdateA.userPreference.transpose, 2);

    // -------------------------------------------------------------
    // Test 7: User A resets / deletes personal key preference
    // -------------------------------------------------------------
    console.log('Test 7: User A resets personal key preference');
    let resDelA = {};
    await songController.deleteUserSongPreference(
      { user: { _id: userA._id, churchId: testChurch._id }, params: { id: originalSong._id.toString() } },
      { json: (data) => { resDelA = data; }, status: () => ({ json: () => {} }) }
    );
    assert.strictEqual(resDelA.success, true);

    // Re-fetch User A
    let fetchedAfterResetA = null;
    await songController.getSong(
      { user: { _id: userA._id, churchId: testChurch._id }, params: { id: originalSong._id.toString() } },
      { json: (data) => { fetchedAfterResetA = data; }, status: () => ({ json: () => {} }) }
    );
    assert.strictEqual(fetchedAfterResetA.userPreference, undefined);
    assert.strictEqual(fetchedAfterResetA.key, 'C');

    // User B still has Key of G
    let fetchedAfterB = null;
    await songController.getSong(
      { user: { _id: userB._id, churchId: testChurch._id }, params: { id: originalSong._id.toString() } },
      { json: (data) => { fetchedAfterB = data; }, status: () => ({ json: () => {} }) }
    );
    assert.ok(fetchedAfterB.userPreference);
    assert.strictEqual(fetchedAfterB.userPreference.key, 'G');

    console.log('\nAll 7 Per-User Transposed Key & Chords tests passed successfully!');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB test database.');
  }
}

runPreferenceTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
