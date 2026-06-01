# Ticketing API server (Express + Mongoose)

This server replaces Supabase (database, auth, storage, edge functions). The React
app in the repo root talks to it over REST at `/api`.

## Stack
- **Express** REST API
- **Mongoose** / MongoDB data store
- **JWT + bcrypt** auth (replaces Supabase Auth)
- **GridFS** file storage (replaces Supabase Storage)
- Postgres triggers/functions re-implemented as services in `src/services/`
- Realtime (chat / notifications) is handled by **client-side polling** for now

## Prerequisites
A reachable MongoDB. For local dev, the quickest option is Docker:

```bash
docker run -d --name ticketing-mongo -p 27017:27017 \
  -v ticketing-mongo-data:/data/db mongo:7
```

## Setup
```bash
cd server
cp .env.example .env      # adjust MONGODB_URI / JWT_SECRET / super-admin creds
npm install
npm run seed              # creates the 5 default roles + a super-admin
npm run dev               # starts the API on http://localhost:3001
```

Default seeded super-admin (change in `.env`): `admin@ticketing.local` / `admin123`.

## Running the whole app
From the repo root:

```bash
npm run seed       # one-time: seed roles + super-admin (proxies to server)
npm run dev:all    # runs the Vite frontend (:8080) + API server (:3001) together
```

The Vite dev server proxies `/api` to `http://localhost:3001` (see `vite.config.ts`),
so uploaded files served from `/api/files/:id` render directly in the browser.

## Layout
```
src/
├── index.ts          Express app + route mounting + error handler
├── db.ts             Mongo connection + GridFS bucket
├── seed.ts           Default roles + super-admin
├── auth/             JWT signing + requireAuth / requireRole middleware
├── models/           Mongoose schemas (snake_case fields, `id` in JSON)
├── services/         Ported triggers: ticket number, SLA, system messages,
│                     notifications, response shaping, access rules
└── routes/           auth, tickets (+history/messages/ratings), users, profiles,
                      units, departments, roles, notifications, ratings, files
```

## Notes
- API responses keep Supabase's field names (`user_id`, `issue_department_id`,
  `raised_by`, …) and join alias keys (`issue_dept`, `raiser`, `assigned_profile`,
  `assignee`, `closed_by_profile`, `rating`) so the frontend needed only its
  data-access calls swapped.
- The old `supabase/` folder (SQL migrations + edge functions) is left in place as
  historical reference; it is no longer used by the app.
- Google Sheets sync was dropped in this migration.
