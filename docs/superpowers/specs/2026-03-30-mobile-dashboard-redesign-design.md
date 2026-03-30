# Mobile Dashboard Redesign - Design Spec

**Date:** 2026-03-30
**Product:** Masterleadflow Contractor Dashboard
**Scope:** Mobile-only redesign (< 768px). Desktop/tablet untouched.
**Prototype:** `prototype-mobile/` on port 5555

---

## 1. Design Principles

- **Clean native feel** — white background, minimal shadows, orange/black/white palette
- **Mobile-first actions** — everything designed for one-thumb operation
- **Contractor in the field** — quick actions, voice input, big tap targets
- **Gamification** — profile strength, trust tiers, lead impact percentages
- **No glass morphism** — solid cards, subtle borders, clean typography

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--brand` | `#fe5b25` | CTAs, accents, active states |
| `--brand-light` | `#fff4f0` | Light accent backgrounds |
| `--dark` | `#111111` | Primary text, dark cards, nav bar |
| `--gray-50` | `#fafafa` | Button backgrounds |
| `--gray-100` | `#f5f5f5` | Dividers, inactive states |

### Typography
- Hero: 34px/700 (-0.04em)
- Title: 24px/700 (-0.03em)
- Headline: 20px/700 (-0.02em)
- Body: 15px/400
- Sub: 14px/600
- Small: 13px/500
- Tiny: 11px/500
- Label: 11px/600 uppercase

---

## 2. Navigation

### Bottom Tab Bar (floating, dark)
- **Position:** Fixed, centered, bottom 24px
- **Style:** Dark pill (`#111`, rounded-28px, blur shadow)
- **5 tabs:** Home | Rebeca | Leads | Jobs | Profile
- Active tab: white circle background, icon filled
- Badges: orange dot with count on Rebeca/Leads
- Labels below icons (9px)
- Hidden on: Rebeca Chat, Lead Detail, Job Detail, sub-pages

### Drawer (hamburger)
- Opens from left, 300px width
- Overlay with blur backdrop
- Contains: avatar + name + tier, profile completion ring
- Links: Groups, Subscription, Settings
- Logout at bottom

### Header
- **Home:** Custom (logo + scan + bell + avatar)
- **Rebeca:** Orange header with photo + "Your AI assistant"
- **Job Detail:** Orange header with title + price + progress
- **Sub-pages:** Back arrow + title
- **Leads/Profile/Jobs:** Shell header with hamburger + bell

---

## 3. Screens

### 3.1 Login (`/login`)
- Orange hero with Masterleadflow branding
- Phone input with country code (+1 US)
- "Continue" orange button
- "Continue with WhatsApp" secondary
- OTP verification step (6 digit)
- Terms link at bottom

### 3.2 Onboarding (`/onboarding`)
- 5-step wizard with progress bar
- Steps: WhatsApp → Professions → Zip Codes → Groups → Hours
- Each step: icon + title + form content
- "Continue" button + "Skip" option
- Last step: "Start Getting Leads"

### 3.3 Complete Account (`/complete-account`)
- Avatar upload with camera button
- Fields: Full name, Phone, Email (optional), Business name (optional)
- Progress bar (2/3)
- "+20% more leads" motivation

### 3.4 Home (`/`)
- **Header:** Logo + Scan + Bell(2) + Avatar(green dot)
- **Greeting:** Dynamic (morning/afternoon/evening) + "12 new leads waiting"
- **Urgent Lead Card:** Dark card with URGENT badge, title, price, distance, "Claim This Lead" full-width orange button
- **KPIs + Schedule:** Side by side — Leads (12, +28%), Rating (4.8) | Today 2 Jobs with timeline
- **Publish + Profile:** Orange "Publish Job" button + Profile ring (72%)
- **Notifications Banner:** Yellow banner "Enable notifications" with Enable button (conditional)
- **Profile Completion:** Ring 72% + "+30% more leads" + chips (Verify ID, License)
- **My Services:** Analytics per profession — name, leads count, trend percentage
- **My Areas:** Chips with city name + pin + lead count

### 3.5 Rebeca Chat (`/rebeca`)
- **Header:** Orange background, Rebeca photo (real `/rebeca.jpg`), "Your AI assistant"
- **Messages:** Bot (white bubbles, photo) / User (dark bubbles)
- **Lead Cards:** Full-width interactive cards inside chat with Claim button
- **After Claim:** Pre-written WhatsApp message to lead publisher
- **Quick Replies:** Contextual chips (Show leads / Publish job / Call Sarah / Navigate)
- **Input:** Text + Mic (when empty) / Send (when typing)
- **Typing indicator:** 3 animated dots with avatar

