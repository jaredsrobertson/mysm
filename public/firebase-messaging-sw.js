// firebase-messaging-sw.js

// Handle install and activation
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(self.clients.claim());
});

importScripts('config.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

if (!self.MYSM_CONFIG) {
  console.error("Service Worker: config.js not found!");
} else {
  try {
    firebase.initializeApp(self.MYSM_CONFIG.firebase);
    const messaging = firebase.messaging();

    // Handle push events directly — this is the ONLY handler
    // (no onBackgroundMessage to avoid conflicts)
    self.addEventListener('push', (event) => {
      console.log('Push event received');

      let data = {};
      try {
        if (event.data) {
          data = event.data.json();
        }
      } catch (e) {
        console.log('Error parsing push data:', e);
      }

      // Check if app is focused — skip notification if so (toast handles it)
      const promiseChain = self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then((windowClients) => {
        const isFocused = windowClients.some(client => client.focused);

        if (isFocused) {
          console.log('App is focused, skipping system notification');
          return;
        }

        // Extract notification data from our data-only payload
        const notificationData = data.data || {};
        const title = notificationData.title || '💌 New Message';
        const body = notificationData.body || 'You have a new message';

        const notificationOptions = {
          body: body,
          icon: notificationData.icon || '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'mysm-message',
          renotify: true,
          requireInteraction: false,
          data: {
            url: notificationData.url || 'https://mysm-baby.web.app'
          }
        };

        return self.registration.showNotification(title, notificationOptions);
      });

      event.waitUntil(promiseChain);
    });

    // Handle notification clicks
    self.addEventListener('notificationclick', (event) => {
      console.log('Notification clicked');
      event.notification.close();

      const urlToOpen = event.notification.data?.url || 'https://mysm-baby.web.app';

      event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            // Focus existing window if found
            for (const client of clientList) {
              if (client.url.includes('mysm-baby') && 'focus' in client) {
                return client.focus();
              }
            }
            // Otherwise open new window
            if (self.clients.openWindow) {
              return self.clients.openWindow(urlToOpen);
            }
          })
      );
    });

  } catch (error) {
    console.error('Service Worker init error:', error);
  }
}