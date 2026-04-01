# Claim Lead Page — Design Spec

## Overview
When a contractor taps "Claim Lead" from a WhatsApp notification, a browser page opens showing lead details, publisher profile, and two contact options (WhatsApp / in-app message).

## Flow
```
1. notify-whatsapp sends CTA template with signed token in URL
2. Contractor taps "Claim & Contact" → opens browser
3. claim-redirect edge function:
   - Verifies HMAC signature
   - Records claim in pipeline_events (non-blocking, multi-claim OK)
   - Redirects to: app.masterleadflow.com/claim/{leadId}?u={userId}&t={token}
4. Dashboard ClaimLead page:
   - Decodes token, fetches lead + publisher profile
   - Shows Compact Tags layout (style E)
   - Two action buttons: WhatsApp / Message in App
```

## Layout: Compact Tags (Style E, Light Theme)
- Background: #FBFBFD (cream), brand orange #fe5b25
- Header row: profession icon + name + city | urgency badge (orange)
- Description: lead text + tag chips (budget, property type, time ago)
- Publisher row: avatar + name + verified badge (green ✓ or orange "Not Verified") + source group. Tappable → /pro/{slug}
- Stats row: "X Responded" | "You Claimed ✓"
- Sticky bottom buttons:
  1. Green WhatsApp button → wa.me/{phone}?text={intro}
  2. White "Message in App" button → opens in-app chat

## Auth
- No login required — token in URL acts as magic link
- Token is HMAC-SHA256 signed, contains: leadId, userId, senderPhone, introMessage
- claim-redirect already verifies signature

## Changes Required

### 1. Twilio Template (le_lead_claim)
- Type: twilio/call-to-action
- Body: {{1}} *New {{2}} Lead* + location {{3}} + summary {{4}} + source {{5}}
- CTA button: "Claim & Contact" → SUPABASE_URL/functions/v1/claim-redirect?t={{6}}
- {{6}} = base64url signed token

### 2. claim-redirect (update)
- Change: Record claim in pipeline_events instead of updating lead status (multi-claim OK)
- Change: Redirect to app.masterleadflow.com/claim/{leadId}?u={userId}&t={token} instead of wa.me
- Keep: HMAC verification, lead existence check

### 3. Token Generation (notify-whatsapp + whatsapp-webhook)
- Add signToken() function using CLAIM_TOKEN_SECRET
- Generate token in sendLeadNotification() with {l: leadId, u: contractorId, p: senderPhone, m: introMsg}
- Pass as variable {{6}} to CTA template

### 4. ClaimLead.tsx (new page)
- Route: /claim/:token (public, no auth guard)
- On mount: decode token, fetch lead + publisher from Supabase
- Render Compact Tags layout
- WhatsApp button: window.open(wa.me/...)
- Message in App: navigate to /leads/{leadId}/chat (requires session — prompt login if needed)
- Publisher row click: navigate to /pro/{slug}

### 5. Supabase Secrets
- TWILIO_CONTENT_LEAD_NOTIFY → new le_lead_claim SID
- TWILIO_CONTENT_LEAD_NOTIFY_BTN → same SID
- Remove old queue-based LEAD_CONTACT dependency
