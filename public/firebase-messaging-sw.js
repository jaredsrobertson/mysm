// firebase-messaging-sw.js
importScripts('config.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

if (!self.MYSM_CONFIG) {
  console.error("Service Worker: config.js not found! Create it from config.example.js");
} else {
  try {
    firebase.initializeApp(self.MYSM_CONFIG.firebase);
    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('Received background message:', payload);
      
      const notificationTitle = payload.notification.title || 'New Message';
      const notificationOptions = {
        body: payload.notification.body || 'You have a new message',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
          url: payload.fcmOptions?.link || 'https://mysm-baby.web.app'
        }
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });

    // Handle notification clicks
    self.addEventListener('notificationclick', (event) => {
      console.log('Notification clicked');
      event.notification.close();

      const urlToOpen = event.notification.data?.url || 'https://mysm-baby.web.app';

      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            // Check if app is already open
            for (let client of clientList) {
              if (client.url === urlToOpen && 'focus' in client) {
                return client.focus();
              }
            }
            // Otherwise open new window
            if (clients.openWindow) {
              return clients.openWindow(urlToOpen);
            }
          })
      );
    });

  } catch (error) {
    console.error('Service Worker initialization error:', error);
  }
}