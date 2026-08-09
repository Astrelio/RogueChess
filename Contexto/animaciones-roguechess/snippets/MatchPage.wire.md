# Cableado en `MatchPage.tsx` (no copiar el archivo entero)

Mergea estos bloques en la versión local de MatchPage.

---

## 1) Imports

```tsx
import { JokerFxOverlay } from '@/components/match/JokerFxOverlay'
import { JokerClockFx, type ClockFxEvent } from '@/components/match/JokerClockFx'
import { PhaseFlash } from '@/components/match/PhaseFlash'
import {
  getJokerAimSquares,
  getJokerCastSquares,
  getJokerFxSpec,
  invisibleSquaresForViewer,
  type JokerFxKind,
} from '@/lib/jokerFx'
```

(`DimensionReveal` ya suele estar importado; usar la versión del pack.)

---

## 2) Estado + timers FX

```tsx
const [phaseFlash, setPhaseFlash] = useState<'action' | 'rift' | 'shop' | null>(null)
const [shopIntro, setShopIntro] = useState(false)

const [boardFx, setBoardFx] = useState<{
  squares: string[]
  kind: JokerFxKind
  code?: string
} | null>(null)
const [jokerBurst, setJokerBurst] = useState<{
  squares: string[]
  code: string
  at: number
} | null>(null)
const [clockFx, setClockFx] = useState<ClockFxEvent | null>(null)
const boardFxTimer = useRef<number | null>(null)
const burstTimer = useRef<number | null>(null)
const clockFxTimer = useRef<number | null>(null)
```

Incluir `flashBoardFx` + `playJokerFx` del pack (ver MatchPage de referencia en la rama que generó el pack).  
`playJokerFx` enruta por `spec.stage` (clock* vs targets/blur vs ritual).

---

## 3) Intro tienda (crítico)

Al entrar a shop: `setPhaseFlash('shop'); setShopIntro(true)`.

Cierre en effect **separado** (evita que sync de `match` cancele el timeout):

```tsx
useEffect(() => {
  if (!shopIntro) return
  const t = window.setTimeout(() => {
    setPhaseFlash((k) => (k === 'shop' ? null : k))
    setShopIntro(false)
  }, 2000) // ~2s para leer
  return () => window.clearTimeout(t)
}, [shopIntro])
```

**No** poner `match` entero en el effect que detecta cambio de fase.

Modal:

```tsx
<ShopPhaseModal open={isShop && !isFinished && !shopIntro} ... />
<PhaseFlash kind={revealDimension ? null : phaseFlash} />
```

---

## 4) Al castear comodín (`castJoker`)

```tsx
if (code && state.you.color) {
  playJokerFx(code, getJokerCastSquares(code, payload), state.you.color)
}
```

---

## 5) Estilos de casilla (capa / FX)

En el `useMemo` de `squareStyles` / `dragSquareStyles`:

- Aura aim: `jokerAimAura` vía `getJokerAimSquares`
- Cast: `boardFx` → `animationName: \`rc-joker-${boardFx.kind}\``
- Persistente capa:

```tsx
for (const sq of invisibleSquaresForViewer(state?.flags, you?.color)) {
  styles[sq] = {
    ...(styles[sq] ?? {}),
    filter: 'blur(1.6px) saturate(0.75) opacity(0.55)',
    animationName: 'rc-piece-cloak',
    animationDuration: '2.2s',
    animationIterationCount: 'infinite',
    // + tint background/boxShadow spectral
  }
}
```

---

## 6) JSX sobre el tablero

Dentro del contenedor del board (ej. `rc-board-glow` o `rc-match-board-stage`), `position: relative`:

```tsx
<JokerClockFx event={clockFx} />
{/* Chessboard ... */}
<JokerFxOverlay
  orientation={you?.color === 'black' ? 'black' : 'white'}
  aim={jokerAimAura}
  burst={jokerBurst}
/>
```

`jokerAimAura` = `useMemo` con `getJokerAimSquares` + `getJokerFxSpec` cuando `aim` activo.

---

## Checklist

- [ ] PNGs en `/dimensions/...`
- [ ] CSS `animaciones.css` cargado
- [ ] Intro tienda cierra sola a los 2s
- [ ] Paso Fantasma = ritual centro (no spray piezas)
- [ ] Capa = blur persistente
- [ ] Axio = chips reloj, no partículas en piezas
- [ ] Reveal dimensión muestra PNG centrado
