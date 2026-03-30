// firebase-messaging-sw.js

// Handle install and activation to prevent Chrome's default notification
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(self.clients.claim());
});

importScripts('config.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

if (!self.MYSM_CONFIG) {
  console.error("Service Worker: config.js not found!");
} else {
  try {
    firebase.initializeApp(self.MYSM_CONFIG.firebase);
    const messaging = firebase.messaging();

    // CRITICAL: Handle push event directly to prevent Chrome's default notification
    self.addEventListener('push', (event) => {
      console.log('Push event received:', event);
      
      let data = {};
      try {
        if (event.data) {
          data = event.data.json();
          console.log('Push data:', data);
        }
      } catch (e) {
        console.log('Error parsing push data:', e);
      }

      // Extract notification data (from our data payload)
      const notificationData = data.data || {};
      const title = notificationData.title || '💌 New Message';
      const body = notificationData.body || 'You have a new message';
      
      const notificationOptions = {
        body: body,
        icon: notificationData.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'mysm-message',
        requireInteraction: false,
        data: {
          url: notificationData.url || 'https://mysm-baby.web.app'
        }
      };

      // MUST call showNotification to prevent Chrome's default
      event.waitUntil(
        self.registration.showNotification(title, notificationOptions)
      );
    });

    // Also keep Firebase handler as backup
    messaging.onBackgroundMessage((payload) => {
      console.log('Background message (Firebase):', payload);
    });

    // Handle notification clicks
    self.addEventListener('notificationclick', (event) => {
      console.log('Notification clicked');
      event.notification.close();

      const urlToOpen = event.notification.data?.url || 'https://mysm-baby.web.app';

      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            for (let client of clientList) {
              if (client.url.includes('mysm-baby')) {
                return client.focus();
              }
            }
            if (clients.openWindow) {
              return clients.openWindow(urlToOpen);
            }
          })
      );
    });

  } catch (error) {
    console.error('Service Worker error:', error);
  }
}