### 3.6 Leads (`/leads`)
- **Header:** "Leads" title + inline tabs (New 5 / Claimed 1 / Passed)
- **Filters:** Chips (Locksmith active, Miami Area, Today)
- **Lead rows:** Compact — avatar + title + source badge (WA green / APP orange) + price green + chevron
- **Urgent leads:** Orange left border + flame icon
- **Empty state:** Inbox icon + "No leads here"
- **Source badge:** WA (green) = WhatsApp group, APP (orange) = published via platform

### 3.7 Lead Detail (`/lead`)
- **Header:** Back + "Lead Details" + Share
- **Urgent badge** + posted time
- **Title + Price** (large green)
- **Info grid:** Location (city + distance) | Needed (ASAP)
- **Description card**
- **Customer card:** Avatar + name + "First request"
- **Map placeholder** with address bar
- **CTA:** "Contact Lead Publisher" orange full-width

### 3.8 Jobs (`/jobs`)
- **Header:** "Jobs" + orange "+" button (→ Rebeca)
- **Toggle:** My Jobs (4) | Published (3) — segmented control
- **My Jobs tab:**
  - Earned summary: "2 completed · $255 earned"
  - Job cards with publisher photo, title, status (Active/Pending/Done), price
  - Active: mini progress bar (Claimed→Driving→Working→Done) + Call/Go buttons
  - Pending: Accept/Decline buttons
  - Done: clean row
- **Published tab:**
  - Status summary: "2 open"
  - Cards with icon (Send blue=open, Check green=assigned), title, price
  - Stats: views + responses
  - Open with responses: "View 3" button
  - Assigned: "→ Carlos M."
  - Open no responses: "Waiting..."

### 3.9 Job Detail (`/job`) — taken job
- **Orange header:** Title + price (white) + timer + Active badge
- **Timeline in header:** 4 steps (✓ ✓ 3 4) with connecting lines, white on orange
- **"Mark as Done"** white button on orange
- **Map** right below header with address
- **Job Info card:** Fixed price + description + note (yellow)
- **Published By:** Real photo, name, verified badge, rating, 3 buttons: Chat (platform) / WhatsApp / Call
- **Customer:** Real photo, name, phone (Call badge) / SMS / address (copy)
- **Details:** Deal + When

### 3.10 Published Job Detail (`/published-job`)
- **Orange header:** Title + price + Open badge + stats (views, responses, expires)
- **Description card** with location + deal
- **Responses list:** Contractor cards with real photo, name, verified badge, rating, reviews count, tier badge, distance, time ago
- **Best match** badge on top candidate
- **Actions per response:** Accept (orange) / Chat / Profile →
- **"Rebroadcast"** button at bottom if no fit

### 3.11 Direct Chat (`/chat`) — P2P
- **Header:** Back + contractor photo + name + Online + Phone button
- **Context bar:** Orange — "Bathroom Plumbing · $800" + Accept + Profile buttons
- **Messages:** User (dark) / Them (white with photo)
- **Input:** Text + Mic/Send

### 3.12 Messages Inbox (`/messages`)
- **List of conversations:** Avatar + name + job context + last message + time + unread badge
- Rebeca first (orange Sparkles icon)
- P2P chats with photos + job name in orange

### 3.13 Profile (`/profile`)
- **Hero dark card:** Avatar + name + profession + rating + trust journey (4 icons: UserCircle→BadgeCheck→Award→Crown) + strength bar 72% + "Preview my public profile"
- **Unlock Trusted card:** Steps to complete (Identity Verification +30%, Trade License +10%) + done items (Photo ✓, Phone ✓)
- **Tab switcher:** Profile | Settings
- **Profile tab:**
  - Professional Info (collapsible, Services/Areas/Languages/Work Preferences)
  - Portfolio (horizontal carousel, before/after cards, "Add Project")
  - Portfolio impact: "6+ projects = 40% more inquiries"
  - Reviews (summary + bars + latest review)
- **Settings tab:**
  - Communication (WhatsApp connected, Telegram connect, Push enabled)
  - Working Hours (Mon-Fri 8-6, Sat-Sun Off)
  - Preferences (Language, Distance, Notifications)
  - Subscription (Premium $79/mo)

