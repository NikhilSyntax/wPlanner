const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');

router.use(authMiddleware.verifyToken);
router.use(requireApproved);

// List songs (public optional filters)
router.get('/', songController.getSongs);

// Get single song
router.get('/:id', songController.getSong);

// Create song (team_leader or admin)
router.post('/', songController.createSong);

// Update song (team_leader or admin)
router.put('/:id', songController.updateSong);

// Delete song (team_leader or admin)
router.delete('/:id', songController.deleteSong);

// Transpose song chords
router.post('/:id/transpose', authMiddleware.roleRestriction(['team_leader', 'admin']), songController.transposeSong);

module.exports = router;
