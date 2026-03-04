
import React, { useState, useEffect } from 'react';
import { Truck as TruckIcon, User, Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle, Search, Filter } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Truck, Driver } from '../types';

const LogisticsRegistry: React.FC = () => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingTruck, setIsAddingTruck] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [newTruck, setNewTruck] = useState({
    id: '',
    plate_number: ''
  });

  const [newDriver, setNewDriver] = useState({
    id: '',
    full_name: '',
    contact_number: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const [trucksRes, driversRes] = await Promise.all([
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*')
      ]);
      if (trucksRes.data) setTrucks(trucksRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const id = `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('trucks').insert([{ ...newTruck, id }]);
      if (error) throw error;
      setNotification({ msg: `Truck ${newTruck.plate_number} registered`, type: 'success' });
      setIsAddingTruck(false);
      setNewTruck({ id: '', plate_number: '' });
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to register truck", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const id = `DRV-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('drivers').insert([{ ...newDriver, id }]);
      if (error) throw error;
      setNotification({ msg: `Driver ${newDriver.full_name} registered`, type: 'success' });
      setIsAddingDriver(false);
      setNewDriver({ id: '', full_name: '', contact_number: '' });
      fetchData();
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to register driver", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteTruck = async (id: string) => {
    if (!confirm("Decommission this truck?")) return;
    try {
      const { error } = await supabase.from('trucks').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert("Error deleting truck");
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!confirm("Remove this driver?")) return;
    try {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert("Error deleting driver");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.msg}</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Logistics Registry</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Fleet & Driver Management</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsAddingTruck(true)} className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-slate-200 transition-all">
            <TruckIcon size={18} /> ADD TRUCK
          </button>
          <button onClick={() => setIsAddingDriver(true)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
            <User size={18} /> ADD DRIVER
          </button>
        </div>
      </div>

      {/* Forms */}
      {isAddingTruck && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95">
          <h4 className="font-black text-sm uppercase tracking-widest mb-6">Register New Truck</h4>
          <form onSubmit={handleAddTruck} className="flex flex-col md:flex-row gap-4">
            <input 
              required
              placeholder="Plate Number (e.g. CA 123-456)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={newTruck.plate_number}
              onChange={e => setNewTruck({...newTruck, plate_number: e.target.value})}
            />
            <div className="flex gap-2">
              <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs">SAVE TRUCK</button>
              <button type="button" onClick={() => setIsAddingTruck(false)} className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl font-black text-xs">CANCEL</button>
            </div>
          </form>
        </div>
      )}

      {isAddingDriver && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95">
          <h4 className="font-black text-sm uppercase tracking-widest mb-6">Register New Driver</h4>
          <form onSubmit={handleAddDriver} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              required
              placeholder="Full Name"
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={newDriver.full_name}
              onChange={e => setNewDriver({...newDriver, full_name: e.target.value})}
            />
            <input 
              placeholder="Contact Number"
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={newDriver.contact_number}
              onChange={e => setNewDriver({...newDriver, contact_number: e.target.value})}
            />
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs">SAVE DRIVER</button>
              <button type="button" onClick={() => setIsAddingDriver(false)} className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl font-black text-xs">CANCEL</button>
            </div>
          </form>
        </div>
      )}

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trucks List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">Fleet (Trucks)</h4>
            <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-400">{trucks.length} Units</span>
          </div>
          <div className="divide-y divide-slate-50">
            {trucks.map(t => (
              <div key={t.id} className="px-8 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors">
                    <TruckIcon size={20} />
                  </div>
                  <span className="font-black text-slate-900">{t.plate_number}</span>
                </div>
                <button onClick={() => handleDeleteTruck(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
              </div>
            ))}
            {trucks.length === 0 && <div className="p-12 text-center text-slate-300 italic text-sm">No trucks registered</div>}
          </div>
        </div>

        {/* Drivers List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">Drivers</h4>
            <span className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-400">{drivers.length} Active</span>
          </div>
          <div className="divide-y divide-slate-50">
            {drivers.map(d => (
              <div key={d.id} className="px-8 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 leading-none">{d.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{d.contact_number || 'No Contact'}</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteDriver(d.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
              </div>
            ))}
            {drivers.length === 0 && <div className="p-12 text-center text-slate-300 italic text-sm">No drivers registered</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsRegistry;

