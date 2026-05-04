# Worker Tracker — Next.js + Supabase

A web-link-based worker location tracker. No app install required for workers — they open a unique URL, grant location permission once, and their position streams to your dashboard in real-time.

## What you get

- **Unique tracking link per worker** (e.g. `yourapp.com/track/a3f9c2b1...`)
- **Consent screen** the worker must accept before any tracking starts
- **Live dashboard** at `/dashboard` showing all workers on a map, updating in real-time via Supabase Realtime
- **Browser screen-wake-lock** so the screen stays on while tracking
- **Pause/resume** controls for the worker
- **Row Level Security** so workers can only insert their own location, identified by their token

## Important limits to know

A web link CANNOT track in the background. The browser pauses tracking when:
- The worker locks their phone screen
- The worker switches to another app
- The worker closes the tab

For continuous background tracking, you would need a native app (e.g. fork the open-source Traccar Client). This project is for "active check-in" tracking where the worker keeps the page open during work.

## Setup (about 30 minutes)

### 1. Create a Supabase project
- Go to https://supabase.com and create a free project
- In the SQL editor, paste and run `supabase/schema.sql`
- Copy your project URL and anon key from Project Settings -> API

### 2. Local setup
```bash
cd worker-tracker
npm install
cp .env.local.example .env.local
# edit .env.local and paste your Supabase URL + anon key
npm run dev
```

### 3. Add a worker (via Supabase Table Editor)
- Open your Supabase dashboard -> Table Editor -> workers
- Insert a row with `name = "Joseph M."`, `role = "Field tech"`
- Copy the auto-generated `token` value
- Worker's link: `http://localhost:3000/track/<token>`

### 4. Deploy to production
- Push to GitHub
- Import to Vercel — set the two env vars
- Replace `http://localhost:3000` with your Vercel URL when sending links to workers

### 5. Lock down the dashboard
The dashboard is currently open. Before going live, add Supabase Auth to `/dashboard` so only you can view it. Quick guide: https://supabase.com/docs/guides/auth/server-side/nextjs

## Legal — Uganda Data Protection and Privacy Act 2019

Before tracking anyone:
1. Get written, signed consent from each worker (the in-app consent button is not enough on its own — keep paper or PDF copies)
2. Document a clear policy: when tracking is active (work hours only), what data is collected, how long it's retained, who can see it
3. Register as a Data Collector with the Personal Data Protection Office if processing data of more than 100 people, or as required
4. Give workers the right to view, correct, and delete their data

## Files

- `supabase/schema.sql` — database tables, RPC functions, RLS policies
- `app/track/[token]/page.tsx` — worker's tracking page (consent + GPS streaming)
- `app/dashboard/page.tsx` — admin dashboard with live map
- `lib/supabase.ts` — Supabase client
- `app/layout.tsx` — root layout (loads Leaflet)

## Extending it

Common next steps:
- Geofences for job sites (alert when worker enters/leaves)
- Daily route history per worker
- Time clock (clock in / clock out tied to first / last ping of the day)
- Battery level reporting
- Offline buffering (queue pings in localStorage when network drops, send when reconnected)
