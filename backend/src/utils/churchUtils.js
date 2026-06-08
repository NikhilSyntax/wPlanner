// utils/churchUtils.js
const crypto = require('crypto');
const Church = require('../models/Church');

/**
 * Generate a cryptographically random, unique church code.
 * The code is 6 characters (alphanumeric uppercase) e.g. "A1B2C3".
 */
async function generateUniqueChurchCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    const bytes = crypto.randomBytes(6);
    code = Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
  } while (await Church.exists({ churchCode: code }));
  return code;
}

module.exports = { generateUniqueChurchCode };
