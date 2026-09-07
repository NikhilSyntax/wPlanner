const Event = require("../models/Event");
const Song = require("../models/Song");
const { getEventDisplayTitle } = require("./eventTitle");

/** Resolve live event titles, calculate real usage from scheduled events, and patch usage history (in memory + DB). */
async function enrichSongsUsage(songs, { persist = true } = {}) {
  if (!songs) return songs;
  const isArray = Array.isArray(songs);
  const list = isArray ? songs : [songs];
  if (!list.length) return isArray ? [] : null;

  const plain = list.map((s) => (s.toObject ? s.toObject() : { ...s }));
  const songIds = plain.map((s) => s._id).filter(Boolean);

  if (!songIds.length) return isArray ? plain : plain[0];

  // Find all events that have any of these songs in their setlist
  const events = await Event.find({
    setlist: { $in: songIds },
  })
    .select("_id churchId event schedule setlist createdAt")
    .sort({ "schedule.start": -1, createdAt: -1 })
    .lean();

  // Group events by songId
  const eventsBySongId = new Map();
  for (const ev of events) {
    const eventTitle = getEventDisplayTitle(ev);
    const usedAt = ev.schedule?.start || ev.createdAt || new Date();
    const status = ev.event?.status || "draft";

    for (const sId of ev.setlist || []) {
      const sIdStr = String(sId?._id || sId);
      const songKey = sId?.key || plain.find((p) => String(p._id) === sIdStr)?.key || "C";
      if (!eventsBySongId.has(sIdStr)) {
        eventsBySongId.set(sIdStr, []);
      }
      eventsBySongId.get(sIdStr).push({
        eventId: ev._id,
        eventTitle,
        usedAt,
        status,
        key: songKey,
      });
    }
  }

  const songsToPersist = [];

  for (const song of plain) {
    const songIdStr = String(song._id);
    const eventEntries = eventsBySongId.get(songIdStr) || [];

    const currentUsage = song.usage || {};

    // Retain any manual usage entries added by admins
    const manualEntries = (currentUsage.usageHistory || []).filter(
      (entry) => !entry.eventId || entry.isManual
    );

    // Merge scheduled event entries and manual entries
    const combinedHistory = [...eventEntries, ...manualEntries];
    combinedHistory.sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt));

    // Determine the true most recent lastPerformed date
    let effectiveLastPerformed = combinedHistory.length > 0 ? combinedHistory[0].usedAt : null;
    if (currentUsage.manualLastPerformed) {
      const manualDate = new Date(currentUsage.manualLastPerformed);
      if (!effectiveLastPerformed || manualDate > new Date(effectiveLastPerformed)) {
        effectiveLastPerformed = currentUsage.manualLastPerformed;
      }
    }

    const timesPerformed = combinedHistory.length;

    const hasChanged =
      String(currentUsage.lastPerformed) !== String(effectiveLastPerformed) ||
      currentUsage.timesPerformed !== timesPerformed ||
      JSON.stringify(currentUsage.usageHistory || []) !== JSON.stringify(combinedHistory);

    song.usage = {
      ...currentUsage,
      lastPerformed: effectiveLastPerformed,
      manualLastPerformed: currentUsage.manualLastPerformed,
      timesPerformed,
      usageHistory: combinedHistory,
    };

    if (hasChanged && persist) {
      songsToPersist.push({
        _id: song._id,
        usage: song.usage,
      });
    }
  }

  if (persist && songsToPersist.length) {
    await Promise.all(
      songsToPersist.map((item) =>
        Song.updateOne(
          { _id: item._id },
          {
            $set: {
              "usage.lastPerformed": item.usage.lastPerformed,
              "usage.manualLastPerformed": item.usage.manualLastPerformed,
              "usage.timesPerformed": item.usage.timesPerformed,
              "usage.usageHistory": item.usage.usageHistory,
            },
          },
        ),
      ),
    );
  }

  return isArray ? plain : plain[0];
}

module.exports = { enrichSongsUsage };
