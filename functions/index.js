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
        const senderName = data.fromName || "Someone";
        const messageText = data.message || "💕";

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
            console.log("No partner found in room");
            return null;
        }

        // Get partner's FCM token
        const userDoc = await admin.firestore().doc(`users/${partnerUid}`).get();
        if (!userDoc.exists) {
            console.log("Partner user document does not exist");
            return null;
        }

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) {
            console.log("Partner has no FCM token");
            return null;
        }

        // Send DATA-ONLY payload (prevents duplicate notifications)
        const payload = {
            token: fcmToken,
            data: {
                title: `💌 ${senderName}`,
                body: messageText,
                icon: "/icon-192.png",
                url: "https://mysm-baby.web.app"
            },
            webpush: {
                headers: {
                    Urgency: "high",
                    TTL: "86400"
                },
                fcmOptions: {
                    link: "https://mysm-baby.web.app"
                }
            }
        };

        const response = await admin.messaging().send(payload);
        console.log("Notification sent successfully:", response);

        return null;
    } catch (error) {
        // Handle invalid/expired FCM tokens
        if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
        ) {
            console.log("Stale FCM token detected, cleaning up...");
            // Try to find and clear the stale token
            try {
                const roomCode = event.params.roomCode;
                const roomDoc = await admin.firestore().doc(`rooms/${roomCode}`).get();
                if (roomDoc.exists) {
                    const members = roomDoc.data().members || [];
                    const senderUid = event.data.data().from;
                    const partnerUid = members.find(uid => uid !== senderUid);
                    if (partnerUid) {
                        await admin.firestore().doc(`users/${partnerUid}`).update({
                            fcmToken: admin.firestore.FieldValue.delete()
                        });
                        console.log("Cleared stale token for user:", partnerUid);
                    }
                }
            } catch (cleanupError) {
                console.error("Token cleanup failed:", cleanupError);
            }
        } else {
            console.error("Error sending notification:", error);
        }
        return null;
    }
});