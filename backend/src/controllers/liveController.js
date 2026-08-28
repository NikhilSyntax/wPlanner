const crypto = require('crypto');
const LiveSession = require('../models/LiveSession');
const LiveDisplay = require('../models/LiveDisplay');
const Event = require('../models/Event');
const Song = require('../models/Song');
const { parseSongToLiveSections } = require('../utils/songParser');

function generatePairingCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// In-Memory Live Session Cache: eventId -> { session, songs, event, lastUpdated }
const sessionMemoryCache = new Map();

/**
 * Invalidate in-memory cache for an event
 */
function invalidateSessionCache(eventId) {
  if (eventId) {
    sessionMemoryCache.delete(eventId.toString());
  }
}
exports.invalidateSessionCache = invalidateSessionCache;

function isSlideHidden(hiddenSlides, songId, sectionId, chunkIndex) {
  if (!hiddenSlides) return false;
  const key = `${songId}_${sectionId}_${chunkIndex}`;
  return Boolean(hiddenSlides[key]);
}

/**
 * Helper to get active section list for a song based on selected language
 */
function getSongSectionsForLanguage(song, language = 'original') {
  if (!song) return [];
  if (language && language !== 'original' && song.regionalSections) {
    const langKey = language.toLowerCase();
    if (song.regionalSections[langKey] && song.regionalSections[langKey].length > 0) {
      return song.regionalSections[langKey];
    }
  }
  return song.sections || [];
}

function findNextValidSlide(songs, hiddenSlides, currentSongIdx, currentSecIdx, currentChunkIdx, language = 'original') {
  if (!Array.isArray(songs) || songs.length === 0) return null;
  const sStart = Math.max(0, currentSongIdx);

  for (let s = sStart; s < songs.length; s++) {
    const song = songs[s];
    const sections = getSongSectionsForLanguage(song, language);
    const secStart = s === sStart ? Math.max(0, currentSecIdx) : 0;

    for (let sec = secStart; sec < sections.length; sec++) {
      const section = sections[sec];
      const chunks = section.chunks || [];
      const chunkStart = (s === sStart && sec === secStart) ? currentChunkIdx + 1 : 0;

      for (let c = chunkStart; c < chunks.length; c++) {
        if (!isSlideHidden(hiddenSlides, song._id, section.sectionId, c)) {
          return {
            song,
            section,
            songIndex: s,
            sectionIndex: sec,
            chunkIndex: c,
            lines: chunks[c]?.lines || [],
          };
        }
      }
    }
  }
  return null;
}

function findPrevValidSlide(songs, hiddenSlides, currentSongIdx, currentSecIdx, currentChunkIdx, language = 'original') {
  if (!Array.isArray(songs) || songs.length === 0) return null;
  const sStart = Math.min(Math.max(0, currentSongIdx), songs.length - 1);

  for (let s = sStart; s >= 0; s--) {
    const song = songs[s];
    const sections = getSongSectionsForLanguage(song, language);
    const secStart = s === sStart ? Math.min(Math.max(0, currentSecIdx), sections.length - 1) : sections.length - 1;

    for (let sec = secStart; sec >= 0; sec--) {
      const section = sections[sec];
      const chunks = section.chunks || [];
      const chunkStart = (s === sStart && sec === secStart) ? currentChunkIdx - 1 : chunks.length - 1;

      for (let c = chunkStart; c >= 0; c--) {
        if (!isSlideHidden(hiddenSlides, song._id, section.sectionId, c)) {
          return {
            song,
            section,
            songIndex: s,
            sectionIndex: sec,
            chunkIndex: c,
            lines: chunks[c]?.lines || [],
          };
        }
      }
    }
  }
  return null;
}

/**
 * Parses all songs in an event's setlist into structured 2-line sections (original + regional languages)
 */
