
import React, { useState, useEffect } from 'react';
import { MOCK_ASSETS, MOCK_FEES } from '../constants';
import { Search, Plus, Filter, MoreVertical, ShieldAlert, Loader2 } from 'lucide-react';
import { AssetMaster, FeeSchedule } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface AssetListProps {
  isAdmin: boolean;
}

const AssetList: React.FC<AssetListProps> = ({ isAdmin }) => {
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setAssets(MOCK_ASSETS);
        setFees(MOCK_FEES);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [assetsRes, feesRes] = await Promise.all([
          supabase.from('asset_master').select('*'),
          supabase.from('fee_schedule').select('*')
        ]);

        if (assetsRes.data) setAssets(assetsRes.data);
        if (feesRes.data) setFees(feesRes.data);
      } catch (err) {
        console.error("Asset List Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search asset ID or name..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50">
            <Filter size={16} /> Filter
          </button>
          {isAdmin && (
            <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 shadow-lg transition-all">
              <Plus size={16} /> New Asset Type
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-3">
           <ShieldAlert className="text-amber-500" size={20} />
           <p className="text-xs font-medium text-amber-800">Master Fee Rates are read-only for your profile. Changes require System Administrator clearance.</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Asset Details</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Specifications</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Active Rate</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.map(asset => {
              const currentFee = fees.find(f => f.asset_id === asset.id && f.effective_to === null);
              return (
                <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                        <span className="font-bold text-xs">{asset.id}</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{asset.name}</p>
                        <p className="text-xs text-slate-400">{asset.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600">{asset.dimensions}</p>
                    <p className="text-xs text-slate-400">{asset.material}</p>
                  </td>
                  <td className="px-6 py-4">
                    {currentFee ? (
                      <div>
                        <p className="font-bold text-slate-800">R {currentFee.amount_zar.toFixed(2)}</p>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase">{currentFee.fee_type}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-rose-400 italic">No rate defined</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <button className="p-2 text-slate-300 hover:text-slate-600">
                        <MoreVertical size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredAssets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
                  No assets found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssetList;
