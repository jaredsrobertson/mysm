const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

// Trigger when a new message is created in any room
exports.sendLoveNotification = onDocumentCreated("rooms/{roomCode}/messages/{msgId}", async (event) => {
    try {
        // Get message data
        const message = event.data.data();
        const roomCode = event.params.roomCode;
        
        console.log(`New message in room ${roomCode} from ${message.fromName}`);

        // Get room data to find all members
        const roomDoc = await admin.firestore().doc(`rooms/${roomCode}`).get();
        
        if (!roomDoc.exists) {
            console.log('Room not found');
            return null;
        }

        const roomData = roomDoc.data();
        const members = roomData.members || [];

        // Find the partner (the member who didn't send the message)
        const partnerUid = members.find(uid => uid !== message.from);

        if (!partnerUid) {
            console.log('No partner found in room');
            return null;
        }

        // Get partner's FCM token
        const partnerDoc = await admin.firestore().doc(`users/${partnerUid}`).get();
        
        if (!partnerDoc.exists) {
            console.log('Partner user document not found');
            return null;
        }

        const partnerData = partnerDoc.data();
        const fcmToken = partnerData.fcmToken;

        if (!fcmToken) {
            console.log('Partner has no FCM token');
            return null;
        }

        // Send notification
        const messagePayload = {
            token: fcmToken,
            notification: {
                title: `💌 ${message.fromName}`,
                body: message.message,
            },
            webpush: {
                fcmOptions: {
                    link: 'https://mysm-baby.web.app'
                },
                notification: {
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    vibrate: [200, 100, 200]
                }
            }
        };

        const response = await admin.messaging().send(messagePayload);
        console.log('Notification sent successfully:', response);
        
        return null;

    } catch (error) {
        console.error('Error sending notification:', error);
        return null;
    }
});