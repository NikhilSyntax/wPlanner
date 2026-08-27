const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const Team = require('../models/Team');
const Event = require('../models/Event');
const userController = require('../controllers/userController');

async function runTests() {
  console.log('--- Starting wPlanner v4 Ministry Statistics Tests ---');
  
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB for testing.');

  // Clean up any test fixtures from previous runs
  const testChurchCode = 'TSTST1';
  const testChurchCode2 = 'TSTST2';
  await Church.deleteMany({ churchCode: { $in: [testChurchCode, testChurchCode2] } });
  await User.deleteMany({ email: { $in: ['testvolunteer1@test.com', 'testvolunteer2@test.com', 'testadmin1@test.com'] } });

  // 1. Create Churches
  const churchA = await Church.create({
    name: 'Grace Church (Church A)',
    churchCode: testChurchCode,
  });
  const churchB = await Church.create({
    name: 'Hope Church (Church B)',
    churchCode: testChurchCode2,
  });

  // 2. Create Users
  const volunteerA = await User.create({
    name: 'Volunteer Alice',
    email: 'testvolunteer1@test.com',
    password: 'hashedpassword',
    role: 'Guitarist',
    churchId: churchA._id,
    approvalStatus: 'approved',
  });

  const adminA = await User.create({
    name: 'Admin Arthur',
    email: 'testadmin1@test.com',
    password: 'hashedpassword',
    role: 'Admin',
    isAdmin: true,
    churchId: churchA._id,
    approvalStatus: 'approved',
  });

  const volunteerB = await User.create({
    name: 'Volunteer Bob',
    email: 'testvolunteer2@test.com',
    password: 'hashedpassword',
    role: 'Singer',
    churchId: churchB._id,
    approvalStatus: 'approved',
  });

  // 3. Create Teams
  const worshipTeam = await Team.create({
    team: { name: 'Worship Team', type: 'worship_band' },
    churchId: churchA._id,
    members: [{ userId: volunteerA._id, roles: ['guitar'] }],
  });

  const mediaTeam = await Team.create({
    team: { name: 'Media Team', type: 'media' },
    churchId: churchA._id,
    members: [{ userId: volunteerA._id, roles: ['production'] }],
  });

  // Clean up any test events
  await Event.deleteMany({ churchId: { $in: [churchA._id, churchB._id] } });

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  // 4. Create Events with various test criteria
  
  // Test Event 1: Accepted + Completed (Sunday Worship - Worship Team - Guitar) -> COUNT in served!
  await Event.create({
    event: { title: 'Sunday Worship 1', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now - 7 * oneDay),
      end: new Date(now - 7 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Guitar', status: 'accepted' }],
  });

  // Test Event 2: Accepted + Completed (Youth Service - Worship Team - Guitar) -> COUNT in served!
  await Event.create({
    event: { title: 'Youth Service', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now - 5 * oneDay),
      end: new Date(now - 5 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Guitar', status: 'accepted' }],
  });

  // Test Event 3: Accepted + Completed (Midweek Service - Media Team - Audio) -> COUNT in served!
  await Event.create({
    event: { title: 'Midweek Service', status: 'completed', type: 'service' },
    schedule: {
      start: new Date(now - 3 * oneDay),
      end: new Date(now - 3 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: mediaTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Audio', status: 'accepted' }],
  });

  // Test Event 4: Accepted + Completed with Multiple Roles in same event (Guitar + Vocals) -> COUNT as 1 in served, 2 in breakdown!
  await Event.create({
    event: { title: 'Special Night Service', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now - 1 * oneDay),
      end: new Date(now - 1 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [
      { userId: volunteerA._id, role: 'Guitar', status: 'accepted' },
      { userId: volunteerA._id, role: 'Vocals', status: 'accepted' },
    ],
  });

  // Test Event 5: Accepted + Future / Upcoming event -> DO NOT COUNT in served! COUNT in upcoming (1)!
  await Event.create({
    event: { title: 'Christmas Service', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now + 2 * oneDay),
      end: new Date(now + 2 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Keys', status: 'accepted' }],
  });

  // Test Event 5b: Accepted + Explicitly marked 'completed' even if end time is in future -> COUNT in served, NOT in upcoming!
  await Event.create({
    event: { title: 'Early Marked Completed Service', status: 'completed', type: 'service' },
    schedule: {
      start: new Date(now + 1 * oneDay),
      end: new Date(now + 1 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Guitar', status: 'accepted' }],
  });

  // Test Event 6: Pending + Completed event -> DO NOT COUNT in served!
  await Event.create({
    event: { title: 'Bible Study', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now - 4 * oneDay),
      end: new Date(now - 4 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Keys', status: 'pending' }],
  });

  // Test Event 7: Declined + Completed event -> DO NOT COUNT in served!
  await Event.create({
    event: { title: 'Easter Service', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now - 6 * oneDay),
      end: new Date(now - 6 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Bass', status: 'declined' }],
  });

  // Test Event 8: Assigned (unconfirmed) + Completed event -> DO NOT COUNT in served!
  await Event.create({
    event: { title: 'Friday Gathering', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now - 2 * oneDay),
      end: new Date(now - 2 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Drums', status: 'assigned' }],
  });

  // Test Event 9: Accepted + Cancelled event -> DO NOT COUNT in served!
  await Event.create({
    event: { title: 'Cancelled Service', status: 'cancelled', type: 'service' },
    schedule: {
      start: new Date(now - 8 * oneDay),
      end: new Date(now - 8 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    team: worshipTeam._id,
    churchId: churchA._id,
    createdBy: adminA._id,
    assignments: [{ userId: volunteerA._id, role: 'Guitar', status: 'accepted' }],
  });

  // Test Event 10: Church B Event (Tenant isolation check)
  await Event.create({
    event: { title: 'Church B Service', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now - 1 * oneDay),
      end: new Date(now - 1 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    churchId: churchB._id,
    createdBy: volunteerB._id,
    assignments: [{ userId: volunteerA._id, role: 'Guitar', status: 'accepted' }],
  });

  // Helper to simulate express request/response
  function mockReqRes(reqData) {
    let statusCode = 200;
    let responseData = null;
    const req = {
      user: reqData.user,
      params: reqData.params || {},
      query: reqData.query || {},
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

  // --- TEST 1: Volunteer A querying /me/statistics ---
  console.log('Executing Test 1: Volunteer A self-query statistics (/me/statistics)...');
  const mock1 = mockReqRes({
    user: { userId: volunteerA._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
    query: { page: '1', limit: '10' },
  });
  await userController.getMinistryStatistics(mock1.req, mock1.res);
  const res1 = mock1.getResult();

  assert.strictEqual(res1.status, 200, 'Expected status 200');
  
  // Total served count check:
  // Qualifying events: Sunday Worship 1 (1), Youth Service (1), Midweek Service (1), Special Night Service (1), Early Marked Completed Service (1) = 5 total!
  console.log('Result served count:', res1.data.served);
  assert.strictEqual(res1.data.served, 5, 'Served count should be exactly 5');

  // Upcoming assignments check:
  // Christmas Service (1) = 1 total! Early Marked Completed Service is completed, so excluded from upcoming!
  console.log('Result upcoming assignments count:', res1.data.upcomingAssignments);
  assert.strictEqual(res1.data.upcomingAssignments, 1, 'Upcoming count should be exactly 1');

  // Serving History check:
  console.log('Serving history count:', res1.data.servingHistory.length);
  assert.strictEqual(res1.data.servingHistory.length, 5, 'Serving history length should be 5');

  // Multi-role in single event verification in history:
  const multiRoleHistory = res1.data.servingHistory.find(h => h.title === 'Special Night Service');
  assert.ok(multiRoleHistory, 'Special Night Service must be in history');
  assert.ok(multiRoleHistory.roles.includes('Guitar') && multiRoleHistory.roles.includes('Vocals'), 'Roles should include Guitar and Vocals');

  // Position breakdown check:
  // Guitar: Sunday Worship 1 (1) + Youth Service (1) + Special Night (1) + Early Completed (1) = 4
  // Audio: Midweek Service (1) = 1
  // Vocals: Special Night (1) = 1
  console.log('Position breakdown:', JSON.stringify(res1.data.positionBreakdown));
  const guitarCount = res1.data.positionBreakdown.find(p => p.position === 'Guitar')?.count;
  const audioCount = res1.data.positionBreakdown.find(p => p.position === 'Audio')?.count;
  const vocalsCount = res1.data.positionBreakdown.find(p => p.position === 'Vocals')?.count;
  assert.strictEqual(guitarCount, 4, 'Guitar count should be 4');
  assert.strictEqual(audioCount, 1, 'Audio count should be 1');
  assert.strictEqual(vocalsCount, 1, 'Vocals count should be 1');

  // Team breakdown check:
  // Worship Team: Sunday Worship 1 (1) + Youth Service (1) + Special Night (1) + Early Completed (1) = 4
  // Media Team: Midweek Service (1) = 1
  console.log('Team breakdown:', JSON.stringify(res1.data.teamBreakdown));
  const worshipTeamCount = res1.data.teamBreakdown.find(t => t.team === 'Worship Team')?.count;
  const mediaTeamCount = res1.data.teamBreakdown.find(t => t.team === 'Media Team')?.count;
  assert.strictEqual(worshipTeamCount, 4, 'Worship Team count should be 4');
  assert.strictEqual(mediaTeamCount, 1, 'Media Team count should be 1');

  console.log('✅ Test 1 Passed: Core business rules, counts, breakdowns, and history verified.');

  // --- TEST 2: Pagination ---
  console.log('Executing Test 2: Pagination (page=1, limit=2)...');
  const mockPage1 = mockReqRes({
    user: { userId: volunteerA._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
    query: { page: '1', limit: '2' },
  });
  await userController.getMinistryStatistics(mockPage1.req, mockPage1.res);
  const resPage1 = mockPage1.getResult();
  assert.strictEqual(resPage1.data.servingHistory.length, 2, 'Page 1 should have 2 items');
  assert.strictEqual(resPage1.data.pagination.hasMore, true, 'hasMore should be true');
  assert.strictEqual(resPage1.data.served, 5, 'Total served count remains 5 regardless of pagination limit');

  const mockPage2 = mockReqRes({
    user: { userId: volunteerA._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
    query: { page: '2', limit: '2' },
  });
  await userController.getMinistryStatistics(mockPage2.req, mockPage2.res);
  const resPage2 = mockPage2.getResult();
  assert.strictEqual(resPage2.data.servingHistory.length, 2, 'Page 2 should have 2 items');
  assert.strictEqual(resPage2.data.pagination.hasMore, true, 'hasMore should be true on page 2');

  console.log('✅ Test 2 Passed: Pagination works properly.');

  // --- TEST 3: Multi-tenancy Isolation ---
  console.log('Executing Test 3: Multi-tenancy Isolation for Church B volunteer...');
  const mockB = mockReqRes({
    user: { userId: volunteerB._id.toString(), churchId: churchB._id.toString(), isAdmin: false },
    query: {},
  });
  await userController.getMinistryStatistics(mockB.req, mockB.res);
  const resB = mockB.getResult();
  // Volunteer B has no accepted assignments in Church B
  assert.strictEqual(resB.data.served, 0, 'Volunteer B in Church B should have 0 served');
  assert.strictEqual(resB.data.servingHistory.length, 0, 'Volunteer B history should be empty');
  console.log('✅ Test 3 Passed: Multi-tenancy isolation strictly maintained.');

  // --- TEST 4: Security / Authorization (Non-admin querying another user) ---
  console.log('Executing Test 4: Security test (Volunteer A trying to query Volunteer B)...');
  const mockUnauthorized = mockReqRes({
    user: { userId: volunteerA._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
    params: { userId: volunteerB._id.toString() },
  });
  await userController.getMinistryStatistics(mockUnauthorized.req, mockUnauthorized.res);
  const resUnauth = mockUnauthorized.getResult();
  assert.strictEqual(resUnauth.status, 403, 'Non-admin should receive 403 when querying another user');
  console.log('✅ Test 4 Passed: Unauthorized cross-user access prevented.');

  // --- TEST 5: Admin in Church A querying Volunteer A in Church A ---
  console.log('Executing Test 5: Admin Arthur querying Volunteer A...');
  const mockAdmin = mockReqRes({
    user: { userId: adminA._id.toString(), churchId: churchA._id.toString(), isAdmin: true },
    params: { userId: volunteerA._id.toString() },
  });
  await userController.getMinistryStatistics(mockAdmin.req, mockAdmin.res);
  const resAdmin = mockAdmin.getResult();
  assert.strictEqual(resAdmin.status, 200, 'Admin should be able to query member in same church');
  assert.strictEqual(resAdmin.data.served, 5, 'Admin receives accurate stats for member');
  console.log('✅ Test 5 Passed: Admin access in same church works.');

  // Cleanup test data
  await Event.deleteMany({ churchId: { $in: [churchA._id, churchB._id] } });
  await Team.deleteMany({ _id: { $in: [worshipTeam._id, mediaTeam._id] } });
  await User.deleteMany({ _id: { $in: [volunteerA._id, volunteerB._id, adminA._id] } });
  await Church.deleteMany({ _id: { $in: [churchA._id, churchB._id] } });
  
  await mongoose.disconnect();
  console.log('All backend ministry statistics tests passed successfully! 🎉');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
