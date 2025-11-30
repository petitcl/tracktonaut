-- ============================================================================
-- Tracktonaut Database Schema
-- ============================================================================
--
-- This file contains the complete database schema for Tracktonaut MVP.
-- Execute this in Supabase SQL Editor or via migration tools.
--
-- Usage:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor in Supabase Dashboard
-- 3. Copy and paste this entire file
-- 4. Execute
--
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Stores user profile information including timezone and language preferences
-- One profile per authenticated user

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  primary_tz TEXT NOT NULL, -- IANA timezone (e.g., 'America/New_York', 'Europe/Madrid')
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'User profile data including timezone and language preferences';
COMMENT ON COLUMN profiles.primary_tz IS 'IANA timezone string used for daily bucket calculation';
COMMENT ON COLUMN profiles.language IS 'ISO 639-1 language code (en, es, fr, de)';

-- ============================================================================
-- METRICS TABLE
-- ============================================================================
-- Defines user-created metrics for tracking
-- Supports 6 types: boolean, rating, number, select, tags, notes

CREATE TABLE IF NOT EXISTS metrics (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('boolean', 'rating', 'number', 'select', 'tags', 'notes')),
  emoji TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative')),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE metrics IS 'User-defined metrics for daily tracking';
COMMENT ON COLUMN metrics.type IS 'Metric type: boolean | rating | number | select | tags | notes';
COMMENT ON COLUMN metrics.direction IS 'Whether higher values are positive or negative';
COMMENT ON COLUMN metrics.is_required IS 'Whether metric must be filled for 100% completion';
COMMENT ON COLUMN metrics.order_index IS 'Display order (lower first)';
COMMENT ON COLUMN metrics.config IS 'Type-specific configuration (e.g., rating scale, select options)';
COMMENT ON COLUMN metrics.archived_at IS 'When metric was archived (NULL = active)';

-- Indexes for metrics
CREATE INDEX idx_metrics_user_id ON metrics(user_id);
CREATE INDEX idx_metrics_user_active ON metrics(user_id) WHERE archived_at IS NULL;
CREATE INDEX idx_metrics_order ON metrics(user_id, order_index) WHERE archived_at IS NULL;

-- ============================================================================
-- DAILY_CHECKIN TABLE
-- ============================================================================
-- Tracks completion status for each day
-- Primary key is (user_id, day_id)

CREATE TABLE IF NOT EXISTS daily_checkin (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_id TEXT NOT NULL, -- Format: YYYY-MM-DD (canonical string in user's primary_tz)
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')),
  completion_pct SMALLINT NOT NULL DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day_id)
);

COMMENT ON TABLE daily_checkin IS 'Daily check-in status and completion tracking';
COMMENT ON COLUMN daily_checkin.day_id IS 'Canonical date string YYYY-MM-DD in user primary timezone';
COMMENT ON COLUMN daily_checkin.status IS 'draft = in progress, submitted = finalized';
COMMENT ON COLUMN daily_checkin.completion_pct IS 'Percentage of required metrics answered (0-100)';

-- Indexes for daily_checkin
CREATE INDEX idx_daily_checkin_user_day ON daily_checkin(user_id, day_id DESC);
CREATE INDEX idx_daily_checkin_user_status ON daily_checkin(user_id, status);

-- ============================================================================
-- METRIC_ENTRY TABLE
-- ============================================================================
-- Stores actual metric values for each day
-- Primary key is (user_id, metric_id, day_id)
-- Uses typed columns for different value types

CREATE TABLE IF NOT EXISTS metric_entry (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_id BIGINT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  day_id TEXT NOT NULL, -- Format: YYYY-MM-DD
  bool_value BOOLEAN,
  int_value INT,
  float_value DOUBLE PRECISION,
  text_value TEXT,
  select_key TEXT,
  tag_keys TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, metric_id, day_id),
  CONSTRAINT text_value_length CHECK (LENGTH(text_value) <= 2000)
);

