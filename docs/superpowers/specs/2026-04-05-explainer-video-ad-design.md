# Explainer Video Ad — "Two Worlds Connect"

## Overview

A 50-second Remotion-powered promotional video for social media (YouTube, LinkedIn, website). The video tells the story of two sides of the contractor market — a GC overwhelmed with leads and a sub starving for work — and shows how MasterLeadFlow connects them.

**Format:** 1920x1080, 16:9, 30fps, ~1500 frames
**Style:** Light/clean, matching the MasterLeadFlow website and mobile app design system
**Audience:** General contractors (GCs) and subcontractors
**Goal:** Drive signups — "Start Free" CTA
**Tagline:** "Get jobs. Send jobs. Get paid."
**Audio:** Voiceover + text on screen (VO recorded separately, text built into Remotion)

---

## Design System (from existing codebase)

| Element | Value | Source |
|---------|-------|--------|
| Background | `#faf9f6` (cream) | `tailwind.config.js` |
| Primary text | `#0b0707` (dark) | `tailwind.config.js` |
| Secondary text | `#3b3b3b` at 70% opacity | gray-subtle |
| Primary accent | `#fe5b25` (orange) | `tailwind.config.js` |
| WhatsApp green | `#25D366` | Hero.tsx |
| Success green | `#10b981` | DashboardShowcase.tsx |
| Font (EN) | Inter (300-900) | index.css |
| Headings | `letter-spacing: -0.04em`, `font-weight: 500` | index.css |
| Cards | `rounded-2xl`, `border: #efeff1`, `shadow-lg` | index.css `.card` |
| Buttons | `rounded-full`, various fills | `.btn-primary`, `.btn-secondary` |
| Phone mockup | `bg-dark rounded-[2.5rem] p-2 shadow-2xl` | CTASection.tsx |
| Dot grid BG | `radial-gradient(circle at 1px 1px, #25D366 1px, transparent 0)` 50px | Hero.tsx |
| Logo | Orange square `bg-primary rounded-lg` with layers SVG icon | Navbar.tsx |

---

## Scene Breakdown

### Scene 1: "Two Worlds" — Hook
**Frames:** 0–90 (0–3 seconds)

**Layout:** Screen split vertically down the center with a thin divider line (`border-dark/5`).

**Left side — GC (orange theme):**
- Warm cream background with soft orange radial glow (`rgba(254,91,37,0.08)`)
- Phone mockup (dark frame, `rounded-[2.5rem]`) showing stacked lead cards
- Lead cards use LeadsFeedShowcase style: profession emoji icon, urgency badge (Hot = red, Warm = amber), location text, time ago, group name
- 3 cards stack and pulse red — visual overwhelm
- Text below phone: **"Too many leads"** — Inter bold, dark
- Badge: `bg-primary/15 text-primary rounded-full px-4 py-1.5 text-xs font-semibold` — "General Contractor"

**Right side — Sub (green theme):**
- Cool cream background with soft green radial glow (`rgba(37,211,102,0.08)`)
- Phone mockup showing empty WhatsApp screen (dark WhatsApp theme `bg-[#0b141a]`)
- Text below phone: **"Not enough work"** — Inter bold, dark
- Badge: `bg-[#25D366]/15 text-[#25D366] rounded-full` — "Subcontractor"

**Animation:**
1. Both sides fade/slide in from edges (spring, damping 10)
2. A glowing lead card (`.card` style) flies from left → crosses divider → right side lights up
3. Text appears: **"What if you could connect them?"** — Inter medium, -0.04em tracking, centered

**Voiceover text:** "Too many leads on one side. Not enough work on the other. What if you could connect them?"

---

### Scene 2: "GC Side"
**Frames:** 90–540 (3–18 seconds)

**Layout:** Left side expands to 60% width. Right side blurs and shrinks.

**Inside phone mockup (app-style UI):**
1. **Lead card enters** (spring animation) — styled exactly like LeadsFeedShowcase:
   - Profession: 🏠 Roofing, color `#dc2626`
   - Summary: "Hurricane damage on tile roof, multiple leaks..."
   - Location: "Homestead, FL 33033"
   - Urgency: Hot badge (`bg: rgba(255,59,48,0.12)`, text: `#FF3B30`)
   - Time: "8m ago"
   - Group: "Miami Dade Roofers"
2. **Subcontractor list appears** — 3 cards slide up with:
   - Avatar circle (colored initials, `rounded-full`)
   - Name, profession, star rating
   - Styled as `.card` components
3. **Cursor selects one** → orange checkmark: `bg-primary rounded-full` with white ✓
4. **WhatsApp message composes and flies right** — green bubble exits screen toward right side

**Text outside phone (section-style headings):**
- Phase 1: "A lead comes in" — Inter medium, dark
- Phase 2: "Pick your sub" — Inter medium, dark
- Phase 3: "Send with one tap" — Inter medium, dark
- Subtitles in gray-subtle/70

**Voiceover text:** "A lead comes in that you can't take. Pick a sub from your network. Send the job with one tap."

---

### Scene 3: "Sub Side"
**Frames:** 540–900 (18–30 seconds)

**Layout:** Right side expands to 60%. Left side blurs.

**Inside phone mockup:**
1. **WhatsApp notification arrives** — iOS-style push notification bar at top of phone
2. **Message opens** — WhatsApp dark theme (`bg-[#202c33]`) with:
   - MasterLeadFlow bot avatar (green WhatsApp icon)
   - Job details message: profession, location, deal terms (20% / $240)
   - Styled like CTASection WhatsApp messages
