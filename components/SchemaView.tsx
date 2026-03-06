
import React, { useState } from 'react';
import { Database, Table as TableIcon, Calculator, ShieldCheck, Zap, Receipt, Lock, Globe, History, MapPin, Truck, FileText, AlertTriangle, TrendingUp, Info, CheckCircle2, Terminal } from 'lucide-react';

const SchemaView: React.FC = () => {
  const [activeView, setActiveView] = useState<'visual' | 'sql' | 'python' | 'simulator' | 'postgres' | 'rbac' | 'backend' | 'scenario' | 'migrations'>('scenario');
  
  // Simulator State
  const [simCondition, setSimCondition] = useState<'Clean' | 'Damaged'>('Clean');
  const [simThaan, setSimThaan] = useState(false);
  const [simClaimReceived, setSimClaimReceived] = useState(false);
  const [simDays, setSimDays] = useState(10);
  const [simAssetType, setSimAssetType] = useState<'Supermarket' | 'QSR'>('Supermarket');

  const entities = [
    { name: 'AssetMaster', fields: ['id', 'name', 'type', 'dimensions', 'material'] },
    { name: 'FeeSchedule', fields: ['id', 'asset_id (FK)', 'fee_type', 'amount_zar', 'effective_from', 'effective_to'] },
    { name: 'Locations', fields: ['id', 'name', 'type', 'category (Home/External)', 'branch_id (FK)', 'partner_type'] },
    { name: 'Batches', fields: ['id', 'asset_id (FK)', 'quantity', 'current_location_id (FK)', 'created_at', 'status'] },
    { name: 'AssetLosses', fields: ['id', 'batch_id (FK)', 'loss_type', 'lost_qty', 'last_known_loc_id', 'timestamp', 'reported_by (FK)', 'notes'] },
    { name: 'BatchVerifications', fields: ['id', 'batch_id (FK)', 'verified_by (FK)', 'received_qty', 'expected_qty', 'variance', 'timestamp'] },
    { name: 'Claims', fields: ['id', 'batch_id (FK)', 'driver_id (FK)', 'thaan_slip_id (FK)', 'status', 'created_at', 'settled_at'] },
    { name: 'Users', fields: ['id', 'name', 'role', 'branch_id'] },
    { name: 'Branches', fields: ['id', 'name', 'created_at'] }
  ];

  const calculateSimLiability = () => {
    let base = simAssetType === 'Supermarket' ? 5.00 : 120.00;
    let quantity = 100;
    if (simAssetType === 'Supermarket') {
      let activeDays = simDays;
      if (simCondition === 'Clean' && simThaan) activeDays = Math.min(simDays, 5);
      else if (simCondition === 'Damaged' && simClaimReceived) activeDays = Math.min(simDays, 8);
      return activeDays * base * quantity;
    } else {
      let fee = base * quantity;
      if (simThaan) fee = 0;
      return fee;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <TabButton active={activeView === 'scenario'} onClick={() => setActiveView('scenario')} label="Lifecycle Walkthrough" />
          <TabButton active={activeView === 'visual'} onClick={() => setActiveView('visual')} label="Visual Diagram" />
          <TabButton active={activeView === 'postgres'} onClick={() => setActiveView('postgres')} label="Postgres Workflow" />
          <TabButton active={activeView === 'migrations'} onClick={() => setActiveView('migrations')} label="SQL Migrations" />
          <TabButton active={activeView === 'backend'} onClick={() => setActiveView('backend')} label="Backend Logic" />
          <TabButton active={activeView === 'simulator'} onClick={() => setActiveView('simulator')} label="Accrual Simulator" />
        </div>
      </div>

      {activeView === 'visual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-slate-900 rounded-3xl border border-slate-800 overflow-auto max-h-[700px]">
          {entities.map(entity => (
            <div key={entity.name} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden h-fit shadow-2xl">
              <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-600 flex items-center gap-2">
                <TableIcon size={14} className="text-emerald-400" />
                <span className="text-[10px] font-black text-white tracking-widest uppercase">{entity.name}</span>
              </div>
              <div className="p-4 space-y-2">
                {entity.fields.map(field => (
                  <div key={field} className="text-xs text-slate-400 flex items-center gap-2 py-1 border-b border-slate-700/30 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    {field}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeView === 'scenario' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">The 3-Month Supermarket Journey</h3>
                <p className="text-sm text-slate-500 uppercase tracking-widest font-bold text-[10px]">End-to-End Operational & Financial Verification</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-12">
              <ScenarioStep 
                num="1" title="Month 1 (Day 1): Intake & 2026 Rate Lock" desc="100 Supermarket Pallets (Asset: SH-P01) received at Kya Sands (LOC-JHB-01)."
                icon={<MapPin className="text-emerald-500" />}
                sql={`INSERT INTO Batches (id, asset_id, quantity, current_location_id, created_at, status)\nVALUES ('B-SM-001', 'SH-P01', 100, 'LOC-JHB-01', '2026-01-01', 'Success');`}
                verify="Rental timer starts immediately. Logic pulls 'Daily Rental' where effective_from <= '2026-01-01'."
              />
              <ScenarioStep 
                num="2" title="Month 1 (Day 15): Batch Splitting" desc="50 pallets are moved from Kya Sands to Cold Storage (LOC-COLD-01)."
                icon={<History className="text-blue-400" />}
                sql={`UPDATE Batches SET quantity = 50 WHERE id = 'B-SM-001';\nINSERT INTO Batches (id, asset_id, quantity, current_location_id, created_at, status)\nVALUES ('B-SM-001-B', 'SH-P01', 50, 'LOC-COLD-01', '2026-01-01', 'Success');`}
                verify="Location updates but rental continues (Category is External)."
              />
              <ScenarioStep 
                num="3" title="Month 2 (Day 10): Logistics Trace" desc="50 pallets from Cold Storage loaded onto Truck GP 22 SH."
                icon={<Truck className="text-amber-500" />}
                sql={`UPDATE Batches SET current_location_id = 'LOC-TRANS-01', status = 'In-Transit' WHERE id = 'B-SM-001-B';`}
                verify="System logs the LogisticsUnit. Rental continues during transit."
              />
            </div>
          </div>
        </div>
      )}

      {activeView === 'postgres' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 font-mono text-xs overflow-x-auto space-y-8">
            <div className="text-emerald-400 flex items-center gap-3 border-b border-slate-800 pb-4">
              <Terminal size={20} />
              <span className="font-black tracking-widest uppercase">RPC: calculate_batch_accrual</span>
            </div>
            <pre className="text-slate-300 leading-relaxed">
{`-- PL/pgSQL Function for Real-time Accrual Calculation
CREATE OR REPLACE FUNCTION calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    total_accrual NUMERIC := 0;
BEGIN
    -- Calculate liability across all rate periods (Month 1, 2, 3 logic)
    WITH AccrualPhases AS (
        SELECT 
            b.id,
            b.quantity,
            fs.amount_zar,
            -- Accrual starts at batch creation or fee effect
            GREATEST(b.created_at, fs.effective_from) as phase_start,
            -- Accrual ends at (Loss, Thaan, or Now) or fee expiration
            LEAST(
                COALESCE(al.timestamp, ts.signed_at, NOW()), 
                COALESCE(fs.effective_to, '9999-12-31'::timestamp)
            ) as phase_end
        FROM Batches b
        JOIN FeeSchedule fs ON b.asset_id = fs.asset_id
        LEFT JOIN AssetLosses al ON b.id = al.batch_id
        LEFT JOIN ThaanSlips ts ON b.id = ts.batch_id
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
$$ LANGUAGE plpgsql;`}
            </pre>
          </div>

          <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 font-mono text-xs overflow-x-auto space-y-8">
            <div className="text-blue-400 flex items-center gap-3 border-b border-slate-800 pb-4">
              <Calculator size={20} />
              <span className="font-black tracking-widest uppercase">Verification Triggers</span>
            </div>
            <pre className="text-slate-300 leading-relaxed">
{`-- Trigger: Variance to Loss Record
CREATE OR REPLACE FUNCTION fn_on_verification_variance() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.variance < 0 THEN
        INSERT INTO AssetLosses (batch_id, loss_type, lost_qty, timestamp, reported_by) 
        VALUES (NEW.batch_id, 'Missing/Lost', ABS(NEW.variance), NOW(), NEW.verified_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`}
            </pre>
          </div>
        </div>
      )}

      {activeView === 'migrations' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 font-mono text-xs overflow-x-auto space-y-8">
            <div className="text-amber-400 flex items-center gap-3 border-b border-slate-800 pb-4">
              <Terminal size={20} />
              <span className="font-black tracking-widest uppercase">Required Schema Updates (Run in Supabase SQL Editor)</span>
            </div>
            <pre className="text-slate-300 leading-relaxed">
{`-- 1. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add branch_id to Locations
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='locations' AND column_name='branch_id') THEN
        ALTER TABLE public.locations ADD COLUMN branch_id TEXT REFERENCES public.branches(id);
    END IF;
END $$;

-- 3. Add partner_type to Locations
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='locations' AND column_name='partner_type') THEN
        ALTER TABLE public.locations ADD COLUMN partner_type TEXT DEFAULT 'Internal';
    END IF;
END $$;

-- 4. Enable RLS for Branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policy for Branches
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Allow public read access') THEN
        CREATE POLICY "Allow public read access" ON public.branches FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Allow admin insert') THEN
        CREATE POLICY "Allow admin insert" ON public.branches FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 6. Create THAAN Slips Table
CREATE TABLE IF NOT EXISTS public.thaan_slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT REFERENCES public.batches(id),
    doc_url TEXT NOT NULL,
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Accrual Engine RPC
CREATE OR REPLACE FUNCTION calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_batch_qty INT;
    v_asset_id TEXT;
    v_created_at TIMESTAMP;
    v_daily_rate NUMERIC;
    v_days INT;
BEGIN
    -- Get batch details
    SELECT quantity, asset_id, created_at 
    INTO v_batch_qty, v_asset_id, v_created_at
    FROM batches WHERE id = batch_id_input;

    -- Get current daily rental rate
    SELECT amount_zar INTO v_daily_rate
    FROM fee_schedule 
    WHERE asset_id = v_asset_id 
    AND fee_type = 'Daily Rental (Supermarket)'
    AND effective_to IS NULL
    LIMIT 1;

    -- Calculate days (minimum 1)
    v_days := GREATEST(1, EXTRACT(DAY FROM (NOW() - v_created_at))::INT);

    RETURN COALESCE(v_batch_qty * v_daily_rate * v_days, 0);
END;
$$ LANGUAGE plpgsql;

-- 7. Create Storage Bucket for THAAN Slips
-- Note: This must be run in the SQL Editor. 
-- It ensures the 'thaan-slips' bucket exists and is public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('thaan-slips', 'thaan-slips', true)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage Policies
-- Allow public read access to thaan-slips
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'thaan-slips');

-- Allow authenticated uploads to thaan-slips
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'thaan-slips');`}
            </pre>
            <div className="p-4 bg-amber-900/20 border border-amber-900/50 rounded-xl flex gap-4">
              <AlertTriangle className="text-amber-500 shrink-0" size={24} />
              <p className="text-xs text-amber-200 font-medium leading-relaxed">
                <strong>Deployment Note:</strong> Copy and paste the SQL above into your Supabase SQL Editor to fix the "table not found" and "column not found" errors. After running, refresh your browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeView === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-[0.2em] flex items-center gap-3">
              <ShieldCheck className="text-emerald-500" size={20} />
              Liability Engine Simulator
            </h3>
            <div className="text-6xl font-black text-slate-900">R {calculateSimLiability().toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ScenarioStepProps {
  num: string; title: string; desc: string; icon: React.ReactNode; sql: string; verify: string;
}

const ScenarioStep: React.FC<ScenarioStepProps> = ({ num, title, desc, icon, sql, verify }) => (
  <div className="flex gap-6 group">
    <div className="flex flex-col items-center">
       <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">{num}</div>
       <div className="flex-1 w-px bg-slate-100" />
    </div>
    <div className="flex-1 pb-10 space-y-4">
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-50 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
             <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
          </div>
       </div>
       <p className="text-xs text-slate-500 font-medium italic leading-relaxed">{desc}</p>
       <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-[10px] text-slate-600 leading-relaxed shadow-inner whitespace-pre-wrap">{sql}</div>
       <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-[10px] font-bold border border-blue-100 flex items-center gap-2">
          <Info size={14} className="shrink-0 text-blue-400" />
          <span className="uppercase tracking-tighter">Forensic Verification:</span> {verify}
       </div>
    </div>
  </div>
);

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string }> = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
);

export default SchemaView;
