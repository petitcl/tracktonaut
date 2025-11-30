-- ============================================================================
-- Tracktonaut RPC Function: save_day
-- ============================================================================
--
-- Atomic transaction for saving daily check-in with metric entries.
-- Validates entries against metric configs and calculates completion percentage.
--
-- Parameters:
--   p_user_id   UUID    - User ID (must match auth.uid())
--   p_day_id    TEXT    - Day identifier (YYYY-MM-DD format)
--   p_status    TEXT    - Check-in status ('draft' or 'submitted')
--   p_entries   JSONB   - Array of metric entries
--
-- Entry format:
-- {
--   "metric_id": 123,
--   "bool_value": true,           -- for boolean metrics
--   "int_value": 7,               -- for rating metrics
--   "float_value": 8.5,           -- for number metrics
--   "text_value": "...",          -- for notes metrics
--   "select_key": "good",         -- for select metrics
--   "tag_keys": ["happy", "calm"] -- for tags metrics
-- }
--
-- Returns:
-- {
--   "completion_pct": 85,
--   "saved_count": 5
-- }
--
-- ============================================================================

CREATE OR REPLACE FUNCTION save_day(
  p_user_id UUID,
  p_day_id TEXT,
  p_status TEXT,
  p_entries JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry JSONB;
  v_metric metrics%ROWTYPE;
  v_saved_count INT := 0;
  v_total_required INT;
  v_answered_required INT;
  v_completion_pct INT;
  v_config JSONB;
  v_min NUMERIC;
  v_max NUMERIC;
  v_scale_min INT;
  v_scale_max INT;
  v_valid_keys TEXT[];
  v_tag_key TEXT;
BEGIN
  -- ========================================
  -- SECURITY: Verify user owns this data
  -- ========================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot save data for another user';
  END IF;

  -- ========================================
  -- VALIDATE STATUS
  -- ========================================
  IF p_status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be ''draft'' or ''submitted''', p_status;
  END IF;

  -- ========================================
  -- VALIDATE DAY_ID FORMAT
  -- ========================================
  IF p_day_id !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid day_id format: %. Expected YYYY-MM-DD', p_day_id;
  END IF;

  -- ========================================
  -- PROCESS ENTRIES
  -- ========================================
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    -- Get metric definition
    SELECT * INTO v_metric
    FROM metrics
    WHERE id = (v_entry->>'metric_id')::BIGINT
      AND user_id = p_user_id
      AND archived_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Metric % not found or archived', v_entry->>'metric_id';
    END IF;

    v_config := v_metric.config;

    -- ========================================
    -- TYPE-SPECIFIC VALIDATION
    -- ========================================
    CASE v_metric.type
      WHEN 'boolean' THEN
        IF v_entry->>'bool_value' IS NULL THEN
          RAISE EXCEPTION 'Boolean metric % requires bool_value', v_metric.id;
        END IF;

      WHEN 'rating' THEN
        v_scale_min := COALESCE((v_config->>'scaleMin')::INT, 1);
        v_scale_max := COALESCE((v_config->>'scaleMax')::INT, 10);

        IF v_entry->>'int_value' IS NULL THEN
          RAISE EXCEPTION 'Rating metric % requires int_value', v_metric.id;
        END IF;

        IF (v_entry->>'int_value')::INT < v_scale_min OR (v_entry->>'int_value')::INT > v_scale_max THEN
          RAISE EXCEPTION 'Rating value % out of range [%, %] for metric %',
            v_entry->>'int_value', v_scale_min, v_scale_max, v_metric.id;
        END IF;

      WHEN 'number' THEN
        IF v_entry->>'float_value' IS NULL THEN
          RAISE EXCEPTION 'Number metric % requires float_value', v_metric.id;
        END IF;

        v_min := (v_config->>'min')::NUMERIC;
        v_max := (v_config->>'max')::NUMERIC;

        IF v_min IS NOT NULL AND (v_entry->>'float_value')::NUMERIC < v_min THEN
          RAISE EXCEPTION 'Number value % below minimum % for metric %',
            v_entry->>'float_value', v_min, v_metric.id;
        END IF;

        IF v_max IS NOT NULL AND (v_entry->>'float_value')::NUMERIC > v_max THEN
          RAISE EXCEPTION 'Number value % above maximum % for metric %',
            v_entry->>'float_value', v_max, v_metric.id;
        END IF;

      WHEN 'select' THEN
        IF v_entry->>'select_key' IS NULL THEN
          RAISE EXCEPTION 'Select metric % requires select_key', v_metric.id;
        END IF;

        -- Validate select_key exists in config options
        SELECT ARRAY_AGG(opt->>'key')
        INTO v_valid_keys
        FROM jsonb_array_elements(v_config->'options') AS opt;

        IF NOT (v_entry->>'select_key' = ANY(v_valid_keys)) THEN
          RAISE EXCEPTION 'Invalid select_key ''%'' for metric %. Valid keys: %',
            v_entry->>'select_key', v_metric.id, v_valid_keys;
        END IF;

      WHEN 'tags' THEN
        IF v_entry->'tag_keys' IS NULL OR jsonb_array_length(v_entry->'tag_keys') = 0 THEN
          RAISE EXCEPTION 'Tags metric % requires at least one tag', v_metric.id;
        END IF;

        -- Validate all tag keys exist in config options
        SELECT ARRAY_AGG(opt->>'key')
        INTO v_valid_keys
        FROM jsonb_array_elements(v_config->'options') AS opt;

        FOR v_tag_key IN
          SELECT jsonb_array_elements_text(v_entry->'tag_keys')
        LOOP
          IF NOT (v_tag_key = ANY(v_valid_keys)) THEN
            RAISE EXCEPTION 'Invalid tag_key ''%'' for metric %. Valid keys: %',
              v_tag_key, v_metric.id, v_valid_keys;
          END IF;
        END LOOP;

      WHEN 'notes' THEN
        IF v_entry->>'text_value' IS NULL OR LENGTH(v_entry->>'text_value') = 0 THEN
          RAISE EXCEPTION 'Notes metric % requires text_value', v_metric.id;
        END IF;

        IF LENGTH(v_entry->>'text_value') > 2000 THEN
          RAISE EXCEPTION 'Notes value exceeds 2000 characters for metric %', v_metric.id;
        END IF;

      ELSE
        RAISE EXCEPTION 'Unknown metric type: %', v_metric.type;
    END CASE;

    -- ========================================
    -- UPSERT METRIC ENTRY
    -- ========================================
    INSERT INTO metric_entry (
      user_id,
      metric_id,
      day_id,
      bool_value,
      int_value,
      float_value,
      text_value,
      select_key,
      tag_keys
    ) VALUES (
      p_user_id,
      (v_entry->>'metric_id')::BIGINT,
      p_day_id,
      (v_entry->>'bool_value')::BOOLEAN,
      (v_entry->>'int_value')::INT,
      (v_entry->>'float_value')::DOUBLE PRECISION,
      v_entry->>'text_value',
      v_entry->>'select_key',
      CASE
        WHEN v_entry->'tag_keys' IS NOT NULL THEN
          ARRAY(SELECT jsonb_array_elements_text(v_entry->'tag_keys'))
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, metric_id, day_id)
    DO UPDATE SET
      bool_value = EXCLUDED.bool_value,
      int_value = EXCLUDED.int_value,
      float_value = EXCLUDED.float_value,
      text_value = EXCLUDED.text_value,
      select_key = EXCLUDED.select_key,
      tag_keys = EXCLUDED.tag_keys,
      updated_at = NOW();

    v_saved_count := v_saved_count + 1;
  END LOOP;

  -- ========================================
  -- CALCULATE COMPLETION PERCENTAGE
  -- ========================================
  -- Count total required metrics (non-archived)
  SELECT COUNT(*)
  INTO v_total_required
  FROM metrics
  WHERE user_id = p_user_id
    AND is_required = TRUE
    AND archived_at IS NULL;

  -- Count how many required metrics have entries for this day
  SELECT COUNT(DISTINCT me.metric_id)
  INTO v_answered_required
  FROM metric_entry me
  INNER JOIN metrics m ON m.id = me.metric_id
  WHERE me.user_id = p_user_id
    AND me.day_id = p_day_id
    AND m.is_required = TRUE
    AND m.archived_at IS NULL;

  -- Calculate percentage (avoid division by zero)
  IF v_total_required > 0 THEN
    v_completion_pct := ROUND((v_answered_required::NUMERIC / v_total_required::NUMERIC) * 100);
  ELSE
    v_completion_pct := 100; -- If no required metrics, consider it complete
  END IF;

  -- ========================================
  -- UPSERT DAILY CHECK-IN
  -- ========================================
  INSERT INTO daily_checkin (
    user_id,
    day_id,
    status,
    completion_pct
  ) VALUES (
    p_user_id,
    p_day_id,
    p_status,
    v_completion_pct
  )
  ON CONFLICT (user_id, day_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    completion_pct = EXCLUDED.completion_pct,
    updated_at = NOW();

  -- ========================================
  -- RETURN RESULT
  -- ========================================
  RETURN jsonb_build_object(
    'completion_pct', v_completion_pct,
    'saved_count', v_saved_count
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION save_day(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================================================
-- RPC FUNCTION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'save_day RPC function created successfully.';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage from client:';
  RAISE NOTICE '  const { data, error } = await supabase.rpc(''save_day'', {';
  RAISE NOTICE '    p_user_id: user.id,';
  RAISE NOTICE '    p_day_id: ''2025-11-30'',';
  RAISE NOTICE '    p_status: ''submitted'',';
  RAISE NOTICE '    p_entries: [';
  RAISE NOTICE '      { metric_id: 1, bool_value: true },';
  RAISE NOTICE '      { metric_id: 2, int_value: 8 }';
  RAISE NOTICE '    ]';
  RAISE NOTICE '  })';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Execute 04-seed-catalog.sql to populate seed metrics';
  RAISE NOTICE '  2. Test RPC from Supabase SQL Editor or client app';
END $$;
