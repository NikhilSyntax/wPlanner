const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');
const songImportController = require('../controllers/songImportController');
const authMiddleware = require('../middleware/authMiddleware');
const requireApproved = require('../middleware/requireApproved');

router.use(authMiddleware.verifyToken);
router.use(requireApproved);

// Search songs from external provider (e.g. Ultimate Guitar)
router.get('/import/search', songImportController.searchSongs);

// Import song from external provider (e.g. Ultimate Guitar)
router.post('/import', songImportController.importSong);

// Parse raw pasted chord/lyric text (manual fallback)
router.post('/parse-raw', songImportController.parseRaw);

// List songs (public optional filters)
router.get('/', songController.getSongs);

// Get single song
router.get('/:id', songController.getSong);

// Create song (team_leader or admin)
router.post('/', songController.createSong);

// Update song (team_leader or admin)
router.put('/:id', songController.updateSong);

// Update song usage / last used date (team_leader or admin)
router.put('/:id/usage', songController.updateSongUsage);

// Delete song (team_leader or admin)
router.delete('/:id', songController.deleteSong);

// Transpose song chords
router.post('/:id/transpose', authMiddleware.roleRestriction(['team_leader', 'admin']), songController.transposeSong);

// Per-user personal key and transposed chords preference (accessible to all church members)
router.get('/:id/personal-key', songController.getUserSongPreference);
router.put('/:id/personal-key', songController.saveUserSongPreference);
router.delete('/:id/personal-key', songController.deleteUserSongPreference);

module.exports = router;
