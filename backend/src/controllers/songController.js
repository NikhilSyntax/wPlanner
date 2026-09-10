const Song = require('../models/Song');
const UserSongPreference = require('../models/UserSongPreference');
const { enrichSongsUsage } = require('../utils/enrichSongUsage');
const { defaultSongImportService } = require('../services/songImport/SongImportService');
const { transposeChordsText } = require('../utils/songParser');

const VALID_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const VALID_TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8'];

const ENHARMONIC_MAP = {
  DB: 'C#',
  EB: 'D#',
  GB: 'F#',
  AB: 'G#',
  BB: 'A#',
};

function normalizeKey(key) {
  if (!key || typeof key !== 'string') return 'C';
  const trimmed = key.trim();
  const match = trimmed.match(/^([A-Ga-g][#b]?)/);
  if (!match) return VALID_KEYS.includes(trimmed.toUpperCase()) ? trimmed.toUpperCase() : 'C';
  let root = match[1].toUpperCase();
  if (root.length === 2 && root[1] === 'B' && ENHARMONIC_MAP[root]) {
    root = ENHARMONIC_MAP[root];
  }
  return VALID_KEYS.includes(root) ? root : 'C';
}

function normalizeTimeSignature(value) {
  if (value == null || value === '') return undefined;
  const trimmed = String(value).trim();
  return VALID_TIME_SIGNATURES.includes(trimmed) ? trimmed : null;
}

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

    // Attach per-user preference if present for the current user
    const userId = req.user._id || req.user.id;
    if (userId) {
      const userPref = await UserSongPreference.findOne({
        songId: song._id,
        userId,
      }).lean();
      if (userPref) {
        enriched.userPreference = {
          key: userPref.key,
          transpose: userPref.transpose,
          capo: userPref.capo,
          chords: userPref.chords,
          updatedAt: userPref.updatedAt,
        };
      }
    }

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
    const { title, artist, album, year, key, bpm, timeSignature, genre, tags, content, source, capo, tuning, autoImport } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Song title is required' });
    }

    const trimmedTitle = title.trim();

    // Check if song already exists for this church (case-insensitive exact title match)
    const escapedTitle = trimmedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Song.findOne({
      churchId: req.user.churchId,
      title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    let finalTitle = trimmedTitle;
    let finalArtist = artist;
    let finalKey = key ? normalizeKey(key) : null;
    let finalBpm = bpm;
    let finalTimeSignature = normalizeTimeSignature(timeSignature);
    let finalContent = content || {};
    let finalSource = source || { type: 'manual' };
    let finalCapo = typeof capo === 'number' ? capo : 0;
    let finalTuning = tuning || 'Standard';

    // Auto-import chord chart from Ultimate Guitar with typo tolerance if no chords content was supplied
    const shouldAutoImport =
      autoImport !== false &&
      (!content || (!content.chords && !content.lyrics && !content.tabs));

    if (shouldAutoImport) {
      try {
        const importResult = await defaultSongImportService.autoImportBestMatch({
          query: trimmedTitle,
          churchId: req.user.churchId,
          keyPreference: key,
        });

        if (importResult.imported && importResult.song) {
          const imported = importResult.song;
          // Use official song title from Ultimate Guitar if user typed a typo
          finalTitle = imported.title || trimmedTitle;
          finalArtist = finalArtist || imported.artist;
          if (!finalKey && imported.key) {
            finalKey = normalizeKey(imported.key);
          }
          finalBpm = finalBpm || imported.bpm;
          if (!finalTimeSignature && imported.timeSignature) {
            finalTimeSignature = normalizeTimeSignature(imported.timeSignature);
          }
          finalContent = imported.content || finalContent;
          finalSource = imported.source || {
            type: 'external',
            provider: 'ultimate_guitar',
            url: importResult.match?.url,
            importedAt: new Date(),
          };
          if (typeof imported.capo === 'number') {
            finalCapo = imported.capo;
          }
          if (imported.tuning) {
            finalTuning = imported.tuning;
          }
        }
      } catch (importErr) {
        console.warn('Auto-import on song create encountered error:', importErr.message);
      }
    }

    if (timeSignature != null && timeSignature !== '' && !finalTimeSignature) {
      return res.status(400).json({
        message: `Invalid time signature. Allowed: ${VALID_TIME_SIGNATURES.join(', ')}`,
      });
    }

    const song = new Song({
      churchId: req.user.churchId,
      title: finalTitle,
      artist: finalArtist,
      album,
      year,
      key: finalKey || 'C',
      bpm: finalBpm,
      timeSignature: finalTimeSignature || '4/4',
      genre: genre || [],
      tags: tags || [],
      content: finalContent,
      source: finalSource,
      capo: finalCapo,
      tuning: finalTuning,
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

// Update a song — must belong to the user's church
exports.updateSong = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const updates = { ...req.body };
    delete updates.churchId;

    const existingSong = await Song.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    });
    if (!existingSong) return res.status(404).json({ message: 'Song not found' });

    if (updates.key !== undefined) {
      const normalizedNewKey = normalizeKey(updates.key);
      if (!VALID_KEYS.includes(normalizedNewKey)) {
        return res.status(400).json({ message: 'Invalid key' });
      }
      updates.key = normalizedNewKey;

      // Automatically transpose chord charts when the key changes
      const oldKey = existingSong.key || 'C';
      if (oldKey !== normalizedNewKey) {
        const currentChords =
          updates.content?.chords !== undefined
            ? updates.content.chords
            : existingSong.content?.chords;

        if (currentChords) {
          const transposedChords = transposeChordsText(currentChords, oldKey, normalizedNewKey);
          updates.content = {
            ...(existingSong.content ? existingSong.content.toObject?.() || existingSong.content : {}),
            ...(updates.content || {}),
            chords: transposedChords,
          };
        }

        // Also transpose regional lyrics chords if present
        if (existingSong.regionalLyrics && existingSong.regionalLyrics.length > 0 && !updates.regionalLyrics) {
          updates.regionalLyrics = existingSong.regionalLyrics.map((reg) => {
            const regChords = reg.content?.chords;
            if (!regChords) return reg;
            return {
              ...(reg.toObject?.() || reg),
              content: {
                ...(reg.content?.toObject?.() || reg.content || {}),
                chords: transposeChordsText(regChords, oldKey, normalizedNewKey),
              },
            };
          });
        }
      }
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

// Update song usage / last used date (Admin or Team Leader)
exports.updateSongUsage = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const isPrivileged =
      Boolean(req.user.isAdmin || req.user.isSubAdmin) ||
      ['admin', 'team_leader', 'worship leader', 'pastor'].includes(
        String(req.user.role || '').toLowerCase()
      ) ||
      (Array.isArray(req.user.roles) &&
        req.user.roles.some((r) =>
          ['admin', 'team_leader', 'worship leader', 'pastor'].includes(String(r).toLowerCase())
        ));

    if (!isPrivileged) {
      return res.status(403).json({ message: 'Access denied. Only church admins or leaders can edit song usage.' });
    }

    const song = await Song.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    });

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const { action = 'setLastUsed', lastPerformed, eventTitle, key, notes, usageId } = req.body;

    if (!song.usage) {
      song.usage = {
        timesPerformed: 0,
        lastPerformed: null,
        manualLastPerformed: null,
        usageHistory: [],
        favorites: [],
      };
    }

    if (action === 'clearLastUsed') {
      song.usage.manualLastPerformed = null;
      song.usage.lastPerformed = null;
      if (req.body.clearManualHistory) {
        song.usage.usageHistory = (song.usage.usageHistory || []).filter((e) => e.eventId && !e.isManual);
      }
    } else if (action === 'deleteUsage' && usageId) {
      song.usage.usageHistory = (song.usage.usageHistory || []).filter(
        (e) => String(e._id) !== String(usageId)
      );
    } else {
      if (!lastPerformed) {
        return res.status(400).json({ message: 'A valid date is required for last used.' });
      }

      const parsedDate = new Date(lastPerformed);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date provided.' });
      }

      const entryTitle = eventTitle?.trim() || 'Worship Service (Manual Entry)';
      const entryKey = key?.trim() || song.key || 'C';

      if (action === 'editUsage' && usageId) {
        const found = (song.usage.usageHistory || []).find(
          (e) => String(e._id) !== String(usageId)
        );
        if (found) {
          found.usedAt = parsedDate;
          found.eventTitle = entryTitle;
          found.key = entryKey;
          if (notes !== undefined) found.notes = notes;
        }
      } else {
        song.usage.usageHistory = song.usage.usageHistory || [];
        song.usage.usageHistory.push({
          eventTitle: entryTitle,
          usedAt: parsedDate,
          key: entryKey,
          isManual: true,
          notes: notes || '',
        });
      }

      song.usage.manualLastPerformed = parsedDate;
      song.usage.lastPerformed = parsedDate;
    }

    await song.save();

    // Re-enrich with real schedule events & manual entries
    const [enriched] = await enrichSongsUsage([song]);
    res.json(enriched);
  } catch (err) {
    console.error('Error updating song usage:', err);
    res.status(500).json({ message: 'Failed to update song usage.' });
  }
};

