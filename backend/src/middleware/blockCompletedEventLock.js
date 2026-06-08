const Event = require("../models/Event");

const LOCK_MESSAGE =
  "This event is completed. Only administrators can make changes.";

/** Use after requireSameChurch — reads req.resource. */
function blockCompletedEventLock(req, res, next) {
  const event = req.resource;
  if (event?.event?.status === "completed" && !req.user?.isAdmin) {
    return res.status(403).json({ message: LOCK_MESSAGE });
  }
  next();
}

/** Load event by route param when req.resource is not set (e.g. chat). */
function requireEventNotLockedUnlessAdmin(paramName = "id") {
  return async (req, res, next) => {
    if (req.user?.isAdmin) return next();

    const eventId = req.params[paramName];
    if (!eventId) return next();

    const event = await Event.findById(eventId)
      .select("event.status churchId")
      .lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    if (
      event.churchId &&
      req.user?.churchId &&
      String(event.churchId) !== String(req.user.churchId)
    ) {
      return res.status(403).json({ message: "Cross-church access denied" });
    }
    if (event.event?.status === "completed") {
      return res.status(403).json({ message: LOCK_MESSAGE });
    }
    next();
  };
}

module.exports = {
  blockCompletedEventLock,
  requireEventNotLockedUnlessAdmin,
  LOCK_MESSAGE,
};
