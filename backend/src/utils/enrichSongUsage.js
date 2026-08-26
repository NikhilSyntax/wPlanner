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

    // Sort usage history descending by date (latest first)
    eventEntries.sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt));

    const lastPerformed = eventEntries.length > 0 ? eventEntries[0].usedAt : null;
    const timesPerformed = eventEntries.length;

    const currentUsage = song.usage || {};
    const hasChanged =
      String(currentUsage.lastPerformed) !== String(lastPerformed) ||
      currentUsage.timesPerformed !== timesPerformed ||
      JSON.stringify(currentUsage.usageHistory || []) !== JSON.stringify(eventEntries);

    song.usage = {
      ...currentUsage,
      lastPerformed,
      timesPerformed,
      usageHistory: eventEntries,
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
