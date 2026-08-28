// middleware/requireSameChurch.js
/**
 * Middleware factory that ensures the requested resource belongs to the same church as the requester.
 * Usage: router.put('/events/:id', requireSameChurch(Event), handler);
 */
module.exports = function requireSameChurch(Model) {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id || req.params.eventId;
      const resource = await Model.findById(resourceId);
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }
      // All tenant-scoped models should have a churchId field
      if (!resource.churchId || String(resource.churchId) !== String(req.user?.churchId)) {
        return res.status(403).json({ message: 'Cross-church access denied' });
      }
      // Attach resource for downstream handlers
      req.resource = resource;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  };
};
