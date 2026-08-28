const crypto = require('crypto');
const LiveSession = require('../models/LiveSession');
const LiveDisplay = require('../models/LiveDisplay');
const Event = require('../models/Event');
const Song = require('../models/Song');
const { parseSongToLiveSections } = require('../utils/songParser');

function generatePairingCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Builds the full enriched payload for a live session including parsed songs & sections
 */
async function buildSessionPayload(session, event) {
  let songs = [];
  if (Array.isArray(event.setlist) && event.setlist.length > 0) {
    const songIds = event.setlist.map((s) => (s._id ? s._id : s));
    const dbSongs = await Song.find({ _id: { $in: songIds } }).lean();
    const songMap = new Map(dbSongs.map((s) => [s._id.toString(), s]));

    songs = songIds
      .map((sId) => {
        const idStr = sId.toString();
        const s = songMap.get(idStr);
        if (!s) return null;

        const rawContent = s.content?.chords || s.content?.lyrics || '';
        const originalKey = s.key || 'C';
        const targetKey = s.key || 'C';
        const sections = parseSongToLiveSections(rawContent, originalKey, targetKey);

        return {
          _id: s._id,
          title: s.title,
          artist: s.artist || '',
          key: originalKey,
          targetKey,
          bpm: s.bpm,
          timeSignature: s.timeSignature,
          sections,
        };
      })
      .filter(Boolean);
  }

  // Determine current song, section, and chunk
  let currentSong = songs.find((s) => s._id.toString() === session.currentSongId?.toString());
  if (!currentSong && songs.length > 0) {
    currentSong = songs[0];
    session.currentSongId = currentSong._id;
    session.currentSongTitle = currentSong.title;
    session.currentSongKey = currentSong.key;
  }

  let currentSection = null;
  let currentChunk = null;
  let nextChunk = null;
  let currentSectionIndex = 0;

  if (currentSong && currentSong.sections?.length > 0) {
    const secIdx = currentSong.sections.findIndex(
      (sec) => sec.sectionId === session.currentSectionId
    );
    currentSectionIndex = secIdx >= 0 ? secIdx : 0;
    currentSection = currentSong.sections[currentSectionIndex];
    session.currentSectionId = currentSection.sectionId;
    session.currentSectionName = currentSection.name;

    const chunks = currentSection.chunks || [];
    const chunkIdx = Math.min(Math.max(session.currentChunkIndex || 0, 0), Math.max(chunks.length - 1, 0));
    session.currentChunkIndex = chunkIdx;
    currentChunk = chunks[chunkIdx] || { lines: [] };

    // Apply custom slide edit overrides if saved
    const overrideKey = `${session.currentSongId}_${session.currentSectionId}_${chunkIdx}`;
    if (session.customChunkOverrides && session.customChunkOverrides[overrideKey]) {
      currentChunk = { lines: session.customChunkOverrides[overrideKey] };
    }

    // Calculate NEXT 2-line preview
    if (chunkIdx + 1 < chunks.length) {
      nextChunk = {
        sectionName: currentSection.name,
        lines: chunks[chunkIdx + 1].lines,
      };
    } else if (currentSectionIndex + 1 < currentSong.sections.length) {
      const nextSec = currentSong.sections[currentSectionIndex + 1];
      nextChunk = {
        sectionName: nextSec.name,
        lines: nextSec.chunks?.[0]?.lines || [],
      };
    } else {
      // Check next song in setlist
      const currentSongIdx = songs.findIndex((s) => s._id.toString() === currentSong._id.toString());
      if (currentSongIdx + 1 < songs.length) {
        const nextSong = songs[currentSongIdx + 1];
        nextChunk = {
          songTitle: nextSong.title,
          sectionName: nextSong.sections?.[0]?.name || 'Intro',
          lines: nextSong.sections?.[0]?.chunks?.[0]?.lines || [],
        };
      } else {
        nextChunk = {
          sectionName: 'End of Service',
          lines: [],
        };
      }
    }
  }

  return {
    sessionId: session._id,
    eventId: session.eventId,
    churchId: session.churchId,
    status: session.status,
    pairingCode: session.pairingCode,
    displayMode: session.displayMode,
    connectedDisplays: session.connectedDisplays || 0,
    currentSongId: session.currentSongId,
    currentSongTitle: session.currentSongTitle,
    currentSongKey: session.currentSongKey,
    currentSectionId: session.currentSectionId,
    currentSectionName: session.currentSectionName,
    currentSectionIndex,
    currentChunkIndex: session.currentChunkIndex,
    currentChunk: currentChunk ? currentChunk.lines : [],
    nextChunk,
    songs,
    liveArrangements: session.liveArrangements || {},
  };
}

/**
 * Get or initialize active LiveSession for an event
 */
