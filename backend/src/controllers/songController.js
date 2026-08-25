const Song = require('../models/Song');
const { enrichSongsUsage } = require('../utils/enrichSongUsage');

// List songs with optional filters — strictly scoped to the user's church
exports.getSongs = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.json([]);
    }
    const { title, artist, key, genre } = req.query;
    const filter = { churchId: req.user.churchId };
    if (title) filter.title = new RegExp(title, 'i');
    if (artist) filter.artist = new RegExp(artist, 'i');
    if (key) filter.key = key;
    if (genre) filter.genre = genre;

    const songs = await Song.find(filter)
      .select('title artist key bpm timeSignature genre usage')
      .sort({ title: 1 })
      .lean();
    const enriched = await enrichSongsUsage(songs);
    res.json(enriched);
  } catch (err) {
    console.error(err);
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single song — must belong to the user's church
exports.getSong = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const song = await Song.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    }).lean();
    if (!song) return res.status(404).json({ message: 'Song not found' });
    const [enriched] = await enrichSongsUsage([song]);
    res.json(enriched);
  } catch (err) {
    console.error(err);
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new song (team_leader or admin) — automatically scoped to the user's church
exports.createSong = async (req, res) => {
  try {
    const { title, artist, album, year, key, bpm, timeSignature, genre, tags, content } = req.body;
    const normalizedTimeSignature = normalizeTimeSignature(timeSignature);
    if (timeSignature != null && timeSignature !== '' && !normalizedTimeSignature) {
      return res.status(400).json({
        message: `Invalid time signature. Allowed: ${VALID_TIME_SIGNATURES.join(', ')}`,
      });
    }
    const song = new Song({
      churchId: req.user.churchId,
      title,
      artist,
      album,
      year,
      key: key || 'C',
      bpm,
      timeSignature: normalizedTimeSignature,
      genre: genre || [],
      tags: tags || [],
      content: content || {}
    });
    await song.save();
    res.status(201).json(song);
  } catch (err) {
    console.error(err);
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

const VALID_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VALID_TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'];

function normalizeTimeSignature(value) {
  if (value == null || value === '') return undefined;
  const trimmed = String(value).trim();
  return VALID_TIME_SIGNATURES.includes(trimmed) ? trimmed : null;
}

// Update a song — must belong to the user's church
exports.updateSong = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const updates = { ...req.body };
    // Prevent churchId from being changed via update
    delete updates.churchId;
    if (updates.key !== undefined && !VALID_KEYS.includes(updates.key)) {
      return res.status(400).json({ message: 'Invalid key' });
    }
    if (updates.timeSignature !== undefined) {
      const normalizedTimeSignature = normalizeTimeSignature(updates.timeSignature);
      if (updates.timeSignature != null && updates.timeSignature !== '' && !normalizedTimeSignature) {
        return res.status(400).json({
          message: `Invalid time signature. Allowed: ${VALID_TIME_SIGNATURES.join(', ')}`,
        });
      }
      updates.timeSignature = normalizedTimeSignature;
    }
    const song = await Song.findOneAndUpdate(
      { _id: req.params.id, churchId: req.user.churchId },
      { $set: updates },
      { new: true }
    );
    if (!song) return res.status(404).json({ message: 'Song not found' });
    res.json(song);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a song — must belong to the user's church
exports.deleteSong = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const song = await Song.findOneAndDelete({
      _id: req.params.id,
      churchId: req.user.churchId,
    });
    if (!song) return res.status(404).json({ message: 'Song not found' });
    res.json({ message: 'Song deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Simple chord transposition helper
const CHORD_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function transposeChord(chord, targetKey) {
  // Very naive: only handles root note like "C", "Dm", "F#", etc.
  const noteMatch = chord.match(/^([A-G]#?)m?/);
  if (!noteMatch) return chord;
  const root = noteMatch[1];
  const idx = CHORD_ORDER.indexOf(root);
  if (idx === -1) return chord;
  const targetIdx = CHORD_ORDER.indexOf(targetKey);
  if (targetIdx === -1) return chord;
  const shift = (targetIdx - idx + 12) % 12;
  const newRoot = CHORD_ORDER[(idx + shift) % 12];
  return chord.replace(root, newRoot);
}

// Transpose song chords to a target key — must belong to the user's church
exports.transposeSong = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const { targetKey } = req.body;
    if (!CHORD_ORDER.includes(targetKey)) {
      return res.status(400).json({ message: 'Invalid key' });
    }
    const song = await Song.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    });
    if (!song) return res.status(404).json({ message: 'Song not found' });

    // For simplicity, return the song with a `transposedKey` field.
    // In a real app you'd transpose the actual chord chart.
    res.json({
      originalKey: song.key,
      targetKey,
      transposedChords: song.content?.chords // placeholder
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
