
import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Search, Loader2, Package, Truck, User, MapPin, Calendar, ArrowLeft, ArrowRight } from 'lucide-react';

const ForensicTable: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('vw_global_inventory_tracker')
        .select('*', { count: 'exact' });

      if (searchQuery) {
        query = query.or(`batch_id.ilike.%${searchQuery}%,last_moved_by_truck.ilike.%${searchQuery}%`);
      }

      const { data: results, count, error } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setData(results || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Forensic Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, searchQuery]);

  const formatCurrency = (val: number) => val?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Batch Forensic Intelligence</h3>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Unified Inventory Tracker (v2.0)</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search Batch ID or Truck..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch Info</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transport Info</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Liability (ZAR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-40" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic text-sm">No forensic records found matching your criteria.</td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item?.batch_id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-white transition-colors">
                          <Package size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 tracking-tight">#{item?.batch_id}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{item?.asset_name} ({item?.quantity} Units)</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={10} className="text-slate-300" />
                          <p className="text-[11px] font-bold text-slate-700">{item?.current_location}</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                          item?.batch_status === 'Success' ? 'bg-emerald-100 text-emerald-700' :
                          item?.batch_status === 'In-Transit' ? 'bg-amber-100 text-amber-700' :
                          item?.batch_status === 'Loss' ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {item?.batch_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                          <Truck size={12} className="text-slate-300" /> {item?.last_moved_by_truck || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                          <User size={12} className="text-slate-300" /> {item?.last_moved_by_driver || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className={`text-sm font-black ${item?.daily_accrued_liability > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        R {formatCurrency(item?.daily_accrued_liability)}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Accrued Total</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Showing {data.length} of {totalCount} Records
          </p>
          <div className="flex gap-2">
            <button 
              disabled={page === 0 || isLoading}
              onClick={() => setPage(p => p - 1)}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <button 
              disabled={(page + 1) * PAGE_SIZE >= totalCount || isLoading}
              onClick={() => setPage(p => p + 1)}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-all"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForensicTable;
