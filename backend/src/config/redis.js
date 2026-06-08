const redis = require('redis');

let redisClient = null;

// Only try to connect if REDIS_URL is set
const isRedisConfigured = () => {
  return process.env.REDIS_URL || process.env.REDIS_HOST;
};

async function getRedisClient() {
  if (!isRedisConfigured()) {
    throw new Error('Redis not configured');
  }

  if (redisClient && redisClient.isReady) return redisClient;

  const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

  redisClient = redis.createClient({ url });

  redisClient.on('error', (err) => {
    console.error('Redis client error:', err.message);
    redisClient = null;
  });

  try {
    await redisClient.connect();
    console.log('Redis connected');
    return redisClient;
  } catch (err) {
    console.log('Redis not available:', err.message);
    redisClient = null;
    throw err;
  }
}

// Simple cache wrapper (returns null if Redis unavailable)
async function getCache(key) {
  if (!redisClient || !redisClient.isReady) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
}

async function setCache(key, data, ttlSeconds = 300) {
  if (!redisClient || !redisClient.isReady) return;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    console.error('Redis setCache error:', err.message);
  }
}

async function invalidateCache(keyPattern) {
  if (!redisClient || !redisClient.isReady) return;
  try {
    const keys = await redisClient.keys(keyPattern);
    if (keys.length) await redisClient.del(keys);
  } catch (err) {
    console.error('Redis invalidateCache error:', err.message);
  }
}

module.exports = { getRedisClient, getCache, setCache, invalidateCache, isRedisConfigured };
