/**
 * wPlanner v4 — Auto Event Scheduler Integration Tests
 *
 * Tests: weekly recurrence calculation, event generation, idempotency,
 * cancelled-event protection, disabled schedule, multi-tenancy, permissions.
 */

const assert = require('assert');
const mongoose = require('mongoose');

// ─── Bootstrap models ──────────────────────────────────────────────────────
const AutoEventSchedule = require('../models/AutoEventSchedule');
const Event = require('../models/Event');
const Church = require('../models/Church');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Scheduler utilities
const {
  getNextOccurrences,
  getNthWeekdayOfMonth,
  processAutoSchedules,
} = require('../utils/autoEventScheduler');

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/wplanner_test_autoschedule';

async function cleanup() {
  await AutoEventSchedule.deleteMany({});
  await Event.deleteMany({});
  await Church.deleteMany({});
  await User.deleteMany({});
  await Notification.deleteMany({});
}

async function runTests() {
  console.log('--- Starting Auto Event Scheduler Tests ---');
  await mongoose.connect(TEST_MONGO_URI);
  console.log('Connected to MongoDB for testing.');
  await cleanup();

  // ─── Seed test data ────────────────────────────────────────────────────

  const churchA = await Church.create({
    name: 'Alpha Church',
    churchCode: 'ALPH01',
    createdBy: new mongoose.Types.ObjectId(),
  });

  const churchB = await Church.create({
    name: 'Beta Church',
    churchCode: 'BETA02',
    createdBy: new mongoose.Types.ObjectId(),
  });

  const adminA = await User.create({
    name: 'Admin Alpha',
    email: 'admin_alpha_sched@test.com',
    password: 'hashedpass',
    role: 'Admin',
    isAdmin: true,
    churchId: churchA._id,
  });

  const memberA = await User.create({
    name: 'Member Alpha',
    email: 'member_alpha_sched@test.com',
    password: 'hashedpass',
    role: 'Member',
    isAdmin: false,
    churchId: churchA._id,
  });

  const adminB = await User.create({
    name: 'Admin Beta',
    email: 'admin_beta_sched@test.com',
    password: 'hashedpass',
    role: 'Admin',
    isAdmin: true,
    churchId: churchB._id,
  });

  // ─── Test 1: Weekly recurrence — next Sunday ──────────────────────────

  console.log('Test 1: Weekly recurrence finds next Sunday...');
  const sundaySchedule = {
    frequency: 'weekly',
    dayOfWeek: 0, // Sunday
    timezone: 'Asia/Kolkata',
  };
  const sundayOccs = getNextOccurrences(sundaySchedule, 3);
  assert.strictEqual(sundayOccs.length, 3, 'Should return 3 occurrences');
  // Each occurrence should be a Sunday
  for (const occ of sundayOccs) {
    const d = new Date(occ.year, occ.month - 1, occ.day);
    assert.strictEqual(d.getDay(), 0, `Occurrence ${occ.day}/${occ.month}/${occ.year} should be Sunday`);
  }
  console.log('✅ Test 1 Passed: Weekly Sunday recurrence works correctly.');

  // ─── Test 2: All 7 days of the week ──────────────────────────────────

  console.log('Test 2: All 7 days resolve correctly...');
  for (let dayNum = 0; dayNum <= 6; dayNum++) {
    const sched = { frequency: 'weekly', dayOfWeek: dayNum, timezone: 'UTC' };
    const occs = getNextOccurrences(sched, 2);
    assert(occs.length >= 1, `Day ${dayNum} should have at least 1 occurrence`);
    const d = new Date(occs[0].year, occs[0].month - 1, occs[0].day);
    assert.strictEqual(d.getDay(), dayNum, `Day ${dayNum} occurrence should match`);
  }
  console.log('✅ Test 2 Passed: All 7 days resolve correctly.');

  // ─── Test 3: Monthly — Nth weekday ───────────────────────────────────

  console.log('Test 3: Monthly Nth weekday calculation...');
  // First Sunday of September 2026
  const firstSunSep = getNthWeekdayOfMonth(2026, 9, 0, 1);
  assert(firstSunSep !== null, 'Should find first Sunday');
  const firstSunDate = new Date(2026, 8, firstSunSep.day);
  assert.strictEqual(firstSunDate.getDay(), 0, 'Should be a Sunday');
  assert(firstSunSep.day <= 7, 'First occurrence should be in first week');

  // Last Sunday of September 2026
  const lastSunSep = getNthWeekdayOfMonth(2026, 9, 0, 5);
  assert(lastSunSep !== null, 'Should find last Sunday');
  const lastSunDate = new Date(2026, 8, lastSunSep.day);
  assert.strictEqual(lastSunDate.getDay(), 0, 'Should be a Sunday');
  console.log('✅ Test 3 Passed: Monthly Nth weekday calculation works.');

  // ─── Test 4: Event generation within creation window ─────────────────

  console.log('Test 4: Event generated within creation window...');

  // Create a schedule for a day that's within 3 days from now
  const now = new Date();
  const targetDay = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
  const targetDOW = targetDay.getDay();

  const scheduleA = await AutoEventSchedule.create({
    churchId: churchA._id,
    createdBy: adminA._id,
    name: 'Test Worship Service',
    frequency: 'weekly',
    dayOfWeek: targetDOW,
    startTime: '10:30',
    endTime: '12:00',
    timezone: 'UTC',
    eventType: 'service',
    creationOffsetDays: 3,
    reminders: [
      { offsetDays: 3, enabled: true },
      { offsetDays: 1, enabled: true },
    ],
  });

  await processAutoSchedules();

  const generatedEvents = await Event.find({
    autoScheduleId: scheduleA._id,
  }).lean();

  assert(generatedEvents.length >= 1, 'Should have generated at least 1 event');
  const genEvent = generatedEvents[0];
  assert.strictEqual(genEvent.event.title, 'Test Worship Service');
  assert.strictEqual(genEvent.event.status, 'published');
  assert.strictEqual(String(genEvent.churchId), String(churchA._id));
  assert.strictEqual(String(genEvent.autoScheduleId), String(scheduleA._id));
  assert(genEvent.occurrenceDate, 'Should have occurrenceDate set');
  console.log('✅ Test 4 Passed: Event generated correctly within creation window.');

  // ─── Test 5: Idempotency — running scheduler multiple times ──────────

  console.log('Test 5: Idempotency check (run scheduler 3 times)...');
  await processAutoSchedules();
  await processAutoSchedules();
  await processAutoSchedules();

  const afterMultiRun = await Event.countDocuments({
    autoScheduleId: scheduleA._id,
  });
  assert.strictEqual(afterMultiRun, generatedEvents.length, 'No duplicates after multiple scheduler runs');
  console.log('✅ Test 5 Passed: Running scheduler 3 additional times created no duplicates.');

  // ─── Test 6: Cancelled event not recreated ───────────────────────────

  console.log('Test 6: Cancelled event not recreated...');
  await Event.updateOne(
    { _id: genEvent._id },
    { $set: { 'event.status': 'cancelled' } }
  );
  await processAutoSchedules();

  const cancelledCheck = await Event.find({
    autoScheduleId: scheduleA._id,
    occurrenceDate: genEvent.occurrenceDate,
  }).lean();
  assert.strictEqual(cancelledCheck.length, 1, 'Should still be only 1 event (not recreated)');
  assert.strictEqual(cancelledCheck[0].event.status, 'cancelled', 'Should still be cancelled');
  console.log('✅ Test 6 Passed: Cancelled event was not recreated.');

  // ─── Test 7: Disabled schedule generates nothing ─────────────────────

  console.log('Test 7: Disabled schedule generates nothing...');
  // Clean up and create a fresh schedule that's disabled
  const disabledSchedule = await AutoEventSchedule.create({
    churchId: churchA._id,
    createdBy: adminA._id,
    name: 'Disabled Service',
    frequency: 'weekly',
    dayOfWeek: targetDOW,
    startTime: '18:00',
    endTime: '20:00',
    timezone: 'UTC',
    creationOffsetDays: 7,
    isActive: false,
    reminders: [],
  });

  await processAutoSchedules();

  const disabledEvents = await Event.countDocuments({
    autoScheduleId: disabledSchedule._id,
  });
  assert.strictEqual(disabledEvents, 0, 'Disabled schedule should generate 0 events');
  console.log('✅ Test 7 Passed: Disabled schedule generates nothing.');

  // ─── Test 8: Multi-tenancy isolation ─────────────────────────────────

  console.log('Test 8: Multi-tenancy isolation...');
  const scheduleB = await AutoEventSchedule.create({
    churchId: churchB._id,
    createdBy: adminB._id,
    name: 'Beta Worship',
    frequency: 'weekly',
    dayOfWeek: targetDOW,
    startTime: '09:00',
    endTime: '11:00',
    timezone: 'UTC',
    creationOffsetDays: 3,
    reminders: [],
  });

  await processAutoSchedules();

  const betaEvents = await Event.find({
    autoScheduleId: scheduleB._id,
  }).lean();
  assert(betaEvents.length >= 1, 'Church B should have generated events');
  assert.strictEqual(
    String(betaEvents[0].churchId),
    String(churchB._id),
    'Generated event should belong to Church B'
  );

  // Ensure Church A events don't belong to Church B
  const crossCheck = await Event.find({
    autoScheduleId: scheduleA._id,
    churchId: churchB._id,
  }).lean();
  assert.strictEqual(crossCheck.length, 0, 'Church A schedule should not produce Church B events');
  console.log('✅ Test 8 Passed: Multi-tenancy isolation maintained.');

  // ─── Test 9: Generated event is a normal Event ───────────────────────

  console.log('Test 9: Generated event behaves like a normal event...');
  // Re-fetch a non-cancelled generated event
  const normalEvent = await Event.findOne({
    autoScheduleId: scheduleB._id,
    'event.status': { $ne: 'cancelled' },
  }).lean();

  assert(normalEvent, 'Should find a generated event');
  assert(normalEvent.event.title, 'Should have a title');
  assert(normalEvent.schedule.start, 'Should have schedule.start');
  assert(normalEvent.schedule.end, 'Should have schedule.end');
  assert(normalEvent.createdBy, 'Should have createdBy');
  assert(normalEvent.churchId, 'Should have churchId');
  // Can add assignments (same schema structure as manual events)
  assert(Array.isArray(normalEvent.assignments), 'Should have assignments array');
  assert(Array.isArray(normalEvent.setlist), 'Should have setlist array');
  console.log('✅ Test 9 Passed: Generated event is a fully normal wPlanner Event.');

  // ─── Test 10: Event NOT generated outside creation window ────────────

  console.log('Test 10: Event NOT generated outside creation window...');
  const farFutureSchedule = await AutoEventSchedule.create({
    churchId: churchA._id,
    createdBy: adminA._id,
    name: 'Far Future Service',
    frequency: 'weekly',
    // Pick a day that's 5+ days away
    dayOfWeek: (new Date().getDay() + 5) % 7,
    startTime: '14:00',
    endTime: '16:00',
    timezone: 'UTC',
    creationOffsetDays: 1, // Only create 1 day before
    reminders: [],
  });

  await processAutoSchedules();

  const farEvents = await Event.countDocuments({
    autoScheduleId: farFutureSchedule._id,
  });
  assert.strictEqual(farEvents, 0, 'Should NOT generate event outside 1-day creation window');
  console.log('✅ Test 10 Passed: Event not generated outside creation window.');

  // ─── Cleanup ─────────────────────────────────────────────────────────

  await cleanup();
  await mongoose.disconnect();
  console.log('All Auto Event Scheduler Tests Passed! 🎉');
}

runTests().catch((err) => {
  console.error('Auto Event Scheduler test failure:', err);
  process.exit(1);
});
