-- =============================================================================
-- RogueChess PATCH — Sin elección de baraja
-- Ejecutar en Neon SQL Editor (sobre el schema ya aplicado).
-- La tienda saca comodines aleatorios del pool completo (por rareza).
-- Las facciones (spectral/antimatter/tempus) quedan solo como sabor/categoría.
-- =============================================================================

BEGIN;

-- Sorteo global (todas las barajas)
CREATE OR REPLACE FUNCTION fn_pick_random_joker()
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_rarity joker_rarity;
  v_joker UUID;
  v_total INT;
  v_roll NUMERIC;
BEGIN
  SELECT COALESCE(SUM(weight), 0) INTO v_total FROM shop_rarity_weights;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'shop_rarity_weights empty';
  END IF;

  v_roll := random() * v_total;
  SELECT rarity INTO v_rarity FROM (
    SELECT rarity, weight, SUM(weight) OVER (ORDER BY rarity) AS cum
    FROM shop_rarity_weights
  ) w WHERE v_roll <= cum ORDER BY cum LIMIT 1;

  SELECT id INTO v_joker FROM jokers
  WHERE rarity = v_rarity AND is_active
  ORDER BY random() * shop_weight DESC
  LIMIT 1;

  IF v_joker IS NULL THEN
    SELECT id INTO v_joker FROM jokers
    WHERE is_active
    ORDER BY random() * shop_weight DESC
    LIMIT 1;
  END IF;

  RETURN v_joker;
END;
$$;

-- Compat: si algo aún llama la versión por facción, ignora facción y usa pool global
CREATE OR REPLACE FUNCTION fn_pick_joker_for_faction(p_faction deck_faction)
RETURNS UUID LANGUAGE plpgsql AS $$
BEGIN
  RETURN fn_pick_random_joker();
END;
$$;

CREATE OR REPLACE FUNCTION fn_open_shop_for_player(p_match_player_id UUID)
RETURNS SETOF shop_offers LANGUAGE plpgsql AS $$
DECLARE
  v_mp match_players;
  v_match matches;
  v_joker UUID;
  v_cost INTEGER;
  i INT;
BEGIN
  SELECT * INTO v_mp FROM match_players WHERE id = p_match_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'player not found'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = v_mp.match_id;

  UPDATE shop_offers SET expired = TRUE
  WHERE match_player_id = p_match_player_id
    AND cycle_index = v_match.cycle_index
    AND NOT purchased;

  FOR i IN 0..2 LOOP
    v_joker := fn_pick_random_joker();
    SELECT cost_seconds INTO v_cost FROM jokers WHERE id = v_joker;
    RETURN QUERY
    INSERT INTO shop_offers (match_id, match_player_id, cycle_index, slot_index, joker_id, cost_seconds)
    VALUES (v_mp.match_id, p_match_player_id, v_match.cycle_index, i, v_joker, v_cost)
    ON CONFLICT (match_id, match_player_id, cycle_index, slot_index) DO UPDATE
      SET joker_id = EXCLUDED.joker_id,
          cost_seconds = EXCLUDED.cost_seconds,
          purchased = FALSE,
          expired = FALSE
    RETURNING *;
  END LOOP;
END;
$$;

