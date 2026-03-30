import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging.js";

// Check if config loaded
if (!self.MYSM_CONFIG) {
    alert("Error: config.js is missing! Create it from config.example.js");
}

// Initialize Firebase
const firebaseConfig = self.MYSM_CONFIG.firebase;
const VAPID_KEY = self.MYSM_CONFIG.vapidKey;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Global variables
let deferredPrompt;
let currentUser = null;
let currentRoomCode = null;
let messagesUnsubscribe = null;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

// Toast notification function
function showToast(title, body) {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastBody = document.getElementById('toast-body');
    
    toastTitle.textContent = title;
    toastBody.textContent = body;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Handle FOREGROUND messages (when app is open)
onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
    // Extract data from payload (data-only payload)
    const data = payload.data || {};
    const title = data.title || 'New Message';
    const body = data.body || 'You have a new message';
    
    // Show toast notification
    showToast(title, body);
    
    // Also show browser notification if permission granted
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'mysm-message',
            vibrate: [200, 100, 200]
        });
    }
});

// Format timestamp
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

// Render messages
function renderMessages(messages, myName) {
    const feed = document.getElementById('message-feed');
    
    if (messages.length === 0) {
        feed.innerHTML = '<div class="feed-empty">No messages yet. Send one! 💌</div>';
        return;
    }
    
    feed.innerHTML = messages.map(msg => {
        const isSent = msg.fromName === myName;
        const className = isSent ? 'sent' : 'received';
        
        return `
            <div class="message-item ${className}">
                <div class="message-sender">${msg.fromName}</div>
                <div class="message-text">${msg.message}</div>
                <div class="message-time">${formatTime(msg.timestamp)}</div>
            </div>
        `;
    }).join('');
    
    feed.scrollTop = feed.scrollHeight;
}

// Listen to messages
function listenToMessages(roomCode, myName) {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    
    const messagesRef = collection(db, "rooms", roomCode, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push(doc.data());
        });
        renderMessages(messages, myName);
    });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
            console.log('Service Worker Registered');
        })
        .catch((error) => {
            console.error('Service Worker Registration Failed:', error);
        });
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('User signed in:', user.uid);
        checkState();
    } else {
        console.log('Signing in anonymously...');
        signInAnonymously(auth).catch((error) => {
            console.error('Auth error:', error);
            alert('Error initializing app: ' + error.message);
        });
    }
});

// Flow Controller
function checkState() {
    const isStandardStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = ('standalone' in window.navigator) && (window.navigator.standalone);
    const isApp = isStandardStandalone || isIosStandalone;

    const userData = localStorage.getItem('mysm_user');
    
    document.getElementById('loading-screen').classList.add('hidden');

    if (isMobile && !isApp) {
        document.getElementById('install-screen').classList.remove('hidden');
        if(isIos) document.getElementById('ios-install-area').classList.remove('hidden');
        else document.getElementById('android-install-area').classList.remove('hidden');
    } 
    else if (!userData) {
        document.getElementById('setup-screen').classList.remove('hidden');
    } 
    else {
        const data = JSON.parse(userData);
        showMainApp(data.name, data.roomCode);
    }
}

// Install Prompt Handler
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

window.triggerAndroidInstall = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted install');
        }
        deferredPrompt = null;
    } else {
        alert("To install, tap the Chrome menu (⋮) and select 'Install App'");
    }
};

// Tab Switching
window.switchTab = (tab) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'create') {
        document.querySelector('.tab:first-child').classList.add('active');
        document.getElementById('create-tab').classList.add('active');
    } else {
        document.querySelector('.tab:last-child').classList.add('active');
        document.getElementById('join-tab').classList.add('active');
    }
};

