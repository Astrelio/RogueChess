# RogueChess — estado del proyecto, setup y pendientes

Documento para el equipo (hackathon). Resume **qué hay hecho**, **qué falta arreglar**, y **cómo clonar y configurar secretos**.

Repo: https://github.com/Astrelio/RogueChess  
Último push relevante: `375acd7` (fase 2 + Portal + landing).

---

## 1. Stack (quién hace qué)

| Capa | Rol |
|------|-----|
| **Firebase Auth** | Login / identidad. El ID token también autentica Portal. |
| **Neon (Postgres)** | Fuente de verdad: partidas, relojes, inventario, tienda, reglas SQL. |
| **API Express** (`server/`) | REST: auth, perfiles, ranking, partidas, jugadas, comodines. |
| **Portal** | Realtime: lobby, canal de partida, pulses de tablero, inbox/retos. |
| **Vite + React** | UI: landing, match, tienda, comodines, shell. |

---

## 2. Qué hemos hecho

### Fase 1 (base)
- Auth Firebase + sync de perfil en Neon.
- Perfiles, mood, ranking, popularidad, supercorazones a devs.
- UI “Ivory Tactics” (tipografías, paleta, shell).
- Schema completo en `db/roguechess_neon.sql` (partidas, jokers, shop, ciclos, etc.).
- Patch sin elección de baraja: `db/patch_no_deck_select.sql`.

### Fase 2 — motor y partida
- Motor de reglas en `server/engine/` (movimientos, dimensiones, comodines, persistencia).
- Rutas de partida en `server/routes/matches.ts`: move, shop buy/sell/close, joker use, resign, bot.
- Dimensiones / grietas (p.ej. Espejo con inversión de jugadas y peones).
- Tienda a pantalla completa (`ShopPhaseModal`): compra/venta, animaciones, cierre optimista.
- UI de apuntado de comodines (`jokerTargets`, banner, clicks en tablero).
- Arte de comodines en `public/jokers/`.
- Overlay de victoria / derrota / tablas.
- Patches SQL de fase 2:
  - `db/patch_phase2_shop_fixes.sql`
  - `db/patch_phase2_engine.sql`
  - `db/patch_phase2_joker_ply.sql`
  - `db/patch_phase2_giratiempo.sql`
  - `db/patch_phase2_clocks.sql`

### Relojes
- Tick en vivo (`useLiveClocks`): solo corre el lado de `clock_running_for`.
- Pausa en 1ª jugada / tienda (server).
- **Petrificus**: congela el reloj del jugador en ese turno (UI + spend 0 al mover).
- **Arresto Momentum**: rival a ×2 en UI y al gastar en server.
- Sync Portal con `clock_running_for` (sin inferirlo ciegamente del turno).

### Portal (realtime)
- Cliente `@portalsdk/core` + `@portalsdk/react`.
- Canales `lobby:presence` y `match:{id}`.
- `match_dirty` → refetch REST; `match_board` / `match_clocks` ephemeral.
- Drag en vivo, board pulse optimista (`preview: true` = solo FEN).
- Inbox / retos (`PortalLiveChrome`).
- Notas vivas: `Contexto/PORTAL_USAGE.md`.
- Config: `portal.config.ts` + extensión `portal/extensions/matchState.ts`.

### UX / landing / shell
- Landing sin scroll (viewport fijo), mascota (`public/mascot/Bishop.png` + `Contexto/mascota/`).
- Icono de rey en lugar del label “RogueChess” del hero.
- Nav compacta: botón avatar → menú (Jugar, Ranking, Devs, Perfil, Salir), estilo `panel` como tooltips de comodines.
- Quitada la barra `@usuario · en línea` del header.
- Comodines con preview optimista + destello (Aparición, Avada, Morsmordre).
- Tienda: no reabre tras cerrar por pulses/buy stale (`dismissedShopCycle`).

### Scripts útiles (`package.json`)
```bash
npm run dev:all          # Vite + API
npm run test             # tests del motor
npm run portal:deploy    # desplegar config Portal
npm run db:patch:phase2  # y variantes clocks / engine / joker-ply / giratiempo
```

---

## 3. Qué hay que arreglar / mejorar

Prioridad orientativa (lo visto en playtests y en código). No es lista exhaustiva de QA.

### Alta (juego / confianza)
| Tema | Notas |
|------|--------|
| **Capa de invisibilidad** | Flags al cliente + ocultar del rival; se revela al capturar. Expecto Patronum es global (anula Morsmordre en todo el tablero). |
| **Timeout / flag** | Corregido: el cliente declara `POST /timeout` cuando el reloj vivo llega a 0 (antes solo se checaba al mover). |
| **PvP real + Portal** | Bot funciona; falta validar bien 2 humanos (late-join, desync, ecos). |
| **Neon de cada entorno** | Quien use DB propia debe aplicar schema + patches; si no, relojes/jokers/tienda fallan en silencio o con 500. |
| **Documentación Portal “final” hackathon** | Ampliar `PORTAL_USAGE.md` a pitch (diagrama jugada→REST→publish, screenshots). |

### Media (pulido)
| Tema | Notas |
|------|--------|
| **Mascota con fondo negro** | El PNG actual trae negro pintado (no alpha). Ideal: export transparente. |
| **README desactualizado** | Sigue titulándose “Fase 1”; falta guía corta de Portal + patches fase 2 (este doc cubre el hueco). |
| **Mobile landing** | Viewport fijo + mascota: revisar pantallas chicas. |
| **Animaciones de más comodines** | Solo Aparición / Avada / Morsmordre tienen destello optimista. |
| **Historial Portal** | Mensajes viejos de board pueden confundir; ya hay skipOwn / dismiss shop, vigilar edge cases. |

