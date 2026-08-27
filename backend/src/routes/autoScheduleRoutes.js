const express = require('express');
const router = express.Router();
const autoScheduleController = require('../controllers/autoScheduleController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');

// All routes require authentication and approved membership
router.use(authMiddleware.verifyToken);
router.use(requireApproved);

// ─── Read routes (any approved member can view schedules) ──────────────────

router.get('/', autoScheduleController.getSchedules);
router.get('/:id', autoScheduleController.getSchedule);

// ─── Write routes (admin, sub-admin, worship leader only) ──────────────────

const canManageSchedules = authMiddleware.roleRestriction([
  'admin',
  'sub_admin',
  'worship leader',
  'worship_leader',
]);

router.post('/', canManageSchedules, autoScheduleController.createSchedule);
router.put('/:id', canManageSchedules, autoScheduleController.updateSchedule);
router.patch('/:id/toggle', canManageSchedules, autoScheduleController.toggleSchedule);
router.delete('/:id', canManageSchedules, autoScheduleController.deleteSchedule);

// Admin-only: manually trigger scheduler for debugging
router.post('/run-now', authMiddleware.adminOnly, autoScheduleController.runNow);

module.exports = router;
