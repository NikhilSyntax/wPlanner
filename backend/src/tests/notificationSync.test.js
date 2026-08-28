const assert = require('assert');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const notificationController = require('../controllers/notificationController');
const eventController = require('../controllers/eventController');

const TEST_MONGO_URI = 'mongodb://localhost:27017/wplanner_test_notif_sync';

async function runNotificationSyncTests() {
  console.log('--- Starting Notification & RSVP Sync Tests ---');
  await mongoose.connect(TEST_MONGO_URI);

  try {
    await Notification.deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
    await Assignment.deleteMany({});

    const churchId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const user = await User.create({
      _id: userId,
      name: 'Worship Vocalist',
      email: 'vocalist@test.com',
      password: 'hash',
      role: 'Singer',
      churchId,
      approvalStatus: 'approved',
    });

    const event = await Event.create({
      churchId,
      createdBy: new mongoose.Types.ObjectId(),
      event: {
        title: 'Sunday Worship Service',
        date: new Date(Date.now() + 86400000),
        status: 'published',
      },
      schedule: {
        start: new Date(Date.now() + 86400000),
        end: new Date(Date.now() + 90000000),
      },
      assignments: [
        {
          userId,
          role: 'Singer',
          status: 'pending',
        },
      ],
    });

    // 1. Create assignment notification
    const notif = await Notification.create({
      recipient: userId,
      type: 'assignment',
      title: 'New Service Assignment 🎵',
      message: 'You have been scheduled for Sunday Worship Service.',
      link: `/events/${event._id}`,
      eventId: event._id,
      actionStatus: 'pending',
    });

    // 2. Mock request & response for getNotifications
    const mockReq = {
      user: { userId: userId.toString(), churchId: churchId.toString(), role: 'Worship Team Member' },
      query: {},
    };

    let responseData = null;
    const mockRes = {
      json: (data) => {
        responseData = data;
        return data;
      },
      status: () => mockRes,
    };

    // Test 1: Notification initially returns pending
    console.log('Test 1: Fetching initial notifications...');
    await notificationController.getNotifications(mockReq, mockRes);
    assert.strictEqual(responseData.notifications.length, 1);
    assert.strictEqual(responseData.notifications[0].actionStatus, 'pending');
    console.log('✅ Test 1 Passed: Initial status is pending.');

    // Test 2: User responds to assignment from EventDetails / Dashboard (accept)
    console.log('Test 2: Responding to assignment via EventDetails endpoint (accept)...');
    const mockEventRespondReq = {
      params: { id: event._id.toString() },
      body: { status: 'accepted' },
      user: { userId: userId.toString(), churchId: churchId.toString() },
    };
    await eventController.respondToAssignment(mockEventRespondReq, mockRes);

    // Verify Notification collection was updated directly
    const directNotif = await Notification.findById(notif._id);
    assert.strictEqual(directNotif.actionStatus, 'accepted');

    // Verify getNotifications returns actionStatus: 'accepted'
    await notificationController.getNotifications(mockReq, mockRes);
    assert.strictEqual(responseData.notifications[0].actionStatus, 'accepted');
    console.log('✅ Test 2 Passed: EventDetails response synced notification actionStatus to accepted.');

    // Test 3: User changes mind to decline from EventDetails
    console.log('Test 3: Changing response to declined...');
    mockEventRespondReq.body.status = 'declined';
    await eventController.respondToAssignment(mockEventRespondReq, mockRes);

    await notificationController.getNotifications(mockReq, mockRes);
    assert.strictEqual(responseData.notifications[0].actionStatus, 'declined');
    console.log('✅ Test 3 Passed: Notification actionStatus dynamically synced to declined.');

    console.log('\nAll Notification & RSVP Sync Tests Passed Successfully! 🎉');
  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

runNotificationSyncTests();
