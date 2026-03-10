
import React, { useState, useEffect } from 'react';
import { MOCK_CLAIMS, MOCK_BATCHES, MOCK_CLAIM_AUDITS } from '../constants';
import { AlertCircle, Clock, CheckCircle2, History, User, FileText, ChevronRight, XCircle, Search, ShieldAlert, Loader2, Truck as TruckIcon, Info } from 'lucide-react';
import { ClaimStatus, Claim, Batch, ClaimAudit, Truck, Driver } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface ClaimsManagerProps {
  isManager: boolean;
}

const ClaimsManager: React.FC<ClaimsManagerProps> = ({ isManager }) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [audits, setAudits] = useState<ClaimAudit[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setClaims([]);
        setBatches([]);
        setAudits([]);
        setTrucks([]);
        setDrivers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [cRes, bRes, aRes, tRes, dRes] = await Promise.all([
          supabase.from('claims').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('claim_audits').select('*'),
          supabase.from('trucks').select('*'),
          supabase.from('drivers').select('*')
        ]);

        if (cRes.data) {
          setClaims(cRes.data);
          if (cRes.data.length > 0) setSelectedClaimId(cRes.data[0].id);
        }
        if (bRes.data) setBatches(bRes.data);
        if (aRes.data) setAudits(aRes.data);
        if (tRes.data) setTrucks(tRes.data);
        if (dRes.data) setDrivers(dRes.data);
      } catch (err) {
        console.error("Claims Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const selectedClaim = claims.find(c => c.id === selectedClaimId);
  const auditLogs = audits.filter(a => a.claim_id === selectedClaimId);
  const driver = selectedClaim ? drivers.find(d => d.id === selectedClaim.driver_id) : null;
  const truck = selectedClaim ? trucks.find(t => t.id === selectedClaim.truck_id) : null;

  const handlePauseRental = async () => {
    if (!selectedClaim || !isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('batches')
        .update({ transfer_confirmed_by_customer: true, confirmation_date: new Date().toISOString() })
        .eq('id', selectedClaim.batch_id);
      
      if (error) throw error;

      // Add audit log for the pause
      await supabase.from('claim_audits').insert([{
        claim_id: selectedClaim.id,
        status_from: selectedClaim.status,
        status_to: 'Under Assessment',
        notes: 'Rental paused pending dispute investigation.',
        updated_by: 'System'
      }]);

      alert("Rental paused for Batch #" + selectedClaim.batch_id);
      // Refresh data
      window.location.reload();
    } catch (err: any) {
      alert("Error pausing rental: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const workflow: ClaimStatus[] = ['Lodged', 'Under Assessment', 'Returned for Assessment', 'Accepted'];

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="p-20 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
        <FileText className="mx-auto text-slate-200 mb-4" size={48} />
        <h3 className="font-bold text-slate-800 uppercase tracking-widest">No Claims Found</h3>
        <p className="text-sm text-slate-500 mt-2">All system claims have been cleared or none have been lodged.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Disputed Liability</p>
            <p className="text-2xl font-bold text-amber-600">R {formatCurrency(claims.filter(c => c.status !== 'Accepted').reduce((acc, c) => acc + c.amount_claimed_zar, 0))}</p>
            <p className="text-[10px] text-slate-400 font-medium">Still accruing fees</p>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
            <Clock size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Approved Credits</p>
            <p className="text-2xl font-bold text-emerald-600">R {formatCurrency(claims.filter(c => c.status === 'Accepted').reduce((acc, c) => acc + c.amount_claimed_zar, 0))}</p>
            <p className="text-[10px] text-slate-400 font-medium">Claims accepted by Supplier</p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
            <CheckCircle2 size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Net Supplier Balance</p>
            <p className="text-2xl font-bold text-slate-800">R {formatCurrency(321400.00)}</p>
            <p className="text-[10px] text-slate-400 font-medium">Final payable amount</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-full">
            <FileText size={24} />
          </div>
        </div>
      </div>

      {/* Source Data Explanation */}
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl flex gap-4">
        <Info className="text-blue-500 shrink-0" size={20} />
        <div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Claims Source Data</h4>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Claims are automatically generated when a <strong>Quantity Variance</strong> is reported during the <strong>Inventory Intake</strong> process. 
            They can also be manually triggered from the <strong>Logistics Intelligence</strong> module when reconciling signed THAAN slips against dispatched quantities.
            Each claim tracks the liability of the transporter (Truck/Driver) for damaged or missing assets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Claims List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-fit">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Active Claims</h3>
            <Search size={16} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-50">
            {claims.map(claim => (
              <button 
                key={claim.id}
                onClick={() => setSelectedClaimId(claim.id)}
                className={`w-full p-4 text-left transition-colors flex items-center justify-between group ${selectedClaimId === claim.id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">{claim.id}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest ${claim.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Batch {claim.batch_id} • {claim.type}</p>
                </div>
                <ChevronRight size={16} className={`text-slate-300 group-hover:text-amber-500 transition-colors ${selectedClaimId === claim.id ? 'text-amber-500' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Workflow & Audit Detail */}
        <div className="lg:col-span-2 space-y-6">
          {selectedClaim ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Workflow: {selectedClaim.id}</h3>
                  <p className="text-sm text-slate-500">Lodged by Crates Dept on {new Date(selectedClaim.created_at).toLocaleString('en-ZA')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase">Estimated Credit</p>
                  <p className="text-2xl font-bold text-emerald-600">R {formatCurrency(selectedClaim.amount_claimed_zar)}</p>
                </div>
              </div>

              {/* Stepper */}
              <div className="flex items-center justify-between mb-12 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                {workflow.map((step, i) => {
                  const isCompleted = workflow.indexOf(selectedClaim.status as any) >= i || selectedClaim.status === 'Accepted';
                  const isCurrent = selectedClaim.status === step;
                  return (
                    <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-300'
                      } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}>
                        {isCompleted ? <CheckCircle2 size={18} /> : <span>{i + 1}</span>}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-tighter text-center max-w-[80px] ${isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Audit Log */}
              <div className="border-t border-slate-100 pt-8">
                <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <History size={18} className="text-slate-400" />
                  Workflow Audit Log
                </h4>
                <div className="space-y-6 relative pl-4 border-l border-slate-100">
                  {auditLogs.map(log => (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleString('en-ZA')}</p>
                          <p className="text-sm font-bold text-slate-800">
                            {log.status_from} &rarr; <span className="text-emerald-600">{log.status_to}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{log.notes}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                          <User size={10} /> {log.updated_by}
                        </div>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && <p className="text-xs text-slate-400 italic">No audit history for this claim.</p>}
                </div>
              </div>
                           {/* Actions */}
              {isManager ? (
                <div className="mt-8 space-y-3">
                  <div className="flex gap-3">
                    <button className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                        <CheckCircle2 size={18} /> Approve Claim (Process Credit)
                    </button>
                    <button className="flex-1 py-3 border-2 border-rose-500 text-rose-500 rounded-lg font-bold text-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2">
                        <XCircle size={18} /> Reject Claim
                    </button>
                  </div>
                  <button 
                    onClick={handlePauseRental}
                    className="w-full py-3 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
                  >
                    <Clock size={18} /> Pause Daily Rental (Dispute Investigation)
                  </button>
                </div>
              ) : (
                <div className="mt-8 bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center gap-4">
                  <ShieldAlert className="text-slate-400" size={24} />
                  <p className="text-sm text-slate-500 italic">Claims must be approved by a Crates Manager before being finalized for the supplier.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-20 text-center shadow-sm">
              <p className="text-slate-400 italic">Select a claim to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimsManager;
