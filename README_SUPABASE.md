Supabase setup (Auth, Database, Storage, Realtime)

Quick start (hosted):
1. Create a Supabase project at https://app.supabase.com
2. Copy the URL and anon/service_role keys into .env
3. Install SDK: npm install @supabase/supabase-js
4. Use src/lib/supabaseClient.ts for frontend and src/lib/supabaseAdmin.ts for server

Local dev (supabase CLI):
1. Install supabase CLI: https://supabase.com/docs/guides/cli
2. Run `supabase init` and `supabase start` to spin up local DB and services
3. Use the provided connection strings and set env vars

Edge & RLS notes:
- When migrating to Supabase Edge, prefer service_role on serverless functions only
- Test RLS policies locally against the same JWT claims as Auth
