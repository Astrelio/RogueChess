-- =============================================================================
-- Ahogado → tablas + oferta/aceptación de tablas
-- npm run db:patch:stalemate-draw
-- =============================================================================

BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS draw_offered_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Reemplazar firma antigua (sin stalemate) para no dejar overload huérfano
DROP FUNCTION IF EXISTS fn_record_chess_move(TEXT, UUID, CHAR, CHAR, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, JSONB);

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
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_is_stalemate BOOLEAN DEFAULT FALSE
) RETURNS match_moves LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles; v_mp match_players; v_match matches; v_move match_moves; v_ply INT;
  v_spend INT;
  v_keep_turn BOOLEAN := FALSE;
  v_fen TEXT := p_fen_after;
  v_parts TEXT[];
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.status <> 'active' THEN RAISE EXCEPTION 'match not in action phase'; END IF;
  IF v_match.turn_color <> v_mp.color THEN RAISE EXCEPTION 'not your turn'; END IF;

  v_spend := GREATEST(COALESCE(p_time_spent_ms, 0), 0);
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
         v_spend, m.white_time_ms, m.black_time_ms,
         COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object('is_stalemate', COALESCE(p_is_stalemate, FALSE))
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
    IF p_is_check OR p_is_mate OR p_is_stalemate THEN
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
    fullmove_number = CASE WHEN v_mp.color = 'black' THEN fullmove_number + 1 ELSE fullmove_number END,
    draw_offered_by = NULL
  WHERE id = p_match_id;

  IF p_is_mate THEN
    PERFORM fn_finish_match(
      p_match_id,
      CASE WHEN v_mp.color = 'white' THEN 'white_win'::match_result ELSE 'black_win'::match_result END,
      v_profile.id
    );
  ELSIF p_is_stalemate THEN
    PERFORM fn_finish_match(p_match_id, 'draw'::match_result, NULL);
  ELSE
    PERFORM fn_advance_after_action_moves(p_match_id);
  END IF;

  RETURN v_move;
END;
$$;

CREATE OR REPLACE FUNCTION fn_offer_draw(p_firebase_uid TEXT, p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_profile profiles; v_mp match_players; v_match matches;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  IF v_mp.is_bot THEN RAISE EXCEPTION 'bots cannot offer draw'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.status <> 'active' THEN RAISE EXCEPTION 'match not active'; END IF;
  IF v_match.draw_offered_by = v_profile.id THEN
    RETURN v_match;
  END IF;
  -- Si el rival ya ofreció, aceptar automáticamente
  IF v_match.draw_offered_by IS NOT NULL AND v_match.draw_offered_by <> v_profile.id THEN
    RETURN fn_finish_match(p_match_id, 'draw'::match_result, NULL);
  END IF;
  UPDATE matches SET draw_offered_by = v_profile.id, updated_at = now() WHERE id = p_match_id
  RETURNING * INTO v_match;
  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION fn_respond_draw(
  p_firebase_uid TEXT,
  p_match_id UUID,
  p_accept BOOLEAN
) RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_profile profiles; v_mp match_players; v_match matches;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.status <> 'active' THEN RAISE EXCEPTION 'match not active'; END IF;
  IF v_match.draw_offered_by IS NULL THEN RAISE EXCEPTION 'no draw offer'; END IF;
  IF v_match.draw_offered_by = v_profile.id THEN RAISE EXCEPTION 'cannot respond to own offer'; END IF;

  IF p_accept THEN
    RETURN fn_finish_match(p_match_id, 'draw'::match_result, NULL);
  END IF;

  UPDATE matches SET draw_offered_by = NULL, updated_at = now() WHERE id = p_match_id
  RETURNING * INTO v_match;
  RETURN v_match;
END;
$$;

COMMIT;
