-- ============================================================================
-- Tracktonaut Row-Level Security (RLS) Policies
-- ============================================================================
--
-- This file enables RLS and creates policies for all tables.
-- Execute this AFTER running 01-schema.sql
--
-- Security Model:
-- - Users can only access their own data
-- - All tables enforce auth.uid() = user_id
-- - Metrics referenced in metric_entry must belong to the user
-- - No anonymous access allowed (must be authenticated)
--
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkin ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own profile (on first sign-in)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- METRICS TABLE POLICIES
-- ============================================================================

-- Users can read their own metrics (including archived)
CREATE POLICY "Users can read own metrics"
  ON metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own metrics
CREATE POLICY "Users can insert own metrics"
  ON metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own metrics
CREATE POLICY "Users can update own metrics"
  ON metrics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own metrics
CREATE POLICY "Users can delete own metrics"
  ON metrics
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- DAILY_CHECKIN TABLE POLICIES
-- ============================================================================

-- Users can read their own check-ins
CREATE POLICY "Users can read own daily_checkin"
  ON daily_checkin
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own check-ins
CREATE POLICY "Users can insert own daily_checkin"
  ON daily_checkin
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own check-ins
CREATE POLICY "Users can update own daily_checkin"
  ON daily_checkin
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own check-ins
CREATE POLICY "Users can delete own daily_checkin"
  ON daily_checkin
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- METRIC_ENTRY TABLE POLICIES
-- ============================================================================

-- Users can read their own metric entries
CREATE POLICY "Users can read own metric_entry"
  ON metric_entry
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert metric entries for their own metrics
CREATE POLICY "Users can insert own metric_entry"
  ON metric_entry
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM metrics
      WHERE metrics.id = metric_entry.metric_id
        AND metrics.user_id = auth.uid()
    )
  );

-- Users can update their own metric entries
CREATE POLICY "Users can update own metric_entry"
  ON metric_entry
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM metrics
      WHERE metrics.id = metric_entry.metric_id
        AND metrics.user_id = auth.uid()
    )
  );

-- Users can delete their own metric entries
CREATE POLICY "Users can delete own metric_entry"
  ON metric_entry
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PUSH_SUBSCRIPTIONS TABLE POLICIES
-- ============================================================================

-- Users can read their own push subscriptions
CREATE POLICY "Users can read own push_subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own push subscriptions
CREATE POLICY "Users can insert own push_subscriptions"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own push subscriptions
CREATE POLICY "Users can update own push_subscriptions"
  ON push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own push subscriptions
CREATE POLICY "Users can delete own push_subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- REMINDER_SETTINGS TABLE POLICIES
-- ============================================================================

-- Users can read their own reminder settings
CREATE POLICY "Users can read own reminder_settings"
  ON reminder_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own reminder settings
CREATE POLICY "Users can insert own reminder_settings"
  ON reminder_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reminder settings
CREATE POLICY "Users can update own reminder_settings"
  ON reminder_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reminder settings
CREATE POLICY "Users can delete own reminder_settings"
  ON reminder_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS SETUP COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Row-Level Security policies created successfully.';
  RAISE NOTICE '';
  RAISE NOTICE 'Security model:';
  RAISE NOTICE '  - All tables enforce user_id = auth.uid()';
  RAISE NOTICE '  - Users can only access their own data';
  RAISE NOTICE '  - Metrics in metric_entry must belong to the user';
  RAISE NOTICE '  - No anonymous access (authentication required)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Execute 03-rpc-save-day.sql to create RPC function';
  RAISE NOTICE '  2. Test policies with different user accounts';
END $$;
