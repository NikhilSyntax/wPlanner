const jwt = require('jsonwebtoken');
const config = require('./config')();

module.exports = {
  // JWT payload now contains churchId and isAdmin for tenant isolation
  createJWT: (user) => {
    const payload = {
      userId: user._id,
      churchId: user.churchId,
      isAdmin: !!user.isAdmin,
      isSubAdmin: !!user.isSubAdmin,
      role: user.role,
      approvalStatus: user.approvalStatus || 'approved',
      iss: 'wPlanner'
    };
    return jwt.sign(payload, config.secrets.jwtSecret, { expiresIn: '30d' });
  },

  createRefreshToken: (user) => {
    return jwt.sign({ userId: user._id }, config.secrets.refreshSecret, { expiresIn: '90d' });
  },

  verifyJWT: (token) => {
    try {
      return jwt.verify(token, config.secrets.jwtSecret);
    } catch (error) {
      return null;
    }
  }
};
