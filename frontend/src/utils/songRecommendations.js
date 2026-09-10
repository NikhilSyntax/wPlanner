import { fuzzySearchSongs } from './fuzzySearch';

export const CHROMATIC_SCALE = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

const ENHARMONIC_MAP = {
  DB: 'C#',
  EB: 'D#',
  GB: 'F#',
  AB: 'G#',
  BB: 'A#',
};

/**
 * Normalizes a musical key string to standard sharp chromatic notation
 */
export function normalizeKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  const match = trimmed.match(/^([A-Ga-g][#b]?)/);
  if (!match) return trimmed;
  let root = match[1].toUpperCase();
  if (root.length === 2 && root[1] === 'B' && ENHARMONIC_MAP[root]) {
    root = ENHARMONIC_MAP[root];
  }
  return root;
}

/**
 * Evaluates if a song's key is in the range of -2 to +2 semitones from any setlist key.
 * 0  = exact same key (Score 5)
 * +1 = 1 semitone higher / half step up (Score 4)
 * -1 = 1 semitone lower / half step down (Score 3)
 * +2 = 2 semitones higher / whole step up (Score 2)
 * -2 = 2 semitones lower / whole step down (Score 1)
 *
 * Returns object with score (0..5), offset (-2..+2 or null), and reason string.
 */
export function getKeyRelationDetails(songKey, setlistKeysSet) {
  if (!songKey || !setlistKeysSet || setlistKeysSet.size === 0) {
    return { score: 0, offset: null, reason: '' };
  }

  const normSongKey = normalizeKey(songKey);
  if (!normSongKey) return { score: 0, offset: null, reason: '' };

  const songIdx = CHROMATIC_SCALE.indexOf(normSongKey);
  if (songIdx === -1) return { score: 0, offset: null, reason: '' };

  let bestScore = 0;
  let bestOffset = null;
  let bestReason = '';

  for (const sKey of setlistKeysSet) {
    const normSKey = normalizeKey(sKey);
    const sIdx = CHROMATIC_SCALE.indexOf(normSKey);
    if (sIdx !== -1) {
      // Calculate semitone difference from setlist key: (songIdx - sIdx)
      const semitoneDiff = (songIdx - sIdx + 12) % 12;

      // 0 semitones (exact same key)
      if (semitoneDiff === 0) {
        if (5 > bestScore) {
          bestScore = 5;
          bestOffset = 0;
          bestReason = `Key Match (${normSKey})`;
        }
      }
      // +1 semitone (1 half step up)
      else if (semitoneDiff === 1) {
        if (4 > bestScore) {
          bestScore = 4;
          bestOffset = 1;
          bestReason = `Key ${normSKey} (+1 st)`;
        }
      }
      // -1 semitone (1 half step down, e.g. 11 % 12)
      else if (semitoneDiff === 11) {
        if (3 > bestScore) {
          bestScore = 3;
          bestOffset = -1;
          bestReason = `Key ${normSKey} (-1 st)`;
        }
      }
      // +2 semitones (2 half steps / 1 whole step up)
      else if (semitoneDiff === 2) {
        if (2 > bestScore) {
          bestScore = 2;
          bestOffset = 2;
          bestReason = `Key ${normSKey} (+2 st)`;
        }
      }
      // -2 semitones (2 half steps / 1 whole step down, e.g. 10 % 12)
      else if (semitoneDiff === 10) {
        if (1 > bestScore) {
          bestScore = 1;
          bestOffset = -2;
          bestReason = `Key ${normSKey} (-2 st)`;
        }
      }
    }
  }

  return { score: bestScore, offset: bestOffset, reason: bestReason };
}

export function getKeyRelationScore(songKey, setlistKeysSet) {
  return getKeyRelationDetails(songKey, setlistKeysSet).score;
}

/**
 * Gets timestamp for the last time a song was performed or used.
 * Returns 0 if never performed (oldest possible time).
 */
export function getLastUsedTimestamp(song) {
  const lastPerformed =
    song?.usage?.lastPerformed || song?.usage?.manualLastPerformed;
  if (!lastPerformed) return 0;
  const time = new Date(lastPerformed).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Formats a user-friendly label for long-time unused songs
 */
export function formatLastUsedLabel(timestamp) {
  if (!timestamp || timestamp === 0) {
    return 'Never performed';
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) {
    return 'Not used in a while';
  }
  return `Not used since ${d.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })}`;
}

/**
 * Generates smart song recommendations for a setlist:
 * Total max 3 songs:
 * - 2 songs related to the key of already saved setlist songs (in range 0 to -2 semitones)
 * - 1 song not used since a long time (least recently used / never used)
 * - Fallbacks fill remaining slots up to 3 using least recently used songs.
 */
export function getRecommendedSongs({
  songs = [],
  setlist = [],
  songQuery = '',
  maxRecommendations = 3,
} = {}) {
  const q = songQuery.trim().toLowerCase();

  // 1. Filter songs by search query if any using typo-tolerant fuzzy search
  const filtered = q ? fuzzySearchSongs(songs, q, 0.4) : songs;

  // 2. Exclude songs already in the setlist
  const setlistSongIds = new Set(
    (setlist || []).map((s) => String(s?._id || s)).filter(Boolean)
  );
  const candidates = filtered.filter((s) => !setlistSongIds.has(String(s._id)));
  if (candidates.length === 0) return [];

  // 3. Extract keys of songs in setlist
  const setlistKeys = new Set(
    (setlist || [])
      .map((s) => s?.key)
      .filter((k) => typeof k === 'string' && k.trim().length > 0)
  );

  const selected = [];
  const selectedIds = new Set();

  // 4. Step 1: Pick up to 2 key-related songs in range 0 to -2 semitones (if setlist has keys)
  if (setlistKeys.size > 0) {
    const keyCandidates = candidates
      .map((song) => {
        const details = getKeyRelationDetails(song.key, setlistKeys);
        return {
          song,
          score: details.score,
          offset: details.offset,
          reason: details.reason,
          lastUsedTime: getLastUsedTimestamp(song),
          timesPerformed: song.usage?.timesPerformed || 0,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        // Highest key score first (exact match 0 = 3 > -1 st = 2 > -2 st = 1)
        if (b.score !== a.score) return b.score - a.score;
        // Prioritize songs used longer ago among key matches for fresh setlists
        if (a.lastUsedTime !== b.lastUsedTime)
          return a.lastUsedTime - b.lastUsedTime;
        return String(a.song.title || '').localeCompare(
          String(b.song.title || '')
        );
      });

    for (const item of keyCandidates) {
      if (selected.length >= 2) break;
      selected.push({
        ...item.song,
        _recReason: item.reason,
        _recType: 'key',
      });
      selectedIds.add(String(item.song._id));
    }
  }

  // 5. Step 2: Pick 1 song not used since a long time from remaining candidates
  const remainingCandidates = candidates
    .filter((song) => !selectedIds.has(String(song._id)))
    .map((song) => ({
      song,
      lastUsedTime: getLastUsedTimestamp(song),
      timesPerformed: song.usage?.timesPerformed || 0,
    }))
    .sort((a, b) => {
      // 0 (never used) or smallest timestamp (longest time ago) first
      if (a.lastUsedTime !== b.lastUsedTime)
        return a.lastUsedTime - b.lastUsedTime;
      // If timestamp same, fewest times performed first
      if (a.timesPerformed !== b.timesPerformed)
        return a.timesPerformed - b.timesPerformed;
      return String(a.song.title || '').localeCompare(
        String(b.song.title || '')
      );
    });

  if (remainingCandidates.length > 0 && selected.length < maxRecommendations) {
    const oldestItem = remainingCandidates[0];
    const reason = formatLastUsedLabel(oldestItem.lastUsedTime);
    selected.push({
      ...oldestItem.song,
      _recReason: reason,
      _recType: 'longTime',
    });
    selectedIds.add(String(oldestItem.song._id));
  }

  // 6. Step 3: Backfill up to maxRecommendations if we still have fewer than 3
  if (selected.length < maxRecommendations) {
    const fillCandidates = candidates
      .filter((song) => !selectedIds.has(String(song._id)))
      .map((song) => ({
        song,
        lastUsedTime: getLastUsedTimestamp(song),
        timesPerformed: song.usage?.timesPerformed || 0,
      }))
      .sort((a, b) => {
        if (a.lastUsedTime !== b.lastUsedTime)
          return a.lastUsedTime - b.lastUsedTime;
        if (a.timesPerformed !== b.timesPerformed)
          return a.timesPerformed - b.timesPerformed;
        return String(a.song.title || '').localeCompare(
          String(b.song.title || '')
        );
      });

    for (const item of fillCandidates) {
      if (selected.length >= maxRecommendations) break;
      const reason = formatLastUsedLabel(item.lastUsedTime);
      selected.push({
        ...item.song,
        _recReason: reason,
        _recType: 'fill',
      });
      selectedIds.add(String(item.song._id));
    }
  }

  return selected.slice(0, maxRecommendations);
}