// Get personal key preference for the authenticated user
exports.getUserSongPreference = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const userId = req.user._id || req.user.id;
    const userPref = await UserSongPreference.findOne({
      songId: req.params.id,
      userId,
    }).lean();
    res.json({ userPreference: userPref || null });
  } catch (err) {
    console.error('Error fetching user song preference:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Save / update personal key & transposed chords for the authenticated user
// Guaranteed NOT to alter the church's master song for other users
exports.saveUserSongPreference = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const song = await Song.findOne({
      _id: req.params.id,
      churchId: req.user.churchId,
    }).lean();
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const { key, transpose = 0, capo = 0, chords = '' } = req.body;
    if (!key) {
      return res.status(400).json({ message: 'Key is required' });
    }

    const userId = req.user._id || req.user.id;
    const preference = await UserSongPreference.findOneAndUpdate(
      { userId, songId: song._id },
      {
        $set: {
          churchId: req.user.churchId,
          key: String(key).trim(),
          transpose: Number(transpose) || 0,
          capo: Number(capo) || 0,
          chords: chords || '',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: `Key of ${preference.key} saved for your profile. Other church members will still see the church original.`,
      userPreference: {
        key: preference.key,
        transpose: preference.transpose,
        capo: preference.capo,
        chords: preference.chords,
        updatedAt: preference.updatedAt,
      },
    });
  } catch (err) {
    console.error('Error saving user song preference:', err);
    res.status(500).json({ message: 'Failed to save personal key preference' });
  }
};

// Reset personal key preference back to the church's original key
exports.deleteUserSongPreference = async (req, res) => {
  try {
    if (!req.user?.churchId) {
      return res.status(404).json({ message: 'Song not found' });
    }
    const userId = req.user._id || req.user.id;
    await UserSongPreference.findOneAndDelete({
      userId,
      songId: req.params.id,
    });
    res.json({
      success: true,
      message: 'Personal key preference reset to church original.',
    });
  } catch (err) {
    console.error('Error deleting user song preference:', err);
    res.status(500).json({ message: 'Failed to reset personal key preference' });
  }
};

