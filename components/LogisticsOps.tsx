
import React, { useState, useRef } from 'react';
import { Truck as TruckIcon, MapPin, ClipboardList, CheckCircle2, AlertTriangle, ArrowRight, User as UserIcon, Package, Zap, Camera, FileText, Trash2, X, UserCheck, ShieldAlert, Lock } from 'lucide-react';
import { MOCK_BATCHES, MOCK_LOCATIONS, MOCK_ASSETS, MOCK_INVENTORY, MOCK_MOVEMENTS } from '../constants';
import { MovementCondition, LocationType, AssetType, User as UserType, UserRole, Location, Batch, Truck as TruckType, Driver, AssetMaster, BatchMovement } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface LogisticsOpsProps {
  currentUser: UserType;
}

const LogisticsOps: React.FC<LogisticsOpsProps> = ({ currentUser }) => {
  const isReadOnly = currentUser.role === UserRole.EXECUTIVE;
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assetsMaster, setAssetsMaster] = useState<AssetMaster[]>([]);
  const [activeShifts, setActiveShifts] = useState<{driver_id: string, truck_id: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState(''); 
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [assets, setAssets] = useState<{ assetId: string, quantity: number, batchId?: string }[]>([]);
  const [condition, setCondition] = useState(MovementCondition.CLEAN);
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0]);
  const [thaanFile, setThaanFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [errors, setErrors] = useState<string[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'alert'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setLocations([]);
      setBatches([]);
      setTrucks([]);
      setDrivers([]);
      setAssetsMaster([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [locsRes, batchesRes, trucksRes, driversRes, assetsRes, shiftsRes] = await Promise.all([
        supabase.from('locations').select('*'),
        supabase.from('batches').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('asset_master').select('*'),
        supabase.from('driver_shifts').select('driver_id, truck_id').is('end_time', null)
      ]);

      if (shiftsRes.data) setActiveShifts(shiftsRes.data);
      if (locsRes.data) {
        setLocations(locsRes.data);
        if (locsRes.data.length > 0) {
          setOrigin(locsRes.data[0].id);
          if (locsRes.data.length > 3) setDestination(locsRes.data[3].id);
          else if (locsRes.data.length > 1) setDestination(locsRes.data[1].id);
        }
      }
      if (batchesRes.data) setBatches(batchesRes.data);
      if (trucksRes.data) {
        setTrucks(trucksRes.data);
        if (trucksRes.data.length > 0) setTruckId(trucksRes.data[0].id);
      }
      if (driversRes.data) {
        setDrivers(driversRes.data);
        if (driversRes.data.length > 0) setDriverId(driversRes.data[0].id);
      }
      if (assetsRes.data) {
        setAssetsMaster(assetsRes.data);
        if (assetsRes.data.length > 0) setAssets([{ assetId: assetsRes.data[0].id, quantity: 0 }]);
      }
    } catch (err) {
      console.error("Error fetching logistics data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleAddAsset = () => !isReadOnly && assetsMaster.length > 0 && setAssets([...assets, { assetId: assetsMaster[0].id, quantity: 0 }]);
  const handleRemoveAsset = (index: number) => !isReadOnly && setAssets(assets.filter((_, i) => i !== index));
  const handleAssetChange = (index: number, field: 'assetId' | 'quantity' | 'batchId', value: any) => {
    if (isReadOnly) return;
    const newAssets = [...assets];
    newAssets[index] = { ...newAssets[index], [field]: value };
    setAssets(newAssets);
  };

  const handleDriverChange = (id: string) => {
    setDriverId(id);
    const shift = activeShifts.find(s => s.driver_id === id);
    if (shift) {
      setTruckId(shift.truck_id);
    }
  };

  const handleCaptureMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    
    setErrors([]);
    const validationErrors: string[] = [];
    if (assets.some(a => !a.batchId)) validationErrors.push("Please select a Batch Reference for all items.");
    if (assets.some(a => a.quantity <= 0)) validationErrors.push("All line items must have a quantity > 0.");
    if (origin === destination) validationErrors.push("Origin and Destination cannot be the same.");
    if (!truckId) validationErrors.push("Please select a truck.");
    if (!driverId) validationErrors.push("Please select a driver.");
    
    const destType = locations.find(l => l.id === destination)?.type;
    if (destType === LocationType.AT_CUSTOMER && !thaanFile) {
      validationErrors.push("Customer delivery requires a THAAN Slip upload.");
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    let firstTargetBatchId: string | null = null;

    try {
      if (isSupabaseConfigured) {
        for (const item of assets) {
          const { data: batch, error: fetchError } = await supabase
            .from('batches')
            .select('*')
            .eq('id', item.batchId)
            .single();

          if (fetchError || !batch) throw new Error(`Could not find Batch ${item.batchId}`);
          if (batch.quantity < item.quantity) {
            throw new Error(`Insufficient quantity in Batch ${item.batchId}. Available: ${batch.quantity}`);
          }

          let targetBatchId = item.batchId;

          // Handle Partial Movement
          if (item.quantity < batch.quantity) {
            // Use RPC to split the batch atomically
            const { data: newBatchId, error: splitError } = await supabase.rpc('split_batch', {
              original_batch_id: item.batchId,
              move_qty: item.quantity,
              new_location_id: destination,
              move_date: movementDate
            });

            if (splitError) throw splitError;
            targetBatchId = newBatchId as string;
          } else {
            // Full Movement
            const { error: updateError } = await supabase
              .from('batches')
              .update({ 
                current_location_id: destination,
                status: destType === LocationType.IN_TRANSIT ? 'In-Transit' : 'Success',
                transaction_date: movementDate
              })
              .eq('id', item.batchId);

            if (updateError) throw updateError;
          }

          if (!firstTargetBatchId) firstTargetBatchId = targetBatchId;

          // Record the movement
          const { error: moveError } = await supabase
            .from('batch_movements')
            .insert([{
              batch_id: String(targetBatchId),
              from_location_id: String(origin),
              to_location_id: String(destination),
              truck_id: String(truckId),
              driver_id: String(driverId),
              timestamp: new Date(movementDate).toISOString(),
              condition: condition,
              origin_user_id: String(currentUser.id)
            }]);

          if (moveError) throw moveError;
        }

        if (thaanFile && firstTargetBatchId) {
          const fileExt = thaanFile.name.split('.').pop();
          const fileName = `${firstTargetBatchId}-${Math.random()}.${fileExt}`;
          const filePath = `thaan-slips/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('thaan-slips')
            .upload(filePath, thaanFile);

          if (uploadError) {
            if (uploadError.message.includes('bucket not found')) {
              throw new Error("Storage bucket 'thaan-slips' not found. Please create it in your Supabase dashboard or run the SQL in the 'Schema & Migrations' tab.");
            }
            throw uploadError;
          }

          const { data: publicUrlData } = supabase.storage
            .from('thaan-slips')
            .getPublicUrl(filePath);

          await supabase
            .from('thaan_slips')
            .insert([{
              batch_id: firstTargetBatchId,
              doc_url: publicUrlData.publicUrl,
              is_signed: true,
              signed_at: new Date().toISOString()
            }]);
        }
      } else {
        // Mock success for development
        console.warn("Supabase not configured. Simulating movement capture success.");
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      setNotification({ message: "Manifest logged & batches updated successfully.", type: 'success' });
      if (assetsMaster.length > 0) {
        setAssets([{ assetId: assetsMaster[0].id, quantity: 0 }]);
      }
      setThaanFile(null);
      fetchData(); // Refresh data
    } catch (err: any) {
      console.error("Movement capture error:", err);
      setNotification({ message: err.message || "Failed to record movement.", type: 'alert' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const selectedTruck = trucks.find(t => t.id === truckId);
  const selectedDriver = drivers.find(d => d.id === driverId);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-center gap-4 animate-in fade-in">
          <ShieldAlert className="text-amber-500" size={24} />
          <div>
            <p className="text-sm font-bold text-amber-900 uppercase">Executive Read-Only Mode</p>
            <p className="text-xs text-amber-700 font-medium">Capture controls are disabled for your profile level. Operations must be logged by Crates Dept staff.</p>
          </div>
        </div>
      )}

      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right max-w-md ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          <p className="text-sm font-bold">{notification.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${isReadOnly ? 'opacity-60 cursor-not-allowed select-none' : ''}`}>
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm uppercase tracking-widest">Movement Manifest</h3>
              </div>
              {isReadOnly && <Lock size={14} className="text-slate-500" />}
            </div>

            <form onSubmit={handleCaptureMovement} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <MapPin size={14} className="text-emerald-500" /> Origin Location
                  </span>
                  <select 
                    disabled={isReadOnly}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                  >
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <MapPin size={14} className="text-rose-500" /> Destination
                  </span>
                  <select 
                    disabled={isReadOnly}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 outline-none"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                  >
                    <optgroup label="Internal Facilities">
                      {locations.filter(l => l.category === 'Home').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </optgroup>
                    <optgroup label="Customers & Partners">
                      {locations.filter(l => l.category === 'External' && l.type !== LocationType.IN_TRANSIT).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </optgroup>
                    <optgroup label="Trucks (In-Transit)">
                      {locations.filter(l => l.type === LocationType.IN_TRANSIT).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </optgroup>
                  </select>
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Assets & Quantities</span>
                    <p className="text-[10px] text-slate-400 font-medium">Select batches currently located at the Origin</p>
                  </div>
                  {!isReadOnly && <button type="button" onClick={handleAddAsset} className="text-[10px] font-bold text-emerald-600 hover:underline uppercase tracking-widest">Add Row</button>}
                </div>
                <div className="space-y-3">
                  {assets.map((a, idx) => {
                    const availableBatches = batches.filter(b => b.current_location_id === origin);
                    return (
                      <div key={idx} className="flex flex-col gap-2">
                        <div className="flex gap-3">
                          <select 
                            disabled={isReadOnly}
                            className={`flex-1 border rounded-xl p-3 text-sm bg-white outline-none transition-all ${!a.batchId ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'}`}
                            value={a.batchId || ''}
                            onChange={e => handleAssetChange(idx, 'batchId', e.target.value)}
                          >
                            <option value="">Select Batch at Origin</option>
                            {availableBatches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.id} — {assetsMaster.find(am => am.id === b.asset_id)?.name} ({b.quantity} available)
                              </option>
                            ))}
                          </select>
                          <input 
                            disabled={isReadOnly}
                            type="number" 
                            placeholder="Qty"
                            className="w-32 border border-slate-200 rounded-xl p-3 text-sm bg-white outline-none"
                            value={a.quantity || ''}
                            onChange={e => handleAssetChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                          />
                          {!isReadOnly && assets.length > 1 && (
                            <button type="button" onClick={() => handleRemoveAsset(idx)} className="p-3 text-slate-300 hover:text-rose-500">
                              <X size={18} />
                            </button>
                          )}
                        </div>
                        {availableBatches.length === 0 && (
                          <p className="text-[9px] text-rose-500 font-bold uppercase px-1">
                            No batches found at this origin. Use "Inventory Intake" to create one.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isReadOnly && (
                <>
                  <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><TruckIcon size={14} /> Select Truck</h4>
                      <select 
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white"
                        value={truckId}
                        onChange={e => setTruckId(e.target.value)}
                      >
                        <option value="">Select Truck</option>
                        {trucks.map(t => <option key={t.id} value={t.id}>{t.plate_number}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><UserIcon size={14} /> Select Driver</h4>
                      <select 
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white"
                        value={driverId}
                        onChange={e => handleDriverChange(e.target.value)}
                      >
                        <option value="">Select Driver</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><ClipboardList size={14} /> Movement Date</h4>
                      <input 
                        type="date"
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm bg-white"
                        value={movementDate}
                        onChange={e => setMovementDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* THAAN Slip Upload Section - Always visible for better UX */}
                  <div className={`p-6 rounded-2xl border transition-all space-y-4 ${locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">THAAN Slip / Proof of Delivery</h4>
                            {locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER && (
                              <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded uppercase tracking-widest animate-pulse">Required</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Upload signed manifest or delivery note</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg ${locations.find(l => l.id === destination)?.type === LocationType.AT_CUSTOMER ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200' : 'bg-slate-800 text-white hover:bg-slate-700 shadow-slate-200'}`}
                      >
                        {thaanFile ? 'Change File' : 'Upload Slip'}
                      </button>
                    </div>
                    
                    <input 
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={e => setThaanFile(e.target.files?.[0] || null)}
                    />

                    {thaanFile && (
                      <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl border border-slate-200 shadow-inner">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md">
                            <CheckCircle2 size={14} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{thaanFile.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setThaanFile(null)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {errors.length > 0 && (
                    <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 space-y-1">
                      {errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-medium text-rose-600"><AlertTriangle size={12} /> {err}</div>
                      ))}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? 'Syncing...' : 'RECORD MOVEMENT'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-4">Unit Summary</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg"><TruckIcon size={24} /></div>
              <div>
                <p className="text-lg font-bold text-slate-800 leading-none mb-1">{selectedTruck?.plate_number || 'Unassigned'}</p>
                <p className="text-xs text-slate-500">{selectedDriver?.full_name || 'No Driver'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsOps;
