# Admin Impersonation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to temporarily view and interact with the application as a specific contractor using a "Virtual Login" state, without requiring passwords or losing their admin session.

**Architecture:** 
1. Extend `AuthContext` to store `impersonatedUserId` and `impersonatedProfile`.
2. Add a global `ImpersonationBanner` to warn the admin they are in this mode.
3. Add a "Login As" button to the Admin Contractors table.
4. Refactor contractor-facing components to use `effectiveUserId` instead of `user.id`.

**Tech Stack:** React Context, Supabase.

---

### Task 1: Update AuthContext

**Files:**
- Modify: `apps/dashboard/src/lib/auth.tsx`

**Step 1: Extend AuthState and AuthContextType**
Add `impersonatedUserId` (string | null) and `impersonatedProfile` (Profile | null) to the state.
Add `impersonate`, `stopImpersonating`, and `effectiveUserId` to the context type.

**Step 2: Implement the functions**
- `effectiveUserId`: `state.impersonatedUserId || state.user?.id`
- `impersonate(userId)`: 
  - Check if `state.isAdmin` is true. If not, throw error.
  - Fetch the profile for `userId` from Supabase.
  - Update state with `impersonatedUserId` and `impersonatedProfile`.
  - Save `impersonatedUserId` to `localStorage` (e.g., `leadexpress_impersonate`).
- `stopImpersonating()`:
  - Clear state.
  - Remove from `localStorage`.
- `useEffect` (on mount): Check `localStorage` for an existing impersonated ID and restore it if the user is an admin.

**Step 3: Commit**
```bash
git add apps/dashboard/src/lib/auth.tsx
git commit -m "feat(auth): add impersonation state and methods to AuthContext"
```

---

### Task 2: Create Impersonation Banner

**Files:**
- Create: `apps/dashboard/src/components/ImpersonationBanner.tsx`
- Modify: `apps/dashboard/src/App.tsx` (or `AppShell` if it exists)

**Step 1: Build the Banner Component**
- Use `useAuth()` to check if `impersonatedUserId` exists.
- If null, return `null`.
- If present, render a fixed banner at the top of the screen (e.g., `bg-red-500 text-white p-2 flex justify-between items-center z-50`).
- Text: "⚠️ You are viewing the app as: [impersonatedProfile.full_name]. Actions taken will affect their account."
- Button: "Return to Admin" -> calls `stopImpersonating()` and navigates to `/admin/contractors`.

**Step 2: Add to App Layout**
- Render `<ImpersonationBanner />` inside the main layout wrapper so it's visible on all pages.

**Step 3: Commit**
```bash
git add apps/dashboard/src/components/ImpersonationBanner.tsx apps/dashboard/src/App.tsx
git commit -m "feat(ui): add global impersonation warning banner"
```

---

### Task 3: Add "Login As" Button to Admin

**Files:**
- Modify: `apps/dashboard/src/pages/AdminContractors.tsx`

**Step 1: Add Action Button**
- In the contractor list/table, add a new button next to the existing actions (like the QR code or edit button).
- Icon: `VenetianMask` or `UserCheck`.
- Title/Tooltip: "Login As".

**Step 2: Implement Click Handler**
- On click: Call `impersonate(contractor.id)`.
- Navigate to the root route `/` (Contractor Dashboard).

**Step 3: Commit**
```bash
git add apps/dashboard/src/pages/AdminContractors.tsx
git commit -m "feat(admin): add login as button to contractors table"
```

---

### Task 4: Refactor Data Fetching (Use Effective ID)

**Files:**
- Modify: `apps/dashboard/src/pages/ContractorDashboard.tsx`
- Modify: `apps/dashboard/src/pages/LeadsFeed.tsx`
- Modify: `apps/dashboard/src/pages/ServiceSettings.tsx`
- Modify: `apps/dashboard/src/pages/Subcontractors.tsx`
- Modify: `apps/dashboard/src/hooks/useContractorSettings.ts`

**Step 1: Replace `profile.id` / `user.id` with `effectiveUserId`**
- Go through each file and ensure that any Supabase query that filters by the current user's ID uses `effectiveUserId` from `useAuth()`.
- Example: `.eq('user_id', effectiveUserId)` instead of `.eq('user_id', user.id)`.

**Step 2: Verify**
- Ensure no hardcoded `user.id` remains in contractor-facing views.

**Step 3: Commit**
```bash
git add apps/dashboard/src/pages/ContractorDashboard.tsx apps/dashboard/src/pages/LeadsFeed.tsx apps/dashboard/src/pages/ServiceSettings.tsx apps/dashboard/src/pages/Subcontractors.tsx apps/dashboard/src/hooks/useContractorSettings.ts
git commit -m "refactor: use effectiveUserId for all contractor data fetching"
```
