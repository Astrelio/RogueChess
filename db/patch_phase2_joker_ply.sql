-- =============================================================================
-- RogueChess PATCH — fix ply en fn_consume_joker
-- El INSERT hacía MAX(ply) desde matches (sin columna ply).
-- Ejecutar: npm run db:patch:joker-ply
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_consume_joker(
  p_firebase_uid TEXT, p_match_id UUID, p_inventory_id UUID, p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS match_effects LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles; v_mp match_players; v_item match_inventory; v_joker jokers;
  v_effect match_effects; v_kind effect_kind; v_match matches;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  SELECT * INTO v_item FROM match_inventory WHERE id = p_inventory_id AND match_player_id = v_mp.id AND status = 'owned' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'joker not in inventory'; END IF;
  SELECT * INTO v_joker FROM jokers WHERE id = v_item.joker_id;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  v_kind := CASE v_joker.code
    WHEN 'paso_fantasma' THEN 'ghost_step'::effect_kind
    WHEN 'imperius' THEN 'imperius'::effect_kind
    WHEN 'capa_invisibilidad' THEN 'invisibility'::effect_kind
    WHEN 'morsmordre' THEN 'morsmordre'::effect_kind
    WHEN 'expecto_patronum' THEN 'expecto_patronum'::effect_kind
    WHEN 'bombarda' THEN 'bombarda_burn'::effect_kind
    WHEN 'aparicion' THEN 'aparicion'::effect_kind
    WHEN 'pocion_multijugos' THEN 'multijugos'::effect_kind
    WHEN 'defodio' THEN 'defodio_trap'::effect_kind
    WHEN 'avada_kedavra' THEN 'avada_kedavra'::effect_kind
    WHEN 'axio_tempus' THEN 'axio_tempus'::effect_kind
    WHEN 'arresto_momentum' THEN 'arresto_momentum'::effect_kind
    WHEN 'petrificus_totalus' THEN 'petrificus_totalus'::effect_kind
    WHEN 'giratiempo' THEN 'giratiempo'::effect_kind
    ELSE NULL
  END;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'unknown joker code %', v_joker.code; END IF;

  IF v_joker.code = 'expecto_patronum' THEN
    UPDATE matches SET expecto_patronum_active = TRUE WHERE id = p_match_id;
  END IF;

  IF v_joker.code = 'axio_tempus' THEN
    IF v_mp.color = 'white' THEN
      UPDATE matches SET white_time_ms = white_time_ms + 10000,
                         black_time_ms = GREATEST(black_time_ms - 10000, 0) WHERE id = p_match_id;
    ELSE
      UPDATE matches SET black_time_ms = black_time_ms + 10000,
                         white_time_ms = GREATEST(white_time_ms - 10000, 0) WHERE id = p_match_id;
    END IF;
    UPDATE match_players mp SET time_ms = CASE
      WHEN mp.color = v_mp.color THEN mp.time_ms + 10000
      ELSE GREATEST(mp.time_ms - 10000, 0) END
    WHERE mp.match_id = p_match_id;
  END IF;

  IF v_joker.code = 'petrificus_totalus' THEN
    UPDATE match_players SET petrificus_ready = TRUE WHERE id = v_mp.id;
  END IF;
  IF v_joker.code = 'arresto_momentum' THEN
    UPDATE match_players SET arresto_pending = TRUE
    WHERE match_id = p_match_id AND id <> v_mp.id;
  END IF;
  IF v_joker.code = 'giratiempo' THEN
    UPDATE match_players SET giratiempo_active = TRUE, giratiempo_moves_left = 2, giratiempo_captures = 0
    WHERE id = v_mp.id;
  END IF;

  UPDATE match_inventory SET status = 'consumed', used_at = now() WHERE id = v_item.id;

  INSERT INTO match_effects (match_id, kind, source_joker_id, applied_by, payload, is_active)
  VALUES (p_match_id, v_kind, v_joker.id, v_mp.id, COALESCE(p_payload, '{}'::jsonb), TRUE)
  RETURNING * INTO v_effect;

  INSERT INTO match_moves (match_id, ply, cycle_index, phase, dimension, kind, by_player_id, joker_id, inventory_id, payload)
  SELECT p_match_id,
         (SELECT COALESCE(MAX(mm.ply), 0) + 1 FROM match_moves mm WHERE mm.match_id = p_match_id),
         m.cycle_index, m.phase, m.current_dimension, 'joker_cast', v_mp.id, v_joker.id, v_item.id, p_payload
  FROM matches m WHERE m.id = p_match_id;

  RETURN v_effect;
END;
$$;

COMMIT;
