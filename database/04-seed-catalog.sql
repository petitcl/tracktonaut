-- ============================================================================
-- Tracktonaut Seed Catalog Data
-- ============================================================================
--
-- This file contains the seed catalog of 11 default metrics.
-- These metrics can be installed by users via the /catalog page.
--
-- NOTE: This creates a catalog_metrics table for seed data only.
--       Users install metrics by copying from catalog to their metrics table.
--
-- ============================================================================

-- ============================================================================
-- CREATE CATALOG TABLE (Public, read-only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_metrics (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('boolean', 'rating', 'number', 'select', 'tags', 'notes')),
  emoji TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative')),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE catalog_metrics IS 'Seed catalog of installable metrics';
COMMENT ON COLUMN catalog_metrics.name IS 'Unique metric name (used for catalog browsing)';

-- Enable RLS but allow all authenticated users to read
ALTER TABLE catalog_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read catalog_metrics"
  ON catalog_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- SEED CATALOG METRICS
-- ============================================================================

INSERT INTO catalog_metrics (name, description, type, emoji, direction, is_required, order_index, config)
VALUES
  -- 1. Mood (rating 1-10, positive)
  (
    'Mood',
    'How did you feel overall today?',
    'rating',
    '😊',
    'positive',
    true,
    1,
    '{"scaleMin": 1, "scaleMax": 10}'::JSONB
  ),

  -- 2. Mood Words (tags, positive) - 20 emotions covering the mood meter
  (
    'Mood Words',
    'What emotions did you experience?',
    'tags',
    '💭',
    'positive',
    false,
    2,
    '{
      "options": [
        {"key": "happy", "label": "😊 Happy"},
        {"key": "calm", "label": "😌 Calm"},
        {"key": "excited", "label": "🤩 Excited"},
        {"key": "grateful", "label": "🙏 Grateful"},
        {"key": "anxious", "label": "😰 Anxious"},
        {"key": "sad", "label": "😢 Sad"},
        {"key": "angry", "label": "😠 Angry"},
        {"key": "tired", "label": "😴 Tired"},
        {"key": "energized", "label": "⚡ Energized"},
        {"key": "stressed", "label": "😫 Stressed"},
        {"key": "frustrated", "label": "😤 Frustrated"},
        {"key": "worried", "label": "😟 Worried"},
        {"key": "content", "label": "🙂 Content"},
        {"key": "lonely", "label": "😔 Lonely"},
        {"key": "hopeful", "label": "🌟 Hopeful"},
        {"key": "overwhelmed", "label": "😵 Overwhelmed"},
        {"key": "peaceful", "label": "☮️ Peaceful"},
        {"key": "disappointed", "label": "😞 Disappointed"},
        {"key": "bored", "label": "😑 Bored"},
        {"key": "motivated", "label": "💪 Motivated"}
      ]
    }'::JSONB
  ),

  -- 3. Energy (rating 1-10, positive)
  (
    'Energy',
    'How energetic did you feel today?',
    'rating',
    '⚡',
    'positive',
    true,
    3,
    '{"scaleMin": 1, "scaleMax": 10}'::JSONB
  ),

  -- 4. Stress (rating 1-10, negative)
  (
    'Stress',
    'How stressed were you today?',
    'rating',
    '😫',
    'negative',
    true,
    4,
    '{"scaleMin": 1, "scaleMax": 10}'::JSONB
  ),

  -- 5. Sleep Quality (rating 1-10, positive)
  (
    'Sleep Quality',
    'How well did you sleep last night?',
    'rating',
    '😴',
    'positive',
    true,
    5,
    '{"scaleMin": 1, "scaleMax": 10}'::JSONB
  ),

  -- 6. Sleep Hours (number, unit h, min 0 max 16, higher is better)
  (
    'Sleep Hours',
    'How many hours of sleep did you get?',
    'number',
    '🛌',
    'positive',
    true,
    6,
    '{
      "unit": "h",
      "min": 0,
      "max": 16,
      "higherIsBetter": true
    }'::JSONB
  ),

  -- 7. Food Quality (rating 1-4 with labels)
  (
    'Food Quality',
    'How healthy was your food today?',
    'rating',
    '🥗',
    'positive',
    true,
    7,
    '{
      "scaleMin": 1,
      "scaleMax": 4,
      "labels": ["Poor", "Average", "Good", "Excellent"]
    }'::JSONB
  ),

  -- 8. Exercise (boolean, positive)
  (
    'Exercise',
    'Did you exercise today?',
    'boolean',
    '🏃',
    'positive',
    true,
    8,
    '{}'::JSONB
  ),

  -- 9. Alcohol (boolean, negative)
  (
    'Alcohol',
    'Did you consume alcohol today?',
    'boolean',
    '🍺',
    'negative',
    false,
    9,
    '{}'::JSONB
  ),

  -- 10. Social (rating 1-10, positive)
  (
    'Social',
    'How was your social interaction today?',
    'rating',
    '👥',
    'positive',
    false,
    10,
    '{"scaleMin": 1, "scaleMax": 10}'::JSONB
  ),

  -- 11. Notes (notes)
  (
    'Notes',
    'Any additional thoughts or reflections?',
    'notes',
    '📝',
    'positive',
    false,
    11,
    '{}'::JSONB
  )

ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED CATALOG COMPLETE
-- ============================================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM catalog_metrics;

  RAISE NOTICE 'Seed catalog created successfully.';
  RAISE NOTICE 'Total catalog metrics: %', v_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Catalog metrics:';
  RAISE NOTICE '  1. Mood (rating 1-10) 😊';
  RAISE NOTICE '  2. Mood Words (tags, 20 emotions) 💭';
  RAISE NOTICE '  3. Energy (rating 1-10) ⚡';
  RAISE NOTICE '  4. Stress (rating 1-10) 😫';
  RAISE NOTICE '  5. Sleep Quality (rating 1-10) 😴';
  RAISE NOTICE '  6. Sleep Hours (number) 🛌';
  RAISE NOTICE '  7. Food Quality (rating 1-4) 🥗';
  RAISE NOTICE '  8. Exercise (boolean) 🏃';
  RAISE NOTICE '  9. Alcohol (boolean) 🍺';
  RAISE NOTICE ' 10. Social (rating 1-10) 👥';
  RAISE NOTICE ' 11. Notes (notes) 📝';
  RAISE NOTICE '';
  RAISE NOTICE 'Users can install these metrics from the /catalog page.';
END $$;
