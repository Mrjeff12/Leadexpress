# Design Doc: Subcontractor CRM & Job Forwarding (White-label)

## 1. Overview
This feature transforms Lead Express from a simple "lead provider" into a core operational tool (Mini-CRM) for our premium contractors. It allows Main Contractors to forward leads to their Subcontractors, track job statuses, and manage financial agreements (percentages/fixed prices) without exposing the Lead Express brand to the Subcontractors.

### Strategic Goals
1. **Upsell:** Gate this feature behind the Pro/Premium plan (`can_manage_subcontractors`).
2. **Stickiness:** Contractors managing their team and finances on our platform will have high switching costs.
3. **Data Acquisition (The Trojan Horse):** Subcontractors who interact with the white-label portal will have their phone numbers silently added to our global marketing pool for future, disconnected outreach.

---

## 2. Architecture & Flow

### The "Chinese Wall" Principle
- **No Lead Express Branding:** The subcontractor must never see the Lead Express logo, name, or domain.
- **Communication:** Messages to the subcontractor are sent from the Main Contractor's own WhatsApp (via a pre-filled `wa.me` link), NOT from our Twilio/Green API bots.
- **The Portal:** The link points to a neutral route (e.g., `/portal/job/:id` or a separate subdomain in the future) styled cleanly and branded with the Main Contractor's name.

### User Flow
1. **Main Contractor Dashboard:**
   - Contractor views a Lead in their feed.
   - Clicks "Forward to Subcontractor" (blocked if not on Pro plan).
   - Selects an existing Subcontractor or creates a new one (Name, Phone).
   - Enters the deal terms (e.g., "50% split" or "Fixed: 500 NIS").
   - Clicks "Generate Link & Send".
   - System opens WhatsApp Web/App with a pre-filled message: *"Hey [Name], I have a job for you in [City]. Terms: [Terms]. Click here to view details and approve: [Link]"*
2. **Subcontractor Portal (White-label):**
   - Subcontractor clicks the link and sees a clean, mobile-optimized page.
   - Header: "Job Order from [Main Contractor Name]".
   - Content: Job description, city, urgency, and agreed terms.
   - **Hidden Info:** Exact address and customer phone number are hidden.
   - Action: Subcontractor clicks "I Approve this Job".
3. **Post-Approval:**
   - The portal reveals the customer's exact phone number and details.
   - The Main Contractor's CRM updates the lead status to "Accepted by [Subcontractor]".
   - The Subcontractor's phone number is silently logged into our global `potential_prospects` table for future marketing.

---

## 3. Data Model (Supabase Migrations)

### 3.1 `subcontractors` table
Stores the subcontractors belonging to a specific Main Contractor.
```sql
CREATE TABLE public.subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  profession_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contractor_id, phone) -- A contractor can only have one sub with the same phone
);
```

### 3.2 `job_orders` table
The transactional record linking a Lead, a Main Contractor, and a Subcontractor.
```sql
CREATE TABLE public.job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id),
  
  -- Financials
  deal_type TEXT NOT NULL CHECK (deal_type IN ('percentage', 'fixed_price', 'custom')),
  deal_value TEXT NOT NULL, -- e.g., "30" (for %), "500" (for fixed), or free text
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  
  -- Security / Access
  access_token UUID NOT NULL DEFAULT gen_random_uuid(), -- Used for the public URL to avoid guessing IDs
  
  -- Timestamps
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for public portal access
CREATE INDEX idx_job_orders_token ON public.job_orders(access_token);
```

### 3.3 Global Marketing Pool (The Trojan Horse)
```sql
-- We can reuse the existing `prospects` table from `005_prospects_crm.sql`, 
-- but we need a way to flag them as sourced from the subcontractor flow.
-- We will add an event to `prospect_events` when a sub approves a job.
```

### 3.4 Updates to `plans` table
Add a boolean flag to control access.
```sql
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS can_manage_subcontractors BOOLEAN NOT NULL DEFAULT false;
-- Update Pro and Unlimited plans to true
UPDATE public.plans SET can_manage_subcontractors = true WHERE slug IN ('pro', 'unlimited');
```

---

## 4. UI/UX Components

### 4.1 Dashboard: "My Team" (Subcontractors List)
- A new tab/section in `ContractorDashboard` or a dedicated route `/subcontractors`.
- List of saved subcontractors.
- Stats: "Active Jobs", "Total Earned" (future).

### 4.2 Dashboard: Forward Lead Modal
- Triggered from the Lead Card.
- **Form Fields:**
  - Select Subcontractor (Dropdown with search + "Add New" inline).
  - Deal Type (Toggle: Percentage / Fixed Price).
  - Amount input.
  - Preview of the WhatsApp message.
- **Action:** "Send via WhatsApp" -> opens `https://wa.me/?text=...`

### 4.3 Public Portal: `/portal/job/:token`
- **Layout:** Mobile-first, clean white/gray aesthetic. No Lead Express navigation bars.
- **Header:** Initials avatar of the Main Contractor + "Job Request from [Name]".
- **Body:** 
  - Profession icon.
  - City & Urgency.
  - Description (Lead's parsed summary).
  - Terms box (highlighted background).
- **Footer Actions:** 
  - Big Green Button: "Approve & View Customer Details"
  - Subtle Link: "I can't take this job"
- **State: Accepted:** 
  - Confetti animation.
  - Reveals Customer Phone Number with a "Call Now" button.

---

## 5. Security & Privacy
- **RLS Policies:** 
  - `subcontractors`: Contractors can only read/write their own.
  - `job_orders`: Contractors can only read/write their own.
  - **Public Portal:** We need a specific Edge Function or a secure view that allows fetching job details using ONLY the `access_token` (bypassing RLS safely, but only returning sanitized data).
- **Data Hiding:** The public endpoint must NEVER return the customer's phone number if the `job_orders.status` is `pending`. It should only return it if `status == 'accepted'`.

## 6. Next Steps (Implementation Plan)
1. Execute DB Migrations (Tables + RLS + Plan flags).
2. Build the Edge Function / API route for the public portal (to securely fetch/update job status).
3. Build the Public Portal UI (`/portal/job/:token`).
4. Build the Dashboard UI (Subcontractor management + Forwarding Modal).
5. Test the WhatsApp `wa.me` deep-linking flow.
