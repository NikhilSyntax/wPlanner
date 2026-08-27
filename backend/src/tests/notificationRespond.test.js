const mongoose = require('mongoose');
const assert = require('assert');
const config = require('../config/config')();
const User = require('../models/User');
const Church = require('../models/Church');
const Event = require('../models/Event');
const Assignment = require('../models/Assignment');
const Notification = require('../models/Notification');
const notificationController = require('../controllers/notificationController');

async function runTests() {
  console.log('--- Starting Notification Response Integration Tests ---');

  await mongoose.connect(config.mongoUri);

  const testCode = 'NOTIF1';
  await Church.deleteMany({ churchCode: testCode });
  await User.deleteMany({ email: 'notiftestuser@test.com' });

  const church = await Church.create({ name: 'Notif Test Church', churchCode: testCode });

  const user = await User.create({
    name: 'Noah Notif',
    email: 'notiftestuser@test.com',
    password: 'password',
    role: 'Guitarist',
    churchId: church._id,
    approvalStatus: 'approved',
  });

  const event = await Event.create({
    churchId: church._id,
    createdBy: user._id,
    event: {
      title: 'Sunday Worship Celebration',
      type: 'service',
      status: 'published',
    },
    schedule: {
      start: new Date(Date.now() + 86400000 * 3),
      end: new Date(Date.now() + 86400000 * 3 + 7200000),
    },
    assignments: [
      {
        userId: user._id,
        role: 'Acoustic Guitar',
        status: 'assigned',
      },
    ],
  });

  const assignmentDoc = await Assignment.create({
    event: event._id,
    user: user._id,
    role: 'Acoustic Guitar',
    status: 'assigned',
    assignedBy: user._id,
  });

  const notification = await Notification.create({
    recipient: user._id,
    type: 'assignment',
    title: 'New Worship Assignment 🎵',
    message: 'You were assigned as Acoustic Guitar for Sunday Worship Celebration.',
    link: `/events/${event._id}`,
    eventId: event._id,
    actionStatus: 'pending',
    assignmentRole: 'Acoustic Guitar',
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

  // TEST 1: Respond with 'accept'
  console.log('Test 1: User responds "accept" to notification...');
  const mock1 = mockReqRes({
    user: { userId: user._id.toString(), churchId: church._id.toString() },
    params: { id: notification._id.toString() },
    body: { action: 'accept' },
  });
  await notificationController.respondToNotification(mock1.req, mock1.res);
  const res1 = mock1.getResult();

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.data.status, 'accepted');

  const updatedNotif = await Notification.findById(notification._id).lean();
  assert.strictEqual(updatedNotif.actionStatus, 'accepted');
  assert.strictEqual(updatedNotif.read, true);

  const updatedEvent = await Event.findById(event._id).lean();
  const userAss = updatedEvent.assignments.find((a) => a.userId.toString() === user._id.toString());
  assert.strictEqual(userAss.status, 'accepted');

  const updatedAssDoc = await Assignment.findById(assignmentDoc._id).lean();
  assert.strictEqual(updatedAssDoc.status, 'accepted');
  console.log('✅ Test 1 Passed: Accepting notification successfully updated event assignments and Assignment doc.');

  // TEST 2: Respond with 'decline'
  console.log('Test 2: User responds "decline" to notification...');
  const mock2 = mockReqRes({
    user: { userId: user._id.toString(), churchId: church._id.toString() },
    params: { id: notification._id.toString() },
    body: { action: 'decline' },
  });
  await notificationController.respondToNotification(mock2.req, mock2.res);
  const res2 = mock2.getResult();

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.data.status, 'declined');

  const declinedEvent = await Event.findById(event._id).lean();
  const declinedAss = declinedEvent.assignments.find((a) => a.userId.toString() === user._id.toString());
  assert.strictEqual(declinedAss.status, 'declined');
  console.log('✅ Test 2 Passed: Declining notification successfully updated event assignments to declined.');

  // Cleanup
  await Notification.deleteMany({ recipient: user._id });
  await Assignment.deleteMany({ user: user._id });
  await Event.deleteMany({ _id: event._id });
  await User.deleteMany({ _id: user._id });
  await Church.deleteMany({ _id: church._id });

  await mongoose.disconnect();
  console.log('All Notification Response Integration Tests Passed! 🎉');
}

runTests().catch((err) => {
  console.error('Notification respond test failure:', err);
  process.exit(1);
});
