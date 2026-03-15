const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendLoveNotification = onDocumentCreated("rooms/{roomCode}/messages/{messageId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const roomCode = event.params.roomCode;
    const senderUid = data.from;
    const senderName = data.fromName;
    const messageText = data.message;

    try {
        // 1. Get the room data to find out who else is in the room
        const roomDoc = await admin.firestore().doc(`rooms/${roomCode}`).get();
        if (!roomDoc.exists) {
            console.log("Room does not exist.");
            return;
        }

        const members = roomDoc.data().members || [];
        
        // 2. Find the partner (the UID that is NOT the sender's UID)
        const partnerUids = members.filter(uid => uid !== senderUid);
        if (partnerUids.length === 0) {
            console.log("No partner found in room.");
            return;
        }

        // 3. Get the partner's FCM Token from the users collection
        const tokens = [];
        for (const uid of partnerUids) {
            const userDoc = await admin.firestore().doc(`users/${uid}`).get();
            if (userDoc.exists && userDoc.data().fcmToken) {
                tokens.push(userDoc.data().fcmToken);
            }
        }

        if (tokens.length === 0) {
            console.log("Partner does not have notifications enabled (No FCM Token).");
            return;
        }

        // 4. Construct and send the push notification
        const payload = {
            notification: {
                title: `💕 ${senderName}`,
                body: messageText,
            },
            tokens: tokens
        };

        const response = await admin.messaging().sendEachForMulticast(payload);
        console.log(`Successfully sent ${response.successCount} messages.`);
        
    } catch (error) {
        console.error("Error sending notification:", error);
    }
});