COMMENT ON TABLE metric_entry IS 'Actual metric values for each day';
COMMENT ON COLUMN metric_entry.bool_value IS 'Value for boolean metrics';
COMMENT ON COLUMN metric_entry.int_value IS 'Value for rating metrics (1-10)';
COMMENT ON COLUMN metric_entry.float_value IS 'Value for number metrics (hours, etc.)';
COMMENT ON COLUMN metric_entry.text_value IS 'Value for notes metrics (max 2000 chars)';
COMMENT ON COLUMN metric_entry.select_key IS 'Selected option key for select metrics';
COMMENT ON COLUMN metric_entry.tag_keys IS 'Array of selected tag keys for tags metrics';

-- Indexes for metric_entry
CREATE INDEX idx_metric_entry_user_day ON metric_entry(user_id, day_id DESC);
CREATE INDEX idx_metric_entry_user_metric ON metric_entry(user_id, metric_id);
CREATE INDEX idx_metric_entry_metric_day ON metric_entry(metric_id, day_id DESC);

-- Partial indexes for efficient value queries by type
CREATE INDEX idx_metric_entry_bool ON metric_entry(user_id, metric_id, day_id) WHERE bool_value IS NOT NULL;
CREATE INDEX idx_metric_entry_int ON metric_entry(user_id, metric_id, day_id) WHERE int_value IS NOT NULL;
CREATE INDEX idx_metric_entry_float ON metric_entry(user_id, metric_id, day_id) WHERE float_value IS NOT NULL;
CREATE INDEX idx_metric_entry_select ON metric_entry(user_id, metric_id, day_id) WHERE select_key IS NOT NULL;

-- ============================================================================
-- PUSH_SUBSCRIPTIONS TABLE
-- ============================================================================
-- Stores Web Push subscription endpoints for reminder notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL, -- Public key for encryption
  auth TEXT NOT NULL,   -- Auth secret for encryption
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

COMMENT ON TABLE push_subscriptions IS 'Web Push notification subscriptions';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Push service endpoint URL (unique)';
COMMENT ON COLUMN push_subscriptions.p256dh IS 'Public key for message encryption';
COMMENT ON COLUMN push_subscriptions.auth IS 'Authentication secret for encryption';
COMMENT ON COLUMN push_subscriptions.last_seen_at IS 'Last successful push delivery';

-- Indexes for push_subscriptions
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- ============================================================================
-- REMINDER_SETTINGS TABLE
-- ============================================================================
-- User preferences for daily reminder notifications

CREATE TABLE IF NOT EXISTS reminder_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_time TIME NOT NULL DEFAULT '09:00:00', -- Local time in user's primary_tz
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reminder_settings IS 'User reminder notification preferences';
COMMENT ON COLUMN reminder_settings.reminder_time IS 'Local time to send reminder (interpreted using profiles.primary_tz)';
COMMENT ON COLUMN reminder_settings.enabled IS 'Whether reminders are enabled';

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Automatically update updated_at timestamp on row updates

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at column
CREATE TRIGGER metrics_updated_at
  BEFORE UPDATE ON metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER daily_checkin_updated_at
  BEFORE UPDATE ON daily_checkin
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER metric_entry_updated_at
  BEFORE UPDATE ON metric_entry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
  RAISE NOTICE 'Schema creation complete. Tables created:';
  RAISE NOTICE '  - profiles';
  RAISE NOTICE '  - metrics';
  RAISE NOTICE '  - daily_checkin';
  RAISE NOTICE '  - metric_entry';
  RAISE NOTICE '  - push_subscriptions';
  RAISE NOTICE '  - reminder_settings';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Execute 02-rls.sql to enable Row-Level Security';
  RAISE NOTICE '  2. Execute 03-rpc-save-day.sql to create save_day function';
  RAISE NOTICE '  3. Execute 04-seed-catalog.sql to populate seed metrics';
END $$;