-- Arranque directo (sin selecting_deck)
CREATE OR REPLACE FUNCTION fn_start_match(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches;
BEGIN
  UPDATE matches SET
    status = 'active',
    phase = 'primo',
    started_at = COALESCE(started_at, now()),
    clock_running_for = 'white',
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

CREATE OR REPLACE FUNCTION fn_create_match(
  p_host_firebase_uid TEXT,
  p_mode match_mode DEFAULT 'quick',
  p_time_control_s INTEGER DEFAULT 300,
  p_host_color player_color DEFAULT 'white',
  p_deck deck_faction DEFAULT NULL, -- ignorado (compat)
  p_allow_spectators BOOLEAN DEFAULT TRUE,
  p_is_rated BOOLEAN DEFAULT TRUE
) RETURNS matches LANGUAGE plpgsql AS $$
DECLARE
  v_host profiles;
  v_match matches;
  v_code TEXT;
  v_ms INTEGER;
BEGIN
  SELECT * INTO v_host FROM profiles WHERE firebase_uid = p_host_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'host not found' USING ERRCODE = 'P0002'; END IF;

  v_ms := GREATEST(p_time_control_s, 60) * 1000;
  v_code := CASE WHEN p_mode = 'custom' THEN fn_generate_invite_code() ELSE NULL END;

  INSERT INTO matches (
    mode, status, phase, white_id, black_id, host_id,
    time_control_s, white_time_ms, black_time_ms,
    invite_code, allow_spectators, is_rated, current_dimension
  ) VALUES (
    p_mode,
    'waiting',
    'primo',
    CASE WHEN p_host_color = 'white' THEN v_host.id ELSE NULL END,
    CASE WHEN p_host_color = 'black' THEN v_host.id ELSE NULL END,
    v_host.id, GREATEST(p_time_control_s, 60), v_ms, v_ms,
    v_code, p_allow_spectators, CASE WHEN p_mode = 'bot' THEN FALSE ELSE p_is_rated END,
    'primo'
  ) RETURNING * INTO v_match;

  INSERT INTO match_players (match_id, profile_id, color, deck, time_ms, is_bot)
  VALUES (v_match.id, v_host.id, p_host_color, NULL, v_ms, FALSE);

  IF p_mode = 'custom' THEN
    INSERT INTO match_invites (match_id, from_profile_id, code)
    VALUES (v_match.id, v_host.id, v_match.invite_code);
  END IF;

  -- Bot: empareja YA y arranca
  IF p_mode = 'bot' THEN
    PERFORM fn_attach_bot(v_match.id);
    v_match := fn_start_match(v_match.id);
  END IF;

  UPDATE profiles SET presence = 'playing', last_seen_at = now() WHERE id = v_host.id;
  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION fn_join_match(
  p_firebase_uid TEXT,
  p_match_id UUID DEFAULT NULL,
  p_invite_code TEXT DEFAULT NULL,
  p_deck deck_faction DEFAULT NULL -- ignorado
) RETURNS matches LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles;
  v_match matches;
  v_color player_color;
  v_ms INTEGER;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002'; END IF;

  IF p_invite_code IS NOT NULL THEN
    SELECT m.* INTO v_match FROM matches m WHERE m.invite_code = upper(trim(p_invite_code)) FOR UPDATE;
  ELSE
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found' USING ERRCODE = 'P0002'; END IF;
  IF v_match.status NOT IN ('waiting') THEN RAISE EXCEPTION 'match not joinable' USING ERRCODE = 'P0001'; END IF;
  IF v_match.white_id = v_profile.id OR v_match.black_id = v_profile.id THEN
    RAISE EXCEPTION 'already in match' USING ERRCODE = 'P0001';
  END IF;

  IF v_match.white_id IS NULL THEN
    v_color := 'white';
    UPDATE matches SET white_id = v_profile.id WHERE id = v_match.id;
  ELSIF v_match.black_id IS NULL THEN
    v_color := 'black';
    UPDATE matches SET black_id = v_profile.id WHERE id = v_match.id;
  ELSE
    RAISE EXCEPTION 'match full' USING ERRCODE = 'P0001';
  END IF;

  v_ms := v_match.time_control_s * 1000;
  INSERT INTO match_players (match_id, profile_id, color, deck, time_ms)
  VALUES (v_match.id, v_profile.id, v_color, NULL, v_ms);

  UPDATE match_invites SET accepted = TRUE, to_profile_id = COALESCE(to_profile_id, v_profile.id)
  WHERE match_id = v_match.id AND NOT accepted;

  SELECT * INTO v_match FROM matches WHERE id = v_match.id;
  IF v_match.white_id IS NOT NULL AND v_match.black_id IS NOT NULL THEN
    v_match := fn_start_match(v_match.id);
  END IF;

  UPDATE profiles SET presence = 'playing', last_seen_at = now() WHERE id = v_profile.id;
  RETURN v_match;
END;
$$;

-- Deprecado: ya no se elige baraja; si se llama, solo arranca la partida
CREATE OR REPLACE FUNCTION fn_select_deck(
  p_firebase_uid TEXT, p_match_id UUID, p_deck deck_faction
) RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF v_match.status IN ('waiting', 'selecting_deck') THEN
    RETURN fn_start_match(p_match_id);
  END IF;
  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION fn_attach_bot(p_match_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_match matches; v_bot profiles; v_color player_color; v_ms INTEGER;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  SELECT * INTO v_bot FROM profiles WHERE username = 'roguebot';
  IF NOT FOUND THEN
    INSERT INTO profiles (firebase_uid, username, display_name, presence, is_banned)
    VALUES ('system:roguebot', 'roguebot', 'RogueBot', 'playing', FALSE)
    RETURNING * INTO v_bot;
  END IF;

  IF v_match.white_id IS NULL THEN
    v_color := 'white';
    UPDATE matches SET white_id = v_bot.id WHERE id = p_match_id;
  ELSIF v_match.black_id IS NULL THEN
    v_color := 'black';
    UPDATE matches SET black_id = v_bot.id WHERE id = p_match_id;
  ELSE
    RETURN;
  END IF;

  v_ms := v_match.time_control_s * 1000;
  INSERT INTO match_players (match_id, profile_id, color, deck, time_ms, is_bot)
  VALUES (p_match_id, v_bot.id, v_color, NULL, v_ms, TRUE)
  ON CONFLICT (match_id, profile_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION fn_enqueue_matchmaking(
  p_firebase_uid TEXT,
  p_deck deck_faction DEFAULT NULL, -- ignorado
  p_time_control_s INTEGER DEFAULT 300
) RETURNS matchmaking_queue LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles;
  v_row matchmaking_queue;
  v_opponent matchmaking_queue;
  v_match matches;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;

  UPDATE matchmaking_queue SET status = 'cancelled'
  WHERE profile_id = v_profile.id AND status = 'queued';

  INSERT INTO matchmaking_queue (profile_id, preferred_deck, time_control_s, rating_snapshot)
  VALUES (v_profile.id, NULL, GREATEST(p_time_control_s, 60), v_profile.rating)
  RETURNING * INTO v_row;

  SELECT * INTO v_opponent FROM matchmaking_queue
  WHERE status = 'queued' AND id <> v_row.id
    AND time_control_s = v_row.time_control_s
    AND abs(rating_snapshot - v_row.rating_snapshot) <= 200
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    v_match := fn_create_match(p_firebase_uid, 'quick', v_row.time_control_s, 'white', NULL, TRUE, TRUE);
    PERFORM fn_join_match(
      (SELECT firebase_uid FROM profiles WHERE id = v_opponent.profile_id),
      v_match.id, NULL, NULL
    );
    UPDATE matchmaking_queue SET status = 'matched', matched_match_id = v_match.id
    WHERE id IN (v_row.id, v_opponent.id);
    SELECT * INTO v_row FROM matchmaking_queue WHERE id = v_row.id;
  END IF;

  RETURN v_row;
END;
$$;

INSERT INTO app_meta (key, value) VALUES
  ('schema_version', '2.1.0-no-deck-select'),
  ('shop_mode', 'global_random_pool')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

COMMIT;

-- Verificación:
--   SELECT value FROM app_meta WHERE key = 'schema_version';
--   SELECT fn_pick_random_joker();
