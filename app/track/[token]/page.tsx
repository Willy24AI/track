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
  const [accuracy, setAccuracy] = useState<number | null>(null);
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

    setError(null);
    setTracking(true);

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy: acc, speed, heading } = pos.coords;
        setAccuracy(acc);
        const { error } = await supabase.rpc('record_location', {
          p_token: token,
          p_lat: latitude,
          p_lng: longitude,
          p_accuracy: acc,
          p_speed: speed,
          p_heading: heading,
        });
        if (!error) {
          setLastSent(new Date());
          setPingsCount((n) => n + 1);
        }
      },
      (err) => {
        // Code 3 = timeout. Don't crash tracking — browser keeps retrying internally.
        if (err.code === 3) {
          console.log('GPS timeout — will retry automatically');
          return;
        }
        // Code 1 = permission denied, Code 2 = position unavailable
        setError(`GPS error: ${err.message}`);
        setTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 60000,
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

  // Give consent then start
  const acceptAndStart = async () => {
    await supabase.rpc('give_consent', { p_token: token });
    if (worker) setWorker({ ...worker, consent_given_at: new Date().toISOString() });
    startTracking();
  };

  // Keep screen awake while tracking
  useEffect(() => {
    let wakeLock: any = null;
    if (tracking && 'wakeLock' in navigator) {
      (navigator as any).wakeLock
        .request('screen')
        .then((wl: any) => (wakeLock = wl))
        .catch(() => {});
    }
    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [tracking]);

  // Re-acquire wake lock when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && tracking && 'wakeLock' in navigator) {
        (navigator as any).wakeLock.request('screen').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tracking]);

  if (error)
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: '#A32D2D', margin: '0 0 16px' }}>{error}</p>
          {worker && (
            <button onClick={startTracking} style={primaryBtn}>
              Try again
            </button>
          )}
        </div>
      </div>
    );

  if (!worker)
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p>Loading…</p>
        </div>
      </div>
    );

  // Consent screen
  if (!worker.consent_given_at) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 16px' }}>
            Hello, {worker.name}
          </h1>
          <p style={{ lineHeight: 1.6, color: '#444', margin: '0 0 16px' }}>
            Your employer is requesting permission to track your location during working hours
            using this device.
          </p>
          <ul style={{ lineHeight: 1.7, color: '#444', paddingLeft: 20, margin: '0 0 20px' }}>
            <li>Tracking only works while this page is open and your screen is on.</li>
            <li>You can stop tracking at any time by closing this tab.</li>
            <li>Your location is shared with your employer only.</li>
          </ul>
          <button onClick={acceptAndStart} style={primaryBtn}>
            I consent — start tracking
          </button>
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
              animation: tracking ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
            {tracking ? 'Tracking active' : 'Tracking paused'}
          </h1>
        </div>
        <p style={{ color: '#666', margin: '0 0 20px', fontSize: 14 }}>
          {worker.name} · keep this tab open and screen on
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Stat label="Pings sent" value={String(pingsCount)} />
          <Stat label="Last update" value={lastSent ? timeAgo(lastSent) : '—'} />
          <Stat
            label="Accuracy"
            value={accuracy ? `±${Math.round(accuracy)}m` : '—'}
          />
          <Stat
            label="Status"
            value={tracking ? 'Active' : 'Paused'}
          />
        </div>
        {tracking ? (
          <button
            onClick={stopTracking}
            style={{ ...primaryBtn, background: '#A32D2D' }}
          >
            Stop tracking
          </button>
        ) : (
          <button onClick={startTracking} style={primaryBtn}>
            Resume tracking
          </button>
        )}
        <p
          style={{
            fontSize: 11,
            color: '#999',
            textAlign: 'center',
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          If you close this tab or lock your phone for too long, tracking will pause.
        </p>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#f6f5f0', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500 }}>{value}</div>
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