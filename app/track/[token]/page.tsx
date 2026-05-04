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

const ORG_NAME = 'Mbarara Distribution Limited';
const ORG_SUB = 'Field Operations';
const ORG_INITIALS = 'MDL';

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

  const consented = !!worker?.consent_given_at;
  const headerTag = !worker
    ? 'Loading'
    : !consented
    ? 'Consent required'
    : tracking
    ? 'Tracking active'
    : 'Tracking paused';

  return (
    <main className="page">
      <section className="hero">
        <nav className="nav">
          <div className="brand">
            <div className="logo">{ORG_INITIALS}</div>
            <div>
              <div className="brandName">{ORG_NAME}</div>
              <div className="brandSub">{ORG_SUB}</div>
            </div>
          </div>
          <div className={`tag ${tracking ? 'tagLive' : ''}`}>
            {tracking && <span className="dot" />}
            {headerTag}
          </div>
        </nav>

        <div className="heroBody">
          {error && (
            <>
              <p className="eyebrow">Something went wrong</p>
              <h1>We could not start tracking</h1>
              <p className="intro">{error}</p>
              {worker && (
                <div className="actions">
                  <button onClick={startTracking} className="primaryBtn">
                    Try again
                  </button>
                </div>
              )}
            </>
          )}

          {!error && !worker && (
            <>
              <p className="eyebrow">Loading</p>
              <h1>Checking your tracking link…</h1>
            </>
          )}

          {!error && worker && !consented && (
            <>
              <p className="eyebrow">Consent required</p>
              <h1>Hello, {worker.name}</h1>
              <p className="intro">
                Your employer is requesting permission to track your location while this page is
                open. Tracking will start as soon as you tap the button below and will continue
                until you close this tab or stop it manually.
              </p>
              <div className="actions">
                <button onClick={acceptAndStart} className="primaryBtn">
                  I consent — start tracking
                </button>
                <span className="microcopy">
                  By tapping consent you agree to share your real-time location with your
                  employer.
                </span>
              </div>
            </>
          )}

          {!error && worker && consented && (
            <>
              <p className="eyebrow">{tracking ? 'Tracking active' : 'Tracking paused'}</p>
              <h1>{worker.name}</h1>
              <p className="intro">
                Keep this tab open and your screen on. Your live location is being shared with
                your employer while tracking is active.
              </p>
              <div className="actions">
                {tracking ? (
                  <button onClick={stopTracking} className="primaryBtn stopBtn">
                    Stop tracking
                  </button>
                ) : (
                  <button onClick={startTracking} className="primaryBtn">
                    Resume tracking
                  </button>
                )}
                <span className="microcopy">
                  Closing this tab or locking your phone for too long will pause tracking.
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="content">
        {!error && worker && !consented && (
          <>
            <div className="section">
              <h2>What happens when you consent</h2>
              <ul>
                <li>Your phone&apos;s GPS coordinates are sent to your employer in real time.</li>
                <li>Tracking only works while this page is open and your screen is on.</li>
                <li>You can stop tracking at any time by tapping the stop button or closing this tab.</li>
                <li>The page will try to keep your screen awake so tracking is not interrupted.</li>
              </ul>
            </div>

            <div className="section twoCol">
              <div>
                <h2>Data collected</h2>
                <ul>
                  <li>Latitude and longitude</li>
                  <li>GPS accuracy, speed, and heading</li>
                  <li>Time of each location update</li>
                </ul>
              </div>
              <div>
                <h2>Your rights</h2>
                <ul>
                  <li>You can withdraw consent at any time by closing this page.</li>
                  <li>You can ask your employer to view, correct, or delete your data.</li>
                  <li>Tracking is intended for working hours only.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {!error && worker && consented && (
          <div className="section">
            <h2>Live status</h2>
            <div className="statGrid">
              <Stat label="Pings sent" value={String(pingsCount)} />
              <Stat label="Last update" value={lastSent ? timeAgo(lastSent) : '—'} />
              <Stat label="Accuracy" value={accuracy ? `±${Math.round(accuracy)}m` : '—'} />
              <Stat label="Status" value={tracking ? 'Active' : 'Paused'} />
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f7f7f4;
          color: #171717;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .hero {
          background:
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 34%),
            linear-gradient(135deg, #1d9e75 0%, #14735a 55%, #0e5240 100%);
          color: white;
          padding: 28px;
        }

        .nav,
        .heroBody,
        .content {
          max-width: 1120px;
          margin: 0 auto;
        }

        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 56px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .logo {
          background: white;
          color: #14735a;
          border-radius: 999px;
          padding: 10px 18px;
          font-size: 21px;
          font-weight: 800;
          font-family: Georgia, 'Times New Roman', serif;
          white-space: nowrap;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
        }

        .brandName {
          font-size: 15px;
          font-weight: 700;
        }

        .brandSub {
          font-size: 12px;
          opacity: 0.82;
          margin-top: 2px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 650;
          white-space: nowrap;
        }

        .tagLive {
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.7);
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .heroBody {
          padding-bottom: 54px;
          max-width: 820px;
        }

        .eyebrow {
          margin: 0 0 12px;
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        h1 {
          margin: 0;
          max-width: 720px;
          font-size: 52px;
          line-height: 1.05;
          letter-spacing: 0;
        }

        .intro {
          max-width: 680px;
          margin: 20px 0 0;
          font-size: 18px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 28px;
        }

        .primaryBtn {
          border: 0;
          border-radius: 8px;
          background: #111;
          color: white;
          padding: 14px 20px;
          font-size: 15px;
          font-weight: 750;
          cursor: pointer;
          min-width: 230px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
        }

        .primaryBtn:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .stopBtn {
          background: #a32d2d;
        }

        .microcopy {
          max-width: 340px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 13px;
          line-height: 1.45;
        }

        .content {
          padding: 34px 28px 56px;
        }

        .section {
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 10px;
          padding: 24px;
          margin-bottom: 16px;
        }

        .twoCol {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 34px;
        }

        h2 {
          margin: 0 0 12px;
          font-size: 22px;
          line-height: 1.2;
        }

        p,
        li {
          color: #424242;
          font-size: 15px;
          line-height: 1.75;
        }

        p {
          margin: 0;
        }

        ul {
          margin: 0;
          padding-left: 20px;
        }

        li + li {
          margin-top: 6px;
        }

        .statGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.4); }
        }

        @media (max-width: 840px) {
          .hero {
            padding: 22px;
          }

          .nav {
            align-items: flex-start;
            margin-bottom: 42px;
          }

          .heroBody,
          .twoCol {
            grid-template-columns: 1fr;
          }

          .heroBody {
            padding-bottom: 34px;
          }

          h1 {
            font-size: 38px;
          }

          .intro {
            font-size: 17px;
          }

          .content {
            padding: 24px 18px 42px;
          }

          .statGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 520px) {
          .brand {
            align-items: flex-start;
          }

          .logo {
            font-size: 18px;
            padding: 9px 14px;
          }

          .brandName {
            font-size: 14px;
          }

          h1 {
            font-size: 32px;
          }

          .primaryBtn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>

      <style jsx>{`
        .stat {
          border-radius: 8px;
          background: #f7f7f4;
          border: 1px solid rgba(0, 0, 0, 0.07);
          padding: 12px;
        }

        .statLabel {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .statValue {
          font-size: 20px;
          font-weight: 700;
          color: #171717;
        }
      `}</style>
    </div>
  );
}

function timeAgo(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}
