const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const Event = require('../models/Event');
const Assignment = require('../models/Assignment');
const eventController = require('../controllers/eventController');

async function runTests() {
  console.log('--- Starting Event Assignment Role Update Tests ---');

  await mongoose.connect(config.mongoUri);

  const testCode = 'EVTR01';
  await Church.deleteMany({ churchCode: testCode });
  await User.deleteMany({
    email: {
      $in: ['evtroleadmin@test.com', 'evtrolemember@test.com', 'evtroleother@test.com'],
    },
  });

  const admin = new User({
    name: 'Event Admin',
    email: 'evtroleadmin@test.com',
    password: 'password123',
    role: 'Admin',
    isAdmin: true,
    approvalStatus: 'approved',
  });

  const church = await Church.create({
    name: 'Event Role Test Church',
    churchCode: testCode,
    createdBy: admin._id,
  });

  admin.churchId = church._id;
  await admin.save();

  const member = await User.create({
    name: 'Worship Member',
    email: 'evtrolemember@test.com',
    password: 'password123',
    role: 'Singer',
    isAdmin: false,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const otherMember = await User.create({
    name: 'Other Member',
    email: 'evtroleother@test.com',
    password: 'password123',
    role: 'Member',
    isAdmin: false,
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const event = await Event.create({
    event: {
      title: 'Sunday Worship Service',
      type: 'service',
      status: 'published',
    },
    schedule: {
      start: new Date(Date.now() + 86400000),
      end: new Date(Date.now() + 90000000),
    },
    churchId: church._id,
    createdBy: admin._id,
    assignments: [
      {
        userId: member._id,
        role: 'Singer',
        status: 'assigned',
      },
    ],
  });

  await Assignment.create({
    event: event._id,
    user: member._id,
    role: 'Singer',
    status: 'assigned',
    assignedBy: admin._id,
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

  // TEST 1: Admin changes member role in the event to "Guitarist"
  console.log('Test 1: Admin changes member role in the event to Guitarist...');
  const mock1 = mockReqRes({
    user: { userId: admin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { id: event._id.toString(), userId: member._id.toString() },
    body: { role: 'Guitarist' },
  });
  await eventController.updateAssignmentRole(mock1.req, mock1.res);
  const res1 = mock1.getResult();
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.data.assignment.role, 'Guitarist');

  const updatedEvent = await Event.findById(event._id).lean();
  assert.strictEqual(updatedEvent.assignments[0].role, 'Guitarist');

  const updatedAssignment = await Assignment.findOne({ event: event._id, user: member._id }).lean();
  assert.strictEqual(updatedAssignment.role, 'Guitarist');
  console.log('✅ Test 1 Passed: Admin successfully changed role in event.');

  // TEST 2: Non-admin non-creator member blocked from changing someone else's role
  console.log('Test 2: Non-admin member blocked from changing roles...');
  const mock2 = mockReqRes({
    user: { userId: otherMember._id.toString(), churchId: church._id.toString(), isAdmin: false },
    params: { id: event._id.toString(), userId: member._id.toString() },
    body: { role: 'Worship Leader' },
  });
  await eventController.updateAssignmentRole(mock2.req, mock2.res);
  const res2 = mock2.getResult();
  assert.strictEqual(res2.status, 403);
  console.log('✅ Test 2 Passed: Non-admin access properly blocked with 403.');

  // TEST 3: Reject empty role
  console.log('Test 3: Empty role rejected...');
  const mock3 = mockReqRes({
    user: { userId: admin._id.toString(), churchId: church._id.toString(), isAdmin: true },
    params: { id: event._id.toString(), userId: member._id.toString() },
    body: { role: '' },
  });
  await eventController.updateAssignmentRole(mock3.req, mock3.res);
  const res3 = mock3.getResult();
  assert.strictEqual(res3.status, 400);
  console.log('✅ Test 3 Passed: Empty role rejected with 400.');

  // Cleanup
  await User.deleteMany({ _id: { $in: [admin._id, member._id, otherMember._id] } });
  await Event.deleteMany({ _id: event._id });
  await Assignment.deleteMany({ event: event._id });
  await Church.deleteMany({ _id: church._id });

  await mongoose.disconnect();
  console.log('All Event Assignment Role Tests Passed! 🎉');
}

runTests().catch((err) => {
  console.error('Event assignment role test failure:', err);
  process.exit(1);
});
