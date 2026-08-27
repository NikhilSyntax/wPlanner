const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const Event = require('../models/Event');
const Team = require('../models/Team');
const Assignment = require('../models/Assignment');
const teamController = require('../controllers/teamController');
const eventController = require('../controllers/eventController');

async function runTests() {
  console.log('--- Starting Admin Team & Roster Restriction Tests ---');

  await mongoose.connect(config.mongoUri);

  const testCode = 'ADMTM1';
  await Church.deleteMany({ churchCode: testCode });
  await User.deleteMany({ email: { $in: ['admin_team_test@test.com', 'member_team_test@test.com'] } });

  const church = await Church.create({ name: 'Admin Team Church', churchCode: testCode });

  const admin = await User.create({
    name: 'Admin Boss',
    email: 'admin_team_test@test.com',
    password: 'password',
    role: 'Admin',
    isAdmin: true,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const member = await User.create({
    name: 'Guitarist Greg',
    email: 'member_team_test@test.com',
    password: 'password',
    role: 'Guitarist',
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const team = await Team.create({
    team: { name: 'Praise Band', type: 'worship_band' },
    churchId: church._id,
    createdBy: admin._id,
    members: [],
  });

  const event = await Event.create({
    event: { title: 'Sunday Worship', status: 'published', type: 'service' },
    schedule: {
      start: new Date(Date.now() + 86400000),
      end: new Date(Date.now() + 90000000),
      timezone: 'UTC',
    },
    churchId: church._id,
    createdBy: admin._id,
    assignments: [],
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

  // TEST 1: Admin cannot be added into a Team
  console.log('Test 1: Admin cannot be added into a Team...');
  const mockAddAdminToTeam = mockReqRes({
    user: { userId: admin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { id: team._id.toString() },
    body: { userId: admin._id.toString(), roles: ['guitar'] },
  });
  await teamController.addMember(mockAddAdminToTeam.req, mockAddAdminToTeam.res);
  const res1 = mockAddAdminToTeam.getResult();
  assert.strictEqual(res1.status, 400, 'Adding admin to team should return 400');
  console.log('✅ Test 1 Passed: Admin cannot be added to a team.');

  // TEST 2: Regular member CAN be added into a Team
  console.log('Test 2: Regular member can be added into a Team...');
  const mockAddMemberToTeam = mockReqRes({
    user: { userId: admin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { id: team._id.toString() },
    body: { userId: member._id.toString(), roles: ['guitar'] },
  });
  await teamController.addMember(mockAddMemberToTeam.req, mockAddMemberToTeam.res);
  const res2 = mockAddMemberToTeam.getResult();
  assert.strictEqual(res2.status, 201, 'Adding member to team should return 201');
  console.log('✅ Test 2 Passed: Member added to team successfully.');

  // TEST 3: Admin cannot be assigned to an event team
  console.log('Test 3: Admin cannot be assigned to an event team...');
  const mockAssignAdmin = mockReqRes({
    user: { userId: admin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { id: event._id.toString() },
    body: { userId: admin._id.toString(), role: 'Guitarist' },
  });
  await eventController.addAssignment(mockAssignAdmin.req, mockAssignAdmin.res);
  const res3 = mockAssignAdmin.getResult();
  assert.strictEqual(res3.status, 400, 'Assigning admin to event should return 400');
  console.log('✅ Test 3 Passed: Admin cannot be assigned to event team.');

  // TEST 4: Regular member CAN be assigned to an event team
  console.log('Test 4: Regular member can be assigned to an event team...');
  const mockAssignMember = mockReqRes({
    user: { userId: admin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { id: event._id.toString() },
    body: { userId: member._id.toString(), role: 'Guitarist' },
  });
  await eventController.addAssignment(mockAssignMember.req, mockAssignMember.res);
  const res4 = mockAssignMember.getResult();
  assert.strictEqual(res4.status, 201, 'Assigning member to event should return 201');
  console.log('✅ Test 4 Passed: Member assigned to event team successfully.');

  // Cleanup
  await Event.deleteMany({ churchId: church._id });
  await Team.deleteMany({ churchId: church._id });
  await Assignment.deleteMany({ user: { $in: [admin._id, member._id] } });
  await User.deleteMany({ _id: { $in: [admin._id, member._id] } });
  await Church.deleteMany({ _id: church._id });

  await mongoose.disconnect();
  console.log('All Admin Team & Roster Restriction Tests Passed! 🎉');
}

runTests().catch((err) => {
  console.error('Admin restriction test failure:', err);
  process.exit(1);
});
