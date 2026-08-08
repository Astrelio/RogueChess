-- =============================================================================
-- RogueChess PATCH — reloj en vivo / pausa tienda / arranca tras 1ª jugada
-- npm run db:patch:clocks
-- =============================================================================

BEGIN;

-- Partida: el reloj de blancas NO corre hasta la primera jugada
CREATE OR REPLACE FUNCTION fn_start_match(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches;
BEGIN
  UPDATE matches SET
    status = 'active',
    phase = 'primo',
    started_at = COALESCE(started_at, now()),
    clock_running_for = NULL,          -- arranca al completar la 1ª jugada
    clock_updated_at = now(),
    white_time_ms = time_control_s * 1000,
    black_time_ms = time_control_s * 1000,
    current_dimension = 'primo',
    cycle_index = 0,
    moves_in_phase = 0
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  UPDATE match_players SET time_ms = v_match.time_control_s * 1000 WHERE match_id = p_match_id;
  RETURN v_match;
END;
$$;

-- Tienda: liquidar tiempo corrido y pausar reloj
CREATE OR REPLACE FUNCTION fn_enter_shop_phase(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches; r RECORD; v_elapsed INT;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF v_match.clock_running_for IS NOT NULL AND v_match.clock_updated_at IS NOT NULL THEN
    v_elapsed := GREATEST(0, (EXTRACT(EPOCH FROM (now() - v_match.clock_updated_at)) * 1000)::INT);
    IF v_match.clock_running_for = 'white' THEN
      UPDATE matches SET white_time_ms = GREATEST(white_time_ms - v_elapsed, 0) WHERE id = p_match_id;
      UPDATE match_players SET time_ms = GREATEST(time_ms - v_elapsed, 0)
        WHERE match_id = p_match_id AND color = 'white';
    ELSE
      UPDATE matches SET black_time_ms = GREATEST(black_time_ms - v_elapsed, 0) WHERE id = p_match_id;
      UPDATE match_players SET time_ms = GREATEST(time_ms - v_elapsed, 0)
        WHERE match_id = p_match_id AND color = 'black';
    END IF;
  END IF;

  UPDATE matches SET
    status = 'shop',
    phase = 'shop',
    moves_in_phase = 0,
    clock_running_for = NULL,
    clock_updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  FOR r IN SELECT id FROM match_players WHERE match_id = p_match_id LOOP
    PERFORM fn_open_shop_for_player(r.id);
  END LOOP;
  RETURN v_match;
END;
$$;

-- Tras grieta: reanudar reloj del bando que tiene el turno
CREATE OR REPLACE FUNCTION fn_reveal_dimension(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches; v_dim dimension_code; v_cycle INT;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  v_cycle := v_match.cycle_index + 1;
  v_dim := fn_pick_random_dimension();

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
    ON CONFLICT DO NOTHING;
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

-- Movimiento: gastar tiempo según clock_updated_at (autoridad servidor)
CREATE OR REPLACE FUNCTION fn_record_chess_move(
  p_firebase_uid TEXT,
  p_match_id UUID,
  p_from CHAR(2),
  p_to CHAR(2),
  p_san TEXT,
  p_uci TEXT,
  p_fen_after TEXT,
  p_is_capture BOOLEAN DEFAULT FALSE,
  p_is_check BOOLEAN DEFAULT FALSE,
  p_is_mate BOOLEAN DEFAULT FALSE,
  p_time_spent_ms INTEGER DEFAULT 0,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS match_moves LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles; v_mp match_players; v_match matches; v_move match_moves; v_ply INT;
  v_spend INT;
  v_keep_turn BOOLEAN := FALSE;
  v_fen TEXT := p_fen_after;
  v_parts TEXT[];
  v_elapsed INT;
  v_first_move BOOLEAN;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.status <> 'active' THEN RAISE EXCEPTION 'match not in action phase'; END IF;
  IF v_match.turn_color <> v_mp.color THEN RAISE EXCEPTION 'not your turn'; END IF;

  v_first_move := (v_match.clock_running_for IS NULL);

  -- Tiempo real desde el último tick del reloj (ignora cliente si el reloj corría)
  IF v_first_move THEN
    v_spend := 0; -- la primera jugada de la partida no consume tiempo
  ELSIF v_match.clock_running_for = v_mp.color AND v_match.clock_updated_at IS NOT NULL THEN
    v_elapsed := GREATEST(0, (EXTRACT(EPOCH FROM (now() - v_match.clock_updated_at)) * 1000)::INT);
    -- Usar el mayor entre servidor y cliente (anti-trampas leves / lag)
    v_spend := GREATEST(v_elapsed, GREATEST(COALESCE(p_time_spent_ms, 0), 0));
  ELSE
    v_spend := GREATEST(COALESCE(p_time_spent_ms, 0), 0);
  END IF;

  IF v_mp.petrificus_ready THEN
    v_spend := 0;
    UPDATE match_players SET petrificus_ready = FALSE WHERE id = v_mp.id;
  ELSIF v_mp.arresto_pending THEN
    v_spend := v_spend * 2;
    UPDATE match_players SET arresto_pending = FALSE WHERE id = v_mp.id;
  END IF;

  UPDATE match_players SET time_ms = GREATEST(time_ms - v_spend, 0) WHERE id = v_mp.id;
  IF v_mp.color = 'white' THEN
    UPDATE matches SET white_time_ms = GREATEST(white_time_ms - v_spend, 0) WHERE id = p_match_id;
  ELSE
    UPDATE matches SET black_time_ms = GREATEST(black_time_ms - v_spend, 0) WHERE id = p_match_id;
  END IF;

  SELECT COALESCE(MAX(ply), 0) + 1 INTO v_ply FROM match_moves WHERE match_id = p_match_id;

  INSERT INTO match_moves (
    match_id, ply, cycle_index, phase, dimension, kind, by_player_id,
    from_square, to_square, san, uci, fen_after, is_capture, is_check, is_mate,
    time_spent_ms, white_time_ms, black_time_ms, payload
  )
  SELECT p_match_id, v_ply, m.cycle_index, m.phase, m.current_dimension, 'chess', v_mp.id,
         lower(p_from), lower(p_to), p_san, p_uci, p_fen_after, p_is_capture, p_is_check, p_is_mate,
         v_spend, m.white_time_ms, m.black_time_ms, COALESCE(p_payload, '{}'::jsonb)
  FROM matches m WHERE m.id = p_match_id
  RETURNING * INTO v_move;

  IF (SELECT CASE WHEN v_mp.color = 'white' THEN white_time_ms ELSE black_time_ms END
        FROM matches WHERE id = p_match_id) <= 0 THEN
    PERFORM fn_finish_match(
      p_match_id,
      'timeout'::match_result,
      CASE WHEN v_mp.color = 'white' THEN v_match.black_id ELSE v_match.white_id END
    );
    RETURN v_move;
  END IF;

  IF p_is_capture AND v_match.current_dimension = 'ruina' THEN
    INSERT INTO match_board_cells (match_id, square, effect, created_cycle, is_active)
    VALUES (p_match_id, lower(p_to), 'ruined', v_match.cycle_index, TRUE)
    ON CONFLICT (match_id, square, effect) DO UPDATE
      SET is_active = TRUE, created_cycle = EXCLUDED.created_cycle;
  END IF;

  IF v_mp.giratiempo_active THEN
    IF p_is_check OR p_is_mate THEN
      UPDATE match_players SET giratiempo_active = FALSE, giratiempo_moves_left = 0 WHERE id = v_mp.id;
      v_keep_turn := FALSE;
    ELSE
      UPDATE match_players SET
        giratiempo_moves_left = giratiempo_moves_left - 1,
        giratiempo_captures = giratiempo_captures + CASE WHEN p_is_capture THEN 1 ELSE 0 END,
        giratiempo_active = (giratiempo_moves_left - 1 > 0) AND (giratiempo_captures + CASE WHEN p_is_capture THEN 1 ELSE 0 END) <= 1
      WHERE id = v_mp.id;
      SELECT giratiempo_active AND giratiempo_moves_left > 0 INTO v_keep_turn
      FROM match_players WHERE id = v_mp.id;
    END IF;
  END IF;

  IF v_keep_turn THEN
    v_parts := string_to_array(v_fen, ' ');
    IF array_length(v_parts, 1) >= 2 THEN
      v_parts[2] := CASE WHEN v_mp.color = 'white' THEN 'w' ELSE 'b' END;
      v_fen := array_to_string(v_parts, ' ');
    END IF;
  END IF;

  UPDATE matches SET
    fen = v_fen,
    turn_color = CASE
      WHEN v_keep_turn THEN v_mp.color
      ELSE CASE WHEN v_mp.color = 'white' THEN 'black'::player_color ELSE 'white'::player_color END
    END,
    moves_in_phase = moves_in_phase + 1,
    clock_running_for = CASE
      WHEN v_keep_turn THEN v_mp.color
      ELSE CASE WHEN v_mp.color = 'white' THEN 'black'::player_color ELSE 'white'::player_color END
    END,
    clock_updated_at = now(),
    fullmove_number = CASE WHEN v_mp.color = 'black' THEN fullmove_number + 1 ELSE fullmove_number END
  WHERE id = p_match_id;

  IF p_is_mate THEN
    PERFORM fn_finish_match(
      p_match_id,
      CASE WHEN v_mp.color = 'white' THEN 'white_win'::match_result ELSE 'black_win'::match_result END,
      v_profile.id
    );
  ELSE
    PERFORM fn_advance_after_action_moves(p_match_id);
  END IF;

  RETURN v_move;
END;
$$;

COMMIT;