### Baja / deuda
| Tema | Notas |
|------|--------|
| Tests E2E / smoke de partida completa. |
| Rate limits / anti-trampas de reloj más fuertes. |
| Doc de diseño de dimensiones vs GDD. |
| Limpiar scripts de inspección si no se usan en demo. |

### Bugs ya corregidos (referencia)
- Reloj propio seguía en turno rival (pulse infería `clock_running_for` del turno).
- Tienda reaparecía un instante tras cerrar (buy/ext stale).
- Aparición “lenta” (sin preview).
- Menú avatar debajo de la mascota (z-index).
- Expecto Patronum solo protegía si lo tenía el rival (ahora es global).
- Capa de invisibilidad no ocultaba nada en el cliente (faltaban `flags` en el estado).
- Reloj a 0 no terminaba la partida (faltaba claim de timeout en vivo).

---

## 4. Cómo descargar el proyecto

### Opción A — clonar (recomendado)
```bash
git clone https://github.com/Astrelio/RogueChess.git
cd RogueChess
git checkout main
git pull
```

### Opción B — ZIP
En GitHub: **Code → Download ZIP**, descomprimir y abrir la carpeta en la terminal / Cursor.

### Requisitos
- **Node.js** 20+ (recomendado LTS).
- Cuenta / acceso a:
  - Proyecto **Firebase** del equipo (o uno propio).
  - **Neon** (misma DB del equipo o la tuya con schema aplicado).
  - **Portal** (useportal.co) con las keys del proyecto.

```bash
npm install
```

---

## 5. Cómo poner los secretos

Los secretos **no están en el repo**. Cada máquina necesita archivos locales.

### 5.1 Crear archivos

Desde la raíz del repo:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
Copy-Item .env.example .env.local

# macOS / Linux
cp .env.example .env
cp .env.example .env.local
```

| Archivo | Quién lo lee |
|---------|----------------|
| `.env` | API (`server/`) — Neon, Firebase Admin, Portal secret |
| `.env.local` | Vite (frontend) — `VITE_*` |

### 5.2 Qué va en cada uno

Plantilla: `.env.example`.

#### `.env` (API)

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
PORT=8787

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Solo local sin Admin SDK (nunca en prod)
VERIFY_SKIP=false

PORTAL_PUBLIC_KEY=pk_...
PORTAL_SECRET_KEY=sk_...
```

- `DATABASE_URL`: connection string **pooled** de Neon.
- Firebase Admin: del service account JSON del proyecto Firebase.
- Portal: dashboard de useportal.co.

#### `.env.local` (frontend)

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_API_PROXY=http://localhost:8787
VITE_PORTAL_PUBLIC_KEY=pk_...
```

`VITE_PORTAL_PUBLIC_KEY` debe ser la **public key** (misma familia que `PORTAL_PUBLIC_KEY`).

### 5.3 Cómo compartirlos en el equipo

1. **No** subir `.env` / `.env.local` a Git.
2. Pasar los valores por canal privado (1Password, Discord DM, etc.) o copiar desde la máquina que ya funciona.
3. Quien ya tiene el proyecto corriendo puede mandar solo los valores (no el archivo con basura extra).

### 5.4 Base de datos (Neon)

**Misma Neon del equipo:** con la `DATABASE_URL` correcta, si ya aplicaron patches de fase 2, no hace falta más.

**Neon nueva / vacía:**

1. Ejecutar una vez `db/roguechess_neon.sql` en el SQL Editor de Neon.  
2. Luego, en orden (o con los scripts npm si tienes `DATABASE_URL` en `.env`):

```bash
npm run db:patch:phase2
npm run db:patch:engine
npm run db:patch:joker-ply
npm run db:patch:giratiempo
npm run db:patch:clocks
```

También aplica `db/patch_no_deck_select.sql` si el schema base aún tenía selección de baraja.

### 5.5 Portal deploy (solo quien administra Portal)

```bash
# PORTAL_SECRET = secret key sk_...
npm run portal:deploy
```

Hace falta si cambian `portal.config.ts` o la extensión. Quien solo corre el cliente con keys ya desplegadas **no** necesita deploy.

---

## 6. Arrancar en local

```bash
npm install
npm run dev:all
```

- Web: http://localhost:5173  
- API: http://localhost:8787  

Parar: Ctrl+C en la terminal, o matar procesos en puertos `5173` y `8787`.

Opcional:

```bash
npm run test    # motor
npm run lint    # TypeScript
```

---

## 7. Mapa rápido de carpetas

```
Contexto/           GDD, notas Portal, mascota fuente, stitch
db/                 schema + patches SQL
portal/             extensión matchState
public/jokers/      arte comodines
public/mascot/      mascota en la web
server/engine/      reglas de partida
server/routes/      API matches
src/pages/          Landing, Match, perfil, ranking…
src/hooks/          clocks, Portal match/lobby/inbox
src/components/     shell, tienda, jokers, overlays
```

---

## 8. Checklist compañero nuevo

- [ ] `git clone` + `npm install`
- [ ] `.env` + `.env.local` rellenados (Neon, Firebase, Portal)
- [ ] Neon con schema + patches fase 2 (o URL compartida ya parcheada)
- [ ] `npm run dev:all` → login Firebase → partida rápida vs bot
- [ ] (Opcional) segunda cuenta / otra ventana para probar Portal PvP

---

*Documento vivo: actualizar cuando se cierren bugs de la sección 3 o cambien secretos/flujo de setup.*
