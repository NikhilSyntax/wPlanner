const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const Song = require('../models/Song');
const songController = require('../controllers/songController');
const { enrichSongsUsage } = require('../utils/enrichSongUsage');

async function runTests() {
  console.log('--- Starting Song Usage & Last Used Manual Edit Tests ---');

  await mongoose.connect(config.mongoUri);

  const testCode = 'USAG01';
  await Church.deleteMany({ churchCode: testCode });
  await User.deleteMany({ email: { $in: ['songadmin@test.com', 'songvolunteer@test.com'] } });
  await Song.deleteMany({ title: 'Amazing Grace (Usage Test)' });

  const church = await Church.create({ name: 'Usage Test Church', churchCode: testCode });

  const admin = await User.create({
    name: 'Worship Admin',
    email: 'songadmin@test.com',
    password: 'password',
    role: 'Admin',
    isAdmin: true,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const volunteer = await User.create({
    name: 'Guitarist Greg',
    email: 'songvolunteer@test.com',
    password: 'password',
    role: 'Guitarist',
    isAdmin: false,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const song = await Song.create({
    churchId: church._id,
    title: 'Amazing Grace (Usage Test)',
    artist: 'John Newton',
    key: 'G',
    bpm: 72,
    content: { chords: 'G  C  G\nAmazing grace' },
  });

  function mockReqRes(reqData) {
    let statusCode = 200;
    let responseData = null;
    const req = {
      user: reqData.user,
      params: reqData.params || {},
      query: reqData.query || {},
      body: reqData.body || {},
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };
    return { req, res, getResult: () => ({ status: statusCode, data: responseData }) };
  }

  // Test 1: Non-admin trying to edit last used -> 403 Forbidden
  {
    const { req, res, getResult } = mockReqRes({
      user: { _id: volunteer._id, churchId: church._id, role: volunteer.role, isAdmin: false },
      params: { id: song._id },
      body: { action: 'setLastUsed', lastPerformed: '2026-08-15' },
    });
    await songController.updateSongUsage(req, res);
    const result = getResult();
    assert.strictEqual(result.status, 403, 'Non-admin should be rejected with 403');
    console.log('✓ Test 1 Passed: Non-admin rejected with 403');
  }

  // Test 2: Admin setting last used date
  let manualDateStr = '2026-08-15T00:00:00.000Z';
  {
    const { req, res, getResult } = mockReqRes({
      user: { _id: admin._id, churchId: church._id, role: admin.role, isAdmin: true },
      params: { id: song._id },
      body: {
        action: 'setLastUsed',
        lastPerformed: manualDateStr,
        eventTitle: 'Sunday Morning Worship',
        key: 'G',
      },
    });
    await songController.updateSongUsage(req, res);
    const result = getResult();
    assert.strictEqual(result.status, 200, 'Admin should successfully update usage');
    assert.ok(result.data.usage?.lastPerformed, 'lastPerformed should be set');
    assert.strictEqual(
      new Date(result.data.usage.lastPerformed).toISOString(),
      manualDateStr,
      'lastPerformed date should match input'
    );
    assert.strictEqual(result.data.usage.usageHistory.length, 1, 'Should have 1 history record');
    assert.strictEqual(result.data.usage.usageHistory[0].eventTitle, 'Sunday Morning Worship');
    console.log('✓ Test 2 Passed: Admin successfully set last used date');
  }

  // Test 3: Calling enrichSongsUsage does NOT wipe out manual lastPerformed or history
  {
    const fetchedSongs = await Song.find({ _id: song._id, churchId: church._id }).lean();
    const enriched = await enrichSongsUsage(fetchedSongs, { persist: true });
    assert.ok(enriched[0].usage?.lastPerformed, 'Enrich should keep lastPerformed');
    assert.strictEqual(
      new Date(enriched[0].usage.lastPerformed).toISOString(),
      manualDateStr,
      'enrichSongsUsage should preserve manual lastPerformed'
    );
    assert.strictEqual(enriched[0].usage.usageHistory.length, 1, 'enrichSongsUsage should preserve history');
    console.log('✓ Test 3 Passed: enrichSongsUsage preserves manual lastPerformed and history');
  }

  // Test 4: Adding another manual performance record
  let secondDateStr = '2026-09-01T00:00:00.000Z';
  {
    const { req, res, getResult } = mockReqRes({
      user: { _id: admin._id, churchId: church._id, role: admin.role, isAdmin: true },
      params: { id: song._id },
      body: {
        action: 'addUsage',
        lastPerformed: secondDateStr,
        eventTitle: 'Midweek Revival Night',
        key: 'A',
      },
    });
    await songController.updateSongUsage(req, res);
    const result = getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.usage.usageHistory.length, 2, 'Should now have 2 history records');
    // Since 2026-09-01 is newer, it should now be lastPerformed
    assert.strictEqual(
      new Date(result.data.usage.lastPerformed).toISOString(),
      secondDateStr,
      'Newer date should become lastPerformed'
    );
    console.log('✓ Test 4 Passed: Multiple manual performance records supported with latest date tracking');
  }

  // Test 5: Clearing last used date
  {
    const { req, res, getResult } = mockReqRes({
      user: { _id: admin._id, churchId: church._id, role: admin.role, isAdmin: true },
      params: { id: song._id },
      body: { action: 'clearLastUsed', clearManualHistory: true },
    });
    await songController.updateSongUsage(req, res);
    const result = getResult();
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.usage?.lastPerformed, null, 'lastPerformed should be cleared to null');
    assert.strictEqual(result.data.usage.usageHistory.length, 0, 'Manual history should be cleared');
    console.log('✓ Test 5 Passed: Clearing last used date works cleanly');
  }

  // Cleanup
  await Church.deleteMany({ churchCode: testCode });
  await User.deleteMany({ email: { $in: ['songadmin@test.com', 'songvolunteer@test.com'] } });
  await Song.deleteMany({ title: 'Amazing Grace (Usage Test)' });

  await mongoose.disconnect();
  console.log('--- All Song Usage & Last Used Tests Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
