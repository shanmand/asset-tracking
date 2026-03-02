
import React, { useState, useEffect } from 'react';
import { MOCK_BATCHES, MOCK_MOVEMENTS, MOCK_LOCATIONS, MOCK_LOGISTICS, MOCK_THAANS, MOCK_ASSETS, MOCK_USERS } from '../constants';
import { Skull, AlertTriangle, Truck, MapPin, User, FileText, CheckCircle2, XCircle, Search, Info, Database, CreditCard, UserCheck, ShieldAlert, Lock } from 'lucide-react';
import { LocationType, LossType, User as UserType, UserRole } from '../types';

interface LossRecorderProps {
  currentUser: UserType;
}

const LossRecorder: React.FC<LossRecorderProps> = ({ currentUser }) => {
  const isReadOnly = currentUser.role === UserRole.EXECUTIVE;
  
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [lossType, setLossType] = useState<LossType>(LossType.MISSING);
  const [isRechargeable, setIsRechargeable] = useState(false);
  const [lostQty, setLostQty] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [lastKnown, setLastKnown] = useState<{
    location: string;
    locationType: LocationType;
    driver?: string;
    truck?: string;
    thaanUrl?: string;
    customerName?: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedBatchId) {
      setLastKnown(null);
      return;
    }

    const batch = MOCK_BATCHES.find(b => b.id === selectedBatchId);
    if (!batch) return;

    const movements = MOCK_MOVEMENTS.filter(m => m.batch_id === selectedBatchId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const lastMv = movements[0];
    const loc = MOCK_LOCATIONS.find(l => l.id === (lastMv?.to_location_id || batch.current_location_id));
    const logistics = lastMv?.logistics_id ? MOCK_LOGISTICS.find(l => l.id === lastMv.logistics_id) : null;
    const thaan = MOCK_THAANS.find(t => t.batch_id === selectedBatchId);

    setLastKnown({
      location: loc?.name || 'Unknown',
      locationType: loc?.type || LocationType.WAREHOUSE,
      driver: logistics?.driver_name,
      truck: logistics?.truck_plate,
      thaanUrl: thaan?.doc_url,
      customerName: loc?.type === LocationType.AT_CUSTOMER ? loc.name : undefined
    });

    setLostQty(batch.quantity);
    
    if (loc?.type === LocationType.AT_CUSTOMER) {
        setLossType(LossType.CUSTOMER_LIABLE);
        setIsRechargeable(true);
    } else {
        setLossType(LossType.MISSING);
        setIsRechargeable(false);
    }
  }, [selectedBatchId]);

  const handleReportLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !selectedBatchId || lostQty <= 0 || !notes) return;

    setIsProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccessMsg(`Loss forensic audit complete for Batch #${selectedBatchId}.`);
      setSelectedBatchId('');
      setNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  const selectedBatch = MOCK_BATCHES.find(b => b.id === selectedBatchId);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-center gap-4">
          <ShieldAlert className="text-amber-500" size={24} />
          <div>
            <p className="text-sm font-bold text-amber-900 uppercase">Executive Audit Access</p>
            <p className="text-xs text-amber-700 font-medium">Write-off permissions are restricted. You may view forensics but cannot confirm losses.</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" size={20} />
            <p className="text-sm font-bold text-emerald-800">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)}><XCircle size={18} className="text-emerald-400" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${isReadOnly ? 'opacity-70 grayscale-[0.5]' : ''}`}>
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skull size={18} className="text-rose-400" />
                <h3 className="font-bold text-sm uppercase tracking-widest">Write-off Terminal</h3>
              </div>
              {isReadOnly && <Lock size={14} className="text-slate-500" />}
            </div>

            <form onSubmit={handleReportLoss} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Search size={14} /> Investigation Target</span>
                  <select 
                    disabled={isReadOnly}
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-rose-500 bg-slate-50 outline-none transition-all"
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                  >
                    <option value="">-- Choose Active Batch --</option>
                    {MOCK_BATCHES.filter(b => b.status !== 'Lost').map(b => (
                      <option key={b.id} value={b.id}>{b.id} ({b.quantity} Units)</option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Reason for Loss</span>
                  <select 
                    disabled={isReadOnly}
                    className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-rose-500 bg-slate-50 outline-none"
                    value={lossType}
                    onChange={e => setLossType(e.target.value as LossType)}
                  >
                    {Object.values(LossType).map(lt => (
                      <option key={lt} value={lt}>{lt}</option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedBatchId && lastKnown && (
                <div className="animate-in fade-in slide-in-from-bottom duration-500 space-y-6">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Database size={14} /> Forensics Trace</h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Last Known Loc</p>
                        <p className="text-sm font-bold text-slate-700">{lastKnown.location}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Primary Driver</p>
                        <p className="text-sm font-bold text-slate-700">{lastKnown.driver || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Actual Qty Lost</span>
                      <input 
                        disabled={isReadOnly}
                        type="number" 
                        className="w-full border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                        value={lostQty}
                        onChange={e => setLostQty(parseInt(e.target.value) || 0)}
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Audit Summary</span>
                    <textarea 
                      disabled={isReadOnly}
                      className="w-full border border-slate-200 rounded-xl p-4 text-sm h-32 bg-slate-50 resize-none outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="Investigation notes..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {!isReadOnly && (
                <button 
                  type="submit" 
                  disabled={!selectedBatchId || isProcessing}
                  className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest ${!selectedBatchId ? 'bg-slate-100 text-slate-300' : 'bg-rose-600 text-white hover:bg-rose-700'}`}
                >
                  {isProcessing ? 'Processing...' : 'CONFIRM WRITE-OFF'}
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LossRecorder;
