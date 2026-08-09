# Prompt para pegar en el otro Cursor

Copia todo el bloque de abajo en el chat del Cursor que trabaja la otra rama del mismo RogueChess.

---

```
Integra el paquete de animaciones de la carpeta `animaciones-roguechess/` en este proyecto RogueChess.

REGLAS:
- No reemplaces MatchPage.tsx entero si ya tiene cambios locales: mergea solo el cableado FX.
- No toques motor/server/DB.
- Lee primero: animaciones-roguechess/INTEGRACION.md y DEPENDENCIAS.md y snippets/MatchPage.wire.md

PASOS:
1) Copia public/dimensions/*.png → public/dimensions/
2) Copia src/lib/jokerFx.ts y los componentes match del pack a las rutas homónimas
3) Añade css/animaciones.css al final de src/index.css (import o pegado)
4) Mergea DimensionReveal.tsx y PhaseFlash.tsx del pack (tablero 3D + flash centrado + intro tienda)
5) En MatchPage: imports, estados (boardFx, jokerBurst, clockFx, shopIntro, phaseFlash shop), playJokerFx, effects shopIntro (timeout 2000ms, sin dep `match` entero), blur capa con invisibleSquaresForViewer, JSX JokerFxOverlay + JokerClockFx, ShopPhaseModal open gated por !shopIntro
6) Verifica framer-motion y chess.js en package.json
7) npm run lint / prueba visual: comodín, intro tienda 2s, reveal dimensión con imagen

Si hay conflictos de merge, prioriza conservar lógica de partida de esta rama y aplicar solo presentación del pack.
```
