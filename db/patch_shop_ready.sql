-- =============================================================================
-- RogueChess PATCH — tienda: 60s + ready por jugador
-- npm run db:patch:shop-ready
-- =============================================================================

BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS shop_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shop_ends_at TIMESTAMPTZ;

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS shop_ready BOOLEAN NOT NULL DEFAULT FALSE;

-- Entrar a tienda: pausa reloj, deadline 60s, reset ready (bots listos al instante)
CREATE OR REPLACE FUNCTION fn_enter_shop_phase(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE
  v_match matches;
  r RECORD;
  v_elapsed INT;
  v_opened TIMESTAMPTZ := now();
  v_ends TIMESTAMPTZ := now() + interval '60 seconds';
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
    clock_updated_at = v_opened,
    shop_opened_at = v_opened,
    shop_ends_at = v_ends
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  UPDATE match_players SET
    shop_ready = is_bot
  WHERE match_id = p_match_id;

  FOR r IN SELECT id FROM match_players WHERE match_id = p_match_id LOOP
    PERFORM fn_open_shop_for_player(r.id);
  END LOOP;

  -- Solo humanos: si no hay humano (raro) o ambos ya ready (solo bots) → cerrar
  IF NOT EXISTS (
    SELECT 1 FROM match_players
    WHERE match_id = p_match_id AND NOT shop_ready
  ) THEN
    RETURN fn_close_shop(p_match_id);
  END IF;

  RETURN v_match;
END;
$$;

-- Cierre real de tienda → grieta (ambos listos o timeout)
CREATE OR REPLACE FUNCTION fn_close_shop(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
BEGIN
  UPDATE shop_offers so SET expired = TRUE
  FROM matches m
  WHERE so.match_id = p_match_id AND so.cycle_index = m.cycle_index AND NOT so.purchased;

  UPDATE matches SET
    status = 'dimension_reveal',
    shop_opened_at = NULL,
    shop_ends_at = NULL
  WHERE id = p_match_id;

  UPDATE match_players SET shop_ready = FALSE WHERE match_id = p_match_id;

  RETURN fn_reveal_dimension(p_match_id);
END;
$$;

-- Jugador termina de comprar (no cierra la fase hasta que todos estén listos)
CREATE OR REPLACE FUNCTION fn_player_ready_shop(p_firebase_uid TEXT, p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles;
  v_mp match_players;
  v_match matches;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF v_match.status <> 'shop' THEN
    RETURN v_match;
  END IF;

  -- Deadline vencido: forzar cierre
  IF v_match.shop_ends_at IS NOT NULL AND now() >= v_match.shop_ends_at THEN
    RETURN fn_close_shop(p_match_id);
  END IF;

  SELECT * INTO v_mp FROM match_players
  WHERE match_id = p_match_id AND profile_id = v_profile.id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;

  UPDATE match_players SET shop_ready = TRUE WHERE id = v_mp.id;

  IF NOT EXISTS (
    SELECT 1 FROM match_players
    WHERE match_id = p_match_id AND NOT shop_ready
  ) THEN
    RETURN fn_close_shop(p_match_id);
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  RETURN v_match;
END;
$$;

-- Cliente reclama cierre por tiempo de tienda
CREATE OR REPLACE FUNCTION fn_force_close_shop_if_due(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF v_match.status <> 'shop' THEN
    RETURN v_match;
  END IF;
  IF v_match.shop_ends_at IS NULL OR now() < v_match.shop_ends_at THEN
    RETURN v_match;
  END IF;
  RETURN fn_close_shop(p_match_id);
END;
$$;

-- Bloquear compras si ya marcó listo o se acabó el tiempo
CREATE OR REPLACE FUNCTION fn_buy_joker(
  p_firebase_uid TEXT, p_match_id UUID, p_offer_id UUID
) RETURNS match_inventory LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles; v_mp match_players; v_offer shop_offers; v_item match_inventory;
  v_owned INT; v_slot INT; v_ply INT; v_match matches;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF v_match.status <> 'shop' THEN RAISE EXCEPTION 'shop closed'; END IF;
  IF v_match.shop_ends_at IS NOT NULL AND now() >= v_match.shop_ends_at THEN
    PERFORM fn_close_shop(p_match_id);
    RAISE EXCEPTION 'shop time expired';
  END IF;

  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  IF v_mp.shop_ready THEN RAISE EXCEPTION 'already ready — waiting for opponent'; END IF;

  SELECT * INTO v_offer FROM shop_offers WHERE id = p_offer_id AND match_player_id = v_mp.id FOR UPDATE;
  IF NOT FOUND OR v_offer.purchased OR v_offer.expired THEN
    RAISE EXCEPTION 'offer unavailable';
  END IF;

  v_owned := fn_owned_inventory_count(v_mp.id);
  IF v_owned >= 3 THEN RAISE EXCEPTION 'inventory full — sell or use a joker first'; END IF;

  IF v_mp.time_ms < v_offer.cost_seconds * 1000 THEN
    RAISE EXCEPTION 'not enough time on clock';
  END IF;

  UPDATE match_players SET time_ms = time_ms - v_offer.cost_seconds * 1000 WHERE id = v_mp.id;
  IF v_mp.color = 'white' THEN
    UPDATE matches SET white_time_ms = white_time_ms - v_offer.cost_seconds * 1000 WHERE id = p_match_id;
  ELSE
    UPDATE matches SET black_time_ms = black_time_ms - v_offer.cost_seconds * 1000 WHERE id = p_match_id;
  END IF;

  SELECT COALESCE(MAX(slot_index) + 1, 0) INTO v_slot
  FROM match_inventory WHERE match_player_id = v_mp.id AND status = 'owned';

  INSERT INTO match_inventory (match_id, match_player_id, joker_id, status, acquired_cycle, purchased_cost_s, slot_index)
  VALUES (p_match_id, v_mp.id, v_offer.joker_id, 'owned', v_offer.cycle_index, v_offer.cost_seconds, LEAST(v_slot, 2))
  RETURNING * INTO v_item;

  UPDATE shop_offers SET purchased = TRUE WHERE id = v_offer.id;

  SELECT COALESCE(MAX(mm.ply), 0) + 1 INTO v_ply FROM match_moves mm WHERE mm.match_id = p_match_id;

  INSERT INTO match_moves (match_id, ply, cycle_index, phase, dimension, kind, by_player_id, joker_id, inventory_id, payload)
  SELECT p_match_id, v_ply, m.cycle_index, 'shop', m.current_dimension, 'shop_buy', v_mp.id, v_offer.joker_id, v_item.id,
         jsonb_build_object('cost_seconds', v_offer.cost_seconds)
  FROM matches m WHERE m.id = p_match_id;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION fn_sell_joker(
  p_firebase_uid TEXT, p_match_id UUID, p_inventory_id UUID
) RETURNS match_inventory LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles; v_mp match_players; v_item match_inventory; v_refund INT; v_ply INT;
  v_match matches;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF v_match.status <> 'shop' THEN RAISE EXCEPTION 'shop closed'; END IF;
  IF v_match.shop_ends_at IS NOT NULL AND now() >= v_match.shop_ends_at THEN
    PERFORM fn_close_shop(p_match_id);
    RAISE EXCEPTION 'shop time expired';
  END IF;

  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  IF v_mp.shop_ready THEN RAISE EXCEPTION 'already ready — waiting for opponent'; END IF;

  SELECT * INTO v_item FROM match_inventory WHERE id = p_inventory_id AND match_player_id = v_mp.id FOR UPDATE;
  IF NOT FOUND OR v_item.status <> 'owned' THEN RAISE EXCEPTION 'item not sellable'; END IF;

  v_refund := v_item.purchased_cost_s * 1000;
  UPDATE match_players SET time_ms = time_ms + v_refund WHERE id = v_mp.id;
  IF v_mp.color = 'white' THEN
    UPDATE matches SET white_time_ms = white_time_ms + v_refund WHERE id = p_match_id;
  ELSE
    UPDATE matches SET black_time_ms = black_time_ms + v_refund WHERE id = p_match_id;
  END IF;

  UPDATE match_inventory SET status = 'sold', sold_at = now(), slot_index = NULL
  WHERE id = v_item.id RETURNING * INTO v_item;

  SELECT COALESCE(MAX(mm.ply), 0) + 1 INTO v_ply FROM match_moves mm WHERE mm.match_id = p_match_id;

  INSERT INTO match_moves (match_id, ply, cycle_index, phase, dimension, kind, by_player_id, joker_id, inventory_id, payload)
  SELECT p_match_id, v_ply, m.cycle_index, m.phase, m.current_dimension, 'shop_sell', v_mp.id, v_item.joker_id, v_item.id,
         jsonb_build_object('refund_seconds', v_item.purchased_cost_s)
  FROM matches m WHERE m.id = p_match_id;

  RETURN v_item;
END;
$$;

COMMIT;
