const admin = require('firebase-admin');

// This part connects to your database using the secret key you added to GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runTask() {
    // 1. Get Tomorrow's Date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // Result: "2024-05-20"

    console.log(`Checking reservations for: ${tomorrowStr}`);

    // 2. Fetch from Firebase
    // We look in your 'reservations' collection for anyone checking in tomorrow
    const snapshot = await db.collection('reservations')
        .where('checkin', '==', tomorrowStr)
        .get();

    if (snapshot.empty) {
        console.log('No reservations found for tomorrow.');
        return;
    }

    // 3. Prepare the list of guests
    let guestList = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        guestList += `• Guest: ${data.guestName} | Room: ${data.name} | Time: ${data.time || 'N/A'}\n`;
    });

    // 4. Send to EmailJS
    const emailData = {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY, // The "Secret" key
        template_params: {
            subject: `Daily Report: ${tomorrowStr}`,
            message: `Hello! You have ${snapshot.size} reservations for tomorrow:\n\n${guestList}`
        }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
    });

    if (response.ok) {
        console.log('Email sent successfully!');
    } else {
        const errorText = await response.text();
        console.error('EmailJS failed:', errorText);
    }
}

runTask();
