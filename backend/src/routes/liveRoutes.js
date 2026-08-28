const express = require('express');
const router = express.Router();
const liveController = require('../controllers/liveController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');
const requireSameChurch = require('../middleware/requireSameChurch');
const Event = require('../models/Event');

// Display Pairing & Viewer endpoints (Public, verified via pairing code & display token or direct pop-out event link)
router.post('/pair', liveController.pairDisplay);
router.get('/viewer/state/:token', liveController.getViewerState);
router.get('/viewer/event/:eventId', liveController.getViewerStateByEvent);

// Operator endpoints (Requires login, church approval & church scoping)
router.use('/session', authMiddleware.verifyToken);
router.use('/session', requireApproved);

router.get('/session/:eventId', requireSameChurch(Event, 'eventId'), liveController.getOrCreateLiveSession);
router.post('/session/:eventId', requireSameChurch(Event, 'eventId'), liveController.getOrCreateLiveSession);

module.exports = router;
