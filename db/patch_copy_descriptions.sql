-- =============================================================================
-- RogueChess PATCH — Copy jugador (dimensiones + comodines) v2
-- Idempotente: actualiza description/name (y timing Imperius) sin tocar rules_json.
-- =============================================================================

BEGIN;

UPDATE dimensions SET description = v.description, name = v.name
FROM (VALUES
  ('primo', 'Tablero Primo',
   'Ajedrez clásico, sin rarezas. La primera fase de cada partida: coloca y toma tempo.'),
  ('espejo', 'Dimensión Espejo',
   'Todo se invierte: derecha es izquierda, arriba es abajo. Los peones avanzan hacia tu propio bando (y pueden coronar ahí).'),
  ('bluriel', 'Dimensión Bluriel',
   'Tras tu jugada, el rival ve tus piezas borrosas. El jaque siempre se anuncia, niebla o no.'),
  ('gravitacional', 'Dimensión Gravitacional',
   'Dama, torre y alfil solo llegan a 3 casillas. Más lejos no dan jaque ni clavan.'),
  ('cadena_sangre', 'Dimensión Cadena de Sangre',
   'Si puedes capturar de forma legal, debes hacerlo. No cuentan las capturas que dejen a tu rey en jaque.'),
  ('ruina', 'Dimensión Ruina',
   'Cada captura deja esa casilla destruida. Nadie la pisa ni la atraviesa el resto de la fase (el caballo sí salta).'),
  ('mercado_negro', 'El Mercado Negro',
   'Monolitos de tiempo en el tablero: písalos o atraviésalos para ganar segundos. Capturar también suma reloj a tu favor.'),
  ('fragilidad', 'Dimensión Fragilidad',
   'Si al cerrar el turno una pieza (no el rey) está amenazada por dos enemigos, se destroza sola.')
) AS v(code, name, description)
WHERE dimensions.code = v.code;

UPDATE jokers SET
  description = v.description,
  timing = v.timing::joker_timing,
  updated_at = now()
FROM (VALUES
  ('paso_fantasma', 'instant',
   'Tu próxima jugada puede saltar o atravesar piezas en la trayectoria.'),
  ('imperius', 'instant',
   'Mueves ahora una pieza enemiga (no el rey) como si fuera tuya. Puede capturar incluso a las suyas.'),
  ('capa_invisibilidad', 'duration',
   'Una pieza tuya queda invisible para el rival hasta que capture o la capturen.'),
  ('morsmordre', 'instant',
   'Empuja una casilla atrás a una pieza enemiga junto a la tuya. Si choca con otra tuya, la aplastas. Sin espacio o con Expecto Patronum, falla.'),
  ('expecto_patronum', 'passive',
   'Anula Morsmordre en todo el tablero el resto de la partida.'),
  ('bombarda', 'instant',
   'Sacrifica un peón tuyo y quema un área 3×3 este ciclo. Las piezas se empujan a casillas seguras (el rey no muere).'),
  ('aparicion', 'instant',
   'Intercambia de casilla dos piezas tuyas (un peón no puede acabar en la última fila).'),
  ('pocion_multijugos', 'duration',
   'Un peón tuyo actúa como dama durante tu jugada; al ceder el turno, se desvanece.'),
  ('defodio', 'duration',
   'Trampa en una casilla vacía por ~1 turno: quien caiga muere al instante (salvo el rey).'),
  ('avada_kedavra', 'instant',
   'Elimina un peón enemigo o una pieza que haya sido peón (coronada o Multijugos).'),
  ('axio_tempus', 'instant',
   'Roba 10 segundos del reloj rival y súmalos al tuyo.'),
  ('arresto_momentum', 'duration',
   'El reloj del rival corre al doble en su próximo turno. Petrificus Totalus lo anula.'),
  ('petrificus_totalus', 'duration',
   'Tu reloj se congela durante tu próximo movimiento. Gana a Arresto Momentum.'),
  ('giratiempo', 'duration',
   'Mueve una pieza tuya dos veces en el mismo turno (máx. 1 captura). Si el primer movimiento da jaque, se cancela el segundo.')
) AS v(code, timing, description)
WHERE jokers.code = v.code;

COMMIT;
