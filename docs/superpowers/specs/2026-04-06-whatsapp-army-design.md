# WhatsApp Army Dashboard - Design Spec

## Overview

A new "Army" admin department for managing 20-50 WhatsApp "slave" accounts that create organic-looking engagement in WhatsApp groups. The system publishes job posts, contractor profiles, and engagement responses - all linking back to MasterLead - to build brand awareness and drive traffic.

**Separate from Inbox/Pipeline** - this is an outbound marketing engine, not part of the lead ingestion or prospect CRM flow.

## Account Types (Roles)

| Role | Purpose | Message Content |
|------|---------|----------------|
| **Publisher** | Posts job listings in groups | "Hiring a plumber in Miami..." + link to MasterLead job page |
| **Responder** | Replies to publisher posts to create buzz | "Signed up through the link, amazing app" / "Sent a proposal via the site" |
| **Contractor** | Posts "looking for work" with profile link | "Hi, I'm Mike - 12 years experience..." + link to MasterLead profile |

## Architecture

### New Department: "Army"

Added to `departmentConfig.ts` as a new department with 4 tabs:

### Tab 1: Accounts

- List of all slave WhatsApp accounts with status indicators
- Each account has: name/alias, phone number, Green API connection status, role (publisher/responder/contractor)
- "+ Add Slave" button → QR code scanner via Green API `getQR` endpoint
- Badge showing how many groups each account is a member of
- Reuses existing `wa_accounts` table with new fields: `army_role`, `is_army` flag

### Tab 2: Assignments

- Table view: Group → assigned accounts → role per group
- Manual assignment: select a group, pick which accounts operate in it
- Per-group summary: X publishers, Y responders, Z contractors assigned
- Only shows groups where at least one army account is already a member
- Groups fetched from Green API `getContacts` for each army account

### Tab 3: Templates

Three template categories:

**Job Posts (for Publishers):**
- Template body with placeholders: `{profession}`, `{city}`, `{state}`, `{price_range}`, `{job_link}`
- Example: "🔨 Kitchen renovation job | {city}, {state}\n💰 {price_range}\n📍 {city} area\n\nFull details & apply:\n🔗 {job_link}"
- Links to existing `/published-job/:id` or `/portal/job/:token` pages

**Responses (for Responders):**
- Variation pool of realistic responses
- Examples: "Wow signed up through the link, amazing platform", "Already working through masterlead for 2 months, highly recommend", "Sent my proposal through the site ✅"
- Templates refined later with Jeff for authenticity

**Contractor Promos (for Contractors):**
- Template with placeholders: `{name}`, `{experience_years}`, `{rating}`, `{completed_jobs}`, `{city}`, `{profile_link}`
- Links to existing `/profile/public` page

### Tab 4: Activity

- Live log: timestamp, group name, account alias, message type, message preview
- Daily stats: messages sent today, links shared, by type breakdown
- Master on/off toggle for entire system
- Per-group pause/resume

## Scheduling Algorithm

```
Engine runs within activity window: 7:00 AM - 9:00 PM (configurable)

Daily planning job (runs at 6:55 AM):
  For each group with active assignments:
    1. JOB POST
       - Select a publisher (rotate daily - not same as yesterday)
       - Pick random job post template
       - Fill placeholders with relevant data (profession matching group category, local city)
       - Generate MasterLead job link
       - Schedule send at random time within activity window

    2. RESPONSES (5-30 min after job post)
       - Select 1-2 responders (from group's assigned responders)
       - Pick random response templates (different from each other)
       - Schedule with random delay 5-30 min after job post

    3. CONTRACTOR PROMO (different hour than job post)
       - Select a contractor account
       - Pick random contractor promo template
       - Fill with actual contractor data + profile link
       - Schedule at random time (at least 2 hours away from job post)

Constraints:
  - Each account posts MAX once per day per group
  - Daily rotation: different accounts assigned each day (round-robin)
  - Random delays between related messages (5-30 min)
  - No messages outside activity window
  - Respect Green API rate limits
```

## Database Changes

### Modified table: `wa_accounts`
New columns:
- `is_army` (boolean, default false) - distinguishes army accounts from inbox/listener accounts
- `army_role` (enum: 'publisher' | 'responder' | 'contractor', nullable)
- `army_alias` (text) - display name in army dashboard

### New table: `army_assignments`
- `id` (uuid, PK)
- `wa_account_id` (FK → wa_accounts)
- `group_wa_id` (text) - WhatsApp group JID
- `group_name` (text) - cached group name
- `role_in_group` (enum: 'publisher' | 'responder' | 'contractor')
- `is_active` (boolean)
- `created_at`, `updated_at`

### New table: `army_templates`
- `id` (uuid, PK)
- `category` (enum: 'job_post' | 'response' | 'contractor_promo')
- `body` (text) - template with placeholders
- `placeholders` (jsonb) - list of placeholder names
- `is_active` (boolean)
- `created_at`, `updated_at`

### New table: `army_schedule`
- `id` (uuid, PK)
- `group_wa_id` (text)
- `wa_account_id` (FK → wa_accounts)
- `template_id` (FK → army_templates)
- `message_type` (enum: 'job_post' | 'response' | 'contractor_promo')
- `scheduled_at` (timestamptz)
- `sent_at` (timestamptz, nullable)
- `status` (enum: 'pending' | 'sent' | 'failed')
- `rendered_message` (text) - final message after placeholder fill
- `error` (text, nullable)
- `created_at`

### New table: `army_config`
- `id` (uuid, PK)
- `key` (text, unique) - e.g. 'activity_window_start', 'activity_window_end', 'enabled'
- `value` (text)

## Green API Integration

**Sending messages:**
- `POST /waInstance{id}/sendMessage/{token}` - send text to group
- Group JID format: `{groupId}@g.us`

**Reading group membership:**
- `GET /waInstance{id}/getContacts/{token}` - verify account is in group

**QR code connection:**
- `GET /waInstance{id}/qr/{token}` - get QR for new account setup
- Existing QR flow in `wa_accounts` reused

## Frontend Components

All under `apps/dashboard/src/pages/admin/army/`:

- `ArmyAccounts.tsx` - account list + QR connection
- `ArmyAssignments.tsx` - group ↔ account assignment matrix
- `ArmyTemplates.tsx` - template CRUD by category
- `ArmyActivity.tsx` - live log + stats + controls

## Backend Components

New Supabase edge function: `army-scheduler`
- Runs on cron (every hour during activity window, or triggered by daily planner)
- Plans and executes the daily message schedule
- Sends via Green API `sendMessage`
- Logs results to `army_schedule`

## Routing

New department in `departmentConfig.ts`:
```typescript
army: {
  label: 'Army',
  basePath: 'army',
  icon: Swords, // or Shield, or Users
  color: '#DC2626', // red
  tabs: [
    { key: 'accounts', label: 'Accounts', path: 'accounts' },
    { key: 'assignments', label: 'Assignments', path: 'assignments' },
    { key: 'templates', label: 'Templates', path: 'templates' },
    { key: 'activity', label: 'Activity', path: 'activity' },
  ]
}
```

## Out of Scope (Phase 1)

- Auto-joining groups (Jeff joins manually for now)
- Template content refinement (will be done separately)
- Click tracking on MasterLead links (future analytics)
- Incoming DM inbox for publishers (future phase)
