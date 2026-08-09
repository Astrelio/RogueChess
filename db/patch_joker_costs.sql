-- Rebalance costes de comodines (segundos de reloj).
-- common ~5–12 · epic ~18–22 · legendary ~15–35

UPDATE jokers SET cost_seconds = v.cost, updated_at = now()
FROM (VALUES
  ('paso_fantasma', 8),
  ('aparicion', 12),
  ('axio_tempus', 5),
  ('capa_invisibilidad', 18),
  ('morsmordre', 20),
  ('bombarda', 22),
  ('petrificus_totalus', 18),
  ('expecto_patronum', 15),
  ('avada_kedavra', 25),
  ('giratiempo', 28),
  ('arresto_momentum', 28),
  ('imperius', 32),
  ('defodio', 32),
  ('pocion_multijugos', 35)
) AS v(code, cost)
WHERE jokers.code = v.code;

-- Ofertas de tienda abiertas: alinear al nuevo catálogo
UPDATE shop_offers so
SET cost_seconds = j.cost_seconds
FROM jokers j
WHERE so.joker_id = j.id
  AND so.purchased = FALSE
  AND so.expired = FALSE
  AND so.cost_seconds IS DISTINCT FROM j.cost_seconds;
