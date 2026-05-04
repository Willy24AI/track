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

declare global {
  interface Window {
    google: any;
    initGoogleMap?: () => void;
  }
}

// Smoothly animate marker movement instead of jumping
function animateMarker(marker: any, newPos: { lat: number; lng: number }) {
  const start = marker.getPosition();
  if (!start) {
    marker.setPosition(newPos);
    return;
  }
  const startLat = start.lat();
  const startLng = start.lng();
  const deltaLat = newPos.lat - startLat;
  const deltaLng = newPos.lng - startLng;
  const duration = 800;
  const startTime = performance.now();

  function step(now: number) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    marker.setPosition({
      lat: startLat + deltaLat * ease,
      lng: startLng + deltaLng * ease,
    });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Builds the HTML content for the map info window
function buildInfoContent(loc: Loc): string {
  return `<div style="font-family:system-ui;padding:6px;min-width:200px">
    <div style="font-weight:600;font-size:14px;margin-bottom:4px">${loc.name}</div>
    <div style="color:#666;font-size:12px">${loc.role || ''}</div>
    <div style="color:#888;font-size:11px;margin-top:4px;margin-bottom:10px">±${Math.round(loc.accuracy || 0)}m accuracy</div>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}"
       target="_blank" rel="noopener"
       style="display:inline-block;background:#185FA5;color:white;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500">
       🧭 Get directions
    </a>
  </div>`;
}

export default function Dashboard() {
  const [locations, setLocations] = useState<Record<string, Loc>>({});
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const mapDiv = useRef<HTMLDivElement>(null);

  // Load Google Maps script once
  useEffect(() => {
    if (window.google?.maps) {
      setMapReady(true);
      return;
    }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) {
      console.error('Missing NEXT_PUBLIC_GOOGLE_MAPS_KEY in .env.local');
      return;
    }
    window.initGoogleMap = () => setMapReady(true);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=initGoogleMap&loading=async`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapReady || !mapDiv.current || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(mapDiv.current, {
      center: { lat: 0.3340, lng: 32.5820 },
      zoom: 13,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, [mapReady]);

  // Initial load of latest locations
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

  // Realtime: every new location ping moves the marker
  useEffect(() => {
    const channel = supabase
      .channel('locations-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'locations' },
        async (payload) => {
          const newLoc = payload.new as any;
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

  // Sync markers when locations or map change
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google) return;
    Object.values(locations).forEach((loc) => {
      const pos = { lat: loc.lat, lng: loc.lng };

      if (markersRef.current[loc.worker_id]) {
        // Smoothly move existing marker (and its accuracy circle)
        const { marker, circle, info } = markersRef.current[loc.worker_id];
        animateMarker(marker, pos);
        circle.setCenter(pos);
        circle.setRadius(loc.accuracy || 20);
        // Update info window so directions point to latest position
        info.setContent(buildInfoContent(loc));
      } else {
        // Create a new big pin
        const initials = loc.name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();

        const svgPin = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72">
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
              </filter>
            </defs>
            <path d="M28 2 C13.6 2 2 13.6 2 28 c0 18 26 42 26 42 s26-24 26-42 C54 13.6 42.4 2 28 2 z"
                  fill="#E24B4A" stroke="white" stroke-width="3" filter="url(#shadow)"/>
            <circle cx="28" cy="28" r="14" fill="white"/>
            <text x="28" y="33" text-anchor="middle" fill="#185FA5"
                  font-family="Arial, sans-serif" font-size="13" font-weight="700">${initials}</text>
          </svg>`
        )}`;

        const marker = new window.google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: loc.name,
          icon: {
            url: svgPin,
            scaledSize: new window.google.maps.Size(56, 72),
            anchor: new window.google.maps.Point(28, 70),
          },
          animation: window.google.maps.Animation.DROP,
          zIndex: 1000,
        });

        // Accuracy circle (shows GPS precision)
        const circle = new window.google.maps.Circle({
          strokeColor: '#185FA5',
          strokeOpacity: 0.4,
          strokeWeight: 1,
          fillColor: '#185FA5',
          fillOpacity: 0.12,
          map: mapRef.current,
          center: pos,
          radius: loc.accuracy || 20,
          clickable: false,
        });

        const info = new window.google.maps.InfoWindow({
          content: buildInfoContent(loc),
        });
        marker.addListener('click', () => info.open(mapRef.current, marker));

        markersRef.current[loc.worker_id] = { marker, circle, info };
      }
    });
  }, [locations, mapReady]);

  const list = Object.values(locations);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 16px' }}>Worker locations</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div ref={mapDiv} style={{ height: 600, borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', background: '#eee' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((loc) => (
            <div
              key={loc.worker_id}
              style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: 12 }}
            >
              <div
                onClick={() => mapRef.current?.panTo({ lat: loc.lat, lng: loc.lng })}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ fontWeight: 500 }}>{loc.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{loc.role}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · ±{Math.round(loc.accuracy || 0)}m
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  {new Date(loc.recorded_at).toLocaleTimeString()}
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  marginTop: 10,
                  padding: '8px 12px',
                  background: '#185FA5',
                  color: 'white',
                  textAlign: 'center',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                🧭 Get directions
              </a>
            </div>
          ))}
          {list.length === 0 && <div style={{ color: '#888', fontSize: 14 }}>No active workers yet.</div>}
        </div>
      </div>
    </div>
  );
}