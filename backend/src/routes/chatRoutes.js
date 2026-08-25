const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :eventId
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');
const { requireEventNotLockedUnlessAdmin } = require('../middleware/blockCompletedEventLock');

router.use(authMiddleware.verifyToken);
router.use(requireApproved);

// Get messages for an event
router.get('/:eventId/messages', chatController.getMessages);

// Send a new message
router.post(
  '/:eventId/messages',
  requireEventNotLockedUnlessAdmin('eventId'),
  chatController.sendMessage,
);

// Delete a message (admin/team_leader only)
router.delete('/messages/:messageId', authMiddleware.roleRestriction(['team_leader', 'admin']), chatController.deleteMessage);

module.exports = router;
