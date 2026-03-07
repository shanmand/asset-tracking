
import React, { useState, useRef } from 'react';
import { MOCK_BATCHES, MOCK_MOVEMENTS, MOCK_LOCATIONS, MOCK_FEES, MOCK_ASSETS, MOCK_THAANS } from '../constants';
import { Package, Truck, Clock, MapPin, CheckCircle2, AlertCircle, FileText, Zap, History, Camera, UploadCloud, XCircle, User } from 'lucide-react';
import { FeeType, ThaanSlip, Batch, BatchMovement, Location, Truck as TruckType, Driver, AssetMaster, FeeSchedule } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import BatchFinancialDetailCard from './BatchFinancialDetailCard';

const BatchTracker: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>(isSupabaseConfigured ? [] : MOCK_BATCHES);
  const [thaans, setThaans] = useState<ThaanSlip[]>(isSupabaseConfigured ? [] : MOCK_THAANS);
  const [movements, setMovements] = useState<BatchMovement[]>(isSupabaseConfigured ? [] : MOCK_MOVEMENTS);
  const [locations, setLocations] = useState<Location[]>(isSupabaseConfigured ? [] : MOCK_LOCATIONS);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>(isSupabaseConfigured ? [] : MOCK_FEES);
  const [assetsMaster, setAssetsMaster] = useState<AssetMaster[]>(isSupabaseConfigured ? [] : MOCK_ASSETS);
  
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setBatches([]);
      setThaans([]);
      setMovements([]);
      setLocations([]);
      setTrucks([]);
      setDrivers([]);
      setFees([]);
      setAssetsMaster([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [batchesRes, thaansRes, movesRes, locsRes, trucksRes, driversRes, feesRes, assetsRes] = await Promise.all([
        supabase.from('batches').select('*'),
        supabase.from('thaan_slips').select('*'),
        supabase.from('batch_movements').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('fee_schedule').select('*'),
        supabase.from('asset_master').select('*')
      ]);

      if (batchesRes.data) {
        setBatches(batchesRes.data);
        if (batchesRes.data.length > 0 && !selectedBatchId) {
          setSelectedBatchId(batchesRes.data[0].id);
        }
      }
      if (thaansRes.data) setThaans(thaansRes.data);
      if (movesRes.data) setMovements(movesRes.data);
      if (locsRes.data) setLocations(locsRes.data);
      if (trucksRes.data) setTrucks(trucksRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
      if (feesRes.data) setFees(feesRes.data);
      if (assetsRes.data) setAssetsMaster(assetsRes.data);
    } catch (err) {
      console.error("Error fetching batch tracker data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const currentBatch = batches.find(b => b.id === selectedBatchId);
  const currentMovements = movements.filter(m => m.batch_id === selectedBatchId);
  const asset = assetsMaster.find(a => a.id === currentBatch?.asset_id);
  const thaan = thaans.find(t => t.batch_id === selectedBatchId);

  const handleUploadThaan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBatchId) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedBatchId}-${Math.random()}.${fileExt}`;
      const filePath = `thaan-slips/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('thaan-slips')
        .upload(filePath, file);

      if (storageError) throw storageError;

      const { data: { publicUrl } } = supabase.storage
        .from('thaan-slips')
        .getPublicUrl(filePath);

      const { data: newThaanRecord, error: dbError } = await supabase
        .from('thaan_slips')
        .insert([{
          batch_id: selectedBatchId,
          doc_url: publicUrl,
          is_signed: true,
          signed_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      setThaans(prev => {
        const filtered = prev.filter(t => t.batch_id !== selectedBatchId);
        return [...filtered, newThaanRecord as ThaanSlip];
      });

      setBatches(prev => prev.map(b => b.id === selectedBatchId ? { ...b, status: 'Success' } : b));

    } catch (err: any) {
      setUploadError(err.message || "Failed to upload THAAN slip.");
    } finally {
      setIsUploading(false);
    }
  };

  const getFeeForBatch = () => {
    if (!currentBatch) return null;
    return fees.find(f => 
      f.asset_id === currentBatch.asset_id &&
      new Date(currentBatch.created_at) >= new Date(f.effective_from) &&
      (!f.effective_to || new Date(currentBatch.created_at) <= new Date(f.effective_to))
    );
  };

  const applicableFee = getFeeForBatch();
  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return <div className="p-20 text-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">Loading Batch Intelligence...</div>;
  }

  if (batches.length === 0) {
    return (
      <div className="p-20 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
        <Package className="mx-auto text-slate-200 mb-4" size={48} />
        <h3 className="font-bold text-slate-800 uppercase tracking-widest">No Batches Found</h3>
        <p className="text-sm text-slate-500 mt-2">Create a movement manifest to start tracking batches.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4 items-center">
        {batches.map(b => (
          <button 
            key={b.id}
            onClick={() => setSelectedBatchId(b.id)}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
              selectedBatchId === b.id 
                ? 'bg-slate-900 text-white ring-4 ring-slate-200' 
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {b.id} ({b.status})
          </button>
        ))}
      </div>

      {currentBatch && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
                <History size={20} className="text-emerald-500" />
                Movement History
              </h3>

              <div className="relative pl-8 border-l-2 border-slate-100 space-y-12">
                {currentMovements.map((mv, idx) => {
                  const from = locations.find(l => l.id === mv.from_location_id);
                  const to = locations.find(l => l.id === mv.to_location_id);
                  const truck = mv.truck_id ? trucks.find(t => t.id === mv.truck_id) : null;
                  const driver = mv.driver_id ? drivers.find(d => d.id === mv.driver_id) : null;

                  return (
                    <div key={mv.id} className="relative">
                      <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(mv.timestamp).toLocaleString('en-ZA')}</p>
                          <h4 className="font-bold text-slate-800 text-lg mt-1">{from?.name} &rarr; {to?.name}</h4>
                          <div className="flex gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${mv.condition === 'Clean' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{mv.condition}</span>
                            {truck && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Truck size={10} /> {truck.plate_number}</span>}
                            {driver && <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><User size={10} /> {driver.full_name}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {(currentBatch.status === 'Success' || thaan?.is_signed) && (
                  <div className="relative">
                    <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-emerald-600 ring-4 ring-emerald-100 flex items-center justify-center"><CheckCircle2 size={10} className="text-white" /></div>
                    <div>
                      <h4 className="font-bold text-emerald-600">Finalized - Delivery Confirmed</h4>
                      <p className="text-sm text-slate-500">All liability transferred to customer location.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <BatchFinancialDetailCard 
              batchId={selectedBatchId} 
              onUpdate={fetchData} 
            />

            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-slate-400" /> THAAN Slip</h3>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadThaan} />
              </div>
              
              {uploadError && (
                <div className="p-3 mb-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-lg border border-rose-100 flex items-center gap-2">
                  <AlertCircle size={14} /> {uploadError}
                </div>
              )}

              {thaan ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="aspect-[4/5] bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative group shadow-inner">
                    <img src={thaan.doc_url} alt="THAAN Slip" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold shadow-lg">Replace Image</button>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg flex items-center gap-3 bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <CheckCircle2 size={18} />
                    <span className="text-xs font-bold">Verified on {new Date(thaan.signed_at!).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full py-12 text-center bg-slate-50 rounded-lg border-2 border-dashed border-slate-200 hover:bg-slate-100 hover:border-emerald-300 transition-all group"
                >
                  <UploadCloud className="mx-auto text-slate-300 group-hover:text-emerald-500 mb-2" size={32} />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{isUploading ? 'Uploading to Supabase...' : 'Upload Signed Slip'}</p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchTracker;
