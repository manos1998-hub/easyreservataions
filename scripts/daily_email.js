const admin = require('firebase-admin');

// 1. Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function runTask() {
    // 2. Get Tomorrow's Date (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Searching for reservations on: ${tomorrowStr}`);

    // 3. Fetch reservations from Firestore
    // Note: We use 'checkin' because that is the ID used in your HTML form
    const snapshot = await db.collection('reservations')
        .where('checkin', '==', tomorrowStr)
        .get();

    if (snapshot.empty) {
        console.log('No reservations found for tomorrow.');
        return;
    }

    // 4. Build a detailed Guest List
    let guestList = "";
    
    snapshot.forEach(doc => {
        const r = doc.data();
        
        // We match these names exactly to your 'index.html' input IDs
        guestList += `------------------------------------------\n`;
        guestList += `GUEST: ${r.guestName || 'N/A'}\n`;
        guestList += `ROOM: ${r.name || 'N/A'}\n`;
        guestList += `CHECK-IN TIME: ${r.time || 'N/A'}\n`;
        
        // Adding the extra details you requested
        guestList += `WHATSAPP: ${r.whatsapp || 'Not provided'}\n`;
        guestList += `EMAIL: ${r.email || 'Not provided'}\n`;
        guestList += `TRANSFER ($): ${r.transferAmount || 0}\n`;
        guestList += `TRANSFER DETAILS: ${r.transferDetails || 'None'}\n`;
        guestList += `MEAL ($): ${r.mealPrice || 0}\n`;
        guestList += `MEAL DETAILS: ${r.mealDetails || 'None'}\n`;
        guestList += `TOTAL GUESTS: ${r.guests || 1}\n`;
        guestList += `OTHER NOTES: ${r.other || 'None'}\n`;
        guestList += `------------------------------------------\n\n`;
    });

    // 5. Send via EmailJS
    const emailData = {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: {
            subject: `Detailed Report for ${tomorrowStr}`,
            message: `You have ${snapshot.size} reservations tomorrow. Here are the full details:\n\n${guestList}`
        }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
    });

    if (response.ok) {
        console.log('Detailed email sent successfully!');
    } else {
        const errorText = await response.text();
        console.error('EmailJS Error:', errorText);
    }
}

runTask();
