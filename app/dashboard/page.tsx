'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Loc = {
  worker_id: string;
  name: string;
  role: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
};

export default function Dashboard() {
  const [locations, setLocations] = useState<Record<string, Loc>>({});
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const mapDiv = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('latest_locations').select('*');
      if (data) {
        const m: Record<string, Loc> = {};
        data.forEach((l: Loc) => (m[l.worker_id] = l));
        setLocations(m);
      }
    })();
  }, []);

  // Realtime subscription — every new location ping refreshes the map
  useEffect(() => {
    const channel = supabase
      .channel('locations-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations' },
        async (payload) => {
          const newLoc = payload.new as any;
          // Fetch worker name
          const { data: worker } = await supabase
            .from('workers')
            .select('name, role')
            .eq('id', newLoc.worker_id)
            .single();
          if (worker) {
            setLocations((prev) => ({
              ...prev,
              [newLoc.worker_id]: { ...newLoc, name: worker.name, role: worker.role },
            }));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    // @ts-ignore — Leaflet loaded via CDN in layout
    const L = (window as any).L;
    if (!L) return;
    mapRef.current = L.map(mapDiv.current).setView([0.3340, 32.5820], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
  }, []);

  // Update markers when locations change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    Object.values(locations).forEach((loc) => {
      if (markersRef.current[loc.worker_id]) {
        markersRef.current[loc.worker_id].setLatLng([loc.lat, loc.lng]);
      } else {
        const initials = loc.name.split(' ').map((s) => s[0]).join('').slice(0, 2);
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:30px;height:30px;border-radius:50%;background:#185FA5;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:600">${initials}</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        });
        markersRef.current[loc.worker_id] = L.marker([loc.lat, loc.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`<b>${loc.name}</b><br>${loc.role || ''}`);
      }
    });
  }, [locations]);

  const list = Object.values(locations);
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 16px' }}>Worker locations</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div ref={mapDiv} style={{ height: 600, borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', background: '#eee' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((loc) => (
            <div key={loc.worker_id} style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 500 }}>{loc.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{loc.role}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · ±{Math.round(loc.accuracy || 0)}m
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                {new Date(loc.recorded_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {list.length === 0 && <div style={{ color: '#888', fontSize: 14 }}>No active workers yet.</div>}
        </div>
      </div>
    </div>
  );
}
