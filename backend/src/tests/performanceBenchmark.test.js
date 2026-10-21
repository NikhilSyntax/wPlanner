const mongoose = require('mongoose');
const assert = require('assert');
const bcrypt = require('bcryptjs');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const Song = require('../models/Song');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const songController = require('../controllers/songController');
const eventController = require('../controllers/eventController');
const notificationController = require('../controllers/notificationController');
const churchController = require('../controllers/churchController');
const authController = require('../controllers/authController');
const { enrichSongsUsage } = require('../utils/enrichSongUsage');

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
}

async function runBenchmark() {
  console.log('=== wPlanner Performance Benchmark & Regression Test Suite ===');
  await mongoose.connect(config.mongoUri);

  const testChurchCode = 'PERF01';
  await Church.deleteMany({ churchCode: testChurchCode });
  await User.deleteMany({ email: /@perf\.test/ });
  await Song.deleteMany({ title: /Benchmark Song/ });
  await Event.deleteMany({ 'event.title': /Benchmark Event/ });
  await Notification.deleteMany({ title: /Benchmark Notif/ });

  // 1. Setup Church & Users
  const church = await Church.create({
    name: 'Benchmark Community Church',
    churchCode: testChurchCode,
  });

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('TestPassword123!', salt);

  const admin = await User.create({
    name: 'Benchmark Admin',
    email: 'admin@perf.test',
    password: hash,
    role: 'Admin',
    isAdmin: true,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  // Create 10 church members
  const memberDocs = [];
  for (let i = 1; i <= 10; i++) {
    memberDocs.push({
      name: `Member ${i}`,
      email: `member${i}@perf.test`,
      password: hash,
      role: 'Singer',
      churchId: church._id,
      approvalStatus: 'approved',
    });
  }
  const members = await User.insertMany(memberDocs);

  // 2. Setup 30 Songs
  const songDocs = [];
  for (let i = 1; i <= 30; i++) {
    songDocs.push({
      churchId: church._id,
      title: `Benchmark Song ${String(i).padStart(2, '0')}`,
      artist: `Artist ${i % 5}`,
      key: 'G',
      bpm: 72 + i,
      timeSignature: '4/4',
      genre: ['Worship'],
      usage: {
        timesPerformed: i % 4,
        lastPerformed: new Date(Date.now() - i * 86400000),
      },
    });
  }
  const songs = await Song.insertMany(songDocs);
  const songIds = songs.map((s) => s._id);

  // 3. Setup 10 Events
  const eventDocs = [];
  for (let i = 1; i <= 10; i++) {
    const start = new Date(Date.now() + i * 86400000);
    const end = new Date(start.getTime() + 2 * 3600000);
    eventDocs.push({
      churchId: church._id,
      createdBy: admin._id,
      event: {
        title: `Benchmark Event ${i}`,
        type: 'service',
        status: i % 2 === 0 ? 'published' : 'draft',
      },
      schedule: { start, end, timezone: 'UTC' },
      setlist: [songIds[i % 30], songIds[(i + 1) % 30], songIds[(i + 2) % 30]],
      assignments: [
        { userId: members[0]._id, role: 'Singer', status: 'accepted' },
        { userId: members[1]._id, role: 'Guitarist', status: 'assigned' },
      ],
    });
  }
  const events = await Event.insertMany(eventDocs);

  // 4. Setup 20 Notifications for Admin
  const notifDocs = [];
  for (let i = 1; i <= 20; i++) {
    notifDocs.push({
      recipient: admin._id,
      type: 'event_reminder',
      title: `Benchmark Notif ${i}`,
      message: `Reminder for Service #${i}`,
      eventId: events[i % 10]._id,
      read: i > 5,
      createdAt: new Date(Date.now() - i * 3600000),
    });
  }
  await Notification.insertMany(notifDocs);

  console.log('✓ Test fixtures created: 1 Church, 11 Users, 30 Songs, 10 Events, 20 Notifications.');

  // ==========================================
  // BENCHMARK 1: Login Performance
  // ==========================================
  console.log('\n--- Benchmarking Login Performance (POST /api/auth/login) ---');
  const loginSamples = [];
  for (let i = 0; i < 5; i++) {
    const req = {
      body: { email: 'admin@perf.test', password: 'TestPassword123!' },
    };
    const res = mockResponse();
    const t0 = process.hrtime.bigint();
    await authController.login(req, res);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.accessToken);
    assert(res.data.refreshToken);
    loginSamples.push(ms);
  }
  loginSamples.sort((a, b) => a - b);
  const loginMedian = loginSamples[Math.floor(loginSamples.length / 2)];
  console.log(`✓ Login Latency (5 runs): median=${loginMedian.toFixed(2)}ms (min=${loginSamples[0].toFixed(2)}ms, max=${loginSamples[loginSamples.length - 1].toFixed(2)}ms)`);

  // ==========================================
  // BENCHMARK 2: Songs Query with churchId scoping & persist:false vs persist:true
  // ==========================================
  console.log('\n--- Benchmarking Songs Endpoint (GET /api/songs) ---');
  const songsSamples = [];
  for (let i = 0; i < 5; i++) {
    const req = {
      user: { userId: admin._id, churchId: church._id },
      query: {},
    };
    const res = mockResponse();
    const t0 = process.hrtime.bigint();
    await songController.getSongs(req, res);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.length, 30);
    songsSamples.push(ms);
  }
  songsSamples.sort((a, b) => a - b);
  const songsMedian = songsSamples[Math.floor(songsSamples.length / 2)];
  console.log(`✓ Optimized GET /api/songs Latency (5 runs): median=${songsMedian.toFixed(2)}ms (min=${songsSamples[0].toFixed(2)}ms, max=${songsSamples[songsSamples.length - 1].toFixed(2)}ms)`);

  // ==========================================
  // BENCHMARK 3: Dashboard Stats Endpoint (GET /api/church/stats) vs Full Fetch
  // ==========================================
  console.log('\n--- Benchmarking Dashboard Stats (/api/church/stats) ---');
  const statsSamples = [];
  for (let i = 0; i < 5; i++) {
    const req = {
      user: { userId: admin._id, churchId: church._id },
    };
    const res = mockResponse();
    const t0 = process.hrtime.bigint();
    await churchController.getChurchStats(req, res);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.songsCount, 30);
    assert.strictEqual(res.data.membersCount, 11);
    statsSamples.push(ms);
  }
  statsSamples.sort((a, b) => a - b);
  const statsMedian = statsSamples[Math.floor(statsSamples.length / 2)];
  console.log(`✓ GET /api/church/stats Latency (5 runs): median=${statsMedian.toFixed(2)}ms (min=${statsSamples[0].toFixed(2)}ms, max=${statsSamples[statsSamples.length - 1].toFixed(2)}ms)`);

  // ==========================================
  // BENCHMARK 4: Notifications Endpoint (GET /api/notifications)
  // ==========================================
  console.log('\n--- Benchmarking Notifications Endpoint (GET /api/notifications) ---');
  const notifSamples = [];
  for (let i = 0; i < 5; i++) {
    const req = {
      user: { userId: admin._id, churchId: church._id },
      query: { limit: 12 },
    };
    const res = mockResponse();
    const t0 = process.hrtime.bigint();
    await notificationController.getNotifications(req, res);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.notifications.length, 12);
    assert.strictEqual(res.data.total, 20);
    assert.strictEqual(res.data.unreadCount, 5);
    notifSamples.push(ms);
  }
  notifSamples.sort((a, b) => a - b);
  const notifMedian = notifSamples[Math.floor(notifSamples.length / 2)];
  console.log(`✓ Parallel GET /api/notifications Latency (5 runs): median=${notifMedian.toFixed(2)}ms (min=${notifSamples[0].toFixed(2)}ms, max=${notifSamples[notifSamples.length - 1].toFixed(2)}ms)`);

  // ==========================================
  // BENCHMARK 5: Events List (GET /api/events with compound index & lean)
  // ==========================================
  console.log('\n--- Benchmarking Events Endpoint (GET /api/events) ---');
  const eventSamples = [];
  for (let i = 0; i < 5; i++) {
    const req = {
      user: { userId: admin._id, churchId: church._id },
      query: {},
    };
    const res = mockResponse();
    const t0 = process.hrtime.bigint();
    await eventController.getEvents(req, res);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.length, 10);
    eventSamples.push(ms);
  }
  eventSamples.sort((a, b) => a - b);
  const eventMedian = eventSamples[Math.floor(eventSamples.length / 2)];
  console.log(`✓ Lean & Indexed GET /api/events Latency (5 runs): median=${eventMedian.toFixed(2)}ms (min=${eventSamples[0].toFixed(2)}ms, max=${eventSamples[eventSamples.length - 1].toFixed(2)}ms)`);

  // ==========================================
  // BENCHMARK 6: Church Members (GET /api/church/members with parallel queries)
  // ==========================================
  console.log('\n--- Benchmarking Church Members Endpoint (GET /api/church/members) ---');
  const memberSamples = [];
  for (let i = 0; i < 5; i++) {
    const req = {
      user: { userId: admin._id, churchId: church._id },
    };
    const res = mockResponse();
    const t0 = process.hrtime.bigint();
    await churchController.getMembers(req, res);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.length, 11);
    memberSamples.push(ms);
  }
  memberSamples.sort((a, b) => a - b);
  const memberMedian = memberSamples[Math.floor(memberSamples.length / 2)];
  console.log(`✓ Parallel GET /api/church/members Latency (5 runs): median=${memberMedian.toFixed(2)}ms (min=${memberSamples[0].toFixed(2)}ms, max=${memberSamples[memberSamples.length - 1].toFixed(2)}ms)`);

  // Cleanup test fixtures
  await Church.deleteMany({ churchCode: testChurchCode });
  await User.deleteMany({ email: /@perf\.test/ });
  await Song.deleteMany({ title: /Benchmark Song/ });
  await Event.deleteMany({ 'event.title': /Benchmark Event/ });
  await Notification.deleteMany({ title: /Benchmark Notif/ });

  console.log('\nAll performance benchmarks and assertions completed successfully! 🎉');
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
