import api from './api';

const STORAGE_PREFIX = 'wplanner_offline_setlist_';
const INDEX_KEY = 'wplanner_offline_setlists_index';

/**
 * Retrieve the index of all currently downloaded offline setlists.
 * @returns {Array<{ eventId: string, eventTitle: string, songCount: number, downloadedAt: number }>}
 */
export function getOfflineSetlistsIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function updateIndex(eventId, eventTitle, songCount) {
  try {
    const index = getOfflineSetlistsIndex().filter((item) => String(item.eventId) !== String(eventId));
    index.unshift({
      eventId: String(eventId),
      eventTitle: eventTitle || 'Event Setlist',
      songCount: songCount || 0,
      downloadedAt: Date.now(),
    });
    localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, 50)));
  } catch (e) {
    console.warn('[OfflineSetlist] Failed to update offline index:', e);
  }
}

function removeFromIndex(eventId) {
  try {
    const index = getOfflineSetlistsIndex().filter((item) => String(item.eventId) !== String(eventId));
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn('[OfflineSetlist] Failed to remove from offline index:', e);
  }
}

/**
 * Check if a setlist for an event is available offline.
 * @param {string} eventId
 * @returns {boolean}
 */
export function isSetlistOffline(eventId) {
  if (!eventId) return false;
  try {
    return Boolean(localStorage.getItem(`${STORAGE_PREFIX}${eventId}`));
  } catch (e) {
    return false;
  }
}

/**
 * Get the offline bundle for an event.
 * @param {string} eventId
 * @returns {{ eventId: string, eventTitle: string, downloadedAt: number, songs: Array, songsById: Object } | null}
 */
export function getOfflineSetlist(eventId) {
  if (!eventId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[OfflineSetlist] Error parsing offline setlist:', e);
    return null;
  }
}

/**
 * Get a single song from the offline setlist cache.
 * @param {string} eventId
 * @param {string} songId
 * @returns {Object|null}
 */
export function getOfflineSong(eventId, songId) {
  if (!eventId || !songId) return null;
  const bundle = getOfflineSetlist(eventId);
  if (!bundle || !bundle.songsById) return null;
  return bundle.songsById[String(songId)] || null;
}

/**
 * Save an offline setlist bundle directly into localStorage.
 * @param {string} eventId
 * @param {Object} bundle
 */
export function saveOfflineSetlist(eventId, bundle) {
  if (!eventId || !bundle) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${eventId}`, JSON.stringify(bundle));
    updateIndex(eventId, bundle.eventTitle, bundle.songs?.length || 0);
    window.dispatchEvent(
      new CustomEvent('wplanner:offline_setlist_updated', {
        detail: { eventId, bundle },
      })
    );
  } catch (e) {
    console.error('[OfflineSetlist] Failed to save offline setlist:', e);
  }
}

/**
 * Download and cache an event's full setlist with all chords & lyrics.
 * Single fast network round trip with fallback to individual songs if needed.
 * @param {string} eventId
 * @returns {Promise<Object>} The cached offline bundle
 */
export async function downloadSetlist(eventId) {
  if (!eventId) throw new Error('Event ID is required');

  // 1. Fetch event with fullSetlist=true
  const eventRes = await api.get(`/events/${eventId}?fullSetlist=true`);
  const eventDoc = eventRes.data || {};
  const eventTitle = eventDoc.title || eventDoc.event?.title || 'Worship Service';
  const rawSetlist = Array.isArray(eventDoc.setlist) ? eventDoc.setlist : [];

  // 2. Ensure each song has full content (lyrics & chords)
  const fullSongs = await Promise.all(
    rawSetlist.map(async (item) => {
      // If item already has content populated, use it
      if (item && item.content && (item.content.chords || item.content.lyrics)) {
        return item;
      }
      const sId = item?._id || item;
      try {
        const songRes = await api.get(`/songs/${sId}`);
        return {
          ...item,
          ...songRes.data,
        };
      } catch (err) {
        console.warn(`[OfflineSetlist] Could not fetch full content for song ${sId}:`, err.message);
        return item;
      }
    })
  );

  const songsById = {};
  fullSongs.forEach((song) => {
    if (song?._id) {
      songsById[String(song._id)] = song;
    }
  });

  const bundle = {
    eventId: String(eventId),
    eventTitle,
    downloadedAt: Date.now(),
    songs: fullSongs,
    songsById,
    songCount: fullSongs.length,
    version: 1,
  };

  saveOfflineSetlist(eventId, bundle);
  return bundle;
}

/**
 * Remove an offline setlist from local storage.
 * @param {string} eventId
 */
export function removeOfflineSetlist(eventId) {
  if (!eventId) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${eventId}`);
    removeFromIndex(eventId);
    window.dispatchEvent(
      new CustomEvent('wplanner:offline_setlist_removed', {
        detail: { eventId },
      })
    );
  } catch (e) {
    console.warn('[OfflineSetlist] Failed to remove offline setlist:', e);
  }
}

/**
 * Update a song in the cached setlist bundle (e.g. after editing chords or changing key).
 * @param {string} eventId
 * @param {Object} updatedSong
 */
export function updateSongInOfflineSetlist(eventId, updatedSong) {
  if (!eventId || !updatedSong?._id) return;
  const bundle = getOfflineSetlist(eventId);
  if (!bundle) return;

  const songIdStr = String(updatedSong._id);
  bundle.songsById = bundle.songsById || {};
  bundle.songsById[songIdStr] = {
    ...(bundle.songsById[songIdStr] || {}),
    ...updatedSong,
  };

  if (Array.isArray(bundle.songs)) {
    bundle.songs = bundle.songs.map((s) =>
      String(s._id) === songIdStr ? { ...s, ...updatedSong } : s
    );
  }

  saveOfflineSetlist(eventId, bundle);
}
