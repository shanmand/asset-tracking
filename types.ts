
export enum UserRole {
  ADMIN = 'System Administrator',
  MANAGER = 'Crates Manager',
  STAFF = 'Crates Department',
  EXECUTIVE = 'Dashboard Viewer'
}

export type Permission = 
  | 'MANAGE_FEES' 
  | 'MANAGE_USERS' 
  | 'APPROVE_CLAIMS' 
  | 'VIEW_SETTLEMENT' 
  | 'WRITE_MOVEMENTS' 
  | 'VERIFY_RECEIPTS'
  | 'MANAGE_LOSSES'
  | 'VIEW_DASHBOARD'
  | 'VIEW_AUDIT_LOGS';

export enum LocationType {
  CRATES_DEPT = 'Crates Dept',
  WAREHOUSE = 'Warehouse',
  COLD_STORAGE = 'Cold Storage',
  AT_CUSTOMER = 'At Customer',
  IN_TRANSIT = 'In Transit',
  RETURNING = 'Returning to Supplier',
  LOST = 'Lost/Written Off'
}

export enum PartnerType {
  INTERNAL = 'Internal',
  CUSTOMER = 'Customer',
  SUPPLIER = 'Supplier'
}

export enum BillingModel {
  DAILY_RENTAL = 'Daily Rental (Supermarket)',
  ISSUE_FEE = 'Issue Fee (QSR)',
  NONE = 'None'
}

export enum OwnershipType {
  INTERNAL = 'Internal',
  EXTERNAL = 'External'
}

export enum LocationCategory {
  HOME = 'Home',
  EXTERNAL = 'External'
}

export enum AssetType {
  CRATE = 'Crate',
  PALLET = 'Pallet'
}

export enum FeeType {
  DAILY_RENTAL = 'Daily Rental (Supermarket)',
  ISSUE_FEE = 'Issue Fee (QSR)',
  REPLACEMENT_FEE = 'Replacement Fee (Lost Equipment)',
  SALVAGE_CREDIT = 'Salvage Credit (Scrapped Assets)'
}

export enum LossType {
  MISSING = 'Missing/Lost',
  SCRAPPED = 'Scrapped (Unrepairable)',
  CUSTOMER_LIABLE = 'Customer Liable',
  STOCK_TAKE_VARIANCE = 'Stock Take Variance'
}

export enum MovementCondition {
  CLEAN = 'Clean',
  DIRTY = 'Dirty',
  DAMAGED = 'Damaged'
}

export type ClaimStatus = 'Lodged' | 'Under Assessment' | 'Returned for Assessment' | 'Accepted' | 'Rejected';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  branch_id: string; // e.g., 'LOC-JHB-01'
}

export interface AssetMaster {
  id: string;
  name: string;
  type: AssetType;
  dimensions: string;
  material: string;
  billing_model: BillingModel;
  ownership_type: OwnershipType;
  supplier_id?: string;
  is_internal?: boolean;
  fee_type?: string;
}

export interface FeeSchedule {
  id: string;
  asset_id: string;
  fee_type: FeeType;
  amount_zar: number;
  effective_from: string; // ISO Date
  effective_to: string | null; // NULL means currently active
  is_active?: boolean; // NEW: For admin bulk management
}

export interface Branch {
  id: string;
  name: string;
  created_at?: string;
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  category: LocationCategory;
  branch_id?: string;
  partner_type: PartnerType;
}

export interface Truck {
  id: string;
  plate_number: string;
  model?: string;
  capacity?: number;
  created_at?: string;
}

export interface Driver {
  id: string;
  full_name: string;
  license_number?: string;
  phone?: string;
  contact_number?: string;
  created_at?: string;
}

export interface Batch {
  id: string;
  asset_id: string;
  quantity: number;
  current_location_id: string;
  created_at: string;
  status: 'Pending' | 'Success' | 'Lost' | 'In-Transit' | 'Settled';
  is_settled?: boolean;
  settled_at?: string;
  transaction_date?: string;
  transfer_confirmed_by_customer?: boolean;
  confirmation_date?: string;
}

export interface BatchMovement {
  id: string;
  batch_id: string;
  from_location_id: string;
  to_location_id: string;
  truck_id?: string;
  driver_id?: string;
  timestamp: string;
  condition: MovementCondition;
  origin_user_id: string;
  transaction_date?: string;
}

export interface BatchVerification {
  id: string;
  batch_id: string;
  verified_by: string; // User ID
  received_quantity: number;
  expected_quantity: number;
  variance: number;
  timestamp: string;
  notes: string;
}

export interface ThaanSlip {
  id: string;
  batch_id: string;
  doc_url: string;
  is_signed: boolean;
  signed_at: string | null;
}

export interface Claim {
  id: string;
  batch_id: string;
  truck_id: string;
  driver_id: string;
  thaan_slip_id: string;
  type: 'Damaged' | 'Dirty';
  amount_claimed_zar: number;
  status: ClaimStatus;
  created_at: string;
  settled_at?: string;
}

export interface AssetLoss {
  id: string;
  batch_id: string;
  loss_type: LossType;
  lost_quantity: number;
  last_known_location_id: string;
  last_driver_name?: string;
  last_truck_plate?: string;
  last_thaan_url?: string;
  reported_by: string; // User ID
  timestamp: string;
  transaction_date?: string;
  notes: string;
  supplier_notified: boolean;
  supplier_invoice_ref?: string;
  is_rechargeable: boolean;
}

export interface ClaimAudit {
  id: string;
  claim_id: string;
  status_from: ClaimStatus | 'None';
  status_to: ClaimStatus;
  updated_by: string;
  timestamp: string;
  notes?: string;
}

export interface InventoryRecord {
  location_id: string;
  asset_id: string;
  quantity: number;
}

export interface AuditLog {
  id: string;
  entity_id: string;
  entity_type: 'Batch' | 'Fee' | 'Claim' | 'Verification';
  action: string;
  old_value: string;
  new_value: string;
  user_id: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  due_date: string;
  assigned_to?: string;
  created_at: string;
}

export interface StockTake {
  id: string;
  location_id: string;
  take_date: string;
  performed_by: string;
  notes?: string;
  created_at: string;
}

export interface StockTakeItem {
  id: string;
  stock_take_id: string;
  asset_id: string;
  system_quantity: number;
  physical_count: number;
  variance: number;
}

export interface Settlement {
  id: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  gross_liability: number;
  discount_amount: number;
  net_payable: number;
  settled_by: string;
  created_at: string;
}

export interface BusinessParty {
  id: string;
  name: string;
  party_type: 'Customer' | 'Supplier';
  contact_person?: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface Discount {
  id: string;
  settlement_id: string;
  amount: number;
  reason: string;
  created_at: string;
}
