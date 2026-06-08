const Event = require("../models/Event");
const Song = require("../models/Song");
const { getEventDisplayTitle } = require("./eventTitle");

/** Resolve live event titles and patch usage history (in memory + DB). */
async function enrichSongsUsage(songs, { persist = true } = {}) {
  const list = Array.isArray(songs) ? songs : [songs];
  const plain = list.map((s) => (s.toObject ? s.toObject() : { ...s }));

  const eventIds = new Set();
  for (const song of plain) {
    for (const entry of song.usage?.usageHistory || []) {
      if (entry?.eventId) eventIds.add(String(entry.eventId));
    }
  }

  if (!eventIds.size) return plain;

  const events = await Event.find({ _id: { $in: [...eventIds] } })
    .select("event schedule")
    .lean();

  const titleByEventId = new Map(
    events.map((e) => [String(e._id), getEventDisplayTitle(e)]),
  );

  const songsToPersist = [];

  for (const song of plain) {
    if (!song.usage?.usageHistory?.length) continue;

    let dirty = false;
    for (const entry of song.usage.usageHistory) {
      const eventIdStr = String(entry.eventId);
      const liveTitle = titleByEventId.get(eventIdStr);
      if (!liveTitle) continue;

      if (liveTitle && entry.eventTitle !== liveTitle) {
        entry.eventTitle = liveTitle;
        dirty = true;
      }
    }

    if (dirty && persist) songsToPersist.push(song);
  }

  if (persist && songsToPersist.length) {
    await Promise.all(
      songsToPersist.map((song) =>
        Song.updateOne(
          { _id: song._id },
          { $set: { "usage.usageHistory": song.usage.usageHistory } },
        ),
      ),
    );
  }

  return plain;
}

module.exports = { enrichSongsUsage };
