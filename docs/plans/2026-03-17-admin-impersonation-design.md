# Design Doc: Admin Impersonation (Login As)

## 1. Overview
This feature allows administrators to temporarily view and interact with the application exactly as a specific contractor would. This is critical for customer support, debugging, and assisting contractors with their settings without requiring their password or generating magic links.

### Strategic Goals
1. **Support Efficiency:** Admins can instantly see what the user sees.
2. **Security:** No need to share passwords or expose Service Role keys to the client.
3. **Seamless UX:** Instant switching between Admin mode and Impersonation mode via React State, without reloading or losing the admin session.

---

## 2. Architecture & Flow

### The "Virtual Login" Principle
Instead of actually logging out the Admin and logging in as the Contractor (which requires Supabase Auth manipulation), we will use a "Virtual Login" approach.
We will extend our global `AuthContext` to hold an `impersonatedUserId`. When this ID is present, the application will use it instead of the actual `user.id` for all data fetching and mutations.

Because our Supabase Row Level Security (RLS) policies already allow admins to read/write all rows (e.g., `OR (SELECT role FROM profiles) = 'admin'`), the database will naturally accept these requests from the Admin's session, even when querying another user's data.

### User Flow
1. **Admin Dashboard (`/admin/contractors`):**
   - Admin clicks the "Login As" (Mask/User icon) button next to a contractor in the list.
   - The app calls `impersonate(contractorId)`.
   - The app redirects the Admin to the main Contractor Dashboard (`/`).
2. **Impersonation Mode (`/`):**
   - A persistent, highly visible red/orange banner appears at the top of the screen: *"You are viewing the app as: [Contractor Name]. Actions taken will affect their account."*
   - All components (`ContractorDashboard`, `ServiceSettings`, `Subcontractors`, etc.) use `effectiveUserId` to fetch and update data.
3. **Exiting Impersonation:**
   - Admin clicks "Return to Admin" on the red banner.
   - The app calls `stopImpersonating()`.
   - The app redirects the Admin back to `/admin/contractors`.

---

## 3. Data Model & Context Updates

### 3.1 `AuthContext` (`apps/dashboard/src/lib/auth.tsx`)
We need to extend the `AuthState` interface and the Context value.

```typescript
interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  impersonatedUserId: string | null
  impersonatedProfile: Profile | null
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  impersonate: (userId: string) => Promise<void>
  stopImpersonating: () => void
  effectiveUserId: string | undefined // Helper to get impersonated ID or real ID
}
```

### 3.2 State Management
- `impersonate(userId)`: Fetches the profile for the given `userId` and updates the state.
- `stopImpersonating()`: Clears the impersonation state.
- `effectiveUserId`: A derived value `state.impersonatedUserId || state.user?.id`.

---

## 4. UI/UX Components

### 4.1 Admin Contractors Table (`AdminContractors.tsx`)
- Add a new action button in the table row for each contractor.
- Icon: `VenetianMask` or `UserCheck`.
- Tooltip: "Login As (Impersonate)".

### 4.2 Impersonation Banner (`ImpersonationBanner.tsx`)
- A global component rendered inside the `AppShell` (above the main content).
- Only renders if `impersonatedUserId` is not null.
- Styling: High contrast (e.g., `bg-red-500 text-white`) to ensure the Admin doesn't forget they are in impersonation mode.
- Includes the Contractor's name and a "Return to Admin" button.

### 4.3 Refactoring Data Fetching
We need to audit the contractor-facing components and replace `user.id` or `profile.id` with `effectiveUserId`.
Key files to update:
- `ContractorDashboard.tsx`
- `LeadsFeed.tsx`
- `ServiceSettings.tsx`
- `Subcontractors.tsx`
- `Profile.tsx` (Optional: we might want to disable profile editing during impersonation, or just allow it).
- Any custom hooks like `useContractorSettings.ts`.

---

## 5. Security & Privacy
- **RLS Policies:** No changes needed. Our existing RLS policies already grant admins full access.
- **Admin Guard:** The `impersonate` function must strictly verify that the current real user `isAdmin === true` before allowing the state change. If a regular contractor somehow triggers it, it should throw an error.
- **Local Storage (Optional):** We may want to persist `impersonatedUserId` in `localStorage` so that if the Admin refreshes the page, they don't lose the impersonation state.

## 6. Next Steps (Implementation Plan)
1. Update `auth.tsx` with the new state, functions, and `localStorage` persistence.
2. Create the `ImpersonationBanner` component and add it to `App.tsx` / `AppShell`.
3. Add the "Login As" button to `AdminContractors.tsx`.
4. Refactor all contractor-facing components and hooks to use `effectiveUserId` instead of `user.id`.
