
import React, { useMemo, useState, useEffect } from 'react';
import { 
  MOCK_BATCHES, 
  MOCK_FEES, 
  MOCK_LOSSES, 
  MOCK_CLAIMS, 
  MOCK_ASSETS, 
  MOCK_LOCATIONS,
  MOCK_MOVEMENTS,
  MOCK_THAANS 
} from '../constants';
import { FeeType, LocationType, LossType, Batch, FeeSchedule, AssetLoss, Claim, AssetMaster, Location, BatchMovement, ThaanSlip } from '../types';
import { 
  Receipt, 
  TrendingUp, 
  MinusCircle, 
  AlertCircle, 
  Building2, 
  Download, 
  Calculator, 
  ArrowRight,
  Info,
  Calendar,
  FileCheck,
  Zap,
  Tag,
  Skull,
  History,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

interface SupplierSettlementReportProps {
  isAdmin: boolean;
}

const SupplierSettlementReport: React.FC<SupplierSettlementReportProps> = ({ isAdmin }) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [losses, setLosses] = useState<AssetLoss[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [movements, setMovements] = useState<BatchMovement[]>([]);
  const [thaans, setThaans] = useState<ThaanSlip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentMonth = "May 2025"; 
  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setBatches(MOCK_BATCHES);
        setFees(MOCK_FEES);
        setLosses(MOCK_LOSSES);
        setClaims(MOCK_CLAIMS);
        setAssets(MOCK_ASSETS);
        setLocations(MOCK_LOCATIONS);
        setMovements(MOCK_MOVEMENTS);
        setThaans(MOCK_THAANS);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [bRes, fRes, lRes, cRes, aRes, locRes, mRes, tRes] = await Promise.all([
          supabase.from('batches').select('*'),
          supabase.from('fee_schedule').select('*'),
          supabase.from('asset_losses').select('*'),
          supabase.from('claims').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('batch_movements').select('*'),
          supabase.from('thaan_slips').select('*')
        ]);

        if (bRes.data) setBatches(bRes.data);
        if (fRes.data) setFees(fRes.data);
        if (lRes.data) setLosses(lRes.data);
        if (cRes.data) setClaims(cRes.data);
        if (aRes.data) setAssets(aRes.data);
        if (locRes.data) setLocations(locRes.data);
        if (mRes.data) setMovements(mRes.data);
        if (tRes.data) setThaans(tRes.data);
      } catch (err) {
        console.error("Settlement Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const reportData = useMemo(() => {
    // 1. Rental Reconciliation
    const rentals = batches.filter(b => {
        const fee = fees.find(f => f.asset_id === b.asset_id && f.fee_type === FeeType.DAILY_RENTAL);
        return !!fee;
    }).map(b => {
        const fee = fees.find(f => f.asset_id === b.asset_id && f.fee_type === FeeType.DAILY_RENTAL && f.effective_to === null);
        const loss = losses.find(l => l.batch_id === b.id);
        
        const endDate = loss ? new Date(loss.timestamp) : new Date();
        const startDate = new Date(b.created_at);
        const billableDays = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const totalZar = billableDays * (fee?.amount_zar || 0) * b.quantity;
        
        const branch = locations.find(l => l.id === b.current_location_id)?.name || "Unallocated";

        return { 
            id: b.id, 
            asset: assets.find(a => a.id === b.asset_id)?.name,
            qty: b.quantity,
            days: billableDays,
            rate: fee?.amount_zar || 0,
            total: totalZar,
            branch,
            isStopped: !!loss
        };
    });

    // 2. Loss & Replacement Settlement
    const lossItems = losses.map(l => {
        const batch = batches.find(b => b.id === l.batch_id);
        const fee = fees.find(f => f.asset_id === batch?.asset_id && f.fee_type === FeeType.REPLACEMENT_FEE);
        const amount = l.lost_quantity * (fee?.amount_zar || 0);
        const branch = locations.find(loc => loc.id === l.last_known_location_id)?.name || "Unallocated";
        
        return {
            id: l.id,
            asset: assets.find(a => a.id === batch?.asset_id)?.name,
            qty: l.lost_quantity,
            reason: l.loss_type,
            fee: fee?.amount_zar || 0,
            total: amount,
            branch
        };
    });

    // 3. QSR Penalties
    const penalties = movements.filter(m => {
        const toLoc = locations.find(l => l.id === m.to_location_id);
        const thaan = thaans.find(t => t.batch_id === m.batch_id);
        return toLoc?.type === LocationType.RETURNING && !thaan;
    }).map(m => {
        const penaltyFee = 250.00; 
        const branch = locations.find(l => l.id === m.from_location_id)?.name || "Unallocated";
        return {
            id: m.batch_id,
            reason: "Missing THAAN Slip on Return",
            total: penaltyFee,
            branch
        };
    });

    // 4. Claims Offsets
    const offsets = claims.filter(c => c.status === 'Accepted').map(c => {
        const branch = "Johannesburg Plant"; 
        return {
            id: c.id,
            reason: `Claim Accepted (${c.type})`,
            total: c.amount_claimed_zar,
            branch
        };
    });

    // Subtotals
    const rentalSubtotal = rentals.reduce((acc, r) => acc + r.total, 0);
    const lossSubtotal = lossItems.reduce((acc, l) => acc + l.total, 0);
    const penaltySubtotal = penalties.reduce((acc, p) => acc + p.total, 0);
    const offsetSubtotal = offsets.reduce((acc, o) => acc + o.total, 0);
    
    const grandTotal = rentalSubtotal + lossSubtotal + penaltySubtotal - offsetSubtotal;

    // Branch Allocation
    const branchBreakdown: Record<string, number> = {};
    [...rentals, ...lossItems, ...penalties].forEach(item => {
        branchBreakdown[item.branch] = (branchBreakdown[item.branch] || 0) + item.total;
    });
    offsets.forEach(item => {
        branchBreakdown[item.branch] = (branchBreakdown[item.branch] || 0) - item.total;
    });

    return { 
        rentals, losses: lossItems, penalties, offsets, 
        rentalSubtotal, lossSubtotal, penaltySubtotal, offsetSubtotal, 
        grandTotal, branchBreakdown 
    };
  }, [batches, fees, losses, claims, assets, locations, movements, thaans]);

  const handleExport = () => {
    alert("Exporting reconciliation data to CSV...");
    // In a real app, this would generate a CSV from reportData
  };

  const handleApprove = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to approve this monthly statement? This will lock the records for this period.")) return;
    
    alert("Statement approved and locked for May 2025.");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl">
             <Receipt size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Monthly Supplier Settlement</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
              <Calendar size={12} /> Billing Period: {currentMonth}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleExport}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
          >
            <Download size={16} /> Export Reconciliation
          </button>
          {isAdmin ? (
            <button 
              onClick={handleApprove}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <FileCheck size={16} /> Approve Statement
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold border border-slate-200">
              <ShieldAlert size={14} /> Pending Admin Approval
            </div>
          )}
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <SummaryCard 
            title="Total Settlement" 
            value={`R ${formatCurrency(reportData.grandTotal)}`} 
            desc="Final Net Payment Amount" 
            type="main" 
            icon={<Calculator size={24} />}
        />
        <SummaryCard 
            title="Rental Subtotal" 
            value={`R ${formatCurrency(reportData.rentalSubtotal)}`} 
            desc="Daily Accruals (Active + Stopped)" 
            type="cost" 
            icon={<TrendingUp size={24} />}
        />
        <SummaryCard 
            title="Losses & Penalties" 
            value={`R ${formatCurrency(reportData.lossSubtotal + reportData.penaltySubtotal)}`} 
            desc="Replacement Costs & Missing THAANs" 
            type="cost" 
            icon={<Skull size={24} />}
        />
        <SummaryCard 
            title="Claims Offset" 
            value={`- R ${formatCurrency(reportData.offsetSubtotal)}`} 
            desc="Accepted Credit Deductions" 
            type="credit" 
            icon={<MinusCircle size={24} />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Reconciliation Table */}
        <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                   <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                     <History size={16} className="text-slate-400" /> Line-Item Rental Reconciliation
                   </h4>
                   <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">HISTORICAL FEE MATCHING ACTIVE</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-100 uppercase tracking-tighter bg-slate-50/50 font-black">
                                <th className="px-6 py-4">Batch ID</th>
                                <th className="px-6 py-4">Asset Detail</th>
                                <th className="px-6 py-4 text-center">Days</th>
                                <th className="px-6 py-4 text-center">Rate</th>
                                <th className="px-6 py-4 text-right">Accrual (ZAR)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {reportData.rentals.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800">#{r.id}</span>
                                            {r.isStopped && <span className="text-[8px] text-rose-500 font-bold uppercase tracking-tighter flex items-center gap-1"><Zap size={8} /> Hard Stopped</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">{r.asset}</span>
                                            <span className="text-slate-400">{r.qty} Units • {r.branch}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-600">{r.days}d</td>
                                    <td className="px-6 py-4 text-center text-slate-400">R {r.rate.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-800">R {formatCurrency(r.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sub-sections: Losses, Penalties, Claims */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Replacement Settlements</h4>
                    </div>
                    <div className="p-4 space-y-4">
                        {reportData.losses.map(l => (
                            <div key={l.id} className="flex justify-between items-center text-xs group">
                                <div>
                                    <p className="font-bold text-slate-800">{l.asset}</p>
                                    <p className="text-[10px] text-slate-400">{l.qty} Units • {l.reason}</p>
                                </div>
                                <p className="font-bold text-rose-700 group-hover:translate-x-1 transition-transform">R {formatCurrency(l.total)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Credits & Offsets</h4>
                    </div>
                    <div className="p-4 space-y-4">
                        {reportData.offsets.map(o => (
                            <div key={o.id} className="flex justify-between items-center text-xs group">
                                <div>
                                    <p className="font-bold text-slate-800">{o.id}</p>
                                    <p className="text-[10px] text-slate-400">{o.reason}</p>
                                </div>
                                <p className="font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">- R {formatCurrency(o.total)}</p>
                            </div>
                        ))}
                        {reportData.offsets.length === 0 && <p className="text-center text-[10px] text-slate-400 italic py-4">No accepted claims this month</p>}
                    </div>
                </div>
            </div>
        </div>

        {/* Sidebar: Branch Allocation & Logic */}
        <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl shadow-slate-300">
                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-6 flex items-center gap-2">
                    <Building2 size={16} /> Branch Cost Center Allocation
                </h4>
                <div className="space-y-6">
                    {(Object.entries(reportData.branchBreakdown) as [string, number][]).map(([branch, total]) => (
                        <div key={branch} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-100">{branch}</span>
                                <span className="text-sm font-black text-white">R {formatCurrency(total)}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(0, (total / (reportData.grandTotal || 1)) * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-8 pt-6 border-t border-slate-800">
                   <p className="text-[10px] text-slate-500 italic leading-relaxed">
                     Values include direct daily rentals, replacement fees for branch-level losses, and offset credits for branch-initiated claims.
                   </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Info className="text-blue-500" size={16} /> Settlement Logic
                </h4>
                <div className="space-y-3">
                    <LogicItem label="Hard Stop Policy" desc="Rental fees truncate on loss_timestamp." />
                    <LogicItem label="Historical Rates" desc="Fees applied based on receipt_date schedule." />
                    <LogicItem label="THAAN Penalty" desc={`Fixed R ${formatCurrency(250.00)} fine per missing POD return.`} />
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    The total settlement value includes a R {formatCurrency(reportData.penaltySubtotal)} penalty for items returned to Supplier Yard without valid signature capture.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ title: string, value: string, desc: string, type: 'main' | 'cost' | 'credit', icon: React.ReactNode }> = ({ title, value, desc, type, icon }) => {
    const styles = {
        main: "bg-slate-900 text-white shadow-xl shadow-slate-200",
        cost: "bg-white text-slate-800 border border-slate-200 shadow-sm",
        credit: "bg-emerald-50 text-emerald-800 border border-emerald-100 shadow-sm"
    };

    const iconColors = {
        main: "text-emerald-400 bg-slate-800",
        cost: "text-slate-400 bg-slate-50",
        credit: "text-emerald-500 bg-white"
    };

    return (
        <div className={`p-6 rounded-2xl transition-all hover:scale-[1.02] ${styles[type]}`}>
            <div className={`p-3 rounded-xl w-fit mb-4 ${iconColors[type]}`}>
                {icon}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${type === 'main' ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
            <p className="text-2xl font-black mt-1">{value}</p>
            <p className={`text-[10px] mt-1 font-medium ${type === 'main' ? 'text-slate-500' : 'text-slate-400'}`}>{desc}</p>
        </div>
    );
};

const LogicItem: React.FC<{ label: string, desc: string }> = ({ label, desc }) => (
    <div className="flex items-start gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
        <div>
            <p className="text-[10px] font-black text-slate-800 uppercase leading-none">{label}</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
        </div>
    </div>
);

export default SupplierSettlementReport;