async function parseEventSongs(event) {
  if (!Array.isArray(event.setlist) || event.setlist.length === 0) {
    return [];
  }

  const songIds = event.setlist.map((s) => (s._id ? s._id : s));
  const dbSongs = await Song.find({ _id: { $in: songIds } }).lean();
  const songMap = new Map(dbSongs.map((s) => [s._id.toString(), s]));

  return songIds
    .map((sId) => {
      const idStr = sId.toString();
      const s = songMap.get(idStr);
      if (!s) return null;

      const rawContent = s.content?.chords || s.content?.lyrics || '';
      const originalKey = s.key || 'C';
      const targetKey = s.key || 'C';
      const sections = parseSongToLiveSections(rawContent, originalKey, targetKey);

      // Parse all regional language lyrics into structured sections
      const regionalSections = {};
      if (Array.isArray(s.regionalLyrics)) {
        s.regionalLyrics.forEach((r) => {
          if (r?.language) {
            const langContent = r.content?.chords || r.content?.lyrics || '';
            if (langContent.trim()) {
              regionalSections[r.language.toLowerCase()] = parseSongToLiveSections(
                langContent,
                originalKey,
                targetKey
              );
            }
          }
        });
      }

      return {
        _id: s._id,
        title: s.title,
        artist: s.artist || '',
        key: originalKey,
        targetKey,
        bpm: s.bpm,
        timeSignature: s.timeSignature,
        sections,
        regionalSections,
        regionalLyrics: s.regionalLyrics || [],
      };
    })
    .filter(Boolean);
}

/**
 * Synchronously computes current chunk, next chunk, and presentation state from memory
 */
function formatSessionPayload(session, songs = []) {
  const hiddenSlides = session.hiddenSlides || {};
  const activeLanguage = session.activeLanguage || 'original';

  // Determine current song
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

  // Extract all available regional languages configured across songs in this session
  const availableLanguagesSet = new Set(['original']);
  songs.forEach((s) => {
    if (Array.isArray(s.regionalLyrics)) {
      s.regionalLyrics.forEach((r) => {
        if (r?.language) availableLanguagesSet.add(r.language);
      });
    }
  });
  const availableLanguages = Array.from(availableLanguagesSet);

  const isSplitView = Boolean(
    session.isSplitView ||
      activeLanguage === 'split' ||
      (typeof activeLanguage === 'string' && activeLanguage.startsWith('split'))
  );

  let splitLanguage = session.splitLanguage || '';
  if (!splitLanguage && typeof activeLanguage === 'string' && activeLanguage.includes(':')) {
    splitLanguage = activeLanguage.split(':')[1];
  }
  if (!splitLanguage) {
    splitLanguage = availableLanguages.find((l) => l !== 'original') || 'Regional';
  }

  let leftChunk = [];
  let rightChunk = [];
  let nextLeftChunk = [];
  let nextRightChunk = [];

  if (currentSong) {
    const defaultSections = currentSong.sections || [];
    const activeSections = getSongSectionsForLanguage(currentSong, activeLanguage);

    const secIdx = defaultSections.findIndex(
      (sec) => sec.sectionId === session.currentSectionId
    );
    currentSectionIndex = secIdx >= 0 ? secIdx : 0;
    currentSection = defaultSections[currentSectionIndex] || { sectionId: '', name: 'Section', chunks: [] };
    session.currentSectionId = currentSection.sectionId;
    session.currentSectionName = currentSection.name;

    // Use active language chunks if available, or fallback to default chunks
    const langSec = activeSections[currentSectionIndex] || currentSection;
    const chunks = langSec.chunks || [];
    const chunkIdx = Math.min(Math.max(session.currentChunkIndex || 0, 0), Math.max(chunks.length - 1, 0));
    session.currentChunkIndex = chunkIdx;
    currentChunk = chunks[chunkIdx] || { lines: [] };

    // Build Split View Chunks (Left: Original/English, Right: Regional Language)
    const origSec = defaultSections[currentSectionIndex] || { chunks: [] };
    const origChunk = (origSec.chunks || [])[chunkIdx] || { lines: [] };
    leftChunk = origChunk.lines || [];

    const regSections = getSongSectionsForLanguage(currentSong, splitLanguage);
    const regSec = regSections[currentSectionIndex] || origSec;
    const regChunk = (regSec.chunks || [])[chunkIdx] || origChunk;
    rightChunk = regChunk.lines || [];

    // Apply custom slide edit overrides if saved
    const overrideKey = `${session.currentSongId}_${session.currentSectionId}_${chunkIdx}`;
    if (session.customChunkOverrides && session.customChunkOverrides[overrideKey]) {
      currentChunk = { lines: session.customChunkOverrides[overrideKey] };
      if (!isSplitView) {
        leftChunk = session.customChunkOverrides[overrideKey];
      }
    }

    // Calculate NEXT non-hidden 2-line preview
    const curSongIdx = songs.findIndex((s) => s._id.toString() === session.currentSongId?.toString());
    const nextValid = findNextValidSlide(songs, hiddenSlides, curSongIdx, currentSectionIndex, chunkIdx, activeLanguage);

    if (nextValid) {
      nextChunk = {
        songTitle: nextValid.song._id.toString() !== session.currentSongId?.toString() ? nextValid.song.title : undefined,
        sectionName: nextValid.section.name,
        lines: nextValid.lines,
      };

      const nextOrigSecs = nextValid.song.sections || [];
      const nextOrigSec = nextOrigSecs[nextValid.sectionIndex] || { chunks: [] };
      nextLeftChunk = (nextOrigSec.chunks || [])[nextValid.chunkIndex]?.lines || [];

      const nextRegSecs = getSongSectionsForLanguage(nextValid.song, splitLanguage);
      const nextRegSec = nextRegSecs[nextValid.sectionIndex] || nextOrigSec;
      nextRightChunk = (nextRegSec.chunks || [])[nextValid.chunkIndex]?.lines || [];
    } else {
      nextChunk = {
        sectionName: 'End of Service',
        lines: [],
      };
    }
  }

  return {
    sessionId: session._id,
    eventId: session.eventId,
    churchId: session.churchId,
    status: session.status,
    pairingCode: session.pairingCode,
    displayMode: session.displayMode,
    activeLanguage,
    availableLanguages,
    isSplitView,
    splitLanguage,
    connectedDisplays: session.connectedDisplays || 0,
    currentSongId: session.currentSongId,
    currentSongTitle: session.currentSongTitle,
    currentSongKey: session.currentSongKey,
    currentSectionId: session.currentSectionId,
    currentSectionName: session.currentSectionName,
    currentSectionIndex,
    currentChunkIndex: session.currentChunkIndex,
    currentChunk: currentChunk ? currentChunk.lines : [],
    leftChunk,
    rightChunk,
    nextChunk,
    nextLeftChunk,
    nextRightChunk,
    songs,
    hiddenSlides: session.hiddenSlides || {},
    customChunkOverrides: session.customChunkOverrides || {},
    liveArrangements: session.liveArrangements || {},
  };
}

