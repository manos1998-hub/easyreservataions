const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function runTask() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Searching for all details for: ${tomorrowStr}`);

    const snapshot = await db.collection('reservations')
        .where('checkin', '==', tomorrowStr)
        .get();

    if (snapshot.empty) {
        console.log('No reservations found.');
        return;
    }

    let messageBody = `You have ${snapshot.size} reservations for tomorrow (${tomorrowStr}):\n\n`;

    snapshot.forEach(doc => {
        const data = doc.data();
        messageBody += `=== GUEST: ${data.guestName || 'Unknown'} ===\n`;
        
        // This part automatically finds EVERY field in your database
        // and adds it to the email so nothing is missed.
        for (const [key, value] of Object.entries(data)) {
            // We skip internal technical IDs so the email stays clean
            if (['id', 'checkin', 'guestName'].includes(key)) continue;
            
            // Format the name to look nicer (e.g., "transferDetails" -> "Transfer Details")
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            
            messageBody += `${formattedKey}: ${value}\n`;
        }
        messageBody += `\n`;
    });

    const emailData = {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: {
            subject: `Daily Report: ${tomorrowStr}`,
            message: messageBody
        }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
    });

    if (response.ok) console.log('Email sent with all details!');
    else console.error('Error:', await response.text());
}

runTask();
