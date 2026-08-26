/* ==========================================================================
   wPlanner Service Worker - Web Push & Mobile Lock-Screen Alerts
   ========================================================================== */

let activeUserId = null;

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Receive active user ID from frontend application
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_CURRENT_USER') {
    activeUserId = event.data.userId ? String(event.data.userId) : null;
    console.log('[SW] Active user ID updated:', activeUserId);
  }
});

// Push notification event received from server
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { message: event.data.text() };
    }
  }

  const senderId = data.senderId || (data.data && data.data.senderId);
  const recipientId = data.recipientId || (data.data && data.data.recipientId);

  // 1. Never show notification if the current active user in this browser is the sender
  if (senderId && activeUserId && String(senderId) === String(activeUserId)) {
    console.log('[SW] Push suppressed: Current browser user is the sender (', senderId, ')');
    return;
  }

  // 2. Suppress if push is targeted at a different recipient and we know the active user
  if (recipientId && activeUserId && String(recipientId) !== String(activeUserId)) {
    console.log('[SW] Push suppressed: Target recipient (', recipientId, ') does not match active user (', activeUserId, ')');
    return;
  }

  const title = data.title || 'wPlanner Alert 🎵';
  const body = data.message || data.body || 'You have a new worship update.';
  const link = data.link || data.url || (data.data && data.data.link) || '/';
  const icon = data.icon || '/favicon.ico';
  const badge = data.badge || '/favicon.ico';
  const tag = data.tag || 'wplanner-push-alert';

  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    data: {
      link,
      dateOfArrival: Date.now(),
      senderId,
      recipientId,
    },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open wPlanner' },
      { action: 'close', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetLink = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open with the app, focus and navigate it
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetLink);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetLink);
      }
    })
  );
});