exports.getOrCreateLiveSession = async (req, res) => {
  try {
    const { eventId } = req.params;
    const churchId = req.user.churchId;

    const event = await Event.findOne({ _id: eventId, churchId }).populate('setlist');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    let session = await LiveSession.findOne({ eventId, churchId });
    if (!session) {
      session = new LiveSession({
        eventId,
        churchId,
        pairingCode: generatePairingCode(),
        status: 'LIVE',
        displayMode: 'LYRICS_CHORDS',
        createdBy: req.user.userId,
      });
      await session.save();
    }

    const payload = await buildSessionPayload(session, event);
    await session.save(); // Save any default initialized indices
    res.json(payload);
  } catch (err) {
    console.error('[LiveController] getOrCreateLiveSession error:', err);
    res.status(500).json({ message: 'Server error loading live session' });
  }
};

/**
 * Pair a TV display using a 4-digit pairing code
 */
exports.pairDisplay = async (req, res) => {
  try {
    const { pairingCode, name } = req.body;
    if (!pairingCode) {
      return res.status(400).json({ message: 'Pairing code is required' });
    }

    const session = await LiveSession.findOne({
      pairingCode: pairingCode.toString().trim(),
      status: { $ne: 'ENDED' },
    });

    if (!session) {
      return res.status(404).json({ message: 'Invalid or expired display pairing code' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const display = new LiveDisplay({
      token,
      name: name || 'Church Display Screen',
      churchId: session.churchId,
      eventId: session.eventId,
      lastConnectedAt: new Date(),
    });
    await display.save();

    res.json({
      token,
      sessionId: session._id,
      eventId: session.eventId,
      name: display.name,
      displayMode: session.displayMode,
    });
  } catch (err) {
    console.error('[LiveController] pairDisplay error:', err);
    res.status(500).json({ message: 'Server error pairing display' });
  }
};

/**
 * Get read-only presentation state for a viewer directly by eventId (for pop-out TV display windows)
 */
exports.getViewerStateByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    let session = await LiveSession.findOne({ eventId });
    const event = await Event.findById(eventId).populate('setlist');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!session) {
      session = new LiveSession({
        eventId,
        churchId: event.churchId,
        pairingCode: Math.floor(1000 + Math.random() * 9000).toString(),
        status: 'LIVE',
        displayMode: 'LYRICS_CHORDS',
      });
      await session.save();
    }

    const fullPayload = await buildSessionPayload(session, event || { setlist: [] });

    res.json({
      eventId: session.eventId,
      sessionId: session._id,
      status: session.status,
      displayMode: session.displayMode,
      currentSongTitle: session.currentSongTitle,
      currentSongKey: session.currentSongKey,
      currentSectionName: session.currentSectionName,
      currentChunk: fullPayload.currentChunk,
      nextChunk: fullPayload.nextChunk,
    });
  } catch (err) {
    console.error('[LiveController] getViewerStateByEvent error:', err);
    res.status(500).json({ message: 'Server error loading viewer state' });
  }
};

/**
 * Get read-only presentation state for a viewer using its display token
 */
exports.getViewerState = async (req, res) => {
  try {
    const { token } = req.params;
    const display = await LiveDisplay.findOne({ token });
    if (!display) {
      return res.status(401).json({ message: 'Invalid display token' });
    }

    const session = await LiveSession.findOne({ eventId: display.eventId });
    if (!session) {
      return res.status(404).json({ message: 'Live session not found' });
    }

    const event = await Event.findById(display.eventId).populate('setlist');
    const fullPayload = await buildSessionPayload(session, event || { setlist: [] });

    display.lastConnectedAt = new Date();
    await display.save();

    res.json({
      eventId: session.eventId,
      sessionId: session._id,
      status: session.status,
      displayMode: display.displayModeOverride !== 'DEFAULT' && display.displayModeOverride
        ? display.displayModeOverride
        : session.displayMode,
      currentSongTitle: session.currentSongTitle,
      currentSongKey: session.currentSongKey,
      currentSectionName: session.currentSectionName,
      currentChunk: fullPayload.currentChunk,
      nextChunk: fullPayload.nextChunk,
    });
  } catch (err) {
    console.error('[LiveController] getViewerState error:', err);
    res.status(500).json({ message: 'Server error loading viewer state' });
  }
};

/**
 * Handle state changes triggered by Live commands
 */