/**
 * Loads session and event data, parses songs, and caches them in RAM
 */
async function loadAndCacheSession(eventId, churchId) {
  const eventIdStr = eventId.toString();

  let query = { _id: eventId };
  if (churchId) query.churchId = churchId;
  const event = await Event.findOne(query).populate('setlist');
  if (!event) return null;

  let sessionQuery = { eventId };
  if (churchId) sessionQuery.churchId = churchId;
  let session = await LiveSession.findOne(sessionQuery);

  if (!session) {
    session = new LiveSession({
      eventId,
      churchId: event.churchId,
      pairingCode: generatePairingCode(),
      status: 'LIVE',
      displayMode: 'LYRICS_CHORDS',
      activeLanguage: 'original',
    });
    await session.save();
  }

  const songs = await parseEventSongs(event);
  const cacheEntry = { session, songs, event, lastUpdated: Date.now() };
  sessionMemoryCache.set(eventIdStr, cacheEntry);
  return cacheEntry;
}

/**
 * Builds the full enriched payload for a live session (Backwards compatible helper)
 */
async function buildSessionPayload(session, event) {
  const songs = await parseEventSongs(event);
  return formatSessionPayload(session, songs);
}

/**
 * Get or initialize active LiveSession for an event
 */
exports.getOrCreateLiveSession = async (req, res) => {
  try {
    const { eventId } = req.params;
    const churchId = req.user.churchId;

    let cached = sessionMemoryCache.get(eventId.toString());
    if (!cached) {
      cached = await loadAndCacheSession(eventId, churchId);
    }
    if (!cached) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const payload = formatSessionPayload(cached.session, cached.songs);
    // Non-blocking save of initialized indices
    cached.session.save().catch((err) => console.error('[LiveController] Save error:', err));
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
      activeLanguage: session.activeLanguage || 'original',
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
    let cached = sessionMemoryCache.get(eventId.toString());
    if (!cached) {
      cached = await loadAndCacheSession(eventId);
    }
    if (!cached) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const fullPayload = formatSessionPayload(cached.session, cached.songs);

    res.json({
      eventId: cached.session.eventId,
      sessionId: cached.session._id,
      status: cached.session.status,
      displayMode: cached.session.displayMode,
      activeLanguage: cached.session.activeLanguage || 'original',
      availableLanguages: fullPayload.availableLanguages,
      currentSongTitle: cached.session.currentSongTitle,
      currentSongKey: cached.session.currentSongKey,
      currentSectionName: cached.session.currentSectionName,
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

    const eventId = display.eventId;
    let cached = sessionMemoryCache.get(eventId.toString());
    if (!cached) {
      cached = await loadAndCacheSession(eventId);
    }
    if (!cached) {
      return res.status(404).json({ message: 'Live session not found' });
    }

    const fullPayload = formatSessionPayload(cached.session, cached.songs);

    display.lastConnectedAt = new Date();
    display.save().catch((err) => console.error('[LiveController] Display save error:', err));

    res.json({
      eventId: cached.session.eventId,
      sessionId: cached.session._id,
      status: cached.session.status,
      displayMode:
        display.displayModeOverride !== 'DEFAULT' && display.displayModeOverride
          ? display.displayModeOverride
          : cached.session.displayMode,
      activeLanguage: cached.session.activeLanguage || 'original',
      availableLanguages: fullPayload.availableLanguages,
      currentSongTitle: cached.session.currentSongTitle,
      currentSongKey: cached.session.currentSongKey,
      currentSectionName: cached.session.currentSectionName,
      currentChunk: fullPayload.currentChunk,
      nextChunk: fullPayload.nextChunk,
    });
  } catch (err) {
    console.error('[LiveController] getViewerState error:', err);
    res.status(500).json({ message: 'Server error loading viewer state' });
  }
};

function queueSessionPersist(session) {
  if (!session || !session._id) return;
  const updateDoc = {
    currentSongId: session.currentSongId,
    currentSongTitle: session.currentSongTitle,
    currentSongKey: session.currentSongKey,
    currentSectionId: session.currentSectionId,
    currentSectionName: session.currentSectionName,
    currentChunkIndex: session.currentChunkIndex,
    displayMode: session.displayMode,
    activeLanguage: session.activeLanguage,
    customChunkOverrides: session.customChunkOverrides,
    hiddenSlides: session.hiddenSlides,
  };

  LiveSession.updateOne({ _id: session._id }, { $set: updateDoc }).catch((err) => {
    console.error('[LiveController] Background updateOne error:', err.message);
  });
}

/**
 * Handle state changes triggered by Live commands (Instant In-Memory Computation & Async DB Save)
 */
exports.processLiveCommand = async (eventId, command) => {
  const eventIdStr = eventId.toString();
  let cached = sessionMemoryCache.get(eventIdStr);
  if (!cached) {
    cached = await loadAndCacheSession(eventId);
  }
  if (!cached) return null;

  const { session, songs } = cached;
  const { type, payload } = command;
  const hiddenSlides = session.hiddenSlides || {};
  const activeLanguage = session.activeLanguage || 'original';
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
  } else if (type === 'SET_SPLIT_VIEW' || type === 'TOGGLE_SPLIT_VIEW') {
    session.isSplitView = payload?.isSplitView !== undefined ? payload.isSplitView : !session.isSplitView;
    if (payload?.splitLanguage) {
      session.splitLanguage = payload.splitLanguage;
    }
    if (session.isSplitView) {
      session.activeLanguage = `split:${session.splitLanguage || 'Regional'}`;
    } else {
      session.activeLanguage = 'original';
    }
  } else if (type === 'SET_LANGUAGE') {
    if (payload?.language) {
      session.activeLanguage = payload.language;
      if (payload.language.startsWith('split')) {
        session.isSplitView = true;
        if (payload.language.includes(':')) {
          session.splitLanguage = payload.language.split(':')[1];
        } else if (payload.splitLanguage) {
          session.splitLanguage = payload.splitLanguage;
        }
      } else {
        session.isSplitView = false;
      }
    }
  } else if (type === 'NEXT') {
    const curSongIdx = songs.findIndex((s) => s._id.toString() === session.currentSongId?.toString());
    const curSecIdx = currentSong?.sections?.findIndex((s) => s.sectionId === session.currentSectionId) ?? 0;
    const nextValid = findNextValidSlide(songs, hiddenSlides, curSongIdx, curSecIdx, session.currentChunkIndex, activeLanguage);

    if (nextValid) {
      session.currentSongId = nextValid.song._id;
      session.currentSongTitle = nextValid.song.title;
      session.currentSongKey = nextValid.song.key;
      session.currentSectionId = nextValid.section.sectionId;
      session.currentSectionName = nextValid.section.name;
      session.currentChunkIndex = nextValid.chunkIndex;
      if (session.displayMode === 'BLACK' || session.displayMode === 'CLEAR') {
        session.displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'PREV') {
    const curSongIdx = songs.findIndex((s) => s._id.toString() === session.currentSongId?.toString());
    const curSecIdx = currentSong?.sections?.findIndex((s) => s.sectionId === session.currentSectionId) ?? 0;
    const prevValid = findPrevValidSlide(songs, hiddenSlides, curSongIdx, curSecIdx, session.currentChunkIndex, activeLanguage);

    if (prevValid) {
      session.currentSongId = prevValid.song._id;
      session.currentSongTitle = prevValid.song.title;
      session.currentSongKey = prevValid.song.key;
      session.currentSectionId = prevValid.section.sectionId;
      session.currentSectionName = prevValid.section.name;
      session.currentChunkIndex = prevValid.chunkIndex;
      if (session.displayMode === 'BLACK' || session.displayMode === 'CLEAR') {
        session.displayMode = 'LYRICS_CHORDS';
      }
    }
  } else if (type === 'TOGGLE_HIDE_SLIDE' || type === 'HIDE_SLIDE' || type === 'DELETE_SLIDE') {
    const { songId, sectionId, chunkIndex } = payload || {};
    const targetSongId = songId || session.currentSongId;
    const targetSectionId = sectionId || session.currentSectionId;
    const targetChunkIdx = chunkIndex !== undefined ? chunkIndex : session.currentChunkIndex;
    const slideKey = `${targetSongId}_${targetSectionId}_${targetChunkIdx}`;

    if (!session.hiddenSlides) {
      session.hiddenSlides = {};
    }

    if (type === 'HIDE_SLIDE' || type === 'DELETE_SLIDE') {
      session.hiddenSlides[slideKey] = true;
    } else {
      // Toggle
      if (session.hiddenSlides[slideKey]) {
        delete session.hiddenSlides[slideKey];
      } else {
        session.hiddenSlides[slideKey] = true;
      }
    }
    session.markModified('hiddenSlides');
  } else if (type === 'TOGGLE_HIDE_SECTION' || type === 'HIDE_SECTION' || type === 'UNHIDE_SECTION') {
    const { songId, sectionId, hide } = payload || {};
    const targetSong = songs.find((s) => s._id.toString() === (songId || session.currentSongId).toString());
    const targetSec = targetSong?.sections?.find((sec) => sec.sectionId === (sectionId || session.currentSectionId));
    if (targetSec && Array.isArray(targetSec.chunks)) {
      if (!session.hiddenSlides) session.hiddenSlides = {};
      const shouldHide =
        hide !== undefined
          ? hide
          : !targetSec.chunks.every((_, cIdx) => isSlideHidden(session.hiddenSlides, targetSong._id, targetSec.sectionId, cIdx));
      targetSec.chunks.forEach((_, cIdx) => {
        const k = `${targetSong._id}_${targetSec.sectionId}_${cIdx}`;
        if (shouldHide) {
          session.hiddenSlides[k] = true;
        } else {
          delete session.hiddenSlides[k];
        }
      });
      session.markModified('hiddenSlides');
    }
  } else if (type === 'UNHIDE_ALL_SLIDES') {
    if (!session.hiddenSlides) session.hiddenSlides = {};
    if (payload?.songId) {
      const prefix = `${payload.songId}_`;
      Object.keys(session.hiddenSlides).forEach((k) => {
        if (k.startsWith(prefix)) delete session.hiddenSlides[k];
      });
    } else {
      hiddenSlides = {};
    }
    session.markModified('hiddenSlides');
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

  // Update in-memory timestamp
  cached.lastUpdated = Date.now();

  // Asynchronous non-blocking save to MongoDB (does not delay socket delivery!)
  queueSessionPersist(session);

  // Return computed payload immediately in < 0.1ms
  return formatSessionPayload(session, songs);
};

module.exports.buildSessionPayload = buildSessionPayload;
