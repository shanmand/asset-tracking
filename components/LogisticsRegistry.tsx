
import React, { useState, useEffect } from 'react';
import { Truck, User, Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle, Search, Filter } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { LogisticsUnit } from '../types';

const LogisticsRegistry: React.FC = () => {
  const [logistics, setLogistics] = useState<LogisticsUnit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [newUnit, setNewUnit] = useState({
    truck_plate: '',
    driver_name: '',
    contact_number: ''
  });

  const fetchLogistics = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('logistics_units').select('*');
      if (error) throw error;
      setLogistics(data || []);
    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogistics();
  }, []);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('logistics_units').insert([newUnit]);
        if (error) throw error;
      }
      setNotification({ msg: `Unit ${newUnit.truck_plate} registered successfully`, type: 'success' });
      setIsAdding(false);
      setNewUnit({ truck_plate: '', driver_name: '', contact_number: '' });
      fetchLogistics();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to register unit", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to decommission this logistics unit?")) return;
    try {
      const { error } = await supabase.from('logistics_units').delete().eq('id', id);
      if (error) throw error;
      setLogistics(prev => prev.filter(l => l.id !== id));
      setNotification({ msg: "Unit decommissioned", type: 'success' });
    } catch (err: any) {
      setNotification({ msg: "Failed to delete unit", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const filtered = logistics.filter(l => 
    l.truck_plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.driver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Logistics Registry</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Manage Drivers & Vehicle Fleet</p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={fetchLogistics}
            className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex-1 lg:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus size={18} /> REGISTER NEW DRIVER/TRUCK
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">New Logistics Unit</h4>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <form onSubmit={handleAddUnit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Truck Plate Number</label>
              <input 
                required
                placeholder="e.g. CA 123-456"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newUnit.truck_plate}
                onChange={e => setNewUnit({...newUnit, truck_plate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Driver Full Name</label>
              <input 
                required
                placeholder="e.g. John Doe"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newUnit.driver_name}
                onChange={e => setNewUnit({...newUnit, driver_name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Number</label>
              <input 
                required
                placeholder="e.g. 071 234 5678"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newUnit.contact_number}
                onChange={e => setNewUnit({...newUnit, contact_number: e.target.value})}
              />
            </div>
            <div className="md:col-span-3 pt-4 border-t border-slate-100">
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all"
              >
                REGISTER LOGISTICS UNIT
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by plate or driver..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                <th className="px-8 py-5">Vehicle / Driver</th>
                <th className="px-8 py-5">Contact</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(unit => (
                <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner font-black text-lg group-hover:bg-white transition-colors">
                         <Truck size={24} />
                      </div>
                      <div>
                         <p className="text-sm font-black text-slate-900">{unit.truck_plate}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Driver: {unit.driver_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-xs font-bold text-slate-600">
                    {unit.contact_number}
                  </td>
                  <td className="px-8 py-5">
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-black text-slate-500 uppercase">Active</span>
                     </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => handleDelete(unit.id)}
                      className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <p className="text-sm font-bold text-slate-400">No logistics units registered.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LogisticsRegistry;
