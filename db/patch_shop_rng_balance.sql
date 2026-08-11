-- =============================================================================
-- Shop más aleatorio: pesos planos + rareza 45/35/20 + 1 slot no-common
-- npm run db:patch:shop-rng
-- =============================================================================

BEGIN;

UPDATE jokers SET shop_weight = 1, updated_at = now() WHERE is_active = TRUE;

INSERT INTO shop_rarity_weights (rarity, weight) VALUES
  ('common', 45), ('epic', 35), ('legendary', 20)
ON CONFLICT (rarity) DO UPDATE SET weight = EXCLUDED.weight, updated_at = now();

CREATE OR REPLACE FUNCTION fn_open_shop_for_player(p_match_player_id UUID)
RETURNS SETOF shop_offers LANGUAGE plpgsql AS $$
DECLARE
  v_mp match_players;
  v_match matches;
  v_joker UUID;
  v_cost INTEGER;
  v_picked UUID[] := '{}'::uuid[];
  v_rarity joker_rarity;
  v_has_uncommon BOOLEAN := FALSE;
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
    IF i = 3 AND NOT v_has_uncommon THEN
      SELECT id, cost_seconds, rarity INTO v_joker, v_cost, v_rarity
      FROM jokers
      WHERE is_active AND rarity IN ('epic', 'legendary')
        AND NOT (id = ANY (v_picked))
      ORDER BY random() DESC
      LIMIT 1;
      IF v_joker IS NULL THEN
        v_joker := fn_pick_random_joker(v_picked);
        SELECT cost_seconds, rarity INTO v_cost, v_rarity FROM jokers WHERE id = v_joker;
      END IF;
    ELSE
      v_joker := fn_pick_random_joker(v_picked);
      SELECT cost_seconds, rarity INTO v_cost, v_rarity FROM jokers WHERE id = v_joker;
    END IF;

    v_picked := array_append(v_picked, v_joker);
    IF v_rarity IS DISTINCT FROM 'common' THEN
      v_has_uncommon := TRUE;
    END IF;

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

COMMIT;
