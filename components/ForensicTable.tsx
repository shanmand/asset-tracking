import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Search, Loader2, Package, Truck, User as UserIcon, MapPin, Calendar, ArrowLeft, ArrowRight } from 'lucide-react';

const ForensicTable = ({ selectedBranchId, onSelectBatch }) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 25;

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      console.log('Fetching forensic data with filters:', { selectedBranchId, searchQuery, startDate, endDate, page });
      let query = supabase
        .from('vw_batch_forensics')
        .select('*', { count: 'exact' });

      // 1. Search Logic
      if (searchQuery) {
        query = query.or(`batch_id.ilike.%${searchQuery}%,truck_plate.ilike.%${searchQuery}%,driver_name.ilike.%${searchQuery}%`);
      }

      // 2. Branch Filter Logic (Handling 'Consolidated')
      // If 'Consolidated' is selected, we skip the eq filter to show everything
      if (selectedBranchId && selectedBranchId !== 'Consolidated' && selectedBranchId !== '') {
        query = query.eq('branch_id', selectedBranchId);
        console.log('Applying branch filter:', selectedBranchId);
      }

      // 3. Date Range Logic
      if (startDate) {
        query = query.gte('transaction_date', startDate);
      }
      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }

      const { data: results, count, error } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .order('transaction_date', { ascending: false })
        .order('movement_id', { ascending: false });

      if (error) throw error;
      console.log('Fetched results:', results, 'Count:', count);
      setData(results || []);
      setTotalCount(count || 0);
      setFetchError(null);
    } catch (err: any) {
      console.error("Forensic Fetch Error:", err);
      setFetchError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, searchQuery, startDate, endDate, selectedBranchId]);

  // 4. Fixed Data Mapping Helper
  const getForensicDescription = (item) => {
    const date = new Date(item.transaction_date).toLocaleDateString('en-ZA');
    
    // Check if it's an internal move
    if (!item.truck_plate || item.truck_plate === 'N/A' || item.driver_name === 'Internal Staff') {
        return `INTERNAL TRANSFER at ${item.from_location_name} performed by Warehouse Staff`;
    }

    return `ON ${date}, ${item.driver_name} moved ${item.quantity} crates to ${item.to_location_name} using truck ${item.truck_plate}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Batch Forensic Intelligence</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Movement Traceability (v4.0)</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search Batch, Truck, or Driver..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase">Audit Period:</span>
          </div>
          <input 
            type="date" 
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-900"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(0); }}
          />
          <span className="text-slate-300 self-center text-xs">to</span>
          <input 
            type="date" 
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-900"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(0); }}
          />
          {(startDate || endDate || searchQuery) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); setSearchQuery(''); setPage(0); }}
              className="text-[10px] font-black text-rose-500 uppercase hover:text-rose-600 transition-colors"
            >
              Reset Intelligence Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Chain of Custody</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Units</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                      {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-64" /></td>
                    <td className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-rose-500 italic text-sm font-bold uppercase tracking-widest">
                    Error fetching forensic data: {fetchError}
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic text-sm font-bold uppercase tracking-widest">
                    No matching forensic data found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr 
                    key={item?.movement_id} 
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    onClick={() => onSelectBatch?.(item.batch_id)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-300" />
                        <p className="text-xs font-bold text-slate-600">{new Date(item?.transaction_date).toLocaleDateString('en-ZA')}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-white transition-colors">
                          <Package size={18} />
                        </div>
                        <p className="text-sm font-black text-slate-900 tracking-tight">#{item?.batch_id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">
                        {getForensicDescription(item)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-400 uppercase tracking-tighter">FROM: {item?.from_location_name}</span>
                        <ArrowRight size={10} className="text-slate-300" />
                        <span className="px-2 py-0.5 bg-slate-900 rounded text-[8px] font-black text-white uppercase tracking-tighter">TO: {item?.to_location_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="text-sm font-black text-slate-900">{item?.quantity}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Crates</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Audit Ledger: {data.length} of {totalCount} Traceable Movements
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