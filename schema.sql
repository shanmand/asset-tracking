
-- ==========================================
-- SHUKU CRATES & PALLETS TRACKING SCHEMA
-- ==========================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES
CREATE TABLE public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_master (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Crate, Pallet
    dimensions TEXT,
    material TEXT,
    billing_model TEXT DEFAULT 'Daily Rental (Supermarket)', -- Daily Rental, Issue Fee, None
    ownership_type TEXT DEFAULT 'External', -- Internal, External
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Warehouse, At Customer, etc.
    category TEXT NOT NULL, -- Home, External
    branch_id TEXT REFERENCES public.branches(id),
    partner_type TEXT DEFAULT 'Internal', -- Internal, Customer, Supplier
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trucks (
    id TEXT PRIMARY KEY,
    plate_number TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.drivers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    contact_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.users (
    id UUID PRIMARY KEY, -- Removed FK to auth.users to allow pre-creation
    full_name TEXT,
    email TEXT UNIQUE,
    role_name TEXT DEFAULT 'Crates Department',
    home_branch_name TEXT DEFAULT 'Kya Sands',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fee_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id TEXT REFERENCES public.asset_master(id),
    fee_type TEXT NOT NULL,
    amount_zar NUMERIC(12, 2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batches (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES public.asset_master(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    current_location_id TEXT REFERENCES public.locations(id),
    status TEXT DEFAULT 'Pending', -- Pending, Success, Lost, In-Transit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batch_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    from_location_id TEXT REFERENCES public.locations(id),
    to_location_id TEXT REFERENCES public.locations(id),
    truck_id TEXT REFERENCES public.trucks(id),
    driver_id TEXT REFERENCES public.drivers(id),
    condition TEXT DEFAULT 'Clean',
    origin_user_id UUID REFERENCES public.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.thaan_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    doc_url TEXT NOT NULL,
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_losses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    loss_type TEXT NOT NULL,
    lost_quantity INTEGER NOT NULL,
    last_known_location_id TEXT REFERENCES public.locations(id),
    reported_by UUID REFERENCES public.users(id),
    notes TEXT,
    is_rechargeable BOOLEAN DEFAULT FALSE,
    supplier_notified BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.claims (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES public.batches(id),
    truck_id TEXT REFERENCES public.trucks(id),
    driver_id TEXT REFERENCES public.drivers(id),
    thaan_slip_id UUID REFERENCES public.thaan_slips(id),
    type TEXT NOT NULL, -- Damaged, Dirty
    amount_claimed_zar NUMERIC(12, 2),
    status TEXT DEFAULT 'Lodged',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- 3. ACCRUAL ENGINE RPC
CREATE OR REPLACE FUNCTION calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    total_accrual NUMERIC := 0;
BEGIN
    WITH AccrualPhases AS (
        SELECT 
            b.id,
            b.quantity,
            fs.amount_zar,
            GREATEST(b.created_at, fs.effective_from::timestamp) as phase_start,
            LEAST(
                COALESCE(al.timestamp, ts.signed_at, NOW()), 
                COALESCE(fs.effective_to::timestamp, '9999-12-31'::timestamp)
            ) as phase_end
        FROM public.batches b
        JOIN public.fee_schedule fs ON b.asset_id = fs.asset_id
        LEFT JOIN public.asset_losses al ON b.id = al.batch_id
        LEFT JOIN public.thaan_slips ts ON b.id = ts.batch_id
        WHERE b.id = batch_id_input
          AND fs.fee_type = 'Daily Rental (Supermarket)'
    )
    SELECT COALESCE(SUM(
        EXTRACT(DAY FROM (phase_end - phase_start)) * amount_zar * quantity
    ), 0)
    INTO total_accrual
    FROM AccrualPhases
    WHERE phase_end > phase_start;

    RETURN total_accrual;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. AUTH SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_count int;
  existing_user_id uuid;
BEGIN
  SELECT count(*) INTO user_count FROM public.users;
  
  -- Check if a user with this email already exists (pre-created by admin)
  SELECT id INTO existing_user_id FROM public.users WHERE email = NEW.email;
  
  IF existing_user_id IS NOT NULL THEN
    -- Update existing record with the real auth ID
    UPDATE public.users 
    SET id = NEW.id,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
        role_name = COALESCE(NEW.raw_user_meta_data->>'role_name', role_name),
        home_branch_name = COALESCE(NEW.raw_user_meta_data->>'home_branch_name', home_branch_name)
    WHERE email = NEW.email;
    
    -- If the ID changed, we might have a problem with PK, but since we are updating the record with NEW.id, 
    -- we should probably delete the old one or just update it if the PK is the same.
    -- Actually, if we update the PK, it might fail if NEW.id already exists.
    -- But NEW.id is from auth.users and just got created.
  ELSE
    INSERT INTO public.users (id, full_name, email, role_name, home_branch_name)
    VALUES (
      NEW.id, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role_name', CASE WHEN user_count = 0 THEN 'System Administrator' ELSE 'Staff' END), 
      COALESCE(NEW.raw_user_meta_data->>'home_branch_name', 'Kya Sands')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. ROW LEVEL SECURITY (RLS)
-- Enable RLS for all tables
ALTER TABLE public.asset_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thaan_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  u_role text;
BEGIN
  -- 1. Check if ANY users exist. If not, the system is in bootstrap mode.
  IF NOT EXISTS (SELECT 1 FROM public.users) THEN
    RETURN TRUE;
  END IF;

  -- 2. Check the current user's role
  SELECT role_name INTO u_role FROM public.users WHERE id = auth.uid();
  
  IF u_role = 'System Administrator' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Clean existing policies
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Asset Master Policies
CREATE POLICY "assets_select" ON public.asset_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets_manage" ON public.asset_master FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Locations Policies
CREATE POLICY "locations_select" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations_manage" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Branches Policies
CREATE POLICY "branches_select" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_manage" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trucks Policies
CREATE POLICY "trucks_select" ON public.trucks FOR SELECT TO authenticated USING (true);
CREATE POLICY "trucks_manage" ON public.trucks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drivers Policies
CREATE POLICY "drivers_select" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_manage" ON public.drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Users Policies
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_self_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users_self_update" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_admin" ON public.users FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Fee Schedule Policies
CREATE POLICY "fees_select" ON public.fee_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "fees_admin" ON public.fee_schedule FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Batches Policies
CREATE POLICY "batches_select" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batches_staff" ON public.batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Movements Policies
CREATE POLICY "movements_select" ON public.batch_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements_staff" ON public.batch_movements FOR INSERT TO authenticated WITH CHECK (true);

-- Losses Policies
CREATE POLICY "losses_select" ON public.asset_losses FOR SELECT TO authenticated USING (true);
CREATE POLICY "losses_staff" ON public.asset_losses FOR INSERT TO authenticated WITH CHECK (true);

-- Claims Policies
CREATE POLICY "claims_select" ON public.claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "claims_staff" ON public.claims FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 287: 
-- 6. SEED DATA
INSERT INTO public.asset_master (id, name, type, dimensions, material)
VALUES 
('SH-001', 'Lupo Standard Bread Crate', 'Crate', '600x400x150mm', 'HDPE-Amber'),
('SH-P01', 'Heavy Duty Flour Pallet', 'Pallet', '1200x1000mm', 'Reinforced Pine')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.locations (id, name, type, category)
VALUES 
('LOC-JHB-01', 'Lupo JHB Main Plant (Kya Sands)', 'Crates Dept', 'Home'),
('LOC-CPT-01', 'Lupo CPT Distribution Hub', 'Warehouse', 'Home')
ON CONFLICT (id) DO NOTHING;
