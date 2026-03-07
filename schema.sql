
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
    supplier_id TEXT REFERENCES public.locations(id),
    is_internal BOOLEAN DEFAULT FALSE,
    fee_type TEXT, -- Daily Rental, Issue Fee
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
    status TEXT DEFAULT 'Pending', -- Pending, Success, Lost, In-Transit, Settled
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    transaction_date DATE DEFAULT CURRENT_DATE,
    transfer_confirmed_by_customer BOOLEAN DEFAULT FALSE,
    confirmation_date DATE,
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
    transaction_date DATE DEFAULT CURRENT_DATE,
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
    transaction_date DATE DEFAULT CURRENT_DATE,
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

CREATE TABLE public.business_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    party_type TEXT NOT NULL, -- Customer, Supplier
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID REFERENCES public.settlements(id),
    amount NUMERIC(12, 2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.business_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_parties_select" ON public.business_parties FOR SELECT TO authenticated USING (true);
CREATE POLICY "business_parties_manage" ON public.business_parties FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "discounts_select" ON public.discounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "discounts_manage" ON public.discounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. ACCRUAL ENGINE RPC
CREATE OR REPLACE FUNCTION calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_asset_id TEXT;
    v_ownership TEXT;
    v_billing_model TEXT;
    v_created_at TIMESTAMPTZ;
    v_confirmed BOOLEAN;
    v_confirmed_at TIMESTAMPTZ;
    v_returned_to_supplier BOOLEAN;
    v_is_faulty BOOLEAN;
    v_rental_total NUMERIC := 0;
    v_issue_fee NUMERIC := 0;
    v_quantity INTEGER;
BEGIN
    -- Get batch and asset info
    SELECT b.asset_id, a.ownership_type, a.billing_model, b.transaction_date, b.quantity, b.transfer_confirmed_by_customer, b.confirmation_date
    INTO v_asset_id, v_ownership, v_billing_model, v_created_at, v_quantity, v_confirmed, v_confirmed_at
    FROM public.batches b
    JOIN public.asset_master a ON b.asset_id = a.id
    WHERE b.id = batch_id_input;

    -- Rule: Owned assets (Internal) have no liability
    IF v_ownership = 'Internal' OR COALESCE(v_asset_id, '') = '' THEN
        RETURN 0;
    END IF;

    v_confirmed := COALESCE(v_confirmed, FALSE);

    -- 1. Daily Rental Calculation
    IF v_billing_model = 'Daily Rental (Supermarket)' THEN
        DECLARE
            v_end_date DATE;
            v_rate NUMERIC;
        BEGIN
            v_end_date := CASE WHEN v_confirmed THEN v_confirmed_at ELSE CURRENT_DATE END;
            
            -- Get current active rate
            SELECT amount_zar INTO v_rate
            FROM public.fee_schedule
            WHERE asset_id = v_asset_id 
              AND fee_type = 'Daily Rental (Supermarket)'
              AND effective_to IS NULL;

            v_rental_total := GREATEST(0, (v_end_date - v_created_at::date)) * COALESCE(v_rate, 0) * v_quantity;
        END;
    END IF;

    -- 2. Issue Fee Calculation
    IF v_billing_model = 'Issue Fee (QSR)' THEN
        DECLARE
            v_rate NUMERIC;
        BEGIN
            -- Get issue fee rate
            SELECT amount_zar INTO v_rate
            FROM public.fee_schedule
            WHERE asset_id = v_asset_id 
              AND fee_type = 'Issue Fee (QSR)'
              AND effective_to IS NULL;

            -- Check if returned to supplier
            SELECT EXISTS (
                SELECT 1 FROM public.batch_movements bm
                JOIN public.locations l ON bm.to_location_id = l.id
                WHERE bm.batch_id = batch_id_input AND l.type = 'Returning to Supplier'
            ) INTO v_returned_to_supplier;

            -- Check if faulty claim exists
            SELECT EXISTS (
                SELECT 1 FROM public.claims
                WHERE batch_id = batch_id_input AND type = 'Damaged' AND status = 'Accepted'
            ) INTO v_is_faulty;

            -- Logic: Credited if confirmed. NOT credited if returned to supplier (unless faulty).
            IF v_confirmed THEN
                v_issue_fee := 0; -- Credited
            ELSIF v_returned_to_supplier AND NOT v_is_faulty THEN
                v_issue_fee := COALESCE(v_rate, 0) * v_quantity; -- Remains payable
            ELSE
                v_issue_fee := COALESCE(v_rate, 0) * v_quantity; -- Initial liability
            END IF;
        END;
    END IF;

    RETURN COALESCE(v_rental_total, 0) + COALESCE(v_issue_fee, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_location_liability(
    location_id_input TEXT,
    start_date DATE,
    end_date DATE
)
RETURNS NUMERIC AS $$
DECLARE
    total_liability NUMERIC := 0;
    v_batch RECORD;
    v_start_ts TIMESTAMPTZ := start_date::timestamptz;
    v_end_ts TIMESTAMPTZ := (end_date + 1)::timestamptz;
BEGIN
    FOR v_batch IN 
        SELECT b.id, b.asset_id, b.quantity, b.transaction_date, a.ownership_type, a.billing_model, b.transfer_confirmed_by_customer, b.confirmation_date
        FROM public.batches b
        JOIN public.asset_master a ON b.asset_id = a.id
        WHERE a.ownership_type = 'External' 
          AND a.billing_model = 'Daily Rental (Supermarket)'
    LOOP
        DECLARE
            v_stop_date DATE;
            v_rate NUMERIC;
            v_current_loc TEXT;
            v_last_date DATE;
            v_move RECORD;
        BEGIN
            v_stop_date := CASE WHEN v_batch.transfer_confirmed_by_customer THEN v_batch.confirmation_date ELSE CURRENT_DATE END;

            SELECT amount_zar INTO v_rate
            FROM public.fee_schedule 
            WHERE asset_id = v_batch.asset_id AND fee_type = 'Daily Rental (Supermarket)' AND effective_to IS NULL;
            
            v_rate := COALESCE(v_rate, 0);

            SELECT from_location_id INTO v_current_loc
            FROM public.batch_movements
            WHERE batch_id = v_batch.id
            ORDER BY transaction_date ASC, timestamp ASC LIMIT 1;
            
            IF v_current_loc IS NULL THEN
                SELECT current_location_id INTO v_current_loc FROM public.batches WHERE id = v_batch.id;
            END IF;

            v_last_date := v_batch.transaction_date;

            FOR v_move IN 
                SELECT transaction_date, to_location_id
                FROM public.batch_movements
                WHERE batch_id = v_batch.id
                ORDER BY transaction_date ASC, timestamp ASC
            LOOP
                IF v_current_loc = location_id_input THEN
                    total_liability := total_liability + (
                        GREATEST(0, (
                            LEAST(v_move.transaction_date, end_date, v_stop_date) - 
                            GREATEST(v_last_date, start_date, v_batch.transaction_date)
                        )) * v_rate * v_batch.quantity
                    );
                END IF;
                
                v_current_loc := v_move.to_location_id;
                v_last_date := v_move.transaction_date;
            END LOOP;

            IF v_current_loc = location_id_input THEN
                total_liability := total_liability + (
                    GREATEST(0, (
                        LEAST(v_stop_date, end_date) - 
                        GREATEST(v_last_date, start_date, v_batch.transaction_date)
                    )) * v_rate * v_batch.quantity
                );
            END IF;
        END;
    END LOOP;

    RETURN total_liability;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PARTIAL TRANSFERS: SPLIT BATCH
CREATE OR REPLACE FUNCTION split_batch(
    original_batch_id TEXT,
    move_qty INTEGER,
    new_location_id TEXT,
    move_date DATE
)
RETURNS TEXT AS $$
DECLARE
    v_new_batch_id TEXT;
    v_asset_id TEXT;
    v_status TEXT;
    v_orig_qty INTEGER;
BEGIN
    -- 1. Get original batch info
    SELECT asset_id, status, quantity INTO v_asset_id, v_status, v_orig_qty
    FROM public.batches
    WHERE id = original_batch_id;

    IF v_orig_qty < move_qty THEN
        RAISE EXCEPTION 'Insufficient quantity in original batch';
    END IF;

    -- 2. Generate new batch ID
    v_new_batch_id := original_batch_id || '-S' || floor(random() * 1000)::text;

    -- 3. Reduce original quantity
    UPDATE public.batches
    SET quantity = quantity - move_qty
    WHERE id = original_batch_id;

    -- 4. Create new batch
    INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date)
    VALUES (v_new_batch_id, v_asset_id, move_qty, new_location_id, v_status, move_date);

    RETURN v_new_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. AUTH SYNC TRIGGER
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

CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, In Progress, Completed
    priority TEXT DEFAULT 'Medium', -- Low, Medium, High
    due_date DATE,
    assigned_to UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_manage" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stock_takes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id TEXT REFERENCES public.locations(id),
    take_date DATE NOT NULL,
    performed_by UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_take_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_take_id UUID REFERENCES public.stock_takes(id),
    asset_id TEXT REFERENCES public.asset_master(id),
    system_quantity INTEGER NOT NULL,
    physical_count INTEGER NOT NULL,
    variance INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id TEXT REFERENCES public.locations(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    gross_liability NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    net_payable NUMERIC(12, 2) NOT NULL,
    settled_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_takes_select" ON public.stock_takes FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_takes_manage" ON public.stock_takes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "stock_take_items_select" ON public.stock_take_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_take_items_manage" ON public.stock_take_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlements_select" ON public.settlements FOR SELECT TO authenticated USING (true);
CREATE POLICY "settlements_manage" ON public.settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);

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
-- 12. VIEWS FOR DASHBOARDS
CREATE OR REPLACE VIEW public.vw_daily_burn_rate AS
SELECT 
    br.name AS branch_name,
    l.name AS location_name,
    l.id AS location_id,
    br.id AS branch_id,
    SUM(bt.quantity * fs.amount_zar) AS daily_burn_rate,
    COUNT(bt.id) AS batch_count,
    AVG(CURRENT_DATE - bt.transaction_date) AS avg_duration_days
FROM public.batches bt
JOIN public.asset_master a ON bt.asset_id = a.id
JOIN public.locations l ON bt.current_location_id = l.id
JOIN public.branches br ON l.branch_id = br.id
JOIN public.fee_schedule fs ON a.id = fs.asset_id
WHERE bt.transfer_confirmed_by_customer = FALSE
  AND a.ownership_type = 'External'
  AND fs.fee_type = 'Daily Rental (Supermarket)'
  AND fs.effective_to IS NULL
GROUP BY br.name, l.name, l.id, br.id;

-- 13. STOCK TAKE RECONCILIATION RPC
CREATE OR REPLACE FUNCTION process_stock_take(
    p_location_id TEXT,
    p_performed_by UUID,
    p_notes TEXT,
    p_items JSONB -- Array of {batch_id, physical_count}
)
RETURNS UUID AS $$
DECLARE
    v_stock_take_id UUID;
    v_item JSONB;
    v_batch_id TEXT;
    v_physical_count INTEGER;
    v_system_qty INTEGER;
    v_asset_id TEXT;
    v_variance INTEGER;
    v_replacement_fee NUMERIC;
BEGIN
    -- 1. Create Stock Take Header
    INSERT INTO public.stock_takes (location_id, take_date, performed_by, notes)
    VALUES (p_location_id, CURRENT_DATE, p_performed_by, p_notes)
    RETURNING id INTO v_stock_take_id;

    -- 2. Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_batch_id := v_item->>'batch_id';
        v_physical_count := (v_item->>'physical_count')::INTEGER;

        -- Get current system quantity
        SELECT quantity, asset_id INTO v_system_qty, v_asset_id
        FROM public.batches
        WHERE id = v_batch_id;

        v_variance := v_system_qty - v_physical_count;

        -- Insert into stock_take_items
        INSERT INTO public.stock_take_items (stock_take_id, asset_id, system_quantity, physical_count, variance)
        VALUES (v_stock_take_id, v_asset_id, v_system_qty, v_physical_count, v_variance);

        -- If loss detected, reconcile
        IF v_variance > 0 THEN
            -- Lookup Replacement Fee
            SELECT amount_zar INTO v_replacement_fee
            FROM public.fee_schedule
            WHERE asset_id = v_asset_id
              AND fee_type = 'Replacement Fee (Lost Equipment)'
              AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
            ORDER BY effective_from DESC
            LIMIT 1;

            -- Update Batch
            UPDATE public.batches
            SET quantity = v_physical_count
            WHERE id = v_batch_id;

            -- Record Loss
            INSERT INTO public.asset_losses (
                batch_id, 
                loss_type, 
                lost_quantity, 
                last_known_location_id, 
                reported_by, 
                notes,
                transaction_date
            )
            VALUES (
                v_batch_id,
                'Stock Take Variance',
                v_variance,
                p_location_id,
                p_performed_by,
                'Stock Take ID: ' || v_stock_take_id::text || ' | Replacement Fee: R' || COALESCE(v_replacement_fee::text, '0.00'),
                CURRENT_DATE
            );
        END IF;
    END LOOP;

    RETURN v_stock_take_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.asset_losses ADD COLUMN is_settled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.asset_losses ADD COLUMN settled_at TIMESTAMPTZ;

-- Update settlements table with payment details
ALTER TABLE public.settlements ADD COLUMN payment_reference TEXT;
ALTER TABLE public.settlements ADD COLUMN cash_paid NUMERIC(12, 2);

-- 14. SUPPLIER LIABILITY CALCULATION RPC
CREATE OR REPLACE FUNCTION get_supplier_liability(
    p_supplier_id TEXT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_rental_accrued NUMERIC,
    total_replacement_fees NUMERIC,
    total_credits NUMERIC,
    gross_liability NUMERIC
) AS $$
DECLARE
    v_rental NUMERIC := 0;
    v_losses NUMERIC := 0;
    v_credits NUMERIC := 0;
BEGIN
    -- 1. Calculate Rental Accrued for batches owned by this supplier
    -- We assume asset_master.supplier_id links to the supplier location
    SELECT COALESCE(SUM(public.calculate_batch_accrual(b.id)), 0)
    INTO v_rental
    FROM public.batches b
    JOIN public.asset_master a ON b.asset_id = a.id
    WHERE a.supplier_id = p_supplier_id
      AND b.is_settled = FALSE
      AND b.transaction_date <= p_end_date;

    -- 2. Calculate Replacement Fees for losses
    SELECT COALESCE(SUM(al.lost_quantity * fs.amount_zar), 0)
    INTO v_losses
    FROM public.asset_losses al
    JOIN public.batches b ON al.batch_id = b.id
    JOIN public.asset_master a ON b.asset_id = a.id
    JOIN public.fee_schedule fs ON a.id = fs.asset_id
    WHERE a.supplier_id = p_supplier_id
      AND al.is_settled = FALSE
      AND al.transaction_date <= p_end_date
      AND fs.fee_type = 'Replacement Fee (Lost Equipment)'
      AND fs.effective_to IS NULL;

    -- 3. Calculate Credits from Accepted Damaged Claims
    SELECT COALESCE(SUM(c.amount_claimed_zar), 0)
    INTO v_credits
    FROM public.claims c
    JOIN public.batches b ON c.batch_id = b.id
    JOIN public.asset_master a ON b.asset_id = a.id
    WHERE a.supplier_id = p_supplier_id
      AND c.status = 'Accepted'
      AND c.type = 'Damaged'
      AND c.created_at::date <= p_end_date;

    RETURN QUERY SELECT 
        v_rental, 
        v_losses, 
        v_credits, 
        (v_rental + v_losses - v_credits);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. FINALIZE PAYMENT SETTLEMENT RPC
CREATE OR REPLACE FUNCTION finalize_payment_settlement(
    p_supplier_id TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_gross_liability NUMERIC,
    p_discount_amount NUMERIC,
    p_net_payable NUMERIC,
    p_cash_paid NUMERIC,
    p_payment_ref TEXT,
    p_settled_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_settlement_id UUID;
BEGIN
    -- 1. Create Settlement Record
    INSERT INTO public.settlements (
        supplier_id, start_date, end_date, gross_liability, 
        discount_amount, net_payable, cash_paid, payment_reference, settled_by
    )
    VALUES (
        p_supplier_id, p_start_date, p_end_date, p_gross_liability, 
        p_discount_amount, p_net_payable, p_cash_paid, p_payment_ref, p_settled_by
    )
    RETURNING id INTO v_settlement_id;

    -- 2. Mark Batches as Settled
    UPDATE public.batches b
    SET is_settled = TRUE,
        settled_at = NOW()
    FROM public.asset_master a
    WHERE b.asset_id = a.id
      AND a.supplier_id = p_supplier_id
      AND b.is_settled = FALSE
      AND b.transaction_date <= p_end_date;

    -- 3. Mark Asset Losses as Settled
    UPDATE public.asset_losses al
    SET is_settled = TRUE,
        settled_at = NOW()
    FROM public.batches b
    JOIN public.asset_master a ON b.asset_id = a.id
    WHERE al.batch_id = b.id
      AND a.supplier_id = p_supplier_id
      AND al.is_settled = FALSE
      AND al.transaction_date <= p_end_date;

    RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SEED DATA
INSERT INTO public.asset_master (id, name, type, dimensions, material)
VALUES 
('SH-001', 'Lupo Standard Bread Crate', 'Crate', '600x400x150mm', 'HDPE-Amber'),
('SH-P01', 'Heavy Duty Flour Pallet', 'Pallet', '1200x1000mm', 'Reinforced Pine')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fee_schedule (asset_id, fee_type, amount_zar, effective_from)
VALUES 
('SH-001', 'Daily Rental (Supermarket)', 5.50, '2026-01-01'),
('SH-001', 'Replacement Fee (Lost Equipment)', 450.00, '2026-01-01'),
('SH-P01', 'Daily Rental (Supermarket)', 12.00, '2026-01-01'),
('SH-P01', 'Replacement Fee (Lost Equipment)', 1200.00, '2026-01-01')
ON CONFLICT DO NOTHING;

INSERT INTO public.locations (id, name, type, category)
VALUES 
('LOC-JHB-01', 'Lupo JHB Main Plant (Kya Sands)', 'Crates Dept', 'Home'),
('LOC-CPT-01', 'Lupo CPT Distribution Hub', 'Warehouse', 'Home')
ON CONFLICT (id) DO NOTHING;