exports.processLiveCommand = async (eventId, command) => {
  const session = await LiveSession.findOne({ eventId });
  if (!session) return null;

  const event = await Event.findById(eventId).populate('setlist');
  if (!event) return null;

  const { type, payload } = command;
  const currentPayload = await buildSessionPayload(session, event);
  const songs = currentPayload.songs || [];
  const currentSong = songs.find((s) => s._id.toString() === session.currentSongId?.toString()) || songs[0];

  if (type === 'SET_SONG') {
    const targetSong = songs.find((s) => s._id.toString() === payload.songId?.toString());
    if (targetSong) {
      session.currentSongId = targetSong._id;
      session.currentSongTitle = targetSong.title;
      session.currentSongKey = targetSong.key;
      session.currentSectionId = targetSong.sections?.[0]?.sectionId || '';
      session.currentSectionName = targetSong.sections?.[0]?.name || '';
      session.currentChunkIndex = 0;
      if (session.displayMode === 'BLACK' || session.displayMode === 'CLEAR') {
        session.displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'SET_SECTION') {
    if (currentSong && currentSong.sections) {
      const targetSec = currentSong.sections.find((s) => s.sectionId === payload.sectionId);
      if (targetSec) {
        session.currentSectionId = targetSec.sectionId;
        session.currentSectionName = targetSec.name;
        session.currentChunkIndex = payload.chunkIndex !== undefined ? payload.chunkIndex : 0;
        if (session.displayMode === 'BLACK' || session.displayMode === 'CLEAR') {
          session.displayMode = 'LYRICS_CHORDS';
        }
      }
    }
  } else if (type === 'NEXT') {
    if (currentSong && currentSong.sections?.length > 0) {
      const secIdx = currentSong.sections.findIndex((s) => s.sectionId === session.currentSectionId);
      const curSec = currentSong.sections[secIdx >= 0 ? secIdx : 0];
      const chunks = curSec.chunks || [];

      if (session.currentChunkIndex + 1 < chunks.length) {
        // Next 2-line slide in current section
        session.currentChunkIndex += 1;
      } else if (secIdx + 1 < currentSong.sections.length) {
        // Next section in current song
        const nextSec = currentSong.sections[secIdx + 1];
        session.currentSectionId = nextSec.sectionId;
        session.currentSectionName = nextSec.name;
        session.currentChunkIndex = 0;
      } else {
        // Next song in setlist
        const songIdx = songs.findIndex((s) => s._id.toString() === currentSong._id.toString());
        if (songIdx + 1 < songs.length) {
          const nextSong = songs[songIdx + 1];
          session.currentSongId = nextSong._id;
          session.currentSongTitle = nextSong.title;
          session.currentSongKey = nextSong.key;
          session.currentSectionId = nextSong.sections?.[0]?.sectionId || '';
          session.currentSectionName = nextSong.sections?.[0]?.name || '';
          session.currentChunkIndex = 0;
        }
      }
      if (session.displayMode === 'BLACK' || session.displayMode === 'CLEAR') {
        session.displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'PREV') {
    if (currentSong && currentSong.sections?.length > 0) {
      const secIdx = currentSong.sections.findIndex((s) => s.sectionId === session.currentSectionId);
      if (session.currentChunkIndex > 0) {
        // Previous 2-line slide in current section
        session.currentChunkIndex -= 1;
      } else if (secIdx > 0) {
        // Previous section
        const prevSec = currentSong.sections[secIdx - 1];
        session.currentSectionId = prevSec.sectionId;
        session.currentSectionName = prevSec.name;
        session.currentChunkIndex = Math.max((prevSec.chunks?.length || 1) - 1, 0);
      } else {
        // Previous song
        const songIdx = songs.findIndex((s) => s._id.toString() === currentSong._id.toString());
        if (songIdx > 0) {
          const prevSong = songs[songIdx - 1];
          session.currentSongId = prevSong._id;
          session.currentSongTitle = prevSong.title;
          session.currentSongKey = prevSong.key;
          const lastSec = prevSong.sections?.[(prevSong.sections?.length || 1) - 1];
          if (lastSec) {
            session.currentSectionId = lastSec.sectionId;
            session.currentSectionName = lastSec.name;
            session.currentChunkIndex = Math.max((lastSec.chunks?.length || 1) - 1, 0);
          }
        }
      }
      if (session.displayMode === 'BLACK' || session.displayMode === 'CLEAR') {
        session.displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'SET_DISPLAY_MODE') {
    if (['LYRICS_CHORDS', 'LYRICS', 'CHORDS', 'BLACK', 'CLEAR'].includes(payload.mode)) {
      session.displayMode = payload.mode;
    }
  } else if (type === 'BLACK_SCREEN') {
    session.displayMode = session.displayMode === 'BLACK' ? 'LYRICS_CHORDS' : 'BLACK';
  } else if (type === 'CLEAR_SCREEN') {
    session.displayMode = session.displayMode === 'CLEAR' ? 'LYRICS_CHORDS' : 'CLEAR';
  } else if (type === 'UPDATE_CHUNK') {
    const { lines, songId, sectionId, chunkIndex } = payload || {};
    if (Array.isArray(lines)) {
      const targetSongId = songId || session.currentSongId;
      const targetSectionId = sectionId || session.currentSectionId;
      const targetChunkIdx = chunkIndex !== undefined ? chunkIndex : session.currentChunkIndex;
      const overrideKey = `${targetSongId}_${targetSectionId}_${targetChunkIdx}`;

      if (!session.customChunkOverrides) {
        session.customChunkOverrides = {};
      }
      session.customChunkOverrides[overrideKey] = lines;
      session.markModified('customChunkOverrides');
    }
  }

  await session.save();
  return buildSessionPayload(session, event);
};

module.exports.buildSessionPayload = buildSessionPayload;
