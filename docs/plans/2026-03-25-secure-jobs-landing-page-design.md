# Secure Jobs Landing Page — Design Document

**Date:** 2026-03-25
**Route:** `/secure-jobs` (public, no auth required)
**Approach:** Story-driven landing page — pain → solution → CTA
**Language:** English (simple, accessible for non-native speakers)
**Voice:** Direct, speaks to "You" and "Your sub" — no jargon
**Target:** Both sides — those who hire subs AND those who are subs
**CTA:** Free signup — "Join Free Now"
**Design benchmark:** Partner pages (glass panels, animations, premium feel)

---

## Page Structure — 6 Sections

### Section 1: Hero — "Pass Jobs. Not Risk."

- **Background:** Dark gradient (navy → black) with subtle grid pattern
- **Headline:** "Pass Jobs. Not Risk."
- **Subheadline:** "Hire verified subs. Get rated. Build your reputation. Track every job from handshake to completion — all in one platform."
- **Visual:** Three animated icons appearing in sequence: Verify → Transfer → Track
- **CTA Button:** "Join Free — Start Hiring with Confidence" (orange #fe5b25)
- **Below CTA:** "No credit card required. 2-minute setup."

### Section 2: The Problem — "Passing Jobs Today? It's All Based on Luck."

- **Background:** White/off-white with glass panel cards
- **Headline:** "Passing Jobs Today? It's All Based on Luck."
- **Three glass cards with icons:**

**Card 1 — "No Information" 🎲**
"You give a job to someone you don't know. No reviews. No history. Just a phone number from a WhatsApp group."

**Card 2 — "No Control" 👻**
"They stop answering. They do bad work. They take the money and disappear. You have no way to protect yourself."

**Card 3 — "Both Sides Lose" 🤷**
"Your sub also takes a risk. They do the work, but sometimes don't get paid. Without trust — everyone loses."

- **Summary line:** "This happens every day. Billions in jobs move with zero protection. Until now."

### Section 3: The Solution — "We Built the Missing Layer of Trust"

- **Background:** Subtle gradient from white to very light orange
- **Headline:** "We Built the Missing Layer of Trust"
- **Subheadline:** "Think of us as the safety net between you and your sub. We verify, track, and rate — so you don't have to hope for the best."
- **Three animated steps (appear sequentially):**

**Step 1 — Verify ✓**
"Every sub on our platform is verified. Real identity. Real work history. Real ratings from real people."

**Step 2 — Transfer →**
"Send a job to your sub with one click. They get all the details. You get a dashboard to follow everything."

**Step 3 — Track 📊**
"See the job status in real time. When it's done — both sides rate each other. Good work builds reputation. Bad work gets flagged."

- **Highlight box (glass panel with orange border):**
"Your sub doesn't have an account yet? No problem. Send them a link to join — it takes 2 minutes. Then transfer the job directly."

### Section 4: Trust System — "Trust Goes Both Ways"

- **Background:** White with glass cards
- **Headline:** "Trust Goes Both Ways"
- **Subheadline:** "After every job, both sides rate each other. Over time, the best people rise to the top."
- **Two columns side by side:**

**Column A — "When You Hire a Sub"**
- ⭐ Rate their work quality
- ⭐ Rate their communication
- ⭐ Rate if they finished on time
- ✅ "Would you hire them again?"

**Column B — "When You Are the Sub"**
- ⭐ Rate if they paid on time
- ⭐ Rate their communication
- ⭐ Rate if the job was as described
- ✅ "Would you work with them again?"

- **Tier system visual (4 badges in a row):**
🟢 New → 🔵 Verified → 🟣 Trusted → 🟡 Elite

- **Tier explanation:** "The more jobs you complete and the better your ratings — the higher your tier. Higher tier = more trust = more jobs."

### Section 5: Dashboard — "Your Jobs. One Dashboard. Full Control."

- **Background:** Dark section (navy/charcoal) for contrast
- **Headline:** "Your Jobs. One Dashboard. Full Control."
- **Subheadline:** "No more chasing updates on WhatsApp. See everything in one place."
- **Visual:** Stylized dashboard mockup with glow effect, slight 3D perspective tilt on dark background
- **Three feature points below mockup:**

📋 **Job Status** — "See which jobs are active, completed, or waiting — in real time."
💬 **Communication Log** — "All messages and updates in one place. No more scrolling through chats."
📊 **Performance Over Time** — "Track your ratings, completed jobs, and reputation score as you grow."

- **Summary line:** "This is not just a tool. It's your professional profile — and it follows you everywhere."

### Section 6: CTA — "Ready to Pass Jobs the Smart Way?"

- **Background:** Dark gradient matching Hero (navy → black), creates full-circle feeling
- **Headline:** "Ready to Pass Jobs the Smart Way?"
- **Subheadline:** "Join for free. Set up your profile in 2 minutes. Start building your reputation today."
- **CTA Button:** Large orange button with animated glow — "Join Free Now →"
- **Below button:**
  - ✓ No credit card needed
  - ✓ Free to join
  - ✓ Takes 2 minutes

---

## Technical Specs

- **File:** `apps/dashboard/src/pages/SecureJobs.tsx`
- **Route:** `/secure-jobs` (public, added to App.tsx outside RequireAuth)
- **Styling:** Tailwind CSS + custom animations from index.css (glass-panel, fade-in, stagger-children)
- **SEO:** React Helmet for meta tags (title, description, og:image)
- **Responsive:** Mobile-first, single column on mobile, multi-column on desktop
- **Animations:** Intersection Observer for scroll-triggered animations (count-up, fade-in, stagger)
- **CTA links:** Navigate to `/login` or signup flow
- **No backend required:** Static content page, no Supabase queries needed
- **Design system:** Match Partner pages — glass panels, premium shadows, Plus Jakarta Sans font
