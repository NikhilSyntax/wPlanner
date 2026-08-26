import api from './api';

/**
 * Utility to convert URL safe base64 to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Web Push is supported by the current browser / OS
 */
export const isPushNotificationSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

/**
 * Register the Service Worker
 */
export const registerServiceWorker = async () => {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.error('[WebPush] Service Worker registration failed:', error);
    return null;
  }
};

/**
 * Get current push notification status
 */
export const getPushSubscriptionStatus = async () => {
  if (!isPushNotificationSupported()) {
    return { isSupported: false, permission: 'unsupported', isSubscribed: false };
  }

  const permission = Notification.permission; // 'default', 'granted', 'denied'

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: !!subscription,
      subscription,
    };
  } catch (err) {
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
    };
  }
};

/**
 * Subscribe current browser / phone to Web Push notifications
 */
export const subscribeUserToPush = async () => {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported on this browser/device.');
  }

  // 1. Request notification permission from the user
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission was denied. Please allow notifications in your browser/device site settings.'
        : 'Notification permission was dismissed.'
    );
  }

  // 2. Ensure Service Worker is registered and ready
  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js');
  }
  await navigator.serviceWorker.ready;

  // 3. Unsubscribe any existing/stale subscription first to ensure fresh key binding
  try {
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      await existingSub.unsubscribe();
    }
  } catch (e) {
    console.warn('[WebPush] Existing subscription cleanup notice:', e);
  }

  // 4. Fetch VAPID Public Key from Backend
  const keyResponse = await api.get('/notifications/vapid-public-key');
  const vapidPublicKey = keyResponse.data?.publicKey;
  if (!vapidPublicKey) {
    throw new Error('Failed to retrieve server VAPID key.');
  }

  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  // 5. Subscribe with PushManager
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });

  // 6. Send Subscription to Backend
  await api.post('/notifications/push-subscribe', {
    subscription: subscription.toJSON(),
  });

  return { success: true, subscription };
};

/**
 * Unsubscribe current browser / phone from Web Push notifications
 */
export const unsubscribeUserFromPush = async () => {
  if (!isPushNotificationSupported()) return { success: false };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend
      try {
        await api.post('/notifications/push-unsubscribe', { endpoint });
      } catch (e) {
        console.warn('[WebPush] Error notifying backend of unsubscription:', e);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[WebPush] Error unsubscribing:', err);
    throw err;
  }
};

/**
 * Trigger a live test notification to the user's phone / device
 * (Self-healing: auto-registers/re-syncs subscription with backend if missing)
 */
export const sendTestPushNotification = async () => {
  if (isPushNotificationSupported()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const result = await subscribeUserToPush();
        subscription = result.subscription;
      } else {
        await api.post('/notifications/push-subscribe', {
          subscription: subscription.toJSON(),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[WebPush] Auto-sync warning:', e);
    }
  }

  try {
    const response = await api.post('/notifications/test-push');
    return response.data;
  } catch (err) {
    if (err?.response?.status === 400 && err?.response?.data?.message?.includes('No active push subscriptions')) {
      await subscribeUserToPush();
      const retryResponse = await api.post('/notifications/test-push');
      return retryResponse.data;
    }
    throw err;
  }
};

/**
 * Automatically sync current push subscription and current active user ID with Service Worker and backend
 */
export const syncPushSubscriptionWithUser = async (userId) => {
  if (!isPushNotificationSupported()) return;

  // Inform Service Worker of the active user ID
  if (userId) {
    const sendUserToSW = (registration) => {
      const sw = registration?.active || navigator.serviceWorker.controller;
      if (sw) {
        sw.postMessage({
          type: 'SET_CURRENT_USER',
          userId: String(userId),
        });
      }
    };

    if (navigator.serviceWorker.controller) {
      sendUserToSW();
    } else {
      navigator.serviceWorker.ready.then(sendUserToSW).catch(() => {});
    }
  }

  // If push permission is already granted, ensure the browser's subscription is assigned to this active user in backend
  if (Notification.permission === 'granted' && userId) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.post('/notifications/push-subscribe', {
          subscription: subscription.toJSON(),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[WebPush] Background push sync notice:', err);
    }
  }
};

