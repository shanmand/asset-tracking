
import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, 
  Plus, 
  Search, 
  Building2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Filter,
  Globe,
  Home,
  ExternalLink,
  Lock,
  MoreVertical,
  ShieldAlert
} from 'lucide-react';
import { MOCK_LOCATIONS } from '../constants';
import { LocationType, LocationCategory, Location, UserRole, Branch, PartnerType } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useUser } from '../UserContext';

const LocationManagement: React.FC = () => {
  const { profile } = useUser();
  const isAdmin = profile?.role_name === UserRole.ADMIN;

  const [locations, setLocations] = useState<Location[]>(isSupabaseConfigured ? [] : MOCK_LOCATIONS);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Branch Form State
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranch, setNewBranch] = useState({ id: '', name: '' });

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newLoc, setNewLoc] = useState({
    id: '',
    name: '',
    type: LocationType.WAREHOUSE,
    category: LocationCategory.EXTERNAL,
    branch_id: '',
    partner_type: PartnerType.INTERNAL
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setLocations(MOCK_LOCATIONS);
      return;
    }
    
    setIsLoading(true);
    try {
      const [locsRes, branchesRes] = await Promise.all([
        supabase.from('locations').select('*'),
        supabase.from('branches').select('*')
      ]);

      if (locsRes.error) throw locsRes.error;
      if (branchesRes.error) throw branchesRes.error;

      if (locsRes.data) setLocations(locsRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesSearch = 
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'All Categories' || loc.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [locations, searchQuery, categoryFilter]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('branches').insert([newBranch]);
        if (error) throw error;
      }
      setBranches(prev => [...prev, newBranch as Branch]);
      setNotification({ msg: `Branch "${newBranch.name}" created`, type: 'success' });
      setIsAddingBranch(false);
      setNewBranch({ id: '', name: '' });
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to create branch", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('locations')
          .insert([newLoc]);
        
        if (error) throw error;
      }

      setLocations(prev => [...prev, newLoc as Location]);
      setNotification({ msg: `Location "${newLoc.name}" created successfully`, type: 'success' });
      setIsAdding(false);
      setNewLoc({ 
        id: '', 
        name: '', 
        type: LocationType.WAREHOUSE, 
        category: LocationCategory.EXTERNAL,
        branch_id: '',
        partner_type: PartnerType.INTERNAL
      });
    } catch (err: any) {
      setNotification({ msg: err.message || "Failed to create location", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

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
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Location Registry</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Manage Logistics Origins & Destinations</p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={fetchData}
            className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setIsAddingBranch(true)}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
          >
            <Plus size={18} /> ADD BRANCH
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex-1 lg:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus size={18} /> ADD NEW LOCATION
          </button>
        </div>
      </div>

      {isAddingBranch && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">New Branch Entry</h4>
            <button onClick={() => setIsAddingBranch(false)} className="text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <form onSubmit={handleCreateBranch} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch ID</label>
              <input 
                required
                placeholder="e.g. BR-JHB"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newBranch.id}
                onChange={e => setNewBranch({...newBranch, id: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Name</label>
              <input 
                required
                placeholder="e.g. Johannesburg Main"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newBranch.name}
                onChange={e => setNewBranch({...newBranch, name: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all"
              >
                CONFIRM & PERSIST BRANCH
              </button>
            </div>
          </form>
        </div>
      )}

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">New Location Entry</h4>
            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <form onSubmit={handleCreateLocation} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location ID</label>
              <input 
                required
                placeholder="e.g. LOC-DBN-02"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newLoc.id}
                onChange={e => setNewLoc({...newLoc, id: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Friendly Name</label>
              <input 
                required
                placeholder="e.g. Durban North Depot"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newLoc.name}
                onChange={e => setNewLoc({...newLoc, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location Type</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newLoc.type}
                onChange={e => setNewLoc({...newLoc, type: e.target.value as LocationType})}
              >
                {Object.values(LocationType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newLoc.category}
                onChange={e => setNewLoc({...newLoc, category: e.target.value as LocationCategory})}
              >
                {Object.values(LocationCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partner Type</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newLoc.partner_type}
                onChange={e => setNewLoc({...newLoc, partner_type: e.target.value as PartnerType})}
              >
                {Object.values(PartnerType).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Branch Allocation</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={newLoc.branch_id}
                onChange={e => setNewLoc({...newLoc, branch_id: e.target.value})}
              >
                <option value="">Unallocated</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-3 pt-4 border-t border-slate-100">
              <button 
                type="submit"
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all"
              >
                CONFIRM & PERSIST LOCATION
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
              placeholder="Search by name or ID..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-slate-900"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option>All Categories</option>
                {Object.values(LocationCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                <th className="px-8 py-5">Location Identity</th>
                <th className="px-8 py-5">Branch / Partner</th>
                <th className="px-8 py-5">Functional Type</th>
                <th className="px-8 py-5">Network Category</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLocations.map(loc => (
                <tr key={loc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner font-black text-lg group-hover:bg-white transition-colors ${
                        loc.category === LocationCategory.HOME ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                         {loc.category === LocationCategory.HOME ? <Home size={20} /> : <MapPin size={20} />}
                      </div>
                      <div>
                         <p className="text-sm font-black text-slate-900">{loc.name}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {loc.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700">{branches.find(b => b.id === loc.branch_id)?.name || 'Unallocated'}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">{loc.partner_type}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {loc.type}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                     <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        {loc.category === LocationCategory.HOME ? (
                          <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                            <Building2 size={12} /> Internal Network
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                            <Globe size={12} /> External Partner
                          </span>
                        )}
                     </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2.5 bg-slate-50 rounded-xl text-slate-300 hover:text-slate-900 transition-all">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!isAdmin && (
        <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 flex items-center gap-4 shadow-2xl">
          <div className="p-3 bg-slate-800 rounded-2xl text-amber-500">
            <Lock size={24} />
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-tight">Administrative Lock Active</p>
            <p className="text-xs text-slate-400 font-medium">Location creation is restricted to System Administrators. You may view the registry but cannot modify the logistics network.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagement;
