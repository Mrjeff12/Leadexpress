# Data Flow Fix + Group Intelligence Features — Design Document

**Date:** 2026-03-17
**Audience:** Admin only (Jeff)

---

## Problem

The `profiles` table is empty, causing RLS policies on `pipeline_events` and `group_members` to block all reads from the dashboard. Data IS being written by services (using service_role key), but the dashboard (using anon key + auth) gets 0 rows.

## Part 1: RLS Fix

### Root Cause
RLS policies check `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`, but `profiles` is empty.

### Fix
Create a migration that:
1. Inserts the authenticated user into `profiles` with `role='admin'` via a trigger on `auth.users`
2. OR — create a simpler approach: add a `handle_new_user` trigger that auto-creates profile rows

**Preferred approach:** Add a DB trigger that creates a profile row when a user signs up. Then manually insert Jeff's profile with `role='admin'`.

```sql
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'contractor')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Set existing users as admin (Jeff)
INSERT INTO public.profiles (id, role, full_name)
SELECT id, 'admin', raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### Also: Update group_members RLS for UPDATE

The Members tab needs UPDATE permission for classification override:
```sql
CREATE POLICY gm_admin_update ON group_members
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## Part 2: Group Health Alerts (Scoreboard Banner)

### Location
New section in AdminGroups.tsx — between filters and table.

### Alert Types

| Alert | Condition | Icon | Color |
|-------|-----------|------|-------|
| Spam Alert | known_sellers / total_members > 0.6 | ShieldAlert | Red |
| Dead Group | last_message_at < now() - 3 days | Skull | Gray |
| Declining | messages7d < messages_prev_7d * 0.5 | TrendingDown | Amber |

### Data Source
Computed client-side from existing `useGroupScoreboard` data. No new queries needed.

For "Declining" alert: need to also fetch messages from 7-14 days ago in the scoreboard hook.

### UI
- Horizontal scrollable row of alert cards
- Each card: icon + message + group name + "View" button
- Hidden if no alerts
- Example: "🔴 Spam Alert — GENESIS SAS has 65% sellers"

---

## Part 3: Seasonal Trends

### Location
New section in Group Detail page — added to Overview tab, below Activity chart.

### Data Source
```sql
SELECT
  DATE_TRUNC('month', created_at) as month,
  profession,
  COUNT(*) as count
FROM leads
WHERE group_id = ? AND created_at > now() - interval '12 months'
GROUP BY month, profession
ORDER BY month
```

### UI
- Recharts AreaChart with month on X axis, lead count on Y
- Profession selector dropdown above chart
- Default: show all professions stacked
- Shows "No historical data yet" if < 2 months of data

---

## Part 4: Repeat Requester Badges (Scoreboard Enhancement)

### Location
New column or badge in Scoreboard table.

### Data Source
```sql
SELECT group_id, COUNT(DISTINCT sender_id) as repeat_count
FROM leads
GROUP BY group_id, sender_id
HAVING COUNT(*) >= 2
```

### UI
- Small flame badge next to group name in Scoreboard: "🔥 3" (3 repeat requesters)
- Only shown if count > 0
- Clicking navigates to Market Intel tab of that group

---

## Implementation Order

1. **RLS Fix** — migration + profiles trigger (unblocks everything)
2. **Health Alerts** — banner in Scoreboard (uses existing data)
3. **Repeat Badges** — column in Scoreboard (new query)
4. **Seasonal Trends** — chart in Group Detail (new query)

## Files Changed

```
supabase/migrations/014_fix_rls_profiles.sql  ← NEW
apps/dashboard/src/pages/AdminGroups.tsx       ← alerts + badges
apps/dashboard/src/hooks/useGroupScoreboard.ts ← alerts data + repeat counts
apps/dashboard/src/pages/AdminGroupDetail.tsx  ← trends chart
apps/dashboard/src/hooks/useGroupDetail.ts     ← trends query
```
