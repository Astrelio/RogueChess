-- Desactiva Bluriel hasta que el motor implemente niebla post-movimiento.
UPDATE dimensions
SET is_playable = FALSE, weight = 0,
    description = 'Tras mover, tus piezas se vuelven borrosas/invisibles al rival. El jaque siempre se anuncia. (Desactivada hasta implementar niebla.)'
WHERE code = 'bluriel';
