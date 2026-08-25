// middleware/requireApproved.js
const User = require('../models/User');

/**
 * Ensures the authenticated user has been approved.
 * Uses DB state (not JWT) so approvals take effect immediately.
 */
module.exports = async function requireApproved(req, res, next) {
  try {
    if (!req.user?.userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(req.user.userId).select('approvalStatus').lean();
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const status = user.approvalStatus;
    if (status === 'pending' || status === 'rejected') {
      const message =
        status === 'rejected'
          ? 'Account was not approved for this church'
          : 'Account pending approval';
      return res.status(403).json({ message });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
