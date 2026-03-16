-- Sample data to populate the database for testing ForensicTable
-- Run this after schema.sql and migrations.sql

-- Insert sample branch
INSERT INTO public.branches (id, name) VALUES ('branch1', 'Kya Sands Branch') ON CONFLICT (id) DO NOTHING;

-- Insert sample locations
INSERT INTO public.locations (id, name, type, category, branch_id) VALUES 
('loc1', 'Warehouse A', 'Warehouse', 'Home', 'branch1'),
('loc2', 'Customer Site X', 'At Customer', 'External', 'branch1') ON CONFLICT (id) DO NOTHING;

-- Insert sample asset
INSERT INTO public.asset_master (id, name, type, ownership_type) VALUES 
('asset1', 'Plastic Crate', 'Crate', 'External') ON CONFLICT (id) DO NOTHING;

-- Insert sample truck
INSERT INTO public.trucks (id, plate_number, branch_id) VALUES 
('truck1', 'ABC123', 'branch1') ON CONFLICT (id) DO NOTHING;

-- Insert sample driver
INSERT INTO public.drivers (id, full_name) VALUES 
('driver1', 'John Doe') ON CONFLICT (id) DO NOTHING;

-- Insert sample batch
INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date) VALUES 
('batch1', 'asset1', 100, 'loc1', 'Success', '2024-01-01') ON CONFLICT (id) DO NOTHING;

-- Insert sample batch movement
INSERT INTO public.batch_movements (batch_id, transaction_date, quantity, from_location_id, to_location_id, driver_id, truck_id) VALUES 
('batch1', '2024-01-01', 100, 'loc1', 'loc2', 'driver1', 'truck1') ON CONFLICT (id) DO NOTHING;