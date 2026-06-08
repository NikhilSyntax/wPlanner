const jwt = require('jsonwebtoken');
const config = require('../config/config')();

module.exports = {
  // Verify JWT and attach user info (userId, churchId, isAdmin) to req.user
  verifyToken: (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Missing token' });
    }

    try {
      const decoded = jwt.verify(token, config.secrets.jwtSecret);
      // decoded should contain userId, churchId, isAdmin
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ message: 'Invalid token' });
    }
  },

  // Restrict endpoint to admin users only
  adminOnly: (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  },

  // Restrict endpoint to users with at least one of the given roles (legacy)
  roleRestriction: (requiredRoles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // New JWT schema includes isAdmin and a single role field on User.
      if (req.user.isAdmin) {
        return next();
      }

      const roleCandidates = [];
      if (typeof req.user.role === 'string') {
        roleCandidates.push(req.user.role);
      }
      if (Array.isArray(req.user.roles)) {
        roleCandidates.push(...req.user.roles);
      }

      const normalizedUserRoles = roleCandidates.map((role) =>
        String(role).toLowerCase().trim()
      );
      const normalizedRequiredRoles = requiredRoles.map((role) =>
        String(role).toLowerCase().trim()
      );

      const hasRole = normalizedUserRoles.some((role) =>
        normalizedRequiredRoles.includes(role)
      );

      if (!hasRole) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      next();
    };
  }
};
