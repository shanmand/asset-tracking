
-- Consolidated SQL for Reporting Views & RPC Fixes

-- 0. Add missing quantity column to batch_movements
ALTER TABLE public.batch_movements ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- 1. Master Logistics Trace View
DROP VIEW IF EXISTS public.vw_master_logistics_trace;
CREATE OR REPLACE VIEW public.vw_master_logistics_trace AS
SELECT 
    bm.id as movement_id,
    bm.batch_id,
    bm.timestamp,
    bm.transaction_date,
    d.full_name as driver_name,
    t.plate_number as truck_plate,
    COALESCE(bm.quantity, b.quantity) as quantity,
    fl.name as from_location_name,
    tl.name as to_location_name,
    tl.id as to_location_id,
    bm.condition,
    tl.branch_id as custodian_branch_id
FROM public.batch_movements bm
LEFT JOIN public.batches b ON bm.batch_id = b.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.trucks t ON bm.truck_id = t.id
LEFT JOIN public.locations fl ON bm.from_location_id = fl.id
LEFT JOIN public.locations tl ON bm.to_location_id = tl.id;

-- 2. Fleet Compliance Alerts View
DROP VIEW IF EXISTS public.vw_fleet_compliance_alerts;
CREATE OR REPLACE VIEW public.vw_fleet_compliance_alerts AS
SELECT 
    t.id as truck_id,
    t.plate_number,
    t.license_disc_expiry as license_expiry,
    d.id as driver_id,
    d.full_name as driver_name,
    d.license_expiry as driver_license_expiry,
    d.prdp_expiry,
    CASE 
        WHEN t.license_disc_expiry < CURRENT_DATE THEN 'Expired'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Critical'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '90 days' THEN 'Warning'
        ELSE 'Valid'
    END as truck_status,
    CASE 
        WHEN d.license_expiry < CURRENT_DATE OR d.prdp_expiry < CURRENT_DATE THEN 'Expired'
        WHEN d.license_expiry < CURRENT_DATE + INTERVAL '30 days' OR d.prdp_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Critical'
        ELSE 'Valid'
    END as driver_status
FROM public.trucks t
FULL OUTER JOIN public.drivers d ON t.branch_id = d.branch_id;

-- 3. Management KPIs View
DROP VIEW IF EXISTS public.vw_management_kpis;
CREATE OR REPLACE VIEW public.vw_management_kpis AS
WITH cycle_times AS (
    SELECT 
        batch_id,
        AVG(EXTRACT(EPOCH FROM (timestamp - created_at))/86400) as avg_days
    FROM public.batch_movements bm
    JOIN public.batches b ON bm.batch_id = b.id
    GROUP BY batch_id
),
shrinkage AS (
    SELECT 
        location_id,
        SUM(variance) as total_variance,
        SUM(system_quantity) as total_expected
    FROM public.stock_take_items sti
    JOIN public.stock_takes st ON sti.stock_take_id = st.id
    GROUP BY location_id
)
SELECT 
    (SELECT AVG(avg_days) FROM cycle_times) as avg_cycle_time,
    (SELECT SUM(total_variance)::float / NULLIF(SUM(total_expected), 0) * 100 FROM shrinkage) as shrinkage_rate;

-- 4. Ensure RPCs handle TEXT IDs correctly
-- (The existing split_batch and process_stock_take already use TEXT/UUID correctly in schema.sql)

-- 5. Loss Module: Process Partial Loss RPC
CREATE OR REPLACE FUNCTION public.process_partial_loss(
    p_batch_id TEXT,
    p_lost_quantity INTEGER,
    p_reported_by UUID,
    p_notes TEXT,
    p_location_id TEXT
) RETURNS VOID AS $$
DECLARE
    v_original_qty INTEGER;
    v_asset_id TEXT;
    v_new_batch_id TEXT;
