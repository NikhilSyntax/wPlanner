const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.verifyToken);

// Get notifications for current user
router.get('/', notificationController.getNotifications);

// Mark a notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all as read
router.put('/read-all', notificationController.markAllAsRead);

// Create notification (admin or system)
router.post('/', authMiddleware.roleRestriction(['admin']), notificationController.createNotification);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
