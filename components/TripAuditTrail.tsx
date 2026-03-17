
import React, { useState, useEffect } from 'react';
import { Search, Calendar, User, Truck, FileText, Printer, Loader2, Filter, ArrowRight, MapPin, Clock } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';

interface TripAuditRecord {
  movement_id: string;
  batch_id: string;
  movement_timestamp: string;
  quantity: number;
  route_instructions: string | null;
  from_location: string;
  to_location: string;
  driver_name: string;
  truck_plate: string;
  shift_start: string | null;
  shift_end: string | null;
  manual_end_time: string | null;
  shift_notes: string | null;
}

const TripAuditTrail: React.FC = () => {
  const [records, setRecords] = useState<TripAuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    driverName: '',
    truckPlate: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let query = supabase
        .from('vw_trip_audit_trail')
        .select('*')
        .gte('movement_timestamp', `${filters.startDate}T00:00:00`)
        .lte('movement_timestamp', `${filters.endDate}T23:59:59`);

      if (filters.driverName) {
        query = query.ilike('driver_name', `%${filters.driverName}%`);
      }
      if (filters.truckPlate) {
        query = query.ilike('truck_plate', `%${filters.truckPlate}%`);
      }

      const { data, error } = await query.order('movement_timestamp', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error("Error fetching trip audit trail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Filters Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg">
              <Filter size={20} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Audit Filters</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Refine Trip History</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchData}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2"
            >
              <Search size={16} /> Apply Filters
            </button>
            <button 
              onClick={handlePrint}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2"
            >
              <Printer size={16} /> Print Audit Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={12} /> Start Date
            </label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={12} /> End Date
            </label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <User size={12} /> Driver Name
            </label>
            <input 
              type="text"
              placeholder="Search driver..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.driverName}
              onChange={e => setFilters({...filters, driverName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Truck size={12} /> Truck Plate
            </label>
            <input 
              type="text"
              placeholder="Search truck..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.truckPlate}
              onChange={e => setFilters({...filters, truckPlate: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Report Header for Print */}
      <div className="hidden print:block mb-8 border-b-4 border-slate-900 pb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">TRIP AUDIT REPORT</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">CrateTrack SA — Logistics Intelligence</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Generated</p>
            <p className="text-sm font-bold text-slate-900">{new Date().toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period Coverage</p>
            <p className="text-sm font-bold text-slate-900">{filters.startDate} to {filters.endDate}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Trips Logged</p>
            <p className="text-sm font-bold text-slate-900">{records.length} Movements</p>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <Loader2 className="animate-spin text-slate-300 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling Audit Trail...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <FileText className="text-slate-200 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No trips found for selected criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {records.map((record) => (
              <div key={record.movement_id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all print:shadow-none print:border-slate-300 break-inside-avoid">
                <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg print:shadow-none">
                      <Truck size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">{record.truck_plate}</h4>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1">
                        <User size={10} /> {record.driver_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Movement Time</p>
                      <p className="text-sm font-bold text-slate-900">{new Date(record.movement_timestamp).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                      <p className="text-lg font-black text-emerald-600">{record.quantity} Units</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <MapPin size={10} /> Origin
                        </p>
                        <p className="text-sm font-bold text-slate-900">{record.from_location}</p>
                      </div>
                      <ArrowRight className="text-slate-300" size={20} />
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <MapPin size={10} /> Destination
                        </p>
                        <p className="text-sm font-bold text-slate-900">{record.to_location}</p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <FileText size={10} /> Route & Instructions
                      </p>
                      <p className="text-xs font-medium text-slate-700 italic leading-relaxed">
                        {record.route_instructions || 'No specific instructions logged for this trip.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Clock size={10} /> Shift Start
                        </p>
                        <p className="text-xs font-bold text-blue-900">
                          {record.shift_start ? new Date(record.shift_start).toLocaleTimeString() : 'N/A'}
                        </p>
                      </div>
                      <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Clock size={10} /> Shift End
                        </p>
                        <p className="text-xs font-bold text-rose-900">
                          {record.manual_end_time 
                            ? new Date(record.manual_end_time).toLocaleTimeString() 
                            : record.shift_end 
                              ? new Date(record.shift_end).toLocaleTimeString() 
                              : 'Active'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <FileText size={10} /> Shift Notes
                      </p>
                      <p className="text-xs font-medium text-slate-700 italic leading-relaxed">
                        {record.shift_notes || 'No shift notes recorded.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TripAuditTrail;
