# Job Portal Redesign — Publisher Conversion Page

**Date:** 2026-04-07
**Status:** Draft
**Scope:** Redesign of `JobPortal.tsx` — the page a publisher sees when a sub-contractor sends them a job confirmation link.

---

## Context

When a sub-contractor (e.g. Moti) claims a job that was posted in a WhatsApp group, the system generates a message for Moti to forward to the publisher (the person who posted the job). This message contains a link to the Job Portal page.

**The publisher:**
- Posted a job in a WhatsApp group (e.g. "Locksmith needed in Hicksville")
- Already agreed with Moti to do the work — the deal is done
- Does NOT know what MasterLeadFlow is
- Is clicking a link from a WhatsApp message Moti forwarded

**Current problems:**
- Page says "Approve Job" — but there's nothing to approve, the deal is done
- No explanation of who we are or what the platform does
- No clear value proposition for the publisher
- Generic branding that doesn't build trust
- CTA is confusing — "approve" implies pending permission

**Goal:** Convert the publisher into a registered user by showing immediate value (manage this specific job) and long-term value (AI-powered sub-contractor matching for future jobs).

---

## Page Structure — Scrollable Story

The page is a single scrollable story. Each section answers one question in the publisher's mind, in order.

### Section 1 — "What happened?" (Hero)

**Content:**
- Moti's name + avatar initial (already available from job data)
- Headline: "מוטי לקח את העבודה שלך ✅" / "Moti took your job ✅"
- Sub: job type + location (e.g. "Locksmith · Hicksville, 11801")
- One-liner: "The job is set. Let's manage it in one place." / "העבודה סגורה. בוא ננהל אותה במקום אחד."

**Design:** Clean hero with brand gradient background (orange → warm). Contractor avatar circle at top. Bilingual toggle retained from current implementation.

**Why:** Opens with what the publisher already knows. No surprises. The language is "manage together" not "approve."

### Section 2 — "What's in it for me?" (Value Cards)

Three horizontal cards:

1. **📋 Track this job** — "Status, commission, contact details — all in one place"
2. **🔄 Next time it's automatic** — "Post a job? AI connects you to a sub-contractor in minutes"
3. **⭐ Build your reputation** — "Get and give ratings. Good sub-contractors will want to work with you"

**Design:** White cards on cream background (`#faf9f6`). Lucide icons. Each card is 2 lines max. Responsive: horizontal on desktop, stacked on mobile.

**Why:** Answers "why should I care" with immediate value (this job), future value (AI matching), and social value (reputation). The free/no-cost message moves to small text near the CTA instead of taking a full card.

### Section 3 — "Who are you?" (Trust)

**Content:**
- Image: `contractors-team.webp` (338KB, optimized)
- One line: "MasterLeadFlow — the platform connecting general contractors with sub-contractors"
- Trust signals row: ⭐ 4.9 · 500+ contractors · FL, TX, CA, NY

**Design:** Centered layout. Image with subtle rounded corners. Trust badges from existing landing page icons (`verified.svg`, `trusted.svg`). Compact — this section should not be tall.

**Why:** Now that they understand the value, they need to know it's legit. Brief and visual.

### Section 4 — "What do I need to do?" (CTA + Signup Form)

**Content:**
- Headline: "Enter your details to see the job in your dashboard" / "הכנס פרטים כדי לראות את העבודה בדשבורד"
- Form fields: Name, Phone
- Button: "→ Take me to my job" / "→ קח אותי לעבודה שלי"
- Small text below button: "Free. No credit card. No commitment." / "בחינם. בלי כרטיס אשראי. בלי התחייבות."

**Design:** White card with subtle shadow. Orange CTA button (`#fe5b25`). Fields styled consistently with landing page inputs.

**Why:** The CTA is NOT "sign up" or "approve." It's "show me my job" — a natural continuation of the story. The free/no-cost reassurance is here where the friction is.

### Section 5 — Success Screen

**Content:**
- "🎉 You're in!"
- "The job with Moti is waiting for you in the dashboard."
- Button: "→ Go to Dashboard"

**Design:** Celebratory but clean. Confetti animation optional (reuse `fadeInUp` animation from landing page).

---

## Data Flow

No changes to the backend. The existing flow works:

1. Publisher clicks link → `JobPortal.tsx` loads with token from URL
2. `get_job_order_by_token(token)` fetches job data (contractor name, profession, location, summary)
3. Publisher fills form → `portal-signup` edge function creates account
4. Job is already in the system — publisher sees it in dashboard after login

**Data already available from the token RPC:**
- Contractor name (for hero section)
- Profession + city + zip (for job details)
- Job summary/description
- Deal type and value

No new API calls or database changes needed.

## Bilingual Support

Retain the existing language toggle (EN/HE) from current `JobPortal.tsx`. All new copy needs both English and Hebrew translations. Hebrew uses RTL layout and Heebo font (already configured).

## Design System

Reuse from landing page (`apps/landing/`):
- **Colors:** `#fe5b25` (primary), `#e04d1c` (hover), `#faf9f6` (background), `#0b0707` (text)
- **Typography:** Inter (EN), Heebo (HE), letter-spacing -0.04em on headings
- **Components:** `.card` pattern, `.btn-primary` pattern, trust badge row
- **Images:** `contractors-team.webp` from landing public folder
- **Icons:** Lucide (already imported in dashboard)

## Scope Boundaries

**In scope:**
- Complete visual redesign of `JobPortal.tsx`
- New copy (EN + HE) for all 5 sections
- Reuse existing brand assets from landing page
- Same signup flow (name + phone → portal-signup edge function)

**Out of scope (separate features):**
- Mutual rating system (publisher ↔ sub-contractor)
- Job completion flow
- Publisher onboarding wizard inside dashboard
- Changes to the WhatsApp message template
- Changes to claim-redirect edge function
- Changes to portal-signup edge function

## Success Criteria

- Publisher understands what happened (Moti took the job) within 3 seconds
- Publisher understands what MasterLeadFlow is within one scroll
- Publisher sees clear personal value before reaching the signup form
- Signup form feels like "access my job" not "create an account"
- Page looks professional and trustworthy on mobile (primary device)
