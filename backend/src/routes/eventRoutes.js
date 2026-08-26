const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');
const requireSameChurch = require('../middleware/requireSameChurch');
const { blockCompletedEventLock } = require('../middleware/blockCompletedEventLock');
const Event = require('../models/Event');

// Protect all routes
router.use(authMiddleware.verifyToken);
router.use(requireApproved);

// List events
router.get('/', eventController.getEvents);

// Get single event
router.get('/:id', requireSameChurch(Event), eventController.getEvent);

// Create event (open to all church members; drafts for non-admins)
router.post(
  '/',
  eventController.createEvent
);

// Update event (allowed for church members on unlocked events)
router.put(
  '/:id',
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.updateEvent
);

// Delete event (Full Admin only)
router.delete(
  '/:id',
  authMiddleware.fullAdminOnly,
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.deleteEvent
);

// Setlists removed

// Add assignment to event
router.post(
  '/:id/assignments',
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.addAssignment
);
router.post(
  '/:id/event-team',
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.setEventTeamFromRoster,
);

// Manual 24h Advance Reminder Dispatch
router.post(
  '/:id/send-reminder',
  authMiddleware.roleRestriction([
    'team_leader',
    'admin',
    'worship leader',
    'worship_leader',
    'pastor',
    'elder',
  ]),
  requireSameChurch(Event),
  eventController.triggerEventReminder,
);

// Get assignments for event
router.get('/:id/assignments', requireSameChurch(Event), eventController.getAssignments);

// Delete an assignment
router.delete(
  '/:id/assignments/:assignmentId',
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.deleteAssignment
);

// Approve or reject an assignment
router.post(
  '/assignments/:assignmentId/approval',
  requireSameChurch(Event),
  eventController.approveAssignment
);

module.exports = router;
