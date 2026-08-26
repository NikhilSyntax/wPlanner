const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.verifyToken);

// Web Push VAPID public key & subscription endpoints
router.get('/vapid-public-key', notificationController.getVapidPublicKey);
router.post('/push-subscribe', notificationController.subscribePush);
router.post('/push-unsubscribe', notificationController.unsubscribePush);
router.post('/test-push', notificationController.sendTestPush);

// Get notifications for current user
router.get('/', notificationController.getNotifications);

// Mark a notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead);

// Respond to notification assignment action (accept/decline)
router.post('/:id/respond', notificationController.respondToNotification);

// Create notification (admin or system)
router.post('/', authMiddleware.roleRestriction(['admin']), notificationController.createNotification);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
