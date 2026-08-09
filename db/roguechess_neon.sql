-- =============================================================================
-- RogueChess — Neon PostgreSQL COMPLETE BOOTSTRAP (UN SOLO SCRIPT)
-- Ejecutar UNA VEZ en el SQL Editor de Neon (o psql).
-- Idempotente: IF NOT EXISTS / OR REPLACE / ON CONFLICT / DO EXCEPTION.
-- Cubre TODO el producto: perfiles, ranking, partidas, dimensiones, barajas,
-- comodines, tienda, inventario, efectos, espectadores, emojis, matchmaking.
--
-- Si un run anterior falló: pulsa ROLLBACK en Neon y vuelve a ejecutar este archivo.
-- =============================================================================

BEGIN;

-- Si un intento anterior dejó la sesión en abort: limpia y sigue
-- (en Neon SQL Editor: también puedes pulsar ROLLBACK antes de re-ejecutar)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN CREATE TYPE presence_status AS ENUM ('offline','online','away','playing','spectating');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE deck_faction AS ENUM ('spectral','antimatter','tempus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE joker_rarity AS ENUM ('common','epic','legendary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE joker_timing AS ENUM ('instant','active','passive','duration');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dimension_code AS ENUM (
  'primo','espejo','bluriel','gravitacional','cadena_sangre','ruina','mercado_negro','fragilidad'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE match_mode AS ENUM ('quick','custom','bot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE match_status AS ENUM (
  'waiting','selecting_deck','active','shop','dimension_reveal','finished','aborted'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE match_phase AS ENUM ('primo','action','shop','grieta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE match_result AS ENUM ('white_win','black_win','draw','abort','resign','timeout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE player_color AS ENUM ('white','black');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE piece_kind AS ENUM ('p','n','b','r','q','k');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE board_cell_effect AS ENUM (
  'none','ruined','burned','monolith','trap_defodio'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE effect_kind AS ENUM (
  'ghost_step','imperius','invisibility','morsmordre','expecto_patronum',
  'bombarda_burn','aparicion','multijugos','defodio_trap','avada_kedavra',
  'axio_tempus','arresto_momentum','petrificus_totalus','giratiempo',
  'mirror_controls','bluriel_fog','gravity_cap','blood_chain','ruin_zone',
  'monolith_time','fragility_crystal','check_priority','king_immunity'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE inventory_item_status AS ENUM ('owned','offered','sold','consumed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE move_kind AS ENUM (
  'chess','joker_cast','shop_buy','shop_sell','resign','timeout','system','emoji'
);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE queue_status AS ENUM ('queued','matched','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Si ya corriste el script de Fase 1, completa valores de enums existentes
DO $$ BEGIN ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'selecting_deck'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'shop'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE match_status ADD VALUE IF NOT EXISTS 'dimension_reveal'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE match_result ADD VALUE IF NOT EXISTS 'resign'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE match_result ADD VALUE IF NOT EXISTS 'timeout'; EXCEPTION WHEN others THEN NULL; END $$;

-- =============================================================================
-- PERFILES / SOCIAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid      TEXT NOT NULL UNIQUE,
  email             TEXT,
  username          TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  avatar_url        TEXT,
  bio               TEXT,
  mood_text         VARCHAR(80),
  mood_emoji        VARCHAR(16),
  mood_updated_at   TIMESTAMPTZ,
  presence          presence_status NOT NULL DEFAULT 'offline',
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  rating            INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  peak_rating       INTEGER NOT NULL DEFAULT 1000 CHECK (peak_rating >= 0),
  wins              INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses            INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws             INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  games_played      INTEGER NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  popularity_score  INTEGER NOT NULL DEFAULT 0 CHECK (popularity_score >= 0),
  preferred_deck    deck_faction,
  is_banned         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$'),
  CONSTRAINT profiles_display_name_len CHECK (char_length(display_name) BETWEEN 1 AND 48),
  CONSTRAINT profiles_mood_text_len CHECK (mood_text IS NULL OR char_length(mood_text) <= 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx ON profiles (lower(username));
CREATE INDEX IF NOT EXISTS profiles_rating_idx ON profiles (rating DESC, popularity_score DESC);
CREATE INDEX IF NOT EXISTS profiles_presence_idx ON profiles (presence) WHERE presence <> 'offline';
CREATE INDEX IF NOT EXISTS profiles_popularity_idx ON profiles (popularity_score DESC);
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON profiles (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS super_likes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  liked_on         DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT super_likes_no_self CHECK (from_profile_id <> to_profile_id),
  CONSTRAINT super_likes_once_per_day UNIQUE (from_profile_id, to_profile_id, liked_on)
);
CREATE INDEX IF NOT EXISTS super_likes_to_idx ON super_likes (to_profile_id, liked_on DESC);
CREATE INDEX IF NOT EXISTS super_likes_from_idx ON super_likes (from_profile_id, liked_on DESC);

CREATE TABLE IF NOT EXISTS developers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  github_url    TEXT,
  twitter_url   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  heart_count   INTEGER NOT NULL DEFAULT 0 CHECK (heart_count >= 0),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT developers_slug_format CHECK (slug ~ '^[a-z0-9-]{2,40}$')
);

CREATE TABLE IF NOT EXISTS developer_hearts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  developer_id     UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT developer_hearts_once UNIQUE (from_profile_id, developer_id)
);
CREATE INDEX IF NOT EXISTS developer_hearts_dev_idx ON developer_hearts (developer_id);

CREATE TABLE IF NOT EXISTS rating_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta        INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  reason       TEXT NOT NULL DEFAULT 'manual',
  match_id     UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rating_events_profile_idx ON rating_events (profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_meta (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- CATÁLOGO: DIMENSIONES + COMODINES (seed estático del GDD)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dimensions (
  code              dimension_code PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  description       TEXT NOT NULL,
  rules_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  visual_hint       TEXT,
  can_kill_pieces   BOOLEAN NOT NULL DEFAULT FALSE, -- entorno NUNCA elimina salvo fragilidad (especial)
  weight            INTEGER NOT NULL DEFAULT 1 CHECK (weight >= 0), -- 0 = no sale en grieta (primo)
  is_playable       BOOLEAN NOT NULL DEFAULT TRUE,  -- 'primo' no sale en grieta
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jokers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,           -- p.ej. paso_fantasma
  name              TEXT NOT NULL,
  faction           deck_faction NOT NULL,
  rarity            joker_rarity NOT NULL,
  timing            joker_timing NOT NULL DEFAULT 'instant',
  cost_seconds      INTEGER NOT NULL CHECK (cost_seconds >= 0),
  description       TEXT NOT NULL,
  rules_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  can_kill_king     BOOLEAN NOT NULL DEFAULT FALSE, -- siempre false por Regla de Oro
  shop_weight       INTEGER NOT NULL DEFAULT 1 CHECK (shop_weight > 0),
  is_passive        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  design_hint       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jokers_faction_rarity_idx ON jokers (faction, rarity);
CREATE INDEX IF NOT EXISTS jokers_active_idx ON jokers (is_active) WHERE is_active;

-- Probabilidades de rareza en tienda (por facción o global)
CREATE TABLE IF NOT EXISTS shop_rarity_weights (
  rarity        joker_rarity PRIMARY KEY,
  weight        INTEGER NOT NULL CHECK (weight > 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- PARTIDAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode                match_mode NOT NULL DEFAULT 'quick',
  status              match_status NOT NULL DEFAULT 'waiting',
  phase               match_phase NOT NULL DEFAULT 'primo',
  result              match_result,
  -- jugadores (denormalizados para queries rápidas)
  white_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  black_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  winner_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- tiempo
  time_control_s      INTEGER NOT NULL DEFAULT 300 CHECK (time_control_s > 0), -- 5 min default
  white_time_ms       INTEGER NOT NULL DEFAULT 300000 CHECK (white_time_ms >= 0),
  black_time_ms       INTEGER NOT NULL DEFAULT 300000 CHECK (black_time_ms >= 0),
  clock_running_for   player_color, -- a quién le corre el reloj ahora
  clock_updated_at    TIMESTAMPTZ,
  -- ciclo / grieta
  cycle_index         INTEGER NOT NULL DEFAULT 0 CHECK (cycle_index >= 0),
  moves_in_phase      INTEGER NOT NULL DEFAULT 0 CHECK (moves_in_phase >= 0),
  moves_per_phase     INTEGER NOT NULL DEFAULT 8 CHECK (moves_per_phase > 0), -- 8 total (4 por jugador)
  current_dimension   dimension_code NOT NULL DEFAULT 'primo',
  -- tablero
  fen                 TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn_color          player_color NOT NULL DEFAULT 'white',
  halfmove_clock      INTEGER NOT NULL DEFAULT 0,
  fullmove_number     INTEGER NOT NULL DEFAULT 1,
  -- flags de reglas de oro / globales
  expecto_patronum_active BOOLEAN NOT NULL DEFAULT FALSE, -- anula Morsmordre toda la partida (lado que lo activó o global)
  -- custom
  invite_code         TEXT UNIQUE,
  host_id             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  allow_spectators    BOOLEAN NOT NULL DEFAULT TRUE,
  max_spectators      INTEGER NOT NULL DEFAULT 50 CHECK (max_spectators >= 0),
  is_rated            BOOLEAN NOT NULL DEFAULT TRUE,
  portal_room_id      TEXT, -- sync realtime Portal
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matches_players_distinct CHECK (white_id IS NULL OR black_id IS NULL OR white_id <> black_id)
);

CREATE INDEX IF NOT EXISTS matches_status_idx ON matches (status);
CREATE INDEX IF NOT EXISTS matches_players_idx ON matches (white_id, black_id);
CREATE INDEX IF NOT EXISTS matches_invite_idx ON matches (invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS matches_active_idx ON matches (status) WHERE status IN ('active','shop','dimension_reveal','selecting_deck');

-- Upgrade desde schema Fase 1 (no-op si ya están las columnas)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS phase match_phase NOT NULL DEFAULT 'primo';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS clock_running_for player_color;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS clock_updated_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS cycle_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS moves_in_phase INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS moves_per_phase INTEGER NOT NULL DEFAULT 8;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_dimension dimension_code NOT NULL DEFAULT 'primo';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS turn_color player_color NOT NULL DEFAULT 'white';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS halfmove_clock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS fullmove_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS expecto_patronum_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS allow_spectators BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_spectators INTEGER NOT NULL DEFAULT 50;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_rated BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS portal_room_id TEXT;
ALTER TABLE matches ALTER COLUMN white_time_ms SET DEFAULT 300000;
ALTER TABLE matches ALTER COLUMN black_time_ms SET DEFAULT 300000;

CREATE TABLE IF NOT EXISTS match_players (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  color               player_color NOT NULL,
  deck                deck_faction, -- legacy; ya no se elige baraja (tienda = pool global)
  time_ms             INTEGER NOT NULL DEFAULT 300000 CHECK (time_ms >= 0),
  inventory_slots     INTEGER NOT NULL DEFAULT 3 CHECK (inventory_slots BETWEEN 1 AND 3),
  is_bot              BOOLEAN NOT NULL DEFAULT FALSE,
  has_resigned        BOOLEAN NOT NULL DEFAULT FALSE,
  connected           BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- flags de efectos personales
  petrificus_ready    BOOLEAN NOT NULL DEFAULT FALSE, -- próximo movimiento detiene reloj
  arresto_pending     BOOLEAN NOT NULL DEFAULT FALSE, -- próximo turno rival x2 (si no petrificus)
  giratiempo_active   BOOLEAN NOT NULL DEFAULT FALSE,
  giratiempo_moves_left INTEGER NOT NULL DEFAULT 0,
  giratiempo_captures INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_players_unique_profile UNIQUE (match_id, profile_id),
  CONSTRAINT match_players_unique_color UNIQUE (match_id, color)
);

CREATE INDEX IF NOT EXISTS match_players_profile_idx ON match_players (profile_id);

-- Ofertas de tienda por ciclo (3 cartas al azar de la baraja del jugador)
CREATE TABLE IF NOT EXISTS shop_offers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  match_player_id   UUID NOT NULL REFERENCES match_players(id) ON DELETE CASCADE,
  cycle_index       INTEGER NOT NULL CHECK (cycle_index >= 0),
  slot_index        SMALLINT NOT NULL CHECK (slot_index BETWEEN 0 AND 3),
  joker_id          UUID NOT NULL REFERENCES jokers(id),
  cost_seconds      INTEGER NOT NULL CHECK (cost_seconds >= 0),
  purchased         BOOLEAN NOT NULL DEFAULT FALSE,
  expired           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_offers_unique_slot UNIQUE (match_id, match_player_id, cycle_index, slot_index)
);
CREATE INDEX IF NOT EXISTS shop_offers_player_cycle_idx ON shop_offers (match_player_id, cycle_index);

-- Inventario de comodines (máx 3 owned activos por jugador/partida)
CREATE TABLE IF NOT EXISTS match_inventory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  match_player_id   UUID NOT NULL REFERENCES match_players(id) ON DELETE CASCADE,
  joker_id          UUID NOT NULL REFERENCES jokers(id),
  status            inventory_item_status NOT NULL DEFAULT 'owned',
  acquired_cycle    INTEGER NOT NULL DEFAULT 0,
  purchased_cost_s  INTEGER NOT NULL DEFAULT 0,
  slot_index        SMALLINT CHECK (slot_index IS NULL OR slot_index BETWEEN 0 AND 2),
  used_at           TIMESTAMPTZ,
  sold_at           TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_inventory_owned_idx
  ON match_inventory (match_player_id, status) WHERE status = 'owned';

-- Efectos activos (comodines + dimensión)
CREATE TABLE IF NOT EXISTS match_effects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  kind              effect_kind NOT NULL,
  source_joker_id   UUID REFERENCES jokers(id),
  source_dimension  dimension_code,
  applied_by        UUID REFERENCES match_players(id) ON DELETE SET NULL,
  target_player_id  UUID REFERENCES match_players(id) ON DELETE SET NULL,
  target_square     CHAR(2),          -- e.g. e4
  target_piece_id   TEXT,             -- id lógico de pieza en el motor
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at_ply     INTEGER,
  ends_at_ply       INTEGER,
  expires_at        TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_effects_active_idx ON match_effects (match_id) WHERE is_active;

-- Casillas especiales del tablero (ruina, burn, monolitos, trampas)
CREATE TABLE IF NOT EXISTS match_board_cells (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  square            CHAR(2) NOT NULL, -- a1..h8
  effect            board_cell_effect NOT NULL DEFAULT 'none',
  owner_player_id   UUID REFERENCES match_players(id) ON DELETE SET NULL, -- trampa / monolito absorbido
  time_bonus_min_s  INTEGER, -- monolitos 40-60
  time_bonus_max_s  INTEGER,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_cycle     INTEGER NOT NULL DEFAULT 0,
  expires_cycle     INTEGER, -- burn temporal; ruina = resto de la fase
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_board_cells_square CHECK (square ~ '^[a-h][1-8]$'),
  CONSTRAINT match_board_cells_unique UNIQUE (match_id, square, effect)
);
CREATE INDEX IF NOT EXISTS match_board_cells_active_idx
  ON match_board_cells (match_id) WHERE is_active;

-- Marcadores de piezas (peón coronado, invisibilidad Bluriel/capa, etc.)
CREATE TABLE IF NOT EXISTS match_piece_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  piece_uid         TEXT NOT NULL, -- id estable en el motor (no solo casilla)
  color             player_color NOT NULL,
  kind              piece_kind NOT NULL,
  square            CHAR(2),
  was_pawn          BOOLEAN NOT NULL DEFAULT FALSE, -- crítico para Avada Kedavra
  is_invisible      BOOLEAN NOT NULL DEFAULT FALSE, -- Bluriel / capa
  is_ghost          BOOLEAN NOT NULL DEFAULT FALSE,
  imperius_by       UUID REFERENCES match_players(id) ON DELETE SET NULL,
  multijugos_queen  BOOLEAN NOT NULL DEFAULT FALSE, -- reina falsa 1 turno
  multijugos_dies_ply INTEGER,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_piece_flags_unique UNIQUE (match_id, piece_uid),
  CONSTRAINT match_piece_flags_square CHECK (square IS NULL OR square ~ '^[a-h][1-8]$')
);
CREATE INDEX IF NOT EXISTS match_piece_flags_match_idx ON match_piece_flags (match_id);

-- Historial de movimientos / eventos
CREATE TABLE IF NOT EXISTS match_moves (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  ply               INTEGER NOT NULL CHECK (ply >= 0),
  cycle_index       INTEGER NOT NULL DEFAULT 0,
  phase             match_phase NOT NULL,
  dimension         dimension_code NOT NULL,
  kind              move_kind NOT NULL DEFAULT 'chess',
  by_player_id      UUID REFERENCES match_players(id) ON DELETE SET NULL,
  from_square       CHAR(2),
  to_square         CHAR(2),
  san               TEXT,
  uci               TEXT,
  fen_after         TEXT,
  joker_id          UUID REFERENCES jokers(id),
  inventory_id      UUID REFERENCES match_inventory(id) ON DELETE SET NULL,
  time_spent_ms     INTEGER,
  white_time_ms     INTEGER,
  black_time_ms     INTEGER,
  is_capture        BOOLEAN NOT NULL DEFAULT FALSE,
  is_check          BOOLEAN NOT NULL DEFAULT FALSE,
  is_mate           BOOLEAN NOT NULL DEFAULT FALSE,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_moves_unique_ply UNIQUE (match_id, ply, kind)
);
CREATE INDEX IF NOT EXISTS match_moves_match_idx ON match_moves (match_id, ply);

-- Dimensiones usadas por ciclo (historial de grietas)
CREATE TABLE IF NOT EXISTS match_dimension_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  cycle_index       INTEGER NOT NULL,
  dimension         dimension_code NOT NULL,
  revealed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_dimension_history_unique UNIQUE (match_id, cycle_index)
);

-- =============================================================================
-- ESPECTADORES + EMOJIS
-- =============================================================================

CREATE TABLE IF NOT EXISTS match_spectators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at           TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT match_spectators_unique UNIQUE (match_id, profile_id)
);
CREATE INDEX IF NOT EXISTS match_spectators_active_idx
  ON match_spectators (match_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS spectator_emojis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  from_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji             VARCHAR(16) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spectator_emojis_match_idx ON spectator_emojis (match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS spectator_emojis_cooldown_idx
  ON spectator_emojis (from_profile_id, match_id, created_at DESC);

-- =============================================================================
-- MATCHMAKING / COLA / INVITACIONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_deck    deck_faction,
  time_control_s    INTEGER NOT NULL DEFAULT 300,
  status            queue_status NOT NULL DEFAULT 'queued',
  rating_snapshot   INTEGER NOT NULL DEFAULT 1000,
  matched_match_id  UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes'),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matchmaking_queue_open_idx
  ON matchmaking_queue (status, rating_snapshot) WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS match_invites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  from_profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id     UUID REFERENCES profiles(id) ON DELETE CASCADE, -- null = link abierto
  code              TEXT NOT NULL UNIQUE,
  accepted          BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_invites_to_idx ON match_invites (to_profile_id) WHERE NOT accepted;

-- FK tardía rating_events.match_id
DO $$ BEGIN
  ALTER TABLE rating_events
    ADD CONSTRAINT rating_events_match_fk
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

DROP TRIGGER IF EXISTS developers_set_updated_at ON developers;
CREATE TRIGGER developers_set_updated_at BEFORE UPDATE ON developers
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

DROP TRIGGER IF EXISTS matches_set_updated_at ON matches;
CREATE TRIGGER matches_set_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

DROP TRIGGER IF EXISTS match_players_set_updated_at ON match_players;
CREATE TRIGGER match_players_set_updated_at BEFORE UPDATE ON match_players
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

DROP TRIGGER IF EXISTS match_inventory_set_updated_at ON match_inventory;
CREATE TRIGGER match_inventory_set_updated_at BEFORE UPDATE ON match_inventory
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

DROP TRIGGER IF EXISTS jokers_set_updated_at ON jokers;
CREATE TRIGGER jokers_set_updated_at BEFORE UPDATE ON jokers
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

DROP TRIGGER IF EXISTS matchmaking_queue_set_updated_at ON matchmaking_queue;
CREATE TRIGGER matchmaking_queue_set_updated_at BEFORE UPDATE ON matchmaking_queue
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE OR REPLACE FUNCTION trg_super_like_popularity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET popularity_score = popularity_score + 1 WHERE id = NEW.to_profile_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET popularity_score = GREATEST(popularity_score - 1, 0) WHERE id = OLD.to_profile_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS super_likes_popularity ON super_likes;
CREATE TRIGGER super_likes_popularity AFTER INSERT OR DELETE ON super_likes
  FOR EACH ROW EXECUTE PROCEDURE trg_super_like_popularity();

CREATE OR REPLACE FUNCTION trg_developer_heart_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE developers SET heart_count = heart_count + 1 WHERE id = NEW.developer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE developers SET heart_count = GREATEST(heart_count - 1, 0) WHERE id = OLD.developer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS developer_hearts_count ON developer_hearts;
CREATE TRIGGER developer_hearts_count AFTER INSERT OR DELETE ON developer_hearts
  FOR EACH ROW EXECUTE PROCEDURE trg_developer_heart_count();

CREATE OR REPLACE FUNCTION trg_profiles_peak_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rating > COALESCE(NEW.peak_rating, 0) THEN NEW.peak_rating := NEW.rating; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_peak_rating ON profiles;
CREATE TRIGGER profiles_peak_rating BEFORE INSERT OR UPDATE OF rating ON profiles
  FOR EACH ROW EXECUTE PROCEDURE trg_profiles_peak_rating();

-- Inventario: máximo 3 owned
CREATE OR REPLACE FUNCTION trg_inventory_max_three()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NEW.status = 'owned' THEN
    SELECT COUNT(*) INTO v_count
    FROM match_inventory
    WHERE match_player_id = NEW.match_player_id AND status = 'owned'
      AND id IS DISTINCT FROM NEW.id;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'inventory full (max 3 jokers)' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_inventory_max_three ON match_inventory;
CREATE TRIGGER match_inventory_max_three BEFORE INSERT OR UPDATE OF status ON match_inventory
  FOR EACH ROW EXECUTE PROCEDURE trg_inventory_max_three();

-- =============================================================================
-- VISTAS
-- =============================================================================

CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
  p.id, p.username, p.display_name, p.avatar_url, p.mood_text, p.mood_emoji,
  p.presence, p.rating, p.peak_rating, p.wins, p.losses, p.draws, p.games_played,
  p.popularity_score,
  RANK() OVER (ORDER BY p.rating DESC, p.wins DESC, p.popularity_score DESC, p.created_at ASC) AS rank_pos,
  CASE
    WHEN RANK() OVER (ORDER BY p.rating DESC, p.wins DESC, p.popularity_score DESC, p.created_at ASC) = 1 THEN 'gold'
    WHEN RANK() OVER (ORDER BY p.rating DESC, p.wins DESC, p.popularity_score DESC, p.created_at ASC) = 2 THEN 'silver'
    WHEN RANK() OVER (ORDER BY p.rating DESC, p.wins DESC, p.popularity_score DESC, p.created_at ASC) = 3 THEN 'bronze'
    ELSE 'none'
  END AS medal,
  p.last_seen_at, p.created_at
FROM profiles p
WHERE p.is_banned = FALSE;

CREATE OR REPLACE VIEW v_profile_public AS
SELECT id, username, display_name, avatar_url, bio, mood_text, mood_emoji, mood_updated_at,
       presence, last_seen_at, rating, peak_rating, wins, losses, draws, games_played,
       popularity_score, preferred_deck, created_at
FROM profiles WHERE is_banned = FALSE;

CREATE OR REPLACE VIEW v_developers_public AS
SELECT id, slug, name, role, bio, avatar_url, github_url, twitter_url, heart_count, sort_order
FROM developers WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC;

CREATE OR REPLACE VIEW v_jokers_catalog AS
SELECT id, code, name, faction, rarity, timing, cost_seconds, description,
       rules_json, is_passive, is_active, shop_weight, design_hint
FROM jokers WHERE is_active = TRUE;

CREATE OR REPLACE VIEW v_match_live AS
SELECT
  m.id, m.mode, m.status, m.phase, m.cycle_index, m.moves_in_phase, m.current_dimension,
  m.fen, m.turn_color, m.white_time_ms, m.black_time_ms, m.clock_running_for,
  m.allow_spectators, m.is_rated, m.portal_room_id, m.started_at, m.created_at,
  mw.username AS white_username, mb.username AS black_username,
  m.white_id, m.black_id
FROM matches m
LEFT JOIN profiles mw ON mw.id = m.white_id
LEFT JOIN profiles mb ON mb.id = m.black_id
WHERE m.status IN ('waiting','selecting_deck','active','shop','dimension_reveal');

-- =============================================================================
-- FUNCIONES SOCIAL / PERFIL
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_unique_username(p_base TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_base TEXT; v_candidate TEXT; v_i INTEGER := 0;
BEGIN
  v_base := lower(regexp_replace(COALESCE(NULLIF(trim(p_base), ''), 'player'), '[^a-z0-9_]', '', 'g'));
  IF char_length(v_base) < 3 THEN v_base := rpad(v_base, 3, '0'); END IF;
  IF char_length(v_base) > 20 THEN v_base := left(v_base, 20); END IF;
  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE lower(username) = v_candidate) LOOP
    v_i := v_i + 1;
    v_candidate := left(v_base, 20 - char_length(v_i::text)) || v_i::text;
    IF v_i > 9999 THEN
      v_candidate := 'p' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      EXIT;
    END IF;
  END LOOP;
  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION fn_upsert_profile(
  p_firebase_uid TEXT, p_email TEXT DEFAULT NULL, p_display_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL, p_username_hint TEXT DEFAULT NULL
) RETURNS profiles LANGUAGE plpgsql AS $$
DECLARE v_row profiles; v_name TEXT; v_user TEXT;
BEGIN
  IF p_firebase_uid IS NULL OR length(trim(p_firebase_uid)) = 0 THEN
    RAISE EXCEPTION 'firebase_uid required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF FOUND THEN
    UPDATE profiles SET
      email = COALESCE(p_email, email),
      display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      presence = CASE WHEN presence = 'offline' THEN 'online'::presence_status ELSE presence END,
      last_seen_at = now()
    WHERE id = v_row.id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;
  v_name := COALESCE(NULLIF(trim(p_display_name), ''), split_part(COALESCE(p_email, 'player'), '@', 1), 'Player');
  v_user := fn_unique_username(COALESCE(NULLIF(trim(p_username_hint), ''), v_name));
  INSERT INTO profiles (firebase_uid, email, username, display_name, avatar_url, presence, last_seen_at)
  VALUES (p_firebase_uid, p_email, v_user, left(v_name, 48), p_avatar_url, 'online', now())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION fn_set_presence(p_firebase_uid TEXT, p_presence presence_status DEFAULT 'online')
RETURNS profiles LANGUAGE plpgsql AS $$
DECLARE v_row profiles;
BEGIN
  UPDATE profiles SET presence = p_presence, last_seen_at = now()
  WHERE firebase_uid = p_firebase_uid RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION fn_mark_stale_offline(p_minutes INTEGER DEFAULT 5)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE profiles SET presence = 'offline'
  WHERE presence <> 'offline' AND last_seen_at < now() - make_interval(mins => GREATEST(p_minutes, 1));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_set_mood(p_firebase_uid TEXT, p_mood_text TEXT DEFAULT NULL, p_mood_emoji TEXT DEFAULT NULL)
RETURNS profiles LANGUAGE plpgsql AS $$
DECLARE v_row profiles; v_text TEXT; v_emoji TEXT;
BEGIN
  v_text := NULLIF(trim(p_mood_text), '');
  v_emoji := NULLIF(trim(p_mood_emoji), '');
  IF v_text IS NOT NULL AND char_length(v_text) > 80 THEN
    RAISE EXCEPTION 'mood_text max 80 chars' USING ERRCODE = '22023';
  END IF;
  UPDATE profiles SET
    mood_text = v_text, mood_emoji = v_emoji,
    mood_updated_at = CASE WHEN v_text IS NULL AND v_emoji IS NULL THEN NULL ELSE now() END
  WHERE firebase_uid = p_firebase_uid RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION fn_update_profile(
  p_firebase_uid TEXT, p_display_name TEXT DEFAULT NULL, p_username TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL
) RETURNS profiles LANGUAGE plpgsql AS $$
DECLARE v_row profiles; v_user TEXT;
BEGIN
  SELECT * INTO v_row FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002'; END IF;
  IF p_username IS NOT NULL THEN
    v_user := lower(regexp_replace(trim(p_username), '[^a-z0-9_]', '', 'g'));
    IF char_length(v_user) < 3 OR char_length(v_user) > 24 THEN
      RAISE EXCEPTION 'username must be 3-24 chars' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM profiles WHERE lower(username) = v_user AND id <> v_row.id) THEN
      RAISE EXCEPTION 'username taken' USING ERRCODE = '23505';
    END IF;
  ELSE
    v_user := v_row.username;
  END IF;
  UPDATE profiles SET
    username = v_user,
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name),
    bio = COALESCE(p_bio, bio),
    avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = v_row.id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

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

CREATE OR REPLACE FUNCTION fn_get_leaderboard(p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS SETOF v_leaderboard LANGUAGE sql STABLE AS $$
  SELECT * FROM v_leaderboard ORDER BY rank_pos ASC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION fn_get_profile_by_username(p_username TEXT)
RETURNS SETOF v_profile_public LANGUAGE sql STABLE AS $$
  SELECT * FROM v_profile_public WHERE lower(username) = lower(trim(p_username)) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_get_profile_by_firebase(p_firebase_uid TEXT)
RETURNS SETOF profiles LANGUAGE sql STABLE AS $$
  SELECT * FROM profiles WHERE firebase_uid = p_firebase_uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_has_super_liked_today(p_from_firebase_uid TEXT, p_to_username TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_likes sl
    JOIN profiles f ON f.id = sl.from_profile_id
    JOIN profiles t ON t.id = sl.to_profile_id
    WHERE f.firebase_uid = p_from_firebase_uid
      AND lower(t.username) = lower(trim(p_to_username))
      AND sl.liked_on = (now() AT TIME ZONE 'utc')::date
  );
$$;

CREATE OR REPLACE FUNCTION fn_apply_match_result(
  p_winner_id UUID, p_loser_id UUID, p_is_draw BOOLEAN DEFAULT FALSE,
  p_match_id UUID DEFAULT NULL, p_k INTEGER DEFAULT 32
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_w profiles; v_l profiles; v_expected NUMERIC; v_delta INTEGER;
BEGIN
  IF p_winner_id IS NULL OR p_loser_id IS NULL THEN
    RAISE EXCEPTION 'winner and loser required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_w FROM profiles WHERE id = p_winner_id FOR UPDATE;
  SELECT * INTO v_l FROM profiles WHERE id = p_loser_id FOR UPDATE;
  IF p_is_draw THEN
    UPDATE profiles SET draws = draws + 1, games_played = games_played + 1 WHERE id IN (p_winner_id, p_loser_id);
    INSERT INTO rating_events (profile_id, delta, rating_after, reason, match_id) VALUES
      (p_winner_id, 0, v_w.rating, 'draw', p_match_id),
      (p_loser_id, 0, v_l.rating, 'draw', p_match_id);
    RETURN;
  END IF;
  v_expected := 1.0 / (1.0 + power(10.0, (v_l.rating - v_w.rating)::NUMERIC / 400.0));
  v_delta := GREATEST(1, ROUND(p_k * (1.0 - v_expected))::INTEGER);
  UPDATE profiles SET rating = rating + v_delta, wins = wins + 1, games_played = games_played + 1 WHERE id = p_winner_id;
  UPDATE profiles SET rating = GREATEST(rating - v_delta, 0), losses = losses + 1, games_played = games_played + 1 WHERE id = p_loser_id;
  INSERT INTO rating_events (profile_id, delta, rating_after, reason, match_id) VALUES
    (p_winner_id, v_delta, v_w.rating + v_delta, 'win', p_match_id),
    (p_loser_id, -v_delta, GREATEST(v_l.rating - v_delta, 0), 'loss', p_match_id);
END;
$$;

-- =============================================================================
-- FUNCIONES DE JUEGO
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_owned_inventory_count(p_match_player_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INTEGER FROM match_inventory
  WHERE match_player_id = p_match_player_id AND status = 'owned';
$$;

CREATE OR REPLACE FUNCTION fn_pick_random_dimension(
  p_exclude dimension_code DEFAULT NULL,
  p_used dimension_code[] DEFAULT NULL
)
RETURNS dimension_code LANGUAGE sql STABLE AS $$
  SELECT code FROM dimensions
  WHERE is_playable
    AND code <> 'primo'
    AND (p_exclude IS NULL OR code <> p_exclude)
    AND (
      p_used IS NULL
      OR cardinality(p_used) = 0
      OR NOT (code = ANY (p_used))
    )
  ORDER BY random() * GREATEST(weight, 1) DESC
  LIMIT 1;
$$;

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

  IF v_joker IS NULL THEN
    SELECT id INTO v_joker FROM jokers
    WHERE is_active
    ORDER BY random() * shop_weight DESC
    LIMIT 1;
  END IF;
  RETURN v_joker;
END;
$$;

-- Compat: facción ignorada; pool global
CREATE OR REPLACE FUNCTION fn_pick_joker_for_faction(p_faction deck_faction)
RETURNS UUID LANGUAGE plpgsql AS $$
BEGIN
  RETURN fn_pick_random_joker('{}'::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION fn_generate_invite_code()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

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

-- Crear partida rápida / bot / custom
CREATE OR REPLACE FUNCTION fn_create_match(
  p_host_firebase_uid TEXT,
  p_mode match_mode DEFAULT 'quick',
  p_time_control_s INTEGER DEFAULT 300,
  p_host_color player_color DEFAULT 'white',
  p_deck deck_faction DEFAULT NULL, -- ignorado
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

  IF p_mode = 'bot' THEN
    PERFORM fn_attach_bot(v_match.id);
    v_match := fn_start_match(v_match.id);
  END IF;

  UPDATE profiles SET presence = 'playing', last_seen_at = now() WHERE id = v_host.id;
  RETURN v_match;
END;
$$;

-- Unirse a partida / aceptar invite
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

-- Deprecado: ya no hay elección de baraja
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

-- Entrar a cola rápida
CREATE OR REPLACE FUNCTION fn_enqueue_matchmaking(
  p_firebase_uid TEXT, p_deck deck_faction DEFAULT NULL, p_time_control_s INTEGER DEFAULT 300
) RETURNS matchmaking_queue LANGUAGE plpgsql AS $$
DECLARE v_profile profiles; v_row matchmaking_queue; v_opponent matchmaking_queue; v_match matches;
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

-- Generar 4 ofertas de tienda (pool global, sin duplicados)
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
  WHERE match_player_id = p_match_player_id AND cycle_index = v_match.cycle_index AND NOT purchased;

  FOR i IN 0..3 LOOP
    v_joker := fn_pick_random_joker(v_picked);
    v_picked := array_append(v_picked, v_joker);
    SELECT cost_seconds INTO v_cost FROM jokers WHERE id = v_joker;
    RETURN QUERY
    INSERT INTO shop_offers (match_id, match_player_id, cycle_index, slot_index, joker_id, cost_seconds)
    VALUES (v_mp.match_id, p_match_player_id, v_match.cycle_index, i, v_joker, v_cost)
    ON CONFLICT (match_id, match_player_id, cycle_index, slot_index) DO UPDATE
      SET joker_id = EXCLUDED.joker_id, cost_seconds = EXCLUDED.cost_seconds,
          purchased = FALSE, expired = FALSE
    RETURNING *;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION fn_enter_shop_phase(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches; r RECORD;
BEGIN
  UPDATE matches SET status = 'shop', phase = 'shop', moves_in_phase = 0
  WHERE id = p_match_id RETURNING * INTO v_match;

  FOR r IN SELECT id FROM match_players WHERE match_id = p_match_id LOOP
    PERFORM fn_open_shop_for_player(r.id);
  END LOOP;
  RETURN v_match;
END;
$$;

-- Comprar comodín (paga con tiempo del reloj)
CREATE OR REPLACE FUNCTION fn_buy_joker(
  p_firebase_uid TEXT, p_match_id UUID, p_offer_id UUID
) RETURNS match_inventory LANGUAGE plpgsql AS $$
DECLARE
  v_profile profiles; v_mp match_players; v_offer shop_offers; v_item match_inventory;
  v_owned INT; v_slot INT;
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

  INSERT INTO match_moves (match_id, ply, cycle_index, phase, dimension, kind, by_player_id, joker_id, inventory_id, payload)
  SELECT p_match_id,
         (SELECT COALESCE(MAX(mm.ply), 0) + 1 FROM match_moves mm WHERE mm.match_id = p_match_id),
         m.cycle_index, 'shop', m.current_dimension, 'shop_buy', v_mp.id, v_offer.joker_id, v_item.id,
         jsonb_build_object('cost_seconds', v_offer.cost_seconds)
  FROM matches m WHERE m.id = p_match_id;

  RETURN v_item;
END;
$$;

-- Vender comodín: recupera el tiempo que costó
CREATE OR REPLACE FUNCTION fn_sell_joker(
  p_firebase_uid TEXT, p_match_id UUID, p_inventory_id UUID
) RETURNS match_inventory LANGUAGE plpgsql AS $$
DECLARE v_profile profiles; v_mp match_players; v_item match_inventory; v_refund INT;
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

  INSERT INTO match_moves (match_id, ply, cycle_index, phase, dimension, kind, by_player_id, joker_id, inventory_id, payload)
  SELECT p_match_id,
         (SELECT COALESCE(MAX(mm.ply), 0) + 1 FROM match_moves mm WHERE mm.match_id = p_match_id),
         m.cycle_index, m.phase, m.current_dimension, 'shop_sell', v_mp.id, v_item.joker_id, v_item.id,
         jsonb_build_object('refund_seconds', v_item.purchased_cost_s)
  FROM matches m WHERE m.id = p_match_id;

  RETURN v_item;
END;
$$;

-- Consumir comodín (marca used; el motor aplica efecto vía payload)
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

  -- map code → effect_kind
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

  -- Expecto Patronum: pasivo de partida
  IF v_joker.code = 'expecto_patronum' THEN
    UPDATE matches SET expecto_patronum_active = TRUE WHERE id = p_match_id;
  END IF;

  -- Axio: roba 10s
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

-- Tras 8 movimientos → tienda → grieta
CREATE OR REPLACE FUNCTION fn_advance_after_action_moves(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.moves_in_phase >= v_match.moves_per_phase THEN
    RETURN fn_enter_shop_phase(p_match_id);
  END IF;
  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION fn_reveal_dimension(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE
  v_match matches;
  v_dim dimension_code;
  v_cycle INT;
  v_used dimension_code[];
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  v_cycle := v_match.cycle_index + 1;

  -- Mazo sin repetición hasta agotar; luego reinicia (sin repetir la inmediata anterior)
  SELECT COALESCE(array_agg(DISTINCT d), '{}'::dimension_code[])
  INTO v_used
  FROM (
    SELECT h.dimension AS d
    FROM match_dimension_history h
    WHERE h.match_id = p_match_id
      AND h.dimension <> 'primo'
    UNION
    SELECT v_match.current_dimension
    WHERE v_match.current_dimension IS NOT NULL
      AND v_match.current_dimension <> 'primo'
  ) x;

  v_dim := fn_pick_random_dimension(NULL, v_used);
  IF v_dim IS NULL THEN
    v_dim := fn_pick_random_dimension(v_match.current_dimension, NULL);
  END IF;
  IF v_dim IS NULL THEN
    v_dim := fn_pick_random_dimension(NULL, NULL);
  END IF;

  -- limpiar celdas de fase anterior (excepto si quieres persistir — ruina es por fase)
  UPDATE match_board_cells SET is_active = FALSE WHERE match_id = p_match_id AND is_active;

  INSERT INTO match_dimension_history (match_id, cycle_index, dimension)
  VALUES (p_match_id, v_cycle, v_dim)
  ON CONFLICT (match_id, cycle_index) DO UPDATE SET dimension = EXCLUDED.dimension, revealed_at = now();

  -- efectos de dimensión
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

  -- Mercado Negro: 4 monolitos en casillas aleatorias
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
    ON CONFLICT (match_id, square, effect) DO UPDATE SET
      is_active = TRUE,
      time_bonus_min_s = EXCLUDED.time_bonus_min_s,
      time_bonus_max_s = EXCLUDED.time_bonus_max_s,
      created_cycle = EXCLUDED.created_cycle;

    -- spawn sobre pieza: absorbe inmediatamente (se resuelve en motor; aquí marcamos)
  END IF;

  UPDATE matches SET
    status = 'active',
    phase = 'grieta',
    cycle_index = v_cycle,
    moves_in_phase = 0,
    current_dimension = v_dim
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$;

-- Cerrar tienda → revelar dimensión
CREATE OR REPLACE FUNCTION fn_close_shop(p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
BEGIN
  UPDATE shop_offers so SET expired = TRUE
  FROM matches m
  WHERE so.match_id = p_match_id AND so.cycle_index = m.cycle_index AND NOT so.purchased;
  UPDATE matches SET status = 'dimension_reveal' WHERE id = p_match_id;
  RETURN fn_reveal_dimension(p_match_id);
END;
$$;

-- Registrar movimiento de ajedrez (el motor valida; DB persiste + avanza ciclo)
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
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.status <> 'active' THEN RAISE EXCEPTION 'match not in action phase'; END IF;
  IF v_match.turn_color <> v_mp.color THEN RAISE EXCEPTION 'not your turn'; END IF;

  v_spend := GREATEST(COALESCE(p_time_spent_ms, 0), 0);
  -- Petrificus: no resta tiempo este movimiento
  IF v_mp.petrificus_ready THEN
    v_spend := 0;
    UPDATE match_players SET petrificus_ready = FALSE WHERE id = v_mp.id;
  ELSIF v_mp.arresto_pending THEN
    -- Arresto: reloj x2 → gastó el doble (API puede precalcular); si no, duplicamos spend
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

  -- timeout: gana el rival
  IF (SELECT CASE WHEN v_mp.color = 'white' THEN white_time_ms ELSE black_time_ms END
        FROM matches WHERE id = p_match_id) <= 0 THEN
    PERFORM fn_finish_match(
      p_match_id,
      'timeout'::match_result,
      CASE WHEN v_mp.color = 'white' THEN v_match.black_id ELSE v_match.white_id END
    );
    RETURN v_move;
  END IF;

  -- Ruina: casilla de captura destruida (reactivar si existía de un ciclo previo)
  IF p_is_capture AND v_match.current_dimension = 'ruina' THEN
    INSERT INTO match_board_cells (match_id, square, effect, created_cycle, is_active)
    VALUES (p_match_id, lower(p_to), 'ruined', v_match.cycle_index, TRUE)
    ON CONFLICT (match_id, square, effect) DO UPDATE
      SET is_active = TRUE, created_cycle = EXCLUDED.created_cycle;
  END IF;

  -- Giratiempo: segundo movimiento o corte por jaque.
  -- Nota: la corrección del side-to-move del FEN está en patch_phase2_giratiempo.sql
  IF v_mp.giratiempo_active THEN
    IF p_is_check OR p_is_mate THEN
      UPDATE match_players SET giratiempo_active = FALSE, giratiempo_moves_left = 0 WHERE id = v_mp.id;
    ELSE
      UPDATE match_players SET
        giratiempo_moves_left = giratiempo_moves_left - 1,
        giratiempo_captures = giratiempo_captures + CASE WHEN p_is_capture THEN 1 ELSE 0 END,
        giratiempo_active = (giratiempo_moves_left - 1 > 0) AND (giratiempo_captures + CASE WHEN p_is_capture THEN 1 ELSE 0 END) <= 1
      WHERE id = v_mp.id;
    END IF;
  END IF;

  UPDATE matches SET
    fen = p_fen_after,
    turn_color = CASE
      WHEN EXISTS (SELECT 1 FROM match_players WHERE id = v_mp.id AND giratiempo_active AND giratiempo_moves_left > 0)
        THEN v_mp.color
      ELSE CASE WHEN v_mp.color = 'white' THEN 'black'::player_color ELSE 'white'::player_color END
    END,
    moves_in_phase = moves_in_phase + 1,
    clock_running_for = CASE
      WHEN EXISTS (SELECT 1 FROM match_players WHERE id = v_mp.id AND giratiempo_active AND giratiempo_moves_left > 0)
        THEN v_mp.color
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

CREATE OR REPLACE FUNCTION fn_finish_match(
  p_match_id UUID, p_result match_result, p_winner_id UUID DEFAULT NULL
) RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_match matches;
BEGIN
  UPDATE matches SET
    status = 'finished',
    result = p_result,
    winner_id = p_winner_id,
    finished_at = now(),
    clock_running_for = NULL
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  IF v_match.is_rated AND p_winner_id IS NOT NULL AND p_result NOT IN ('abort','draw') THEN
    PERFORM fn_apply_match_result(
      p_winner_id,
      CASE WHEN p_winner_id = v_match.white_id THEN v_match.black_id ELSE v_match.white_id END,
      FALSE, p_match_id
    );
  ELSIF v_match.is_rated AND p_result = 'draw' THEN
    PERFORM fn_apply_match_result(v_match.white_id, v_match.black_id, TRUE, p_match_id);
  END IF;

  UPDATE profiles SET presence = 'online'
  WHERE id IN (v_match.white_id, v_match.black_id);

  UPDATE match_spectators SET is_active = FALSE, left_at = now()
  WHERE match_id = p_match_id AND is_active;

  RETURN v_match;
END;
$$;

CREATE OR REPLACE FUNCTION fn_resign(p_firebase_uid TEXT, p_match_id UUID)
RETURNS matches LANGUAGE plpgsql AS $$
DECLARE v_profile profiles; v_mp match_players; v_match matches; v_winner UUID;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_mp FROM match_players WHERE match_id = p_match_id AND profile_id = v_profile.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not in match'; END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  v_winner := CASE WHEN v_mp.color = 'white' THEN v_match.black_id ELSE v_match.white_id END;
  UPDATE match_players SET has_resigned = TRUE WHERE id = v_mp.id;
  RETURN fn_finish_match(p_match_id, 'resign', v_winner);
END;
$$;

-- Espectar
CREATE OR REPLACE FUNCTION fn_join_spectate(p_firebase_uid TEXT, p_match_id UUID)
RETURNS match_spectators LANGUAGE plpgsql AS $$
DECLARE v_profile profiles; v_match matches; v_row match_spectators; v_count INT;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF NOT v_match.allow_spectators THEN RAISE EXCEPTION 'spectators disabled'; END IF;
  IF v_match.white_id = v_profile.id OR v_match.black_id = v_profile.id THEN
    RAISE EXCEPTION 'players cannot spectate their own match';
  END IF;
  SELECT COUNT(*) INTO v_count FROM match_spectators WHERE match_id = p_match_id AND is_active;
  IF v_count >= v_match.max_spectators THEN RAISE EXCEPTION 'spectator cap reached'; END IF;

  INSERT INTO match_spectators (match_id, profile_id, is_active)
  VALUES (p_match_id, v_profile.id, TRUE)
  ON CONFLICT (match_id, profile_id) DO UPDATE
    SET is_active = TRUE, left_at = NULL, joined_at = now()
  RETURNING * INTO v_row;

  UPDATE profiles SET presence = 'spectating' WHERE id = v_profile.id;
  RETURN v_row;
END;
$$;

-- Emoji con cooldown (default 8s)
CREATE OR REPLACE FUNCTION fn_send_spectator_emoji(
  p_firebase_uid TEXT, p_match_id UUID, p_emoji TEXT, p_cooldown_seconds INTEGER DEFAULT 8
) RETURNS spectator_emojis LANGUAGE plpgsql AS $$
DECLARE v_profile profiles; v_last TIMESTAMPTZ; v_row spectator_emojis;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE firebase_uid = p_firebase_uid;
  IF NOT EXISTS (
    SELECT 1 FROM match_spectators WHERE match_id = p_match_id AND profile_id = v_profile.id AND is_active
  ) THEN
    RAISE EXCEPTION 'not spectating';
  END IF;
  SELECT MAX(created_at) INTO v_last FROM spectator_emojis
  WHERE match_id = p_match_id AND from_profile_id = v_profile.id;
  IF v_last IS NOT NULL AND v_last > now() - make_interval(secs => GREATEST(p_cooldown_seconds, 1)) THEN
    RAISE EXCEPTION 'emoji cooldown' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO spectator_emojis (match_id, from_profile_id, emoji)
  VALUES (p_match_id, v_profile.id, left(trim(p_emoji), 16))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION fn_get_match_state(p_match_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE v_json JSONB;
BEGIN
  SELECT jsonb_build_object(
    'match', to_jsonb(m.*),
    'players', COALESCE((SELECT jsonb_agg(to_jsonb(mp.*) ORDER BY mp.color) FROM match_players mp WHERE mp.match_id = m.id), '[]'::jsonb),
    'cells', COALESCE((SELECT jsonb_agg(to_jsonb(c.*)) FROM match_board_cells c WHERE c.match_id = m.id AND c.is_active), '[]'::jsonb),
    'effects', COALESCE((SELECT jsonb_agg(to_jsonb(e.*)) FROM match_effects e WHERE e.match_id = m.id AND e.is_active), '[]'::jsonb),
    'inventory', COALESCE((SELECT jsonb_agg(to_jsonb(i.*)) FROM match_inventory i WHERE i.match_id = m.id AND i.status = 'owned'), '[]'::jsonb),
    'shop', COALESCE((SELECT jsonb_agg(to_jsonb(s.*)) FROM shop_offers s WHERE s.match_id = m.id AND s.cycle_index = m.cycle_index AND NOT s.expired), '[]'::jsonb),
    'spectators', COALESCE((SELECT jsonb_agg(to_jsonb(sp.*)) FROM match_spectators sp WHERE sp.match_id = m.id AND sp.is_active), '[]'::jsonb),
    'dimension_history', COALESCE((SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.cycle_index) FROM match_dimension_history d WHERE d.match_id = m.id), '[]'::jsonb)
  ) INTO v_json
  FROM matches m WHERE m.id = p_match_id;
  RETURN v_json;
END;
$$;

-- =============================================================================
-- PROCEDIMIENTOS DE MANTENIMIENTO / SEED
-- =============================================================================

CREATE OR REPLACE PROCEDURE sp_recalc_popularity()
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles p SET popularity_score = COALESCE((
    SELECT COUNT(*)::INTEGER FROM super_likes sl WHERE sl.to_profile_id = p.id
  ), 0);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_recalc_developer_hearts()
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE developers d SET heart_count = COALESCE((
    SELECT COUNT(*)::INTEGER FROM developer_hearts h WHERE h.developer_id = d.id
  ), 0);
END;
$$;

CREATE OR REPLACE PROCEDURE sp_seed_developers()
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE developers SET is_active = FALSE, updated_at = now()
  WHERE slug IN ('lead', 'engine', 'realtime', 'astreli');

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
    name = EXCLUDED.name, role = EXCLUDED.role, bio = EXCLUDED.bio,
    avatar_url = EXCLUDED.avatar_url, sort_order = EXCLUDED.sort_order,
    is_active = TRUE, updated_at = now();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_seed_shop_weights()
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO shop_rarity_weights (rarity, weight) VALUES
    ('common', 60), ('epic', 30), ('legendary', 10)
  ON CONFLICT (rarity) DO UPDATE SET weight = EXCLUDED.weight, updated_at = now();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_seed_dimensions()
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO dimensions (code, name, slug, description, rules_json, visual_hint, can_kill_pieces, weight, is_playable, sort_order) VALUES
  ('primo', 'Tablero Primo', 'primo',
   'Ajedrez clásico, sin rarezas. La primera fase de cada partida: coloca y toma tempo.',
   '{"max_range":null,"forced_capture":false}'::jsonb, 'tablero limpio', FALSE, 0, FALSE, 0),
  ('espejo', 'Dimensión Espejo', 'espejo',
   'Todo se invierte: derecha es izquierda, arriba es abajo. Los peones avanzan hacia tu propio bando (y pueden coronar ahí).',
   '{"invert_controls":true,"pawn_reverse":true,"castle_command_invert":true}'::jsonb, 'espejo', FALSE, 1, TRUE, 1),
  ('bluriel', 'Dimensión Bluriel', 'bluriel',
   'Tras tu jugada, el rival ve tus piezas borrosas. El jaque siempre se anuncia, niebla o no.',
   '{"fog_after_move":true,"announce_check":true}'::jsonb, 'niebla', FALSE, 0, FALSE, 2),
  ('gravitacional', 'Dimensión Gravitacional', 'gravitacional',
   'Dama, torre y alfil solo llegan a 3 casillas. Más lejos no dan jaque ni clavan.',
   '{"max_range":3,"affects":["q","r","b"]}'::jsonb, 'gravedad', FALSE, 1, TRUE, 3),
  ('cadena_sangre', 'Dimensión Cadena de Sangre', 'cadena-sangre',
   'Si puedes capturar de forma legal, debes hacerlo. No cuentan las capturas que dejen a tu rey en jaque.',
   '{"forced_capture":true,"legal_only":true,"king_safety_override":true}'::jsonb, 'sangre', FALSE, 1, TRUE, 4),
  ('ruina', 'Dimensión Ruina', 'ruina',
   'Cada captura deja esa casilla destruida. Nadie la pisa ni la atraviesa el resto de la fase (el caballo sí salta).',
   '{"ruin_on_capture":true,"block_sliders":true,"knights_jump":true}'::jsonb, 'ruinas', FALSE, 1, TRUE, 5),
  ('mercado_negro', 'El Mercado Negro', 'mercado-negro',
   'Monolitos de tiempo en el tablero: písalos o atraviésalos para ganar segundos. Capturar también suma reloj a tu favor.',
   '{"monoliths":4,"bonus_min":40,"bonus_max":60,"capture_bonus_cap":15}'::jsonb, 'monolitos', FALSE, 1, TRUE, 6),
  ('fragilidad', 'Dimensión Fragilidad', 'fragilidad',
   'Si al cerrar el turno una pieza (no el rey) está amenazada por dos enemigos, se destroza sola.',
   '{"double_threat_destroys":true,"resolve_end_of_turn":true,"king_immune":true}'::jsonb, 'cristal', TRUE, 1, TRUE, 7)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, rules_json = EXCLUDED.rules_json,
    visual_hint = EXCLUDED.visual_hint, can_kill_pieces = EXCLUDED.can_kill_pieces,
    weight = EXCLUDED.weight, is_playable = EXCLUDED.is_playable, sort_order = EXCLUDED.sort_order;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_seed_jokers()
LANGUAGE plpgsql AS $$
BEGIN
  -- Espectral
  INSERT INTO jokers (code, name, faction, rarity, timing, cost_seconds, description, rules_json, is_passive, shop_weight) VALUES
  ('paso_fantasma', 'Paso Fantasma', 'spectral', 'common', 'instant', 8,
   'Tu próxima jugada puede saltar o atravesar piezas en la trayectoria.',
   '{"ghost_path":true}'::jsonb, FALSE, 3),
  ('imperius', 'Imperius', 'spectral', 'legendary', 'instant', 32,
   'Mueves ahora una pieza enemiga (no el rey) como si fuera tuya. Puede capturar incluso a las suyas.',
   '{"control_enemy":true,"turns":1,"king_immune":true,"friendly_fire":true}'::jsonb, FALSE, 1),
  ('capa_invisibilidad', 'Capa de invisibilidad', 'spectral', 'epic', 'duration', 18,
   'Una pieza tuya queda invisible para el rival hasta que capture o la capturen.',
   '{"invisible_until_combat":true}'::jsonb, FALSE, 2),
  ('morsmordre', 'Morsmordre', 'spectral', 'epic', 'instant', 20,
   'Empuja una casilla atrás a una pieza enemiga junto a la tuya. Si choca con otra tuya, la aplastas. Sin espacio o con Expecto Patronum, falla.',
   '{"push_back":1,"adjacent_only":true,"crush_own":true,"fail_on_blocked":true}'::jsonb, FALSE, 2),
  ('expecto_patronum', 'Expecto Patronum', 'spectral', 'legendary', 'passive', 15,
   'Anula Morsmordre en todo el tablero el resto de la partida.',
   '{"negates":"morsmordre","duration":"match"}'::jsonb, TRUE, 1),
  -- Antimateria
  ('bombarda', 'Bombarda', 'antimatter', 'epic', 'instant', 22,
   'Sacrifica un peón tuyo y quema un área 3×3 este ciclo. Las piezas se empujan a casillas seguras (el rey no muere).',
   '{"sacrifice_pawn":true,"burn_3x3":true,"push_not_kill":true,"king_immune":true}'::jsonb, FALSE, 2),
  ('aparicion', 'Aparición', 'antimatter', 'common', 'instant', 12,
   'Intercambia de casilla dos piezas tuyas (un peón no puede acabar en la última fila).',
   '{"swap_own_pieces":true}'::jsonb, FALSE, 3),
  ('pocion_multijugos', 'Poción Multijugos', 'antimatter', 'legendary', 'duration', 35,
   'Un peón tuyo actúa como dama durante tu jugada; al ceder el turno, se desvanece.',
   '{"pawn_to_queen_turns":1,"then_dies":true,"check_valid_while_active":true,"tag_was_pawn":true}'::jsonb, FALSE, 1),
  ('defodio', 'Defodio', 'antimatter', 'legendary', 'duration', 32,
   'Trampa en una casilla vacía por ~1 turno: quien caiga muere al instante (salvo el rey).',
   '{"trap_empty_square":true,"turns":1,"instant_kill":true,"king_immune":true}'::jsonb, FALSE, 1),
  ('avada_kedavra', 'Avada Kedavra', 'antimatter', 'legendary', 'instant', 25,
   'Elimina un peón enemigo o una pieza que haya sido peón (coronada o Multijugos).',
   '{"kills_was_pawn":true,"king_immune":true}'::jsonb, FALSE, 1),
  -- Tempus
  ('axio_tempus', 'Axio Tempus', 'tempus', 'common', 'instant', 5,
   'Roba 10 segundos del reloj rival y súmalos al tuyo.',
   '{"steal_seconds":10}'::jsonb, FALSE, 3),
  ('arresto_momentum', 'Arresto Momentum', 'tempus', 'legendary', 'duration', 28,
   'El reloj del rival corre al doble en su próximo turno. Petrificus Totalus lo anula.',
   '{"opponent_clock_multiplier":2,"next_turn":true,"beaten_by":"petrificus_totalus"}'::jsonb, FALSE, 1),
  ('petrificus_totalus', 'Petrificus Totalus', 'tempus', 'epic', 'duration', 18,
   'Tu reloj se congela durante tu próximo movimiento. Gana a Arresto Momentum.',
   '{"freeze_own_clock_next_move":true,"priority_over":"arresto_momentum"}'::jsonb, FALSE, 2),
  ('giratiempo', 'Giratiempo', 'tempus', 'legendary', 'duration', 28,
   'Mueve una pieza tuya dos veces en el mismo turno (máx. 1 captura). Si el primer movimiento da jaque, se cancela el segundo.',
   '{"double_move":true,"max_captures":1,"check_ends_combo":true}'::jsonb, FALSE, 1)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, faction = EXCLUDED.faction, rarity = EXCLUDED.rarity,
    timing = EXCLUDED.timing, cost_seconds = EXCLUDED.cost_seconds,
    description = EXCLUDED.description, rules_json = EXCLUDED.rules_json,
    is_passive = EXCLUDED.is_passive, shop_weight = EXCLUDED.shop_weight,
    is_active = TRUE, updated_at = now();
END;
$$;

CREATE OR REPLACE PROCEDURE sp_seed_all()
LANGUAGE plpgsql AS $$
BEGIN
  CALL sp_seed_developers();
  CALL sp_seed_shop_weights();
  CALL sp_seed_dimensions();
  CALL sp_seed_jokers();
END;
$$;

CALL sp_seed_all();

INSERT INTO app_meta (key, value) VALUES
  ('schema_version', '2.1.0-no-deck-select'),
  ('project', 'RogueChess'),
  ('shop_mode', 'global_random_pool'),
  ('bootstrapped_at', now()::text),
  ('gdd', 'Documento Maestro RogueChess')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

COMMIT;

-- =============================================================================
-- Verificación:
--   SELECT * FROM app_meta;
--   SELECT code, name FROM dimensions ORDER BY sort_order;
--   SELECT faction, rarity, code, cost_seconds FROM jokers ORDER BY faction, rarity;
--   SELECT * FROM v_jokers_catalog;
--   SELECT * FROM fn_get_leaderboard(10,0);
-- =============================================================================
