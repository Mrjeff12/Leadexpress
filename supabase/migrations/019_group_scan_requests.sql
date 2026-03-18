-- 019_group_scan_requests.sql

-- Tables for group scan requests
CREATE TABLE public.contractor_group_scan_requests (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.profiles(id) on delete cascade,
  invite_link_raw text not null,
  invite_link_normalized text not null,
  invite_code text,
  status text not null check (status in ('pending','joined','failed','blocked_private','archived')),
  join_method text not null check (join_method in ('manual','auto')) default 'manual',
  group_name text,
  member_count integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.admin_group_scan_entries (
  id uuid primary key default gen_random_uuid(),
  invite_link_raw text not null,
  invite_link_normalized text not null,
  invite_code text,
  status text not null check (status in ('pending','joined','failed','blocked_private','archived')),
  join_method text not null check (join_method in ('manual','auto')) default 'manual',
  group_name text,
  member_count integer,
  last_error text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
CREATE UNIQUE INDEX idx_contractor_group_scan_requests_invite_code ON public.contractor_group_scan_requests (invite_code) WHERE status != 'archived';
CREATE UNIQUE INDEX idx_admin_group_scan_entries_invite_code ON public.admin_group_scan_entries (invite_code) WHERE status != 'archived';

CREATE INDEX idx_contractor_group_scan_requests_contractor_id_status ON public.contractor_group_scan_requests (contractor_id, status);
CREATE INDEX idx_contractor_group_scan_requests_status_updated_at ON public.contractor_group_scan_requests (status, updated_at);

CREATE INDEX idx_admin_group_scan_entries_status_updated_at ON public.admin_group_scan_entries (status, updated_at);

-- RLS for contractor_group_scan_requests
ALTER TABLE public.contractor_group_scan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractor_group_scan_requests_admin_all" ON public.contractor_group_scan_requests
  FOR ALL
  USING (public.is_admin());

CREATE POLICY "contractor_group_scan_requests_contractor_select" ON public.contractor_group_scan_requests
  FOR SELECT
  USING (auth.uid() = contractor_id);

CREATE POLICY "contractor_group_scan_requests_contractor_insert" ON public.contractor_group_scan_requests
  FOR INSERT
  WITH CHECK (auth.uid() = contractor_id);

CREATE POLICY "contractor_group_scan_requests_contractor_update" ON public.contractor_group_scan_requests
  FOR UPDATE
  USING (auth.uid() = contractor_id);

CREATE POLICY "contractor_group_scan_requests_contractor_delete" ON public.contractor_group_scan_requests
  FOR DELETE
  USING (auth.uid() = contractor_id);

-- RLS for admin_group_scan_entries
ALTER TABLE public.admin_group_scan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_group_scan_entries_admin_all" ON public.admin_group_scan_entries
  FOR ALL
  USING (public.is_admin());

-- View for group scan queue (combining both)
CREATE OR REPLACE VIEW public.group_scan_queue_view AS
SELECT 
  id,
  contractor_id,
  invite_link_raw,
  invite_link_normalized,
  invite_code,
  'contractor' as source,
  status,
  join_method,
  group_name,
  member_count,
  last_error,
  created_at,
  updated_at
FROM public.contractor_group_scan_requests
UNION ALL
SELECT 
  id,
  NULL as contractor_id,
  invite_link_raw,
  invite_link_normalized,
  invite_code,
  'admin' as source,
  status,
  join_method,
  group_name,
  member_count,
  last_error,
  created_at,
  updated_at
FROM public.admin_group_scan_entries;

-- View for contractors to see admin groups with masked data
CREATE OR REPLACE VIEW public.contractor_admin_group_scan_view AS
SELECT 
  id,
  invite_link_raw,
  invite_link_normalized,
  invite_code,
  status,
  join_method,
  CASE WHEN group_name IS NOT NULL THEN 'קבוצה שמורה במערכת' ELSE NULL END as group_name,
  CASE WHEN member_count IS NOT NULL THEN 100 ELSE NULL END as member_count,
  last_error,
  created_at,
  updated_at
FROM public.admin_group_scan_entries;

-- Grant access to views
GRANT SELECT ON public.group_scan_queue_view TO authenticated;
GRANT SELECT ON public.contractor_admin_group_scan_view TO authenticated;

-- Triggers for updated_at
CREATE TRIGGER update_contractor_group_scan_requests_updated_at
  BEFORE UPDATE ON public.contractor_group_scan_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_group_scan_entries_updated_at
  BEFORE UPDATE ON public.admin_group_scan_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
