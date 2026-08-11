-- =============================================================================
-- Bot puede comprar en tienda: no marcar shop_ready hasta después de comprar
-- npm run db:patch:bot-shop
-- =============================================================================

BEGIN;

-- Antes: shop_ready = is_bot → fn_buy_joker rechazaba al bot ("already ready")
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

  -- Humanos y bots empiezan sin ready; el servidor compra por el bot y luego lo marca listo.
  UPDATE match_players SET shop_ready = FALSE WHERE match_id = p_match_id;

  FOR r IN SELECT id FROM match_players WHERE match_id = p_match_id LOOP
    PERFORM fn_open_shop_for_player(r.id);
  END LOOP;

  RETURN v_match;
END;
$$;

-- Permitir compra si es bot aunque estuviera ready (red de seguridad)
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
  IF v_mp.shop_ready AND NOT v_mp.is_bot THEN
    RAISE EXCEPTION 'already ready — waiting for opponent';
  END IF;

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

COMMIT;
