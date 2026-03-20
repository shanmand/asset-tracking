import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Calendar, Plus, ChevronRight, CheckCircle2, Clock, User, AlertCircle, Loader2, Save, Trash2, ArrowRight, ArrowUp, ArrowDown, Edit } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Trip, TripStop, Driver, Truck as TruckType, Source } from '../types';

const TripManagement: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [locations, setLocations] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showEditTripModal, setShowEditTripModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [tripStops, setTripStops] = useState<TripStop[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateTripId = () => `TRIP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;

  const [newTrip, setNewTrip] = useState({
    id: generateTripId(),
    driver_id: '',
    truck_id: '',
    start_location_id: '',
    route_name: '',
    status: 'Planned' as const,
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_departure_time: '08:00',
    start_odometer: 0,
    end_odometer: 0
  });

  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [tripsRes, driversRes, trucksRes, locationsRes] = await Promise.all([
        supabase.from('trips').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*').eq('is_active', true),
        supabase.from('trucks').select('*'),
        supabase.from('vw_all_sources').select('*')
      ]);

      if (tripsRes.data) setTrips(tripsRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
      if (trucksRes.data) setTrucks(trucksRes.data);
      if (locationsRes.data) setLocations(locationsRes.data);
    } catch (err) {
      console.error("Error fetching trip data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTripStops = async (tripId: string) => {
    const { data } = await supabase
      .from('trip_stops')
      .select('*')
      .eq('trip_id', tripId)
      .order('sequence_number', { ascending: true });
    
    if (data) setTripStops(data);
  };

  const handleCreateTrip = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('trips').insert([newTrip]);
      if (error) throw error;

      setShowNewTripModal(false);
      setNewTrip({
        id: generateTripId(),
        driver_id: '',
        truck_id: '',
        start_location_id: '',
        route_name: '',
        status: 'Planned',
        scheduled_date: new Date().toISOString().slice(0, 10),
        scheduled_departure_time: '08:00',
        start_odometer: 0,
        end_odometer: 0
      });

      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to create trip.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStop = async (tripId: string, locationId: string) => {
    const nextSeq = tripStops.length + 1;
    await supabase.from('trip_stops').insert([{
      trip_id: tripId,
      location_id: locationId,
      sequence_number: nextSeq,
      status: 'Pending'
    }]);
    fetchTripStops(tripId);
  };

  const handleDeleteStop = async (stopId: string) => {
    if (!window.confirm('Remove this stop?')) return;
    await supabase.from('trip_stops').delete().eq('id', stopId);

    if (selectedTrip) fetchTripStops(selectedTrip.id);
  };

  const handleMoveStop = async (stopId: string, direction: 'up' | 'down') => {
    const idx = tripStops.findIndex(s => s.id === stopId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= tripStops.length) return;

    const a = tripStops[idx];
    const b = tripStops[swapIdx];

    await Promise.all([
      supabase.from('trip_stops').update({ sequence_number: b.sequence_number }).eq('id', a.id),
      supabase.from('trip_stops').update({ sequence_number: a.sequence_number }).eq('id', b.id)
    ]);

    if (selectedTrip) fetchTripStops(selectedTrip.id);
  };

  const updateStopStatus = async (stopId: string, status: string) => {
    const updateData: any = { status };
    if (status === 'Arrived') updateData.actual_arrival = new Date().toISOString();
    if (status === 'Departed') updateData.actual_departure = new Date().toISOString();

    await supabase.from('trip_stops').update(updateData).eq('id', stopId);

    if (selectedTrip) fetchTripStops(selectedTrip.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 bg-slate-50 min-h-screen">

      {!isSupabaseConfigured && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-3xl flex items-center gap-4 text-amber-800">
          <AlertCircle size={20} />
          <p className="text-xs font-bold">Supabase not configured</p>
        </div>
      )}

      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-black">MULTI-STOP LOGISTICS</h2>
        <button onClick={() => setShowNewTripModal(true)} className="bg-black text-white px-6 py-3 rounded-xl">
          <Plus size={16}/> New Route
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">

        <div className="space-y-3">
          {trips.map(trip => (
            <div key={trip.id} onClick={() => {
              setSelectedTrip(trip);
              fetchTripStops(trip.id);
            }} className="p-4 bg-white rounded-xl border cursor-pointer">
              <h4 className="font-bold">{trip.route_name}</h4>
              <p className="text-xs text-gray-500">
                {drivers.find(d => d.id === trip.driver_id)?.full_name}
              </p>
            </div>
          ))}
        </div>

        <div className="col-span-2 bg-white rounded-xl p-6">
          {selectedTrip ? (
            <>
              <h3 className="font-bold text-lg mb-4">{selectedTrip.route_name}</h3>

              <select onChange={(e) => handleAddStop(selectedTrip.id, e.target.value)}>
                <option>Add Stop</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.display_name}</option>
                ))}
              </select>

              <div className="mt-4 space-y-3">
                {tripStops.map((stop, idx) => (
                  <div key={stop.id} className="flex justify-between border p-3 rounded">
                    <div>
                      {idx + 1}. {locations.find(l => l.id === stop.location_id)?.name}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleMoveStop(stop.id, 'up')}>
                        <ArrowUp size={14}/>
                      </button>
                      <button onClick={() => handleMoveStop(stop.id, 'down')}>
                        <ArrowDown size={14}/>
                      </button>
                      <button onClick={() => handleDeleteStop(stop.id)}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>Select a trip</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default TripManagement;