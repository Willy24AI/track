'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Worker = {
  id: string;
  name: string;
  role: string | null;
  consent_given_at: string | null;
};

export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [pingsCount, setPingsCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  // Load worker info from token
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_worker_by_token', {
        p_token: token,
      });

      if (error || !data?.length) {
        setError('Invalid or expired tracking link. Contact your supervisor.');
        return;
      }

      setWorker(data[0]);
    })();
  }, [token]);

  // Start GPS watch
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support GPS.');
      return;
    }

    if (watchIdRef.current !== null) return;

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        setTracking(true);
        setError(null);

        const { latitude, longitude, accuracy, speed, heading } = pos.coords;

        const { error } = await supabase.rpc('record_location', {
          p_token: token,
          p_lat: latitude,
          p_lng: longitude,
          p_accuracy: accuracy,
          p_speed: speed,
          p_heading: heading,
        });

        if (!error) {
          setLastSent(new Date());
          setPingsCount((n) => n + 1);
        }
      },
      (err) => {
        setTracking(false);
        setError(`GPS error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    watchIdRef.current = id;
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTracking(false);
  };

  // Automatically start tracking once the worker link is valid.
  // Office agreements handle consent; the browser will still request GPS permission.
  useEffect(() => {
    if (!worker || tracking || watchIdRef.current !== null) return;
    startTracking();
  }, [worker, tracking]);

  // Keep screen awake while tracking
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    if (tracking && 'wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then((wl) => (wakeLock = wl)).catch(() => {});
    }

    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [tracking]);

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: '#A32D2D' }}>{error}</p>
          <button onClick={startTracking} style={primaryBtn}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  // Tracking active screen
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: tracking ? '#1D9E75' : '#888',
            }}
          />
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
            {tracking ? 'Tracking active' : 'Starting tracking…'}
          </h1>
        </div>

        <p style={{ color: '#666', margin: '0 0 20px' }}>
          {worker.name} · keep this tab open and screen on
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <Stat label="Pings sent" value={String(pingsCount)} />
          <Stat label="Last update" value={lastSent ? timeAgo(lastSent) : '—'} />
        </div>

        {tracking ? (
          <button onClick={stopTracking} style={{ ...primaryBtn, background: '#A32D2D' }}>
            Stop tracking
          </button>
        ) : (
          <button onClick={startTracking} style={primaryBtn}>
            Start tracking
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f6f5f0', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function timeAgo(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: '#fafaf7',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 12,
  padding: 24,
  maxWidth: 420,
  width: '100%',
  border: '0.5px solid rgba(0,0,0,0.1)',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#1D9E75',
  color: 'white',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
};
