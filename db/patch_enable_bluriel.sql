-- =============================================================================
-- Reactivar Bluriel en el ciclo (niebla mínima en cliente)
-- npm run db:patch:bluriel
-- =============================================================================

BEGIN;

UPDATE dimensions
SET is_playable = TRUE,
    weight = 1
WHERE code = 'bluriel';

COMMIT;