3. **Job detail card expands** — `.card` style with:
   - Profession icon + name
   - Location with pin emoji
   - Deal terms highlighted in green
4. **Accept button** — `rounded-full bg-dark text-white` (btn-primary style) → tap animation → transforms to green `bg-[#10b981]` with ✅
5. **Light confetti** in primary (#fe5b25) and green (#25D366) colors

**Text outside phone:**
- "Job lands on your phone"
- "See the deal"
- "Accept instantly"

**Voiceover text:** "The job lands on your sub's phone. Clear terms, clear deal. One tap to accept."

---

### Scene 4: "Merge — Everyone Wins"
**Frames:** 900–1260 (30–42 seconds)

**Layout transition:** The center divider dissolves. Both sides merge into unified cream background.

**Animation sequence:**
1. **Divider line fades** — opacity 1→0 over 15 frames
2. **Both phone mockups slide toward center and fade out**
3. **Dashboard rises from center** — styled like DashboardShowcase:
   - 4 KPI cards in a row with count-up animations:
     - Active Jobs: 24 (blue `#3b82f6`)
     - Completed: 142 (green `#10b981`)
     - Revenue: $48K (primary `#fe5b25`)
     - Success Rate: 87% (purple `#8b5cf6`)
   - Each card: rounded-xl, subtle border, colored accent
   - Cards enter one by one with spring + staggered delay
4. **Lead table below** — 3 rows slide in left-to-right:
   - Job name + location, Sub name, Deal %, Status badge, Earned amount
   - Matches DashboardShowcase table styling
5. **Two avatars** appear on sides of dashboard:
   - Left: GC avatar with orange ring
   - Right: Sub avatar with green ring
   - Green connecting arrows between them
6. **Text:** **"Everyone wins."** — large Inter medium heading, centered above dashboard

**Voiceover text:** "You earn a cut. They get the job. Everyone wins."

---

### Scene 5: CTA
**Frames:** 1260–1500 (42–50 seconds)

**Animation:**
1. Dashboard + avatars scale down (0.6) and blur
2. Center stage clears

**Final frame content:**
- **Logo:** Orange square with layers icon + "MasterLeadFlow" text — exactly like Navbar
- **Tagline:** **"Get jobs. Send jobs. Get paid."** — Inter bold, -0.04em, dark, large (48px equivalent)
- **CTA button:** `rounded-full bg-[#25D366] text-white px-8 py-4` with WhatsApp icon — **"Start Free →"** — gentle pulse animation (scale 1→1.05→1 loop)
- **URL:** masterleadflow.com — gray-subtle, smaller text
- **Background:** cream with dot grid pattern and soft green glow (matching Hero)

**Voiceover text:** "Get jobs. Send jobs. Get paid. Start free at masterleadflow.com."

---

## Technical Spec

### File Structure
```
apps/landing/src/remotion/
  ExplainerAd.tsx          # Main composition — scene orchestration
  explainer/
    Scene1Hook.tsx          # Two Worlds split screen
    Scene2GCSide.tsx        # GC flow with phone mockup
    Scene3SubSide.tsx       # Sub flow with phone mockup
    Scene4Merge.tsx         # Dashboard merge
    Scene5CTA.tsx           # Call to action
    shared/
      PhoneMockup.tsx       # Reusable dark phone frame
      LeadCardAd.tsx        # Lead card adapted from LeadsFeedShowcase
      WhatsAppMessage.tsx   # WA bubble adapted from CTASection
      KpiCardAd.tsx         # KPI card adapted from DashboardShowcase
      DashboardTable.tsx    # Table rows with staggered animation
      Logo.tsx              # MasterLeadFlow logo from Navbar
```

### Animation Toolkit (reuse existing patterns)
- `spring()` from remotion — with damping 10-12, stiffness 120-140 (matching SubcontractorDemo)
- `interpolate()` for phase transitions
- `NoiseGrain` and `Particles` — NOT used (light theme, clean look)
- Floating `Math.sin(frame * 0.035) * 3` for subtle hover on elements

### Constants
```ts
const FPS = 30
const SCENE_1_START = 0      // Hook
const SCENE_2_START = 90     // GC Side
const SCENE_3_START = 540    // Sub Side
const SCENE_4_START = 900    // Merge
const SCENE_5_START = 1260   // CTA
const TOTAL_FRAMES = 1500    // ~50 seconds
const WIDTH = 1920
const HEIGHT = 1080
```

### Component Reuse Strategy
Components are **adapted, not imported** from landing page components (since landing uses Tailwind + React state, Remotion uses inline styles + frame-based animation). The visual style is replicated:
- Colors, border-radius, shadows, typography are extracted from tailwind config
- Layout patterns are translated from Tailwind classes to inline styles
- Data (lead examples, KPI values) follows the same mock data patterns

### Voiceover Sync
Each scene has a `voText` string exported alongside its component. These serve as:
1. On-screen text (rendered as animated captions)
2. Script for future voiceover recording
3. Timing reference — each scene's text fits its frame budget at natural speaking pace (~150 words/min)

Total word count: ~65 words = ~26 seconds of speech across 50 seconds of video (leaving breathing room)

---

## Out of Scope
- Audio/music integration (added post-render)
- Voiceover recording
- Multiple format exports (9:16, 1:1) — future iteration
- Hebrew version — future iteration
- Remotion Studio preview page setup
