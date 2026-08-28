const assert = require('assert');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
const config = require('../config/config')();

async function runAuthTests() {
  console.log('--- Starting Auth Token Persistence Tests ---');

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    churchId: '507f1f77bcf86cd799439022',
    isAdmin: true,
    isSubAdmin: false,
    role: 'Admin',
    approvalStatus: 'approved',
  };

  // Test 1: Generate Access Token and verify expiration is long-lived (30 days)
  console.log('Test 1: Verifying JWT Access Token expiration is long-lived...');
  const accessToken = authConfig.createJWT(mockUser);
  const decodedAccess = jwt.verify(accessToken, config.secrets.jwtSecret);
  const accessTtlSeconds = decodedAccess.exp - decodedAccess.iat;
  const accessTtlDays = accessTtlSeconds / (60 * 60 * 24);
  console.log(`Access Token TTL: ${accessTtlDays} days (${accessTtlSeconds}s)`);
  assert.ok(accessTtlDays >= 29 && accessTtlDays <= 31, 'Access token should have a 30-day lifetime');

  // Test 2: Generate Refresh Token and verify expiration (90 days)
  console.log('Test 2: Verifying Refresh Token expiration...');
  const refreshToken = authConfig.createRefreshToken(mockUser);
  const decodedRefresh = jwt.verify(refreshToken, config.secrets.refreshSecret);
  const refreshTtlSeconds = decodedRefresh.exp - decodedRefresh.iat;
  const refreshTtlDays = refreshTtlSeconds / (60 * 60 * 24);
  console.log(`Refresh Token TTL: ${refreshTtlDays} days (${refreshTtlSeconds}s)`);
  assert.ok(refreshTtlDays >= 89 && refreshTtlDays <= 91, 'Refresh token should have a 90-day lifetime');

  // Test 3: Verify Token Payload Isolation
  console.log('Test 3: Verifying Payload and claims...');
  assert.strictEqual(decodedAccess.userId, mockUser._id);
  assert.strictEqual(decodedAccess.churchId, mockUser.churchId);
  assert.strictEqual(decodedAccess.isAdmin, true);
  assert.strictEqual(decodedAccess.iss, 'wPlanner');

  console.log('\nAll Auth Persistence Tests Passed Successfully! 🎉');
}

runAuthTests().catch((err) => {
  console.error('Auth test failed:', err);
  process.exit(1);
});
