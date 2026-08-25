const Event = require("../models/Event");

const TYPE_LABELS = {
  service: "Worship Service",
  rehearsal: "Rehearsal",
  meeting: "Team Meeting",
  special: "Special Event",
  seminar: "Seminar",
  wedding: "Wedding",
  baptism: "Baptism",
  other: "Event",
};

/** Best display name for an event (stored title or derived from type + date). */
function getEventDisplayTitle(eventDoc) {
  if (!eventDoc) return "";

  const stored = eventDoc.event?.title?.trim();
  if (stored) return stored;

  const type = eventDoc.event?.type || "service";
  const label = TYPE_LABELS[type] || "Event";
  const start = eventDoc.schedule?.start;

  if (start) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${label} — ${dateStr}`;
    }
  }

  return label;
}

/** Persist a derived title when the event subdocument lost its name. */
async function ensureEventHasTitle(eventDoc) {
  const displayTitle = getEventDisplayTitle(eventDoc);
  if (!displayTitle || !eventDoc?._id) return displayTitle;

  if (!eventDoc.event?.title?.trim()) {
    await Event.updateOne(
      { _id: eventDoc._id },
      { $set: { "event.title": displayTitle } },
    );
    if (!eventDoc.event) eventDoc.event = {};
    eventDoc.event.title = displayTitle;
  }

  return eventDoc.event.title?.trim() || displayTitle;
}

module.exports = {
  getEventDisplayTitle,
  ensureEventHasTitle,
  TYPE_LABELS,
};
