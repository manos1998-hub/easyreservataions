const admin = require('firebase-admin');

// 1. Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 2. This is your "Dictionary" to fix the weird letters
const fieldLabels = {
    "7jx7xxcpf2LiQ0GeUzph": "Email",
    "85y0CqXWKrC5DRepvcUb": "Meal Details",
    "LW6ooMfrgfjSsANKfmV5": "Other Notes",
    "O5rvx0XBDsOT2MneLoXo": "Whatsapp",
    "XvwuQnj0v8hunwlYAiB3": "Number of Guests",
    "mwyJKoEHsiVM9VLfvqH1": "Transfer Details",
    "raAW5ajcpqiB2LTVZVBb": "Meal",
    "transferAmount": "Transfer ($)",
    "mealPrice": "Meal ($)",
    "name": "Room Type",
    "time": "Check-in Time"
};

async function runTask() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Generating report for: ${tomorrowStr}`);

    const snapshot = await db.collection('reservations')
        .where('checkin', '==', tomorrowStr)
        .get();

    if (snapshot.empty) {
        console.log('No reservations found for tomorrow.');
        return;
    }

    let emailMessage = `Hello! Here are the reservation details for tomorrow (${tomorrowStr}):\n\n`;

    snapshot.forEach(doc => {
        const data = doc.data();
        emailMessage += `=================================\n`;
        emailMessage += `GUEST: ${data.guestName || 'N/A'}\n`;
        emailMessage += `=================================\n`;

        // Loop through the data and use our dictionary to translate keys
        for (const [key, value] of Object.entries(data)) {
            // Skip things we don't want in the email
            if (['id', 'checkin', 'guestName', 'createdAt'].includes(key)) continue;

            // Look up the "Pretty Name" from our dictionary
            const label = fieldLabels[key] || key; 
            
            // Add to the message
            emailMessage += `${label}: ${value}\n`;
        }
        emailMessage += `\n`;
    });

    // 3. Send via EmailJS
    const emailData = {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: {
            subject: `Reservations Report - ${tomorrowStr}`,
            message: emailMessage
        }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
    });

    if (response.ok) {
        console.log('Email sent successfully with correct names!');
    } else {
        console.error('EmailJS Error:', await response.text());
    }
}

runTask();
