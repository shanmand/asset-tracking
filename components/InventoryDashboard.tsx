
import React from 'react';
import { MOCK_LOCATIONS, MOCK_BATCHES, MOCK_ASSETS, MOCK_FEES } from '../constants';
import { MapPin, ThermometerSnowflake, Truck, ShoppingCart, Home, Building2, TrendingUp, Info } from 'lucide-react';
import { LocationType, LocationCategory } from '../types';

const InventoryDashboard: React.FC = () => {
  // Logic: Calculate accrued costs for batches at locations
  const calculateAccruedCost = (batchId: string) => {
    const batch = MOCK_BATCHES.find(b => b.id === batchId);
    if (!batch) return 0;

    const fee = MOCK_FEES.find(f => f.asset_id === batch.asset_id && f.effective_to === null);
    if (!fee) return 0;

    const days = Math.floor((Date.now() - new Date(batch.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return days * fee.amount_zar * batch.quantity;
  };

  const getInventoryAtLocation = (locationId: string) => {
    return MOCK_BATCHES.filter(b => b.current_location_id === locationId);
  };

  const getLocationIcon = (type: LocationType) => {
    switch (type) {
      case LocationType.COLD_STORAGE: return <ThermometerSnowflake className="text-blue-500" />;
      case LocationType.IN_TRANSIT: return <Truck className="text-amber-500" />;
      case LocationType.AT_CUSTOMER: return <ShoppingCart className="text-rose-500" />;
      case LocationType.CRATES_DEPT: return <Home className="text-emerald-500" />;
      default: return <Building2 className="text-slate-400" />;
    }
  };

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalGlobalLiability = MOCK_BATCHES.reduce((acc, b) => acc + calculateAccruedCost(b.id), 0);

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Global Possessive Liability</p>
          <p className="text-3xl font-bold">R {formatCurrency(totalGlobalLiability)}</p>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-2 uppercase">
            <TrendingUp size={12} /> Accruing in real-time
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Home Locations</p>
            <p className="text-2xl font-bold text-slate-800">
              {MOCK_LOCATIONS.filter(l => l.category === LocationCategory.HOME).length} Units
            </p>
          </div>
          <Home className="text-emerald-500 opacity-20" size={40} />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">External Storage</p>
            <p className="text-2xl font-bold text-slate-800">
              {MOCK_LOCATIONS.filter(l => l.type === LocationType.COLD_STORAGE).length} Sites
            </p>
          </div>
          <ThermometerSnowflake className="text-blue-500 opacity-20" size={40} />
        </div>
      </div>

      {/* Location Map View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
           <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
             <MapPin size={16} className="text-rose-500" /> Multi-Site Live Map Summary
           </h3>
           <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Home</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Cold Storage</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> In Transit</span>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-x divide-y divide-slate-100">
          {MOCK_LOCATIONS.map(loc => {
            const inventory = getInventoryAtLocation(loc.id);
            const locationCost = inventory.reduce((acc, b) => acc + calculateAccruedCost(b.id), 0);
            const totalUnits = inventory.reduce((acc, b) => acc + b.quantity, 0);

            return (
              <div key={loc.id} className="p-6 hover:bg-slate-50/50 transition-colors space-y-4">
                <div className="flex items-start justify-between">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white border border-slate-100 shadow-sm`}>
                        {getLocationIcon(loc.type)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 leading-tight">{loc.name}</p>
                        <p className={`text-[10px] font-bold uppercase ${loc.category === LocationCategory.HOME ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {loc.category} • {loc.type}
                        </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">{totalUnits}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Total Units</p>
                   </div>
                </div>

                <div className="space-y-2">
                   {inventory.length > 0 ? inventory.map(batch => (
                     <div key={batch.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[11px]">
                        <span className="font-bold text-slate-600">Batch #{batch.id}</span>
                        <span className="text-slate-400">{MOCK_ASSETS.find(a => a.id === batch.asset_id)?.name}</span>
                        <span className="font-bold text-slate-800">{batch.quantity}</span>
                     </div>
                   )) : (
                     <div className="text-center py-2 text-[10px] text-slate-300 italic">No Active Load</div>
                   )}
                </div>

                <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
                   <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Accrued Cost</p>
                      <p className={`font-bold ${locationCost > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        R {formatCurrency(locationCost)}
                      </p>
                   </div>
                   <button className="text-[10px] font-bold text-blue-600 hover:underline">Audits (v2.1)</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Possession Logic Notice */}
      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4">
         <Info className="text-blue-500 shrink-0" size={24} />
         <div>
            <h4 className="font-bold text-blue-900 text-sm">Cold Storage Possession Policy</h4>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              Assets located at <strong>External Cold Storage</strong> sites are considered 'In Possession'. 
              Daily rental fees continue to accrue as these locations are managed as high-possession vaults. 
              Only successful transfers to <strong>'At Customer'</strong> or <strong>'Returning to Supplier'</strong> locations (with signed THAAN slips) pause the possession timer.
            </p>
         </div>
      </div>
    </div>
  );
};

export default InventoryDashboard;
