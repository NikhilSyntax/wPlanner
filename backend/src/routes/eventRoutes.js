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

// Create event (team_leader, admin, worship leader, pastor, elder)
router.post(
  '/',
  authMiddleware.roleRestriction([
    'team_leader',
    'admin',
    'worship leader',
    'worship_leader',
    'pastor',
    'elder',
  ]),
  eventController.createEvent
);

// Update event (allowed for church members on unlocked events)
router.put(
  '/:id',
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.updateEvent
);

// Delete event (team_leader, admin, worship leader, pastor, elder)
router.delete(
  '/:id',
  authMiddleware.roleRestriction([
    'team_leader',
    'admin',
    'worship leader',
    'worship_leader',
    'pastor',
    'elder',
  ]),
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.deleteEvent
);

// Setlists removed

// Add assignment to event
router.post(
  '/:id/assignments',
  authMiddleware.roleRestriction([
    'team_leader',
    'admin',
    'worship leader',
    'worship_leader',
    'pastor',
    'elder',
  ]),
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.addAssignment
);
router.post(
  '/:id/event-team',
  authMiddleware.roleRestriction([
    'team_leader',
    'admin',
    'worship leader',
    'worship_leader',
    'pastor',
    'elder',
  ]),
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.setEventTeamFromRoster,
);
// Get assignments for event
router.get('/:id/assignments', requireSameChurch(Event), eventController.getAssignments);
// Delete an assignment
router.delete(
  '/:id/assignments/:assignmentId',
  authMiddleware.roleRestriction([
    'team_leader',
    'admin',
    'worship leader',
    'worship_leader',
    'pastor',
    'elder',
  ]),
  requireSameChurch(Event),
  blockCompletedEventLock,
  eventController.deleteAssignment
);

// Approve or reject an assignment (admin, team_leader, worship leader)
router.post(
  '/assignments/:assignmentId/approval',
  authMiddleware.roleRestriction([
    'team_leader',
    'admin',
    'worship leader',
    'worship_leader',
    'pastor',
    'elder',
  ]),
  requireSameChurch(Event),
  eventController.approveAssignment
);

module.exports = router;
