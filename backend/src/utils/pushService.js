const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const config = require('../config/config')();

// Ensure VAPID keys exist (environment or auto-generated fallback)
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || config.vapid?.publicKey;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || config.vapid?.privateKey;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:notifications@wplanner.app';

if (!vapidPublicKey || !vapidPrivateKey) {
  // Generate a fallback pair for immediate out-of-the-box operation
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  console.log('[WebPush] Auto-generated VAPID keys initialized.');
}

try {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
} catch (err) {
  console.error('[WebPush] Failed to set VAPID details:', err);
}

exports.getVapidPublicKey = () => vapidPublicKey;

/**
 * Save or update a user push subscription
 */
exports.subscribeUser = async (userId, subscriptionData, userAgent = '') => {
  const { endpoint, keys } = subscriptionData;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    throw new Error('Invalid subscription payload');
  }

  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      userId,
      endpoint,
      keys,
      userAgent,
      createdAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return subscription;
};

/**
 * Remove a push subscription by endpoint
 */
exports.unsubscribeUser = async (userId, endpoint) => {
  await PushSubscription.findOneAndDelete({ endpoint, userId });
  return { success: true };
};

/**
 * Send push notification to all active devices of a user
 */
exports.sendPushToUser = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ userId });
    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payloadString = JSON.stringify({
      title: payload.title || 'wPlanner Notification',
      message: payload.message || payload.body || '',
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
      link: payload.link || payload.url || '/',
      tag: payload.tag || 'wplanner-alert',
      senderId: payload.senderId || null,
      recipientId: String(userId),
      data: {
        link: payload.link || payload.url || '/',
        type: payload.type || 'system',
        senderId: payload.senderId || null,
        recipientId: String(userId),
      },
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, payloadString);
        return { success: true, id: sub._id };
      } catch (err) {
        // If subscription is expired, unauthorized or key mismatched, auto-delete from DB
        const statusCode = err.statusCode;
        if (statusCode === 410 || statusCode === 404 || statusCode === 401 || statusCode === 403 || statusCode === 400) {
          console.log(`[WebPush] Removing invalid/expired subscription ${sub._id} (HTTP ${statusCode})`);
          await PushSubscription.findByIdAndDelete(sub._id);
        } else {
          console.error(`[WebPush] Push failed for ${sub._id}:`, err.message || err);
        }
        return { success: false, id: sub._id, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.length - sentCount;

    return { sent: sentCount, failed: failedCount };
  } catch (err) {
    console.error('[WebPush] Error dispatching user push:', err);
    return { sent: 0, failed: 0, error: err.message };
  }
};
