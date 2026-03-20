import { supabase } from './supabase';

const createViewsSQL = `
-- Create the required views for dashboard functionality

-- First, ensure vw_all_sources exists
DROP VIEW IF EXISTS public.vw_all_sources CASCADE;
CREATE OR REPLACE VIEW public.vw_all_sources AS
SELECT
    id,
    name,
    partner_type,
    branch_id,
    type,
    category,
    address,
    name || ' (' || partner_type || ')' as display_name,
    CASE
        WHEN partner_type = 'Internal' AND type != 'In Transit' THEN 1
        WHEN type = 'In Transit' THEN 3
        ELSE 2
    END as sort_group
FROM public.locations
UNION ALL
SELECT
    id::text,
    name,
    party_type as partner_type,
    NULL as branch_id,
    'Business Party' as type,
    'External' as category,
    address,
    name || ' (' || party_type || ')' as display_name,
    2 as sort_group
FROM public.business_parties;

-- Create dashboard stats view
CREATE OR REPLACE VIEW public.vw_dashboard_stats AS
WITH stats AS (
    SELECT
        COALESCE(SUM(CASE WHEN s.category = 'Home' AND s.type != 'In Transit' THEN b.quantity ELSE 0 END), 0) as available,
        COALESCE(SUM(CASE WHEN s.partner_type = 'Customer' THEN b.quantity ELSE 0 END), 0) as at_customers,
        COALESCE(SUM(CASE WHEN s.type = 'In Transit' THEN b.quantity ELSE 0 END), 0) as in_transit,
        COALESCE(SUM(CASE WHEN b.status = 'Maintenance' THEN b.quantity ELSE 0 END), 0) as maintenance,
        COALESCE(SUM(b.quantity), 0) as total_fleet,
        -- Financial Alerts
        COALESCE(SUM(CASE WHEN b.status = 'Lost' THEN b.quantity ELSE 0 END), 0) as lost_missing,
        COALESCE(SUM(CASE WHEN b.status = 'Damaged' THEN b.quantity ELSE 0 END), 0) as damaged,
        COALESCE(SUM(public.calculate_batch_accrual(b.id)), 0) as pending_charges,
        (SELECT COUNT(*) FROM public.asset_losses WHERE is_settled = FALSE) as open_loss_cases,
        -- Liability
        COALESCE(SUM(public.calculate_batch_accrual(b.id)), 0) as accrued_rental,
        (SELECT COALESCE(SUM(net_payable), 0) FROM public.settlements) as settlement_liability,
        (SELECT COUNT(DISTINCT id) FROM public.locations WHERE partner_type = 'Customer') as active_customers,
        (SELECT COALESCE(SUM(quantity), 0) FROM public.batch_movements WHERE transaction_date = CURRENT_DATE) as movements_today
    FROM public.batches b
    JOIN public.vw_all_sources s ON b.current_location_id = s.id
)
SELECT * FROM stats;

-- Create batch forensics view
CREATE OR REPLACE VIEW public.vw_batch_forensics AS
SELECT
    bm.transaction_date as date,
    bm.condition as type,
    s_from.name as from_location,
    s_to.name as to_location,
    bm.quantity
FROM public.batch_movements bm
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
ORDER BY bm.timestamp DESC
LIMIT 20;
`;

export const createDatabaseViews = async () => {
  try {
    console.log('Creating database views...');

    // Split the SQL into individual statements
    const statements = createViewsSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        if (error) {
          console.error('Error executing statement:', statement.substring(0, 100) + '...', error);
        } else {
          console.log('Executed statement successfully');
        }
      }
    }

    console.log('Database views creation completed');
    return { success: true };
  } catch (error) {
    console.error('Failed to create database views:', error);
    return { success: false, error };
  }
};