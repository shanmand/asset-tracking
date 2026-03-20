import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Calendar, Plus, CheckCircle2, User, AlertCircle, Loader2, Trash2, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Trip, TripStop, Driver, Truck as TruckType, Source } from '../types';

/* -----------------------------
   UTILS: HAVERSINE DISTANCE
------------------------------ */
const toRad = (value: number) => (value * Math.PI) / 180;

const getDistanceKm = (a: any, b: any) => {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return 0;

  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

/* -----------------------------
   ROUTE OPTIMISATION
------------------------------ */
const optimiseRoute = (start: any, stops: any[], locations: any[]) => {
  const ordered: any[] = [];
  let current = locations.find(l => l.id === start);

  const remaining = [...stops];

  while (remaining.length > 0) {
    let closestIdx = 0;
    let closestDist = Infinity;

    remaining.forEach((stop, i) => {
      const loc = locations.find(l => l.id === stop.location_id);
      const dist = getDistanceKm(current, loc);

      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    const next = remaining.splice(closestIdx, 1)[0];
    ordered.push(next);
    current = locations.find(l => l.id === next.location_id);
  }

  return ordered;
};

const TripManagement: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [locations, setLocations] = useState<Source[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [tripStops, setTripStops] = useState<TripStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [fuelPrice, setFuelPrice] = useState(25); // R/litre

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);

    const [t, d, tr, l] = await Promise.all([
      supabase.from('trips').select('*'),
      supabase.from('drivers').select('*'),
      supabase.from('trucks').select('*'),
      supabase.from('vw_all_sources').select('*')
    ]);

    setTrips(t.data || []);
    setDrivers(d.data || []);
    setTrucks(tr.data || []);
    setLocations(l.data || []);
    setIsLoading(false);
  };

  const fetchStops = async (id: string) => {
    const { data } = await supabase
      .from('trip_stops')
      .select('*')
      .eq('trip_id', id)
      .order('sequence_number');

    setTripStops(data || []);
  };

  /* -----------------------------
     DISTANCE + COST
  ------------------------------ */
  const calculateTotals = () => {
    if (!selectedTrip) return null;

    const start = locations.find(l => l.id === selectedTrip.start_location_id);
    let totalKm = 0;
    let current = start;

    tripStops.forEach(stop => {
      const loc = locations.find(l => l.id === stop.location_id);
      totalKm += getDistanceKm(current, loc);
      current = loc;
    });

    const truck = trucks.find(t => t.id === selectedTrip.truck_id);
    const consumption = truck?.fuel_consumption || 30;

    const litres = (totalKm / 100) * consumption;
    const cost = litres * fuelPrice;

    return { totalKm, litres, cost };
  };

  const totals = calculateTotals();

  /* -----------------------------
     OPTIMISE ROUTE
  ------------------------------ */
  const handleOptimise = async () => {
    if (!selectedTrip) return;

    const optimised = optimiseRoute(
      selectedTrip.start_location_id,
      tripStops,
      locations
    );

    for (let i = 0; i < optimised.length; i++) {
      await supabase
        .from('trip_stops')
        .update({ sequence_number: i + 1 })
        .eq('id', optimised[i].id);
    }

    fetchStops(selectedTrip.id);
  };

  /* ----------------------------- */

  if (isLoading) {
    return <Loader2 className="animate-spin m-10" />;
  }

  return (
    <div className="p-6 space-y-6">

      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Logistics Engine</h2>

        <div className="flex items-center gap-2">
          <span>Fuel (R/L):</span>
          <input
            type="number"
            value={fuelPrice}
            onChange={e => setFuelPrice(parseFloat(e.target.value))}
            className="border p-1 w-20"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">

        {/* TRIPS */}
        <div>
          {trips.map(t => (
            <div
              key={t.id}
              onClick={() => {
                setSelectedTrip(t);
                fetchStops(t.id);
              }}
              className="p-3 border cursor-pointer"
            >
              {t.route_name}
            </div>
          ))}
        </div>

        {/* DETAILS */}
        <div className="col-span-2">

          {selectedTrip && (
            <>
              <h3 className="text-lg font-bold">{selectedTrip.route_name}</h3>

              {/* KPIs */}
              {totals && (
                <div className="grid grid-cols-3 gap-3 my-4">
                  <div className="p-3 bg-gray-100">
                    KM: {totals.totalKm.toFixed(1)}
                  </div>
                  <div className="p-3 bg-gray-100">
                    Fuel: {totals.litres.toFixed(1)} L
                  </div>
                  <div className="p-3 bg-gray-100">
                    Cost: R {totals.cost.toFixed(2)}
                  </div>
                </div>
              )}

              <button
                onClick={handleOptimise}
                className="bg-black text-white px-4 py-2 mb-4 flex items-center gap-2"
              >
                <Zap size={14}/> Optimise Route
              </button>

              {tripStops.map((stop, i) => (
                <div key={stop.id} className="flex justify-between border p-2">
                  <div>
                    {i + 1}. {locations.find(l => l.id === stop.location_id)?.name}
                  </div>
                </div>
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default TripManagement;