# Dependencias de las animaciones

Casi todo **ya está** en `RogueChess/package.json`. No hace falta librería nueva solo por este pack.

---

## Ya en el proyecto (usar, no reinstalar si existe)

### `framer-motion` (^12.6.3)
- **Qué es:** librería de animación para React (enter/exit, springs, keyframes JS).
- **Dónde se usa en este pack:**
  - `JokerFxOverlay.tsx` — aparición/salida de partículas y rituales
  - `JokerClockFx.tsx` — chips de reloj (±10s, hielo, ×2)
  - `PhaseFlash.tsx` — flash centrado de fase / intro tienda
  - `DimensionReveal.tsx` — fade del reveal + tablero 3D
- **Si falta:** `npm i framer-motion`
- **Nota:** el pack también usa `@/lib/motion` (`easeOut`, `easeSnap`) del proyecto. Si esa ruta no existe en la otra rama, sustituir por curvas propias o `ease: [0.22, 1, 0.36, 1]`.

### `react` / `react-dom` (^19)
- Componentes y `createPortal` (reveal a `document.body`).

### `chess.js` (^1.4.0)
- **Qué es:** motor de tablero FEN/piezas en cliente.
- **Dónde:** `jokerFx.ts` → `getJokerAimSquares` (casillas elegibles al apuntar).
- **Si falta:** `npm i chess.js`
- No anima; solo calcula casillas válidas.

### `react-chessboard` (^5.12.0)
- **Qué es:** componente de tablero visual.
- **Dónde (en MatchPage, no en este pack):** `squareStyles` aplica `animationName: 'rc-joker-*'` / blur capa.
- El overlay de partículas se monta **encima** del board (`position: absolute` en el contenedor del tablero).

---

## CSS / build (ya en proyecto)

### Tailwind CSS v4 + Vite (`@tailwindcss/vite`, `tailwindcss`)
- El pack usa sobre todo CSS propio (`rc-*`). Algunas clases Tailwind quedan en `PhaseFlash` / wrappers (`fixed`, `flex`, etc.).
- Variables esperadas en el tema (ya definidas en `@theme` de `index.css`):
  - `--font-display`, `--font-label`
  - `--color-ink`, `--color-ink-muted`, `--color-primary`, `--color-surface`, …

Si la otra rama renombró variables, ajustar `animaciones.css` / `PhaseFlash`.

---

## Dependencias del proyecto que este pack **importa** (código propio)

No son npm packages; deben existir en el repo destino:

| Import | Archivo pack | Rol |
|--------|--------------|-----|
| `@/lib/dimensions` (`getDimension`, `DimensionTheme`, `LOOP_PHASES`) | `DimensionReveal`, `PhaseFlash` | Copy de fases/dimensiones |
| `@/lib/motion` (`easeOut`, `easeSnap`) | overlays / flash / reveal | Easing compartido |
| `@/components/match/DimensionEnv` | `DimensionReveal` | Fondo ambiental por dimensión |
| `@/types/match` (`PieceFlag`) | `jokerFx.ts` | Flags capa / was_pawn / multijugos |

Si `DimensionEnv` o `dimensions.ts` cambiaron en la otra rama, **no sobrescribirlos** — solo asegurar que exportan lo que usa el pack.

---

## No usadas por este pack (no instalar por las animaciones)

- `@portalsdk/*` — matchmaking / live (fuera de scope)
- `firebase` / `firebase-admin`
- `@neondatabase/serverless`
- `zod` (validación API; el FX no valida payloads)

---

## Checklist npm

```bash
# Solo si faltan en package.json:
npm i framer-motion chess.js react-chessboard
```

El resto del stack visual (Vite, Tailwind, React 19) se asume igual que RogueChess.