BEGIN
    -- Get original batch info
    SELECT quantity, asset_id INTO v_original_qty, v_asset_id 
    FROM public.batches 
    WHERE id = p_batch_id;

    IF v_original_qty IS NULL THEN
        RAISE EXCEPTION 'Batch % not found', p_batch_id;
    END IF;

    IF v_original_qty < p_lost_quantity THEN
        RAISE EXCEPTION 'Lost quantity (%) exceeds batch quantity (%)', p_lost_quantity, v_original_qty;
    END IF;

    -- 1. Record the loss
    INSERT INTO public.asset_losses (
        batch_id, 
        loss_type, 
        lost_quantity, 
        last_known_location_id, 
        reported_by, 
        notes, 
        transaction_date
    ) VALUES (
        p_batch_id, 
        'Partial Loss', 
        p_lost_quantity, 
        p_location_id, 
        p_reported_by, 
        p_notes, 
        CURRENT_DATE
    );

    -- 2. Handle batch adjustment
    IF v_original_qty = p_lost_quantity THEN
        -- Full loss: Just update status
        UPDATE public.batches 
        SET status = 'Lost', quantity = p_lost_quantity 
        WHERE id = p_batch_id;
    ELSE
        -- Partial loss: Reduce original, create new 'Lost' batch for tracking
        UPDATE public.batches 
        SET quantity = quantity - p_lost_quantity 
        WHERE id = p_batch_id;

        v_new_batch_id := p_batch_id || '-LOST-' || floor(random() * 1000)::text;
        
        INSERT INTO public.batches (
            id, 
            asset_id, 
            quantity, 
            current_location_id, 
            status, 
            transaction_date
        ) VALUES (
            v_new_batch_id, 
            v_asset_id, 
            p_lost_quantity, 
            p_location_id, 
            'Lost', 
            CURRENT_DATE
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fleet Expenses View: Cast truck_id to text
DROP VIEW IF EXISTS public.vw_branch_fleet_expenses;
CREATE OR REPLACE VIEW public.vw_branch_fleet_expenses AS
SELECT 
    t.branch_id::text,
    b.name::text as branch_name,
    t.id::text as truck_id,
    t.plate_number::text,
    'License Renewal'::text as expense_type,
    COALESCE(t.last_renewal_cost_zar, 0)::numeric as amount,
    t.license_disc_expiry::date as expense_date,
    t.license_doc_url::text
FROM public.trucks t
JOIN public.branches b ON t.branch_id = b.id
WHERE t.last_renewal_cost_zar > 0

UNION ALL

SELECT 
    t.branch_id::text,
    b.name::text as branch_name,
    t.id::text as truck_id,
    t.plate_number::text,
    'COF/Roadworthy'::text as expense_type,
    COALESCE(rh.test_fee_zar, 0) + COALESCE(rh.repair_costs_zar, 0)::numeric as amount,
    rh.test_date::date as expense_date,
    t.license_doc_url::text
FROM public.truck_roadworthy_history rh
JOIN public.trucks t ON rh.truck_id::text = t.id::text
JOIN public.branches b ON t.branch_id = b.id;

-- 7. Liability Heatmap View
DROP VIEW IF EXISTS public.vw_daily_burn_rate;
CREATE OR REPLACE VIEW public.vw_daily_burn_rate AS
SELECT 
    br.name AS branch_name, 
    l.name AS location_name, 
    l.id AS location_id, 
    br.id AS branch_id, 
    SUM(bt.quantity * fs.amount_zar) AS daily_burn_rate, 
    COUNT(bt.id) AS batch_count, 
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - bt.transaction_date))/86400) AS avg_duration_days
FROM public.batches bt 
JOIN public.locations l ON bt.current_location_id = l.id 
JOIN public.branches br ON l.branch_id = br.id 
JOIN public.fee_schedule fs ON bt.asset_id = fs.asset_id
WHERE bt.transfer_confirmed_by_customer = FALSE 
  AND fs.effective_to IS NULL
GROUP BY br.name, l.name, l.id, br.id;

-- 8. Vehicle Inspections Table
CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id TEXT NOT NULL, -- References your 'trucks' table
    driver_id TEXT, -- References your 'drivers' table (custom IDs like DRV-7333)
    inspection_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    odometer_reading INT,
    
    -- South African Safety Checklist
    tyres_ok BOOLEAN DEFAULT TRUE,
    lights_ok BOOLEAN DEFAULT TRUE,
    brakes_ok BOOLEAN DEFAULT TRUE,
    fluids_ok BOOLEAN DEFAULT TRUE, -- Oil/Water
    license_disc_present BOOLEAN DEFAULT TRUE,
    
    -- Evidence & Faults
    odometer_photo_url TEXT,
    fault_description TEXT,
    fault_photo_url TEXT,
    is_grounded BOOLEAN DEFAULT FALSE, -- If TRUE, truck shows as 'Red' on Dashboard
    
    branch_id TEXT -- Tied to the branch performing the check
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- Security Policy: Allow Drivers to submit (Insert)
DROP POLICY IF EXISTS "Allow drivers to submit inspections" ON public.vehicle_inspections;
CREATE POLICY "Allow drivers to submit inspections" 
ON public.vehicle_inspections 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Security Policy: Allow Managers to view (Select)
DROP POLICY IF EXISTS "Allow managers to view all inspections" ON public.vehicle_inspections;
CREATE POLICY "Allow managers to view all inspections" 
ON public.vehicle_inspections 
FOR SELECT 
TO authenticated 
USING (true);

