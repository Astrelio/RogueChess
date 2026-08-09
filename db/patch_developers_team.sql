-- =============================================================================
-- RogueChess PATCH — Equipo real + fix super likes / hearts (ambigüedad OUT)
-- =============================================================================

BEGIN;

-- Desactivar placeholders viejos
-- Desactivar placeholders viejos / typo Astreli
UPDATE developers SET is_active = FALSE, updated_at = now()
WHERE slug IN ('lead', 'engine', 'realtime');

-- Renombrar fila existente Astreli → Astrelio (conserva hearts)
UPDATE developers
SET
  slug = 'astrelio',
  name = 'Astrelio',
  role = 'Conceptualización & gameplay',
  bio = 'Director de la idea y programador principal de las mecánicas y toda la lógica de partida.',
  avatar_url = '/devs/astrelio.webp',
  sort_order = 1,
  is_active = TRUE,
  updated_at = now()
WHERE slug = 'astreli'
  AND NOT EXISTS (SELECT 1 FROM developers d2 WHERE d2.slug = 'astrelio');

INSERT INTO developers (slug, name, role, bio, avatar_url, sort_order, is_active) VALUES
  (
    'astrelio',
    'Astrelio',
    'Conceptualización & gameplay',
    'Director de la idea y programador principal de las mecánicas y toda la lógica de partida.',
    '/devs/astrelio.webp',
    1,
    TRUE
  ),
  (
    'anderson',
    'Anderson Flores',
    'Animación & dimensiones',
    'Diseñó las animaciones de los comodines y de las dimensiones.',
    '/devs/anderson.webp',
    2,
    TRUE
  ),
  (
    'angel',
    'Angel Carias',
    'Sistemas sociales',
    'Ensambló la lógica de los sistemas sociales de la app: perfil, ranking, presencia y retos.',
    '/devs/angel.webp',
    3,
    TRUE
  ),
  (
    'ticas',
    'Oscar Ticas',
    'Audio',
    'Programó el reproductor de música nativo (aún en fase beta). También aportó al concepto de dimensiones y a varias mecánicas del juego.',
    '/devs/ticas.webp',
    4,
    TRUE
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Super like: OUT params no pueden llamarse como columnas (ambigüedad).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_give_super_like(TEXT, TEXT);
CREATE OR REPLACE FUNCTION fn_give_super_like(p_from_firebase_uid TEXT, p_to_username TEXT)
RETURNS TABLE (ok BOOLEAN, message TEXT, liked_profile_id UUID, popularity INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_from profiles;
  v_to profiles;
  v_today DATE := (now() AT TIME ZONE 'utc')::date;
  v_pop INTEGER;
BEGIN
  SELECT * INTO v_from FROM profiles WHERE firebase_uid = p_from_firebase_uid;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'sender not found'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_to FROM profiles WHERE lower(username) = lower(trim(p_to_username));
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'target not found'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_from.id = v_to.id THEN
    RETURN QUERY SELECT FALSE, 'cannot like yourself'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM super_likes sl
    WHERE sl.from_profile_id = v_from.id
      AND sl.to_profile_id = v_to.id
      AND sl.liked_on = v_today
  ) THEN
    SELECT p.popularity_score INTO v_pop FROM profiles p WHERE p.id = v_to.id;
    RETURN QUERY SELECT FALSE, 'already liked today'::TEXT, v_to.id, v_pop;
    RETURN;
  END IF;

  INSERT INTO super_likes (from_profile_id, to_profile_id, liked_on)
  VALUES (v_from.id, v_to.id, v_today);

  SELECT p.popularity_score INTO v_pop FROM profiles p WHERE p.id = v_to.id;
  RETURN QUERY SELECT TRUE, 'ok'::TEXT, v_to.id, v_pop;
END;
$$;

-- ---------------------------------------------------------------------------
-- Hearts a desarrolladores: mismo patrón de OUT params.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_give_developer_heart(TEXT, TEXT);
CREATE OR REPLACE FUNCTION fn_give_developer_heart(p_from_firebase_uid TEXT, p_developer_slug TEXT)
RETURNS TABLE (ok BOOLEAN, message TEXT, liked_developer_id UUID, hearts INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_from profiles;
  v_dev developers;
  v_hearts INTEGER;
BEGIN
  SELECT * INTO v_from FROM profiles WHERE firebase_uid = p_from_firebase_uid;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'sender not found'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_dev
  FROM developers
  WHERE slug = lower(trim(p_developer_slug)) AND is_active;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'developer not found'::TEXT, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM developer_hearts dh
    WHERE dh.from_profile_id = v_from.id AND dh.developer_id = v_dev.id
  ) THEN
    SELECT d.heart_count INTO v_hearts FROM developers d WHERE d.id = v_dev.id;
    RETURN QUERY SELECT FALSE, 'already hearted'::TEXT, v_dev.id, v_hearts;
    RETURN;
  END IF;

  INSERT INTO developer_hearts (from_profile_id, developer_id)
  VALUES (v_from.id, v_dev.id);

  SELECT d.heart_count INTO v_hearts FROM developers d WHERE d.id = v_dev.id;
  RETURN QUERY SELECT TRUE, 'ok'::TEXT, v_dev.id, v_hearts;
END;
$$;

COMMIT;
