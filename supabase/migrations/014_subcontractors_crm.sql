-- 014: Subcontractors CRM

-- 1. Update Plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS can_manage_subcontractors BOOLEAN NOT NULL DEFAULT false;
UPDATE public.plans SET can_manage_subcontractors = true WHERE slug IN ('pro', 'unlimited');

-- 2. Subcontractors Table
CREATE TABLE public.subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  profession_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contractor_id, phone)
);

CREATE INDEX idx_subcontractors_contractor ON public.subcontractors(contractor_id);

-- 3. Job Orders Table
CREATE TABLE public.job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  
  deal_type TEXT NOT NULL CHECK (deal_type IN ('percentage', 'fixed_price', 'custom')),
  deal_value TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_orders_token ON public.job_orders(access_token);
CREATE INDEX idx_job_orders_contractor ON public.job_orders(contractor_id);
CREATE INDEX idx_job_orders_lead ON public.job_orders(lead_id);

-- 4. RLS Policies
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_orders ENABLE ROW LEVEL SECURITY;

-- Contractors see their own subs
CREATE POLICY subcontractors_own ON public.subcontractors
  FOR ALL USING (
    contractor_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Contractors see their own job orders
CREATE POLICY job_orders_own ON public.job_orders
  FOR ALL USING (
    contractor_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 5. Public Access RPCs
CREATE OR REPLACE FUNCTION get_job_order_by_token(token UUID)
RETURNS TABLE (
  id UUID,
  lead_id UUID,
  contractor_id UUID,
  subcontractor_id UUID,
  deal_type TEXT,
  deal_value TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jo.id, jo.lead_id, jo.contractor_id, jo.subcontractor_id, 
    jo.deal_type, jo.deal_value, jo.status, jo.created_at, jo.updated_at
  FROM public.job_orders jo
  WHERE jo.access_token = token;
END;
$$;

CREATE OR REPLACE FUNCTION update_job_order_status_by_token(token UUID, new_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id UUID;
BEGIN
  UPDATE public.job_orders jo
  SET status = new_status, responded_at = now()
  WHERE jo.access_token = token
  RETURNING jo.id INTO found_id;
  
  RETURN found_id IS NOT NULL;
END;
$$;

-- 6. Triggers
CREATE TRIGGER subcontractors_updated_at BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER job_orders_updated_at BEFORE UPDATE ON public.job_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