-- Fleet Readiness View
CREATE OR REPLACE VIEW public.vw_fleet_readiness AS
SELECT 
    t.id as truck_id,
    t.plate_number,
    t.branch_id,
    b.name as branch_name,
    t.license_disc_expiry,
    CASE 
        WHEN t.license_disc_expiry < CURRENT_DATE THEN 'Expired'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Critical'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '90 days' THEN 'Warning'
        ELSE 'Compliant'
    END as license_status,
    COALESCE(t.last_renewal_cost_zar, 0) as last_renewal_cost,
    (
        SELECT COALESCE(SUM(test_fee_zar + repair_costs_zar), 0)
        FROM public.truck_roadworthy_history
        WHERE truck_id = t.id AND test_date >= DATE_TRUNC('year', CURRENT_DATE)
    ) as ytd_roadworthy_costs,
    (
        SELECT result
        FROM public.truck_roadworthy_history
        WHERE truck_id = t.id
        ORDER BY test_date DESC
        LIMIT 1
    ) as last_roadworthy_result,
    (
        SELECT expiry_date
        FROM public.truck_roadworthy_history
        WHERE truck_id = t.id
        ORDER BY test_date DESC
        LIMIT 1
    ) as roadworthy_expiry
FROM public.trucks t
LEFT JOIN public.branches b ON t.branch_id = b.id;

-- 9. Auto-Supplier Logic: Quick-Register RPC
CREATE OR REPLACE FUNCTION public.check_and_create_supplier(p_supplier_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Ensure it exists in locations (since asset_master references it)
    IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = p_supplier_id) THEN
        INSERT INTO public.locations (id, name, type, category, partner_type)
        VALUES (p_supplier_id, 'Auto-Registered: ' || p_supplier_id, 'Supplier', 'External', 'Supplier');
    END IF;

    -- 2. Ensure it exists in business_parties (as requested)
    -- Update: business_parties now uses TEXT ID to match locations
    IF NOT EXISTS (SELECT 1 FROM public.business_parties WHERE id = p_supplier_id) THEN
        INSERT INTO public.business_parties (id, name, party_type)
        VALUES (p_supplier_id, p_supplier_id, 'Supplier');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Business Directory View & Schema Update
-- Change business_parties ID to TEXT to support human-readable IDs
ALTER TABLE public.business_parties ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.business_parties ALTER COLUMN id DROP DEFAULT;

DROP VIEW IF EXISTS public.vw_business_directory;
CREATE OR REPLACE VIEW public.vw_business_directory AS
SELECT 
    bp.id,
    bp.name,
    bp.party_type,
    COALESCE(asset_counts.type_count, 0) as asset_types,
    COALESCE(stock_counts.total_stock, 0) as current_stock
FROM public.business_parties bp
LEFT JOIN (
    SELECT supplier_id, count(*) as type_count
    FROM public.asset_master
    GROUP BY supplier_id
) asset_counts ON bp.id = asset_counts.supplier_id
LEFT JOIN (
    SELECT am.supplier_id, sum(b.quantity) as total_stock
    FROM public.batches b
    JOIN public.asset_master am ON b.asset_id = am.id
    GROUP BY am.supplier_id
) stock_counts ON bp.id = stock_counts.supplier_id;

-- 11. Inventory Intake Management RPCs
CREATE OR REPLACE FUNCTION public.delete_inventory_batch(p_batch_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Delete movements first due to FK
    DELETE FROM public.batch_movements WHERE batch_id = p_batch_id;
    DELETE FROM public.asset_losses WHERE batch_id = p_batch_id;
    DELETE FROM public.claims WHERE batch_id = p_batch_id;
    DELETE FROM public.thaan_slips WHERE batch_id = p_batch_id;
    DELETE FROM public.batches WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_inventory_batch(
    p_batch_id TEXT,
    p_quantity INTEGER,
    p_date_received DATE
) RETURNS VOID AS $$
BEGIN
    UPDATE public.batches 
    SET quantity = p_quantity, 
        transaction_date = p_date_received
    WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Batch Summary Report View
DROP VIEW IF EXISTS public.vw_intake_summary_report;
CREATE OR REPLACE VIEW public.vw_intake_summary_report AS
SELECT 
    date_trunc('week', bm.transaction_date)::date as week_starting,
    fl.partner_type as source_type,
    fl.name as source_name,
    SUM(bm.quantity) as total_quantity
FROM public.batch_movements bm
JOIN public.locations tl ON bm.to_location_id = tl.id
JOIN public.locations fl ON bm.from_location_id = fl.id
WHERE tl.partner_type = 'Internal' -- Destination is us
GROUP BY 1, 2, 3;