// Create Room
window.createRoom = async () => {
    const name = document.getElementById('create-name').value.trim();
    const roomCode = document.getElementById('create-code').value.trim().toLowerCase();
    
    if (!name || !roomCode) {
        alert("Please fill in both fields!");
        return;
    }

    if (roomCode.length < 4) {
        alert("Room code must be at least 4 characters!");
        return;
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        const roomDoc = await getDoc(roomRef);

        if (roomDoc.exists() && roomDoc.data().members.length >= 2) {
            alert("This room is full! Choose a different code.");
            return;
        }

        const members = roomDoc.exists() ? [...roomDoc.data().members, currentUser.uid] : [currentUser.uid];
        
        await setDoc(roomRef, {
            members: members,
            createdAt: serverTimestamp(),
            lastActivity: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, "users", currentUser.uid), {
            displayName: name,
            roomCode: roomCode,
            joinedAt: serverTimestamp()
        });

        localStorage.setItem('mysm_user', JSON.stringify({ name, roomCode }));
        
        document.getElementById('setup-screen').classList.add('hidden');
        showMainApp(name, roomCode);

    } catch (error) {
        console.error('Create room error:', error);
        alert('Error creating room: ' + error.message);
    }
};

// Join Room
window.joinRoom = async () => {
    const name = document.getElementById('join-name').value.trim();
    const roomCode = document.getElementById('join-code').value.trim().toLowerCase();
    
    if (!name || !roomCode) {
        alert("Please fill in both fields!");
        return;
    }

    try {
        const roomRef = doc(db, "rooms", roomCode);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
            alert("Room not found! Check the code.");
            return;
        }

        const roomData = roomDoc.data();
        if (roomData.members.length >= 2 && !roomData.members.includes(currentUser.uid)) {
            alert("This room is full!");
            return;
        }

        const members = roomData.members.includes(currentUser.uid) 
            ? roomData.members 
            : [...roomData.members, currentUser.uid];
        
        await setDoc(roomRef, {
            members: members,
            lastActivity: serverTimestamp()
        }, { merge: true });

        await setDoc(doc(db, "users", currentUser.uid), {
            displayName: name,
            roomCode: roomCode,
            joinedAt: serverTimestamp()
        });

        localStorage.setItem('mysm_user', JSON.stringify({ name, roomCode }));
        
        document.getElementById('setup-screen').classList.add('hidden');
        showMainApp(name, roomCode);

    } catch (error) {
        console.error('Join room error:', error);
        alert('Error joining room: ' + error.message);
    }
};

// Show Main App
async function showMainApp(name, roomCode) {
    currentRoomCode = roomCode;
    
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('welcome-msg').innerText = `Hi, ${name}! 💕`;
    document.getElementById('display-code').innerText = roomCode;

    listenToMessages(roomCode, name);

    if (Notification.permission === "granted") {
        document.getElementById('notify-btn-compact').classList.add('hidden');
        document.getElementById('status-indicator').classList.remove('hidden');
        
        try {
            const registration = await navigator.serviceWorker.ready;
            const token = await getToken(messaging, { 
                vapidKey: VAPID_KEY, 
                serviceWorkerRegistration: registration 
            });
            
            if (token) {
                await setDoc(doc(db, "users", currentUser.uid), {
                    fcmToken: token
                }, { merge: true });
                console.log('FCM token saved:', token);
            }
        } catch(error) {
            console.error("Token refresh failed:", error);
        }
    }
}

// Request Notification Permission
window.requestPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;
            const token = await getToken(messaging, { 
                vapidKey: VAPID_KEY, 
                serviceWorkerRegistration: registration 
            });
            
            if (token) {
                await setDoc(doc(db, "users", currentUser.uid), {
                    fcmToken: token
                }, { merge: true });
                
                document.getElementById('notify-btn-compact').classList.add('hidden');
                document.getElementById('status-indicator').classList.remove('hidden');
            }
        } else {
            alert("Notifications denied. You won't receive messages!");
        }
    } catch (error) {
        console.error('Permission error:', error);
        alert("Error: " + error.message);
    }
};

// Send Love Message
window.sendLove = async (message) => {
    try {
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = "Sent! 💌";
        btn.disabled = true;
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);

        const userData = JSON.parse(localStorage.getItem('mysm_user'));
        
        await addDoc(collection(db, "rooms", userData.roomCode, "messages"), {
            message: message,
            from: currentUser.uid,
            fromName: userData.name,
            timestamp: serverTimestamp()
        });

        await setDoc(doc(db, "rooms", userData.roomCode), {
            lastActivity: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        console.error('Send error:', error);
        alert("Error sending message: " + error.message);
    }
};

// Reset App
window.resetApp = () => {
    if (confirm("Sign out and clear all data?")) {
        if (messagesUnsubscribe) {
            messagesUnsubscribe();
        }
        localStorage.clear();
        window.location.reload();
    }
};