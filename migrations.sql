
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
