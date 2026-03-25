// setup-twilio-broadcast-templates.js
// Creates WhatsApp Content Templates for the job broadcast system
//
// Usage: TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx node setup-twilio-broadcast-templates.js

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars');
  process.exit(1);
}

const TEMPLATES = [
  {
    friendly_name: 'le_broadcast_notify',
    language: 'en',
    variables: {
      '1': 'profession_emoji',
      '2': 'profession',
      '3': 'city',
      '4': 'deal_summary',
      '5': 'publisher_name',
    },
    types: {
      'twilio/quick-reply': {
        body: '{{1}} *Job Available: {{2}}*\n━━━━━━━━━━━━━━━\n\n📍 *Location:* {{3}}\n💰 *Terms:* {{4}}\n👤 *From:* {{5}}\n\n⚡ Interested in this job?',
        actions: [
          { title: '✅ Interested', id: 'broadcast_interested' },
          { title: '❌ Pass', id: 'broadcast_pass' },
        ],
      },
    },
  },
  {
    friendly_name: 'le_broadcast_interest',
    language: 'en',
    variables: {
      '1': 'contractor_name',
      '2': 'tier',
      '3': 'rating',
      '4': 'completed_jobs',
      '5': 'profile_url',
    },
    types: {
      'twilio/call-to-action': {
        body: '👋 *{{1}} is interested in your job!*\n\n🏅 {{2}} | ⭐ {{3}} | ✅ {{4}} jobs completed\n\nCheck their profile:',
        actions: [
          {
            title: '👤 View Profile',
            type: 'URL',
            url: '{{5}}',
          },
        ],
      },
    },
  },
  {
    friendly_name: 'le_broadcast_chosen',
    language: 'en',
    variables: {
      '1': 'profession',
      '2': 'city',
      '3': 'portal_url',
    },
    types: {
      'twilio/call-to-action': {
        body: "🎉 *You've been selected for a {{1}} job in {{2}}!*\n\nTap below to view details and confirm:",
        actions: [
          {
            title: '📋 View Job Details',
            type: 'URL',
            url: '{{3}}',
          },
        ],
      },
    },
  },
  {
    friendly_name: 'le_broadcast_closed',
    language: 'en',
    variables: {},
    types: {
      'twilio/text': {
        body: 'Thanks for your interest! This job has been assigned to another contractor.\n\nKeep your profile updated to get more opportunities! 💪',
      },
    },
  },
  {
    friendly_name: 'le_contractor_invite',
    language: 'en',
    variables: {
      '1': 'inviter_name',
      '2': 'register_url',
    },
    types: {
      'twilio/call-to-action': {
        body: '👋 *{{1}} wants to send you work on LeadExpress!*\n\nJoin now to see job details and start receiving opportunities:',
        actions: [
          {
            title: '🚀 Register Now',
            type: 'URL',
            url: '{{2}}',
          },
        ],
      },
    },
  },
];

async function createTemplates() {
  const results = [];

  for (const tpl of TEMPLATES) {
    console.log(`\nCreating template: ${tpl.friendly_name}`);
    const res = await fetch('https://content.twilio.com/v1/Content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' +
          Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: JSON.stringify(tpl),
    });
    const data = await res.json();

    if (res.ok) {
      console.log(`  ✅ SID: ${data.sid}`);
      results.push({ name: tpl.friendly_name, sid: data.sid });
    } else {
      console.log(`  ❌ Error: ${JSON.stringify(data)}`);
      results.push({ name: tpl.friendly_name, error: data });
    }
  }

  console.log('\n\n=== TEMPLATE SIDs ===');
  console.log('Add these to whatsapp-webhook CONTENT object:\n');
  for (const r of results) {
    if (r.sid) {
      const key = r.name
        .replace('le_', '')
        .toUpperCase()
        .replace(/_/g, '_');
      console.log(`  ${key}: '${r.sid}',`);
    }
  }
}

createTemplates();
