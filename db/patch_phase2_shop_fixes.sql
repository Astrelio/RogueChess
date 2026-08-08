-- =============================================================================
-- RogueChess PATCH — shop 4 ofertas + fixes buy/superlike
-- Ejecutar en Neon (o: npm run db:patch:phase2)
-- =============================================================================

BEGIN;

-- 4 slots de tienda (0..3)
ALTER TABLE shop_offers DROP CONSTRAINT IF EXISTS shop_offers_slot_index_check;
ALTER TABLE shop_offers ADD CONSTRAINT shop_offers_slot_index_check
  CHECK (slot_index BETWEEN 0 AND 3);

-- Sorteo con exclusión (sin duplicados en el mismo ciclo)
CREATE OR REPLACE FUNCTION fn_pick_random_joker(p_exclude UUID[] DEFAULT '{}'::uuid[])
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
    AND NOT (id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
  ORDER BY random() * shop_weight DESC
  LIMIT 1;

  IF v_joker IS NULL THEN
    SELECT id INTO v_joker FROM jokers
    WHERE is_active
      AND NOT (id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
    ORDER BY random() * shop_weight DESC
    LIMIT 1;
  END IF;

  -- Si el pool se agota, permitir repetición
  IF v_joker IS NULL THEN
    SELECT id INTO v_joker FROM jokers
    WHERE is_active
    ORDER BY random() * shop_weight DESC
    LIMIT 1;
  END IF;

  RETURN v_joker;
END;
$$;

CREATE OR REPLACE FUNCTION fn_pick_joker_for_faction(p_faction deck_faction)
RETURNS UUID LANGUAGE plpgsql AS $$
BEGIN
  RETURN fn_pick_random_joker('{}'::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION fn_open_shop_for_player(p_match_player_id UUID)
RETURNS SETOF shop_offers LANGUAGE plpgsql AS $$
DECLARE
  v_mp match_players;
  v_match matches;
  v_joker UUID;
  v_cost INTEGER;
  v_picked UUID[] := '{}'::uuid[];
  i INT;
BEGIN
  SELECT * INTO v_mp FROM match_players WHERE id = p_match_player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'player not found'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = v_mp.match_id;

  UPDATE shop_offers SET expired = TRUE
  WHERE match_player_id = p_match_player_id
    AND cycle_index = v_match.cycle_index
    AND NOT purchased;

  FOR i IN 0..3 LOOP
    v_joker := fn_pick_random_joker(v_picked);
    v_picked := array_append(v_picked, v_joker);
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

-- Fix ply: MAX(ply) debe venir de match_moves, no de matches
CREATE OR REPLACE FUNCTION fn_buy_joker(
  p_firebase_uid TEXT, p_match_id UUID, p_offer_id UUID
) RETURNS match_inventory LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles; v_mp match_players; v_offer shop_offers; v_item match_inventory;
  v_owned INT; v_slot INT; v_ply INT;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;

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
DECLARE v_profile profiles; v_mp match_players; v_item match_inventory; v_refund INT; v_ply INT;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;

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

-- Fix ambigüedad to_profile_id (RETURNS TABLE vs columna)
CREATE OR REPLACE FUNCTION fn_give_super_like(p_from_firebase_uid TEXT, p_to_username TEXT)
RETURNS TABLE (ok BOOLEAN, message TEXT, to_profile_id UUID, popularity_score INTEGER)
LANGUAGE plpgsql AS $$
DECLARE v_from profiles; v_to profiles; v_today DATE := (now() AT TIME ZONE 'utc')::date;
BEGIN
  SELECT * INTO v_from FROM profiles WHERE firebase_uid = p_from_firebase_uid;
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'sender not found'::TEXT, NULL::UUID, NULL::INTEGER; RETURN; END IF;
  SELECT * INTO v_to FROM profiles WHERE lower(username) = lower(trim(p_to_username));
  IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'target not found'::TEXT, NULL::UUID, NULL::INTEGER; RETURN; END IF;
  IF v_from.id = v_to.id THEN RETURN QUERY SELECT FALSE, 'cannot like yourself'::TEXT, NULL::UUID, NULL::INTEGER; RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM super_likes sl
    WHERE sl.from_profile_id = v_from.id
      AND sl.to_profile_id = v_to.id
      AND sl.liked_on = v_today
  ) THEN
    RETURN QUERY SELECT FALSE, 'already liked today'::TEXT, v_to.id, v_to.popularity_score; RETURN;
  END IF;
  INSERT INTO super_likes (from_profile_id, to_profile_id, liked_on) VALUES (v_from.id, v_to.id, v_today);
  SELECT p.popularity_score INTO v_to.popularity_score FROM profiles p WHERE p.id = v_to.id;
  RETURN QUERY SELECT TRUE, 'ok'::TEXT, v_to.id, v_to.popularity_score;
END;
$$;

COMMIT;
