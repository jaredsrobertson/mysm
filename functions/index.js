const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

// This is the V2 Syntax for Firestore Triggers
exports.sendLoveNotification = onDocumentWritten("history/{code}", async (event) => {
    // 1. Get the data
    // In V2, data is found inside event.data.after
    if (!event.data) return; 
    const newData = event.data.after.data();

    // If data was deleted, do nothing
    if (!newData) return;

    const senderName = newData.from;
    const messageBody = newData.last_message;
    const pairCode = event.params.code; // Note: params are now in 'event.params'

    console.log(`Processing message from ${senderName} in room ${pairCode}`);

    // 2. Find the PARTNER
    const usersRef = admin.firestore().collection('users');
    const snapshot = await usersRef.where('code', '==', pairCode).get();

    if (snapshot.empty) {
        console.log('No users found.');
        return;
    }

    const tokens = [];
    snapshot.forEach(doc => {
        const user = doc.data();
        // If this user is NOT the sender, and they have a token...
        if (user.name !== senderName && user.fcmToken) {
            tokens.push(user.fcmToken);
        }
    });

    if (tokens.length === 0) {
        console.log("No partner token found.");
        return;
    }

    // 3. Send Notification
    const messagePayload = {
        notification: {
            title: `New Message from ${senderName}`,
            body: messageBody,
        },
        webpush: {
            fcmOptions: {
                link: 'https://mysm-baby.web.app'
            },
            notification: {
                icon: '/icon-192.png'
            }
        },
        tokens: tokens
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(messagePayload);
        console.log('Notifications sent:', response.successCount);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
});