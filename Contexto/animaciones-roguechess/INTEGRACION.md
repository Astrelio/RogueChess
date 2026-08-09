# Paquete de animaciones RogueChess

Paquete portable para integrar en **el mismo proyecto RogueChess** desde otro Cursor / otra rama con cambios distintos.

No incluye lógica de motor, API ni DB. Solo presentación: FX de comodines, flashes de fase, intro de tienda, tableros 3D en reveal de dimensión.

---

## Contenido

```
animaciones-roguechess/
├── INTEGRACION.md          ← este archivo
├── DEPENDENCIAS.md         ← librerías y para qué se usan
├── PROMPT_CURSOR.md        ← prompt listo para pegar en el otro Cursor
├── css/
│   └── animaciones.css     ← CSS de todas las animaciones (pegar/importar)
├── public/
│   └── dimensions/         ← PNGs tablero 3D por dimensión
│       ├── dim-ruina.png
│       ├── dim-espejo.png
│       ├── dim-bluriel.png
│       ├── dim-gravitacional.png
│       ├── dim-sangre.png      → tema cadena_sangre
│       ├── dim-mercado.png     → tema mercado_negro
│       ├── dim-fragilidad.png
│       └── dim-primo.png
├── src/
│   ├── lib/
│   │   └── jokerFx.ts      ← specs FX, casillas aim/cast, stages
│   └── components/match/
│       ├── JokerFxOverlay.tsx   ← partículas + rituales en tablero
│       ├── JokerClockFx.tsx     ← HUD reloj (Axio / Petrificus / Arresto)
│       ├── PhaseFlash.tsx       ← flash centrado acción / grieta / tienda
│       └── DimensionReveal.tsx  ← reveal + imagen tablero 3D
└── snippets/
    └── MatchPage.wire.md   ← puntos exactos a cablear en MatchPage.tsx
```

---

## Orden de integración (recomendado)

1. Copiar `public/dimensions/*.png` → `RogueChess/public/dimensions/`
2. Copiar componentes y `jokerFx.ts` a las rutas homónimas bajo `RogueChess/src/`
3. Importar CSS: añadir al final de `src/index.css`:

   ```css
   @import "./../ruta-o-pegar-contenido";
   ```

   O pegar el contenido de `css/animaciones.css` al final de `src/index.css`.

4. Cablear `MatchPage.tsx` siguiendo `snippets/MatchPage.wire.md`  
   **No reemplazar MatchPage entero** si la otra rama tiene cambios — mergear solo los hooks/FX.
5. Sustituir/mergear `DimensionReveal.tsx` y `PhaseFlash.tsx` (este pack ya trae la versión con tablero + flash centrado).
6. Verificar que existan dependencias de `DEPENDENCIAS.md` (casi todas ya están en el proyecto).

---

## Qué anima cada pieza

| Sistema | Cuándo | Archivos |
|--------|--------|----------|
| Aim partículas | Al apuntar comodín (casillas válidas) | `JokerFxOverlay` + `jokerFx.getJokerAimSquares` |
| Cast por stage | Al usar comodín | `playJokerFx` + overlay / clock / blur |
| Capa persistente | Flag `is_invisible` en tus piezas | `invisibleSquaresForViewer` + CSS `rc-piece-cloak` |
| Phase flash | Entrar tienda / volver acción / grieta | `PhaseFlash` + `shopIntro` |
| Intro tienda | 2s “Elige tus comodines” antes del modal | `shopIntro` gate en `ShopPhaseModal` |
| Reveal dimensión | Cambio de dimensión | `DimensionReveal` + PNG centrado |

### Stages de comodín (`jokerFx.ts`)

- `targets` — solo casillas del payload (Bombarda 3×3, Avada, etc.)
- `pieceBlur` — Capa de invisibilidad
- `boardCenter` — Paso Fantasma, Giratiempo (ritual, **no** todas las piezas)
- `shield` — Expecto Patronum
- `clockSteal` / `clockFreeze` / `clockHaste` — Tempus en HUD

---

## Conflictos típicos con otra rama

- Si `MatchPage.tsx` divergió: aplicar **solo** imports, estados FX, `playJokerFx`, effects de `shopIntro`, y JSX de overlays.
- Si `index.css` divergió: pegar `animaciones.css` al **final** (clases `rc-jfx-*`, `rc-phase-flash-*`, `rc-dim-board-*`, `rc-clock-fx-*`, `rc-joker-*`).
- Si ya existe `DimensionReveal` / `PhaseFlash`: preferir versión de este pack o mergear a mano el bloque `DimensionBoardArt` + CSS board.
- Alias `@/` debe apuntar a `src/` (Vite).

---

## Prueba rápida

1. `npm run dev:all`
2. Partida → usar Capa / Axio / Bombarda → ver FX distinto por comodín
3. Llegar a tienda → pausa 2s centrada → luego modal mercado
4. Cambiar dimensión → reveal con tablero 3D al centro
