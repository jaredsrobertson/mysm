const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendLoveNotification = onDocumentCreated("rooms/{roomCode}/messages/{messageId}", async (event) => {
    try {
        const snapshot = event.data;
        if (!snapshot) return null;

        const data = snapshot.data();
        const roomCode = event.params.roomCode;
        const senderUid = data.from;
        const senderName = data.fromName;
        const messageText = data.message;

        console.log(`New message in room ${roomCode} from ${senderName}`);

        // Get room to find partner
        const roomDoc = await admin.firestore().doc(`rooms/${roomCode}`).get();
        if (!roomDoc.exists) {
            console.log("Room does not exist");
            return null;
        }

        const members = roomDoc.data().members || [];
        const partnerUid = members.find(uid => uid !== senderUid);

        if (!partnerUid) {
            console.log("No partner found");
            return null;
        }

        // Get partner's FCM token
        const userDoc = await admin.firestore().doc(`users/${partnerUid}`).get();
        if (!userDoc.exists || !userDoc.data().fcmToken) {
            console.log("Partner has no FCM token");
            return null;
        }

        const fcmToken = userDoc.data().fcmToken;

        // Send DATA-ONLY payload (prevents duplicates)
        const payload = {
            token: fcmToken,
            data: {
                title: `💌 ${senderName}`,
                body: messageText,
                icon: '/icon-192.png',
                url: 'https://mysm-baby.web.app'
            },
            webpush: {
                headers: {
                    Urgency: 'high'
                }
            }
        };

        const response = await admin.messaging().send(payload);
        console.log('Notification sent successfully:', response);
        
        return null;
    } catch (error) {
        console.error("Error sending notification:", error);
        return null;
    }
});