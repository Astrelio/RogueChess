-- Bio Oscar Ticas: marcar reproductor en beta
UPDATE developers
SET
  bio = 'Programó el reproductor de música nativo (aún en fase beta). También aportó al concepto de dimensiones y a varias mecánicas del juego.',
  updated_at = now()
WHERE slug = 'ticas';
