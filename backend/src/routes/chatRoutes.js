const express = require('express');
const router = express.Router({ mergeParams: true });
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');
const { requireEventNotLockedUnlessAdmin } = require('../middleware/blockCompletedEventLock');

router.use(authMiddleware.verifyToken);
router.use(requireApproved);

// Church Roster Messages
router.get('/church/messages', chatController.getChurchMessages);
router.post('/church/messages', chatController.sendChurchMessage);
router.get('/church-messages', chatController.getChurchMessages);
router.post('/church-messages', chatController.sendChurchMessage);

// Event messages (under /api/events or /api)
router.get('/:eventId/messages', chatController.getMessages);
router.post(
  '/:eventId/messages',
  requireEventNotLockedUnlessAdmin('eventId'),
  chatController.sendMessage
);
router.get('/events/:eventId/messages', chatController.getMessages);
router.post(
  '/events/:eventId/messages',
  requireEventNotLockedUnlessAdmin('eventId'),
  chatController.sendMessage
);

// Team messages (under /api/teams or /api)
router.get('/:teamId/team-messages', chatController.getTeamMessages);
router.post('/:teamId/team-messages', chatController.sendTeamMessage);
router.get('/teams/:teamId/messages', chatController.getTeamMessages);
router.post('/teams/:teamId/messages', chatController.sendTeamMessage);

// Delete a message (admin/team_leader only)
router.delete('/messages/:messageId', authMiddleware.roleRestriction(['team_leader', 'admin']), chatController.deleteMessage);

module.exports = router;