### 3.14 Public Profile View (`/public-profile`)
- Orange gradient hero with "PUBLIC PROFILE PREVIEW" label
- Profile card: photo, name, verified, rating, bio, badges (Verified, Available, 8 yrs)
- "Send Job Offer" CTA
- Stats grid: Jobs, Response time, Groups, Rating
- Services chips
- Service areas
- Portfolio grid
- Reviews with stars

### 3.15 My Reviews (`/reviews`)
- Summary: average 4.8, 5 stars, rating bars
- Would hire again percentage
- Review cards: avatar, name, job, rating, text, time, thumbs up

### 3.16 Notifications (`/notifications`)
- "Mark all read" button
- Types: lead (orange), response (blue), message (green), job (green), review (amber), system (gray)
- Unread: orange dot + bold title + light background
- Each: icon + title + description + time

### 3.17 Identity Verification (`/verify`)
- 4-step flow: Intro → Upload ID → Selfie → Done
- Intro: shield icon, "+30% more leads", 2 steps explained
- Upload: drag area + Camera/Gallery buttons
- Selfie: circular frame + tips
- Done: green check + "Within 24 hours"

### 3.18 Service Areas (`/areas`)
- Map placeholder with pins
- Search bar (zip code or city)
- Search results dropdown
- Current areas list with remove (×)
- "Save Areas" button

### 3.19 Edit Professions (`/professions`)
- Selected chips (orange, removable)
- Search bar
- Grouped by category (Security, Plumbing, Electrical, etc.)
- Toggle selection with checkmark
- "Save Services" button
- Premium/Free limit note

### 3.20 Groups (`/groups`)
- Stats: Groups, Messages scanned, Leads found
- Group cards: WhatsApp icon (green), name, messages count, leads count, "Live" indicator
- Add group: paste link input + "Add Group" button

### 3.21 Subscription (`/subscription`)
- Dark hero: current plan (Premium $79/mo) + renewal date
- Plans: Premium first (ACTIVE badge, orange ring) → Free (Downgrade)
- Features comparison with checkmarks
- Billing info: payment method, next billing, amount
- Cancel button

### 3.22 Drawer (overlay)
- Profile: avatar + name + tier badge
- Completion ring (72%)
- Menu: Groups, Subscription, Settings
- Logout

---

## 4. Implementation Strategy

### Approach: Mobile-only CSS/Components
- **NO changes** to desktop layout, components, or styles
- All new styles scoped to `@media (max-width: 767px)` or via `md:hidden` / `block md:hidden` classes
- New mobile-only components (BottomTabBar, Drawer, MobileHeader) rendered conditionally

### Key Changes per Component:
| Component | Desktop (unchanged) | Mobile (new) |
|-----------|-------------------|--------------|
| Sidebar | Fixed left panel | Hidden, replaced by Drawer |
| Navigation | Sidebar links | Floating bottom tab bar |
| Page layouts | max-w-6xl, sidebar padding | Full width, bottom padding |
| Cards | Standard cards | Compact rounded cards |
| Lead cards | Table rows | Compact list items |
| Job cards | Panel sections | Compact cards with photos |
| Profile | Multi-section page | Hero + collapsible sections |
| Chat | Embedded panel | Full-screen chat |

### New Mobile-Only Components:
1. `MobileBottomTabBar` — floating dark nav
2. `MobileDrawer` — hamburger menu
3. `MobileHeader` — per-page headers
4. `MobileLeadCard` — compact lead row
5. `MobileJobCard` — compact job with photo
6. `SwipeToComplete` — job completion gesture

### Files to Modify:
- `App.tsx` — conditional mobile shell
- `index.css` — mobile-specific styles
- Each page component — add mobile layout variant

### Files to Create:
- `components/mobile/BottomTabBar.tsx`
- `components/mobile/Drawer.tsx`
- `components/mobile/Header.tsx`
- All mobile-specific sub-pages (DirectChat, MessagesInbox, etc.)

---

## 5. Reference

- **Prototype:** `prototype-mobile/` — run with `npm run dev` on port 5555
- **All URLs:** Listed in Section 3 above
- **Brand colors:** Orange `#fe5b25`, Black `#111`, White, Green for prices/success
- **Rebeca image:** `/rebeca.jpg` (real photo from landing page)
- **Font:** System font stack (-apple-system, SF Pro, Inter)
