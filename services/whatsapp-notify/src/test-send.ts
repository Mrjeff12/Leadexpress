/**
 * Quick test: send a WhatsApp message via Twilio Sandbox.
 * Usage: npx tsx src/test-send.ts +972XXXXXXXXX
 */
import 'dotenv/config';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const FROM = process.env.TWILIO_WA_FROM ?? 'whatsapp:+14155238886';

const phone = process.argv[2];
if (!phone) {
  console.error('Usage: npx tsx src/test-send.ts +972XXXXXXXXX');
  process.exit(1);
}

const to = `whatsapp:${phone.startsWith('+') ? phone : '+' + phone}`;

console.log(`Sending test message to ${to} from ${FROM}...`);

const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
const auth = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');

const body = new URLSearchParams({
  From: FROM,
  To: to,
  Body: '🔔 LeadExpress Test — WhatsApp connected successfully!\n\nזה הודעת בדיקה מ-LeadExpress. אם אתה רואה את זה, החיבור עובד!',
});

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: auth,
  },
  body: body.toString(),
});

const data = await res.json();

if (res.ok || res.status === 201) {
  console.log('✅ Message sent!');
  console.log('   SID:', data.sid);
  console.log('   Status:', data.status);
} else {
  console.error('❌ Failed:', data.message);
  console.error('   Code:', data.code);
}
