const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const Event = require('../models/Event');
const Assignment = require('../models/Assignment');
const eventController = require('../controllers/eventController');
const userController = require('../controllers/userController');

async function runTests() {
  console.log('--- Starting Volunteer Opt-In Tests ---');

  await mongoose.connect(config.mongoUri);

  const testCode = 'OPTIN1';
  const testCode2 = 'OPTIN2';
  await Church.deleteMany({ churchCode: { $in: [testCode, testCode2] } });
  await User.deleteMany({ email: { $in: ['optinv1@test.com', 'optinadmin@test.com', 'optinchurchb@test.com'] } });

  const churchA = await Church.create({ name: 'OptIn Church A', churchCode: testCode });
  const churchB = await Church.create({ name: 'OptIn Church B', churchCode: testCode2 });

  const volunteer = await User.create({
    name: 'Volunteer Vanessa',
    email: 'optinv1@test.com',
    password: 'password',
    role: 'Singer',
    churchId: churchA._id,
    approvalStatus: 'approved',
  });

  const admin = await User.create({
    name: 'Leader Larry',
    email: 'optinadmin@test.com',
    password: 'password',
    role: 'Admin',
    isAdmin: true,
    churchId: churchA._id,
    approvalStatus: 'approved',
  });

  const foreignMember = await User.create({
    name: 'Foreign Frank',
    email: 'optinchurchb@test.com',
    password: 'password',
    role: 'Drummer',
    churchId: churchB._id,
    approvalStatus: 'approved',
  });

  await Event.deleteMany({ churchId: { $in: [churchA._id, churchB._id] } });

  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  // Upcoming published event
  const upcomingEvent = await Event.create({
    event: { title: 'Sunday Celebration', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now + 2 * oneDay),
      end: new Date(now + 2 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    churchId: churchA._id,
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

  // TEST 1: Volunteer opts in
  console.log('Test 1: Member opts in to upcoming event...');
  const mockOptIn = mockReqRes({
    user: { userId: volunteer._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
    params: { id: upcomingEvent._id.toString() },
    body: { role: 'Lead Vocals', notes: 'Available from 9 AM' },
  });
  await eventController.optInToEvent(mockOptIn.req, mockOptIn.res);
  const resOptIn = mockOptIn.getResult();
  assert.strictEqual(resOptIn.status, 200);

  const updatedEv = await Event.findById(upcomingEvent._id).lean();
  const optInAssignment = updatedEv.assignments.find(a => a.userId.toString() === volunteer._id.toString());
  assert.ok(optInAssignment, 'Volunteer must be in assignments');
  assert.strictEqual(optInAssignment.status, 'opt_in_pending', 'Status must be opt_in_pending');
  assert.strictEqual(optInAssignment.role, 'Lead Vocals');
  assert.strictEqual(optInAssignment.notes, 'Available from 9 AM');
  console.log('✅ Test 1 Passed: Opt-in created successfully with status opt_in_pending.');

  // TEST 2: Check ministry stats while in opt_in_pending
  console.log('Test 2: Verify stats while in opt_in_pending...');
  const mockStats1 = mockReqRes({
    user: { userId: volunteer._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
  });
  await userController.getMinistryStatistics(mockStats1.req, mockStats1.res);
  const resStats1 = mockStats1.getResult();
  assert.strictEqual(resStats1.data.served, 0, 'Served count must be 0');
  assert.strictEqual(resStats1.data.upcomingAssignments, 0, 'Pending opt-in must NOT count as upcoming assignment');
  console.log('✅ Test 2 Passed: opt_in_pending does not increment upcoming or served statistics.');

  // TEST 3: Admin confirms opted-in volunteer into active team
  console.log('Test 3: Leader confirms opted-in volunteer into team...');
  const mockReview = mockReqRes({
    user: { userId: admin._id.toString(), churchId: churchA._id.toString(), isAdmin: true },
    params: { id: upcomingEvent._id.toString(), userId: volunteer._id.toString() },
    body: { action: 'confirm', role: 'Main Vocals' },
  });
  await eventController.reviewOptInVolunteer(mockReview.req, mockReview.res);
  const resReview = mockReview.getResult();
  assert.strictEqual(resReview.status, 200);

  const evAfterConfirm = await Event.findById(upcomingEvent._id).lean();
  const confirmedAssignment = evAfterConfirm.assignments.find(a => a.userId.toString() === volunteer._id.toString());
  assert.strictEqual(confirmedAssignment.status, 'accepted', 'Status must now be accepted');
  assert.strictEqual(confirmedAssignment.role, 'Main Vocals');

  // TEST 4: Check ministry stats after confirmation
  console.log('Test 4: Verify stats after leader confirmation...');
  const mockStats2 = mockReqRes({
    user: { userId: volunteer._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
  });
  await userController.getMinistryStatistics(mockStats2.req, mockStats2.res);
  const resStats2 = mockStats2.getResult();
  assert.strictEqual(resStats2.data.upcomingAssignments, 1, 'Upcoming count must now be 1');
  console.log('✅ Test 4 Passed: Confirmed volunteer counts in upcoming assignments.');

  // TEST 5: Withdraw test on another event
  console.log('Test 5: Volunteer withdraws opt-in before review...');
  const event2 = await Event.create({
    event: { title: 'Youth Night', status: 'published', type: 'service' },
    schedule: {
      start: new Date(now + 3 * oneDay),
      end: new Date(now + 3 * oneDay + 2 * oneHour),
      timezone: 'UTC',
    },
    churchId: churchA._id,
    createdBy: admin._id,
    assignments: [],
  });

  const mockOptIn2 = mockReqRes({
    user: { userId: volunteer._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
    params: { id: event2._id.toString() },
    body: { role: 'Backup Vocals' },
  });
  await eventController.optInToEvent(mockOptIn2.req, mockOptIn2.res);

  const mockWithdraw = mockReqRes({
    user: { userId: volunteer._id.toString(), churchId: churchA._id.toString(), isAdmin: false },
    params: { id: event2._id.toString() },
  });
  await eventController.withdrawOptIn(mockWithdraw.req, mockWithdraw.res);
  const resWithdraw = mockWithdraw.getResult();
  assert.strictEqual(resWithdraw.status, 200);

  const ev2AfterWithdraw = await Event.findById(event2._id).lean();
  assert.strictEqual(ev2AfterWithdraw.assignments.length, 0, 'Volunteer should be removed after withdrawing');
  console.log('✅ Test 5 Passed: Volunteer successfully withdrew opt-in.');

  // Cleanup
  await Event.deleteMany({ churchId: { $in: [churchA._id, churchB._id] } });
  await Assignment.deleteMany({ user: { $in: [volunteer._id, admin._id, foreignMember._id] } });
  await User.deleteMany({ _id: { $in: [volunteer._id, admin._id, foreignMember._id] } });
  await Church.deleteMany({ _id: { $in: [churchA._id, churchB._id] } });

  await mongoose.disconnect();
  console.log('All Volunteer Opt-In Tests Passed! 🎉');
}

runTests().catch((err) => {
  console.error('Opt-in test failure:', err);
  process.exit(1);
});
