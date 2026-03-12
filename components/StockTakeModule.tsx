
import React, { useState, useEffect } from 'react';
import { ClipboardCheck, AlertTriangle, Search, MapPin, Package, History as HistoryIcon, TrendingDown, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { normalizePayload } from '../supabaseUtils';
import BranchSelector from './BranchSelector';
import { Batch, Location, AssetMaster, User } from '../types';

interface StockTakeModuleProps {
  currentUser: User;
  initialLocationId?: string;
}

const StockTakeModule: React.FC<StockTakeModuleProps> = ({ currentUser, initialLocationId }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>(initialLocationId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  
  // Local state for counts
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [locsRes, assetsRes] = await Promise.all([
          supabase.from('locations').select('*').order('name'),
          supabase.from('asset_master').select('*')
        ]);
        if (locsRes.data) setLocations(locsRes.data);
        if (assetsRes.data) setAssets(assetsRes.data);
      } catch (err) {
        console.error("StockTake Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!selectedLocation || !isSupabaseConfigured) {
        setBatches([]);
        return;
      }
      const { data } = await supabase
        .from('batches')
        .select('*')
        .eq('current_location_id', selectedLocation)
        .eq('status', 'Success');
      
      if (data) {
        setBatches(data);
        const initialCounts: Record<string, number> = {};
        data.forEach(b => initialCounts[b.id] = b.quantity);
        setPhysicalCounts(initialCounts);
      }
    };
    fetchBatches();
  }, [selectedLocation]);

  const handleCountChange = (batchId: string, value: string) => {
    const num = parseInt(value) || 0;
    setPhysicalCounts(prev => ({ ...prev, [batchId]: num }));
  };

  const handleSubmitReconciliation = async () => {
    if (!selectedLocation || !isSupabaseConfigured || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const items = batches.map(b => ({
        batch_id: String(b.id),
        physical_count: physicalCounts[b.id] ?? b.quantity
      }));

      const { data, error } = await supabase.rpc('process_stock_take', normalizePayload({
        p_location_id: selectedLocation,
        p_performed_by: currentUser.id,
        p_notes: notes,
        p_items: items
      }));

      if (error) throw error;

      setNotification({ message: `Stock take processed successfully. ID: ${data}`, type: 'success' });
      setNotes('');
      
      const { data: updatedBatches } = await supabase
        .from('batches')
        .select('*')
        .eq('current_location_id', selectedLocation)
        .eq('status', 'Success');
      if (updatedBatches) setBatches(updatedBatches);

    } catch (err: any) {
      setNotification({ message: err.message || "Failed to process stock take.", type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Stock Take Reconciliation</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bulk Inventory Audit & Loss Recovery</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <BranchSelector 
                value={selectedBranch}
                onChange={setSelectedBranch}
                placeholder="All Branches"
                className="bg-slate-800 border-slate-700 text-white text-xs py-2 h-auto"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-white"
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
              >
                <option value="">Select Location...</option>
                {locations
                  .filter(l => !selectedBranch || l.branch_id === selectedBranch)
                  .map(l => <option key={l.id} value={l.id}>{l.name}</option>)
                }
              </select>
            </div>
          </div>
        </div>

        <div className="p-8">
          {!selectedLocation ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Search size={32} />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select a location to begin reconciliation</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Package size={32} />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No active batches found at this location</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID</th>
                      <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Type</th>
                      <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">System Qty</th>
                      <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Count</th>
                      <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Variance</th>
                      <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {batches.map(batch => {
                      const asset = assets.find(a => a.id === batch.asset_id);
                      const physical = physicalCounts[batch.id] ?? batch.quantity;
                      const variance = physical - batch.quantity;
                      
                      return (
                        <tr key={batch.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                <HistoryIcon size={14} />
                              </div>
                              <span className="text-sm font-bold text-slate-900">#{batch.id}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="text-xs font-medium text-slate-600">{asset?.name || 'Unknown Asset'}</span>
                          </td>
                          <td className="py-4">
                            <span className="text-sm font-black text-slate-900">{batch.quantity}</span>
                          </td>
                          <td className="py-4">
                            <input 
                              type="number"
                              className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                              value={physicalCounts[batch.id] ?? ''}
                              onChange={e => handleCountChange(batch.id, e.target.value)}
                            />
                          </td>
                          <td className="py-4">
                            <div className={`flex items-center gap-2 text-sm font-black ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {variance > 0 && <Plus size={12} />}
                              {variance}
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            {variance < 0 ? (
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1 justify-end">
                                <TrendingDown size={14} /> Loss Detected
                              </span>
                            ) : variance > 0 ? (
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 justify-end">
                                <Plus size={14} /> Surplus
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 justify-end">
                                <CheckCircle2 size={14} /> Balanced
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-8 border-t border-slate-100 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Take Notes / Audit Comments</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all min-h-[100px]"
                    placeholder="E.g. Monthly audit performed by J. Doe. Identified 5 missing crates due to warehouse breakage."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={handleSubmitReconciliation}
                    disabled={isSubmitting}
                    className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    SUBMIT RECONCILIATION
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-8 rounded-3xl flex gap-6">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Reconciliation Protocol</h4>
          <p className="text-xs text-amber-800 leading-relaxed font-medium">
            Submitting this reconciliation will atomically update system quantities. Any <strong>Losses</strong> identified will automatically trigger the creation of <strong>Asset Loss Records</strong> and apply the current <strong>Replacement Fees</strong> from the fee schedule. This action is permanent and recorded in the branch audit trail.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockTakeModule;
