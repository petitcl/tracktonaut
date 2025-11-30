# Tracktonaut Database

SQL migration files for Tracktonaut's Supabase database.

## Execution Order

Execute these files **in order** in the Supabase SQL Editor:

1. **01-schema.sql** - Create all tables and indexes
2. **02-rls.sql** - Enable Row-Level Security and create policies
3. **03-rpc-save-day.sql** - Create the `save_day` RPC function
4. **04-seed-catalog.sql** - Populate seed catalog metrics

## Quick Start

### Option 1: Manual Execution (Supabase Dashboard)

1. Go to your Supabase project
2. Open **SQL Editor** (left sidebar)
3. Create a new query for each file
4. Copy-paste the content and execute
5. Verify success messages in output

### Option 2: Supabase CLI (Recommended for production)

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase locally
supabase init

# Link to your project
supabase link --project-ref your-project-id

# Apply migrations (copy files to supabase/migrations/ first)
supabase db push
```

## Database Schema Overview

### Tables

- **profiles** - User profiles with timezone and language
- **metrics** - User-defined tracking metrics
- **daily_checkin** - Daily check-in status and completion %
- **metric_entry** - Actual metric values for each day
- **push_subscriptions** - Web Push notification endpoints
- **reminder_settings** - User reminder preferences
- **catalog_metrics** - Seed catalog of installable metrics (read-only)

### RPC Functions

- **save_day(user_id, day_id, status, entries)** - Atomic save for daily check-in

### Security

- All tables have RLS enabled
- Users can only access their own data (enforced via `user_id = auth.uid()`)
- `save_day` function validates all inputs and metric configs
- Admin operations require service role key

## Testing the Schema

After executing all files, test with:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'metrics',
    'daily_checkin',
    'metric_entry',
    'push_subscriptions',
    'reminder_settings',
    'catalog_metrics'
  );

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE '%metrics%';

-- Check catalog has metrics
SELECT COUNT(*) FROM catalog_metrics;
-- Should return 11

-- Test save_day function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'save_day';
```

## Schema Regeneration

After schema changes, regenerate TypeScript types:

```bash
cd webapp
npm run gen-types:typescript
```

This creates `src/lib/supabase/database.types.ts` from the live schema.

## Troubleshooting

**Issue**: RLS blocks all queries

- **Solution**: Ensure user is authenticated (`auth.uid()` is not null)
- Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'metrics'`

**Issue**: `save_day` returns validation errors

- **Solution**: Check metric config matches entry type (e.g., rating needs `scaleMin`/`scaleMax`)
- Verify metric is not archived
- Ensure entry format matches metric type

**Issue**: Type generation fails

- **Solution**: Set `SUPABASE_PROJECT_ID` in `.env.local`
- Run `npx supabase login` first
- Ensure you have project access

## Next Steps

1. Configure Google OAuth in Supabase Auth settings
2. Set up Edge Functions for reminders (see `supabase/functions/`)
3. Generate VAPID keys for Web Push
4. Deploy to production
