-- Mazo de dimensiones sin repetición hasta agotar el pool.
-- Luego se reinicia y vuelve a salir aleatorio (sin repetir la inmediata anterior).
-- Aplicar: npm run db:patch:dimension-deck

DROP FUNCTION IF EXISTS fn_pick_random_dimension();
DROP FUNCTION IF EXISTS fn_pick_random_dimension(dimension_code);
DROP FUNCTION IF EXISTS fn_pick_random_dimension(dimension_code, dimension_code[]);

CREATE OR REPLACE FUNCTION fn_pick_random_dimension(
  p_exclude dimension_code DEFAULT NULL,
  p_used dimension_code[] DEFAULT NULL
)
RETURNS dimension_code LANGUAGE sql STABLE AS $$
  SELECT code FROM dimensions
  WHERE is_playable
    AND code <> 'primo'
    AND (p_exclude IS NULL OR code <> p_exclude)
    AND (
      p_used IS NULL
      OR cardinality(p_used) = 0
      OR NOT (code = ANY (p_used))
    )
  ORDER BY random() * GREATEST(weight, 1) DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_reveal_dimension(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE
  v_match matches;
  v_dim dimension_code;
  v_cycle INT;
  v_used dimension_code[];
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  v_cycle := v_match.cycle_index + 1;

  -- Dimensiones ya vistas en esta partida (historial + actual, sin primo)
  SELECT COALESCE(array_agg(DISTINCT d), '{}'::dimension_code[])
  INTO v_used
  FROM (
    SELECT h.dimension AS d
    FROM match_dimension_history h
    WHERE h.match_id = p_match_id
      AND h.dimension <> 'primo'
    UNION
    SELECT v_match.current_dimension
    WHERE v_match.current_dimension IS NOT NULL
      AND v_match.current_dimension <> 'primo'
  ) x;

  -- Preferir una que aún no haya salido
  v_dim := fn_pick_random_dimension(NULL, v_used);

  -- Pool agotado: reiniciar mazo, evitar solo la dimensión inmediata anterior
  IF v_dim IS NULL THEN
    v_dim := fn_pick_random_dimension(v_match.current_dimension, NULL);
  END IF;

  IF v_dim IS NULL THEN
    v_dim := fn_pick_random_dimension(NULL, NULL);
  END IF;

  UPDATE match_board_cells SET is_active = FALSE WHERE match_id = p_match_id AND is_active;

  INSERT INTO match_dimension_history (match_id, cycle_index, dimension)
  VALUES (p_match_id, v_cycle, v_dim)
  ON CONFLICT (match_id, cycle_index) DO UPDATE SET dimension = EXCLUDED.dimension, revealed_at = now();

  INSERT INTO match_effects (match_id, kind, source_dimension, payload, is_active)
  VALUES (
    p_match_id,
    CASE v_dim
      WHEN 'espejo' THEN 'mirror_controls'::effect_kind
      WHEN 'bluriel' THEN 'bluriel_fog'::effect_kind
      WHEN 'gravitacional' THEN 'gravity_cap'::effect_kind
      WHEN 'cadena_sangre' THEN 'blood_chain'::effect_kind
      WHEN 'ruina' THEN 'ruin_zone'::effect_kind
      WHEN 'mercado_negro' THEN 'monolith_time'::effect_kind
      WHEN 'fragilidad' THEN 'fragility_crystal'::effect_kind
      ELSE 'king_immunity'::effect_kind
    END,
    v_dim,
    jsonb_build_object('cycle', v_cycle),
    TRUE
  );

  IF v_dim = 'mercado_negro' THEN
    INSERT INTO match_board_cells (match_id, square, effect, time_bonus_min_s, time_bonus_max_s, created_cycle, is_active)
    SELECT p_match_id, sq, 'monolith', 40, 60, v_cycle, TRUE
    FROM (
      SELECT (chr(97 + (n % 8)) || ((n / 8)::int + 1)) AS sq
      FROM (SELECT (random() * 63)::int AS n FROM generate_series(1, 64)) x
      GROUP BY sq
      ORDER BY random()
      LIMIT 4
    ) s
    ON CONFLICT (match_id, square, effect) DO UPDATE SET
      is_active = TRUE,
      time_bonus_min_s = EXCLUDED.time_bonus_min_s,
      time_bonus_max_s = EXCLUDED.time_bonus_max_s,
      created_cycle = EXCLUDED.created_cycle;
  END IF;

  UPDATE matches SET
    status = 'active',
    phase = 'grieta',
    cycle_index = v_cycle,
    moves_in_phase = 0,
    current_dimension = v_dim,
    clock_running_for = turn_color,
    clock_updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;
