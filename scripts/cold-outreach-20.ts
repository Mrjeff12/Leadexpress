/**
 * Cold Outreach Script — sends Hebrew marketing DM to 20 prospects
 * Uses Green API (Scanner IL) with random 1-3 min delay between messages
 *
 * Usage: npx tsx scripts/cold-outreach-20.ts
 *        npx tsx scripts/cold-outreach-20.ts --dry-run
 */

const GREEN_API_URL = "https://7107.api.greenapi.com";
const GREEN_API_ID = "7107548478";
const GREEN_API_TOKEN = "805319ef70304622bc70204e07201458090f71991bcb4f128b";

const DRY_RUN = process.argv.includes("--dry-run");

// 20 prospects from DB — phone + display_name + first group name
const PROSPECTS = [
  { phone: "972515371540", name: "Ilay Bar Jaacov", group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "12159165916", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "12153702869", name: "Xpert Chimney Sweep", group: "GENESIS SAS Chimney HVAC Locksmith" },
  { phone: "12149713590", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "972526823046", name: "Shlomi Biton", group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13058503646", name: "Ofek", group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13146502626", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13158986745", name: "Annette Prager", group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13212710390", name: "~Anaya Joshi", group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13219008498", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13472104693", name: "Master Duct", group: "GENESIS SAS Chimney HVAC Locksmith" },
  { phone: "13057336003", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "972523097515", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13474732963", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "13479303719", name: "BHM SERVICES USA", group: "GENESIS SAS Chimney HVAC Locksmith" },
  { phone: "13527218773", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "18212109949", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "18322309716", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
  { phone: "972527772198", name: null, group: "Locksmith Garage Air Duct Chimney Roofing" },
];

function buildMessage(name: string | null, groupName: string): string {
  const greeting = name ? `היי ${name}` : "היי";
  return `${greeting}, אנחנו שנינו ב-${groupName} 👋
אני משתמש במערכת חכמה שמסננת את כל ההודעות בקבוצה ושולחת לי רק את הלידים באזור שלי ובסוג העבודה שלי.
בוט AI מסנן את הלידים ישר לווצאפ.
כדי לקבל הנחה אני צריך להביא 2 חברים ובאמת שאין לי מישהו אז שלחתי לך, אולי יעניין אותך :)
סליחה אם לא!`;
}

function randomDelay(): number {
  // 1-3 minutes in milliseconds
  return (60 + Math.random() * 120) * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const chatId = `${phone}@c.us`;
  const url = `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });

  if (!res.ok) {
    console.error(`  FAILED: HTTP ${res.status} ${await res.text()}`);
    return false;
  }

  const data = await res.json();
  console.log(`  OK: ${data.idMessage || JSON.stringify(data)}`);
  return true;
}

async function main() {
  console.log(`\n🚀 Cold Outreach Script — ${PROSPECTS.length} prospects`);
  console.log(`📱 Sending from: Scanner IL (${GREEN_API_ID})`);
  console.log(`${DRY_RUN ? "🧪 DRY RUN — no messages will be sent\n" : ""}`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < PROSPECTS.length; i++) {
    const p = PROSPECTS[i];
    const message = buildMessage(p.name, p.group);
    const displayName = p.name || p.phone;

    console.log(`\n[${i + 1}/${PROSPECTS.length}] ${displayName} (${p.group})`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would send:\n  ${message.split("\n")[0]}...`);
      sent++;
    } else {
      const ok = await sendWhatsApp(p.phone, message);
      if (ok) sent++;
      else failed++;
    }

    // Delay before next message (skip after last)
    if (i < PROSPECTS.length - 1) {
      const delay = randomDelay();
      const mins = (delay / 60000).toFixed(1);
      console.log(`  ⏳ Waiting ${mins} min before next message...`);
      await sleep(delay);
    }
  }

  console.log(`\n✅ Done! Sent: ${sent} | Failed: ${failed}`);
  console.log(`⏱️  Total time: ~${PROSPECTS.length * 2} minutes (avg 2 min between messages)`);
}

main().catch(console.error);
