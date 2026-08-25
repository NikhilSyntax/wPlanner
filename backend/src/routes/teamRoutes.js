const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');
const requireSameChurch = require('../middleware/requireSameChurch');
const Team = require('../models/Team');

router.use(authMiddleware.verifyToken);
router.use(requireApproved);

// List teams
router.get('/', teamController.getTeams);

// Get single team
router.get('/:id', requireSameChurch(Team), teamController.getTeam);

// Create team (admin only)
router.post('/', authMiddleware.roleRestriction(['admin']), teamController.createTeam);

// Update team (admin only)
router.put('/:id', authMiddleware.roleRestriction(['admin']), requireSameChurch(Team), teamController.updateTeam);

// Delete team (admin only)
router.delete('/:id', authMiddleware.roleRestriction(['admin']), requireSameChurch(Team), teamController.deleteTeam);

// Add member to team (admin only)
router.post(
  '/:id/members',
  authMiddleware.roleRestriction(['admin']),
  requireSameChurch(Team),
  teamController.addMember
);

module.exports = router;
