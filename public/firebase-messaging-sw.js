importScripts('config.js'); // Loads self.MYSM_CONFIG
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

if (!self.MYSM_CONFIG) {
  console.error("Service Worker: config.js not found!");
} else {
  firebase.initializeApp(self.MYSM_CONFIG.firebase);
  const messaging = firebase.messaging();
}