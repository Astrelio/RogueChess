-- Emparejamiento rápido: sin filtro estricto de rating (hackathon / cola abierta).
-- npm run db:patch:matchmaking  (añadir script) o apply-sql.mjs

CREATE OR REPLACE FUNCTION fn_enqueue_matchmaking(
  p_firebase_uid TEXT,
  p_deck deck_faction DEFAULT NULL,
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

  -- Cualquier rival en cola con el mismo time control (FIFO)
  SELECT * INTO v_opponent FROM matchmaking_queue
  WHERE status = 'queued' AND id <> v_row.id
    AND time_control_s = v_row.time_control_s
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

CREATE OR REPLACE FUNCTION fn_cancel_matchmaking(p_firebase_uid TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles;
  v_n INTEGER;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  UPDATE matchmaking_queue SET status = 'cancelled'
  WHERE profile_id = v_profile.id AND status = 'queued';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
