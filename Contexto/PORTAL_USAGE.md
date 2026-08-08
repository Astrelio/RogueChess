# Portal — notas de uso (hackathon)

> Documento vivo. Al final: expandir a pitch/README formal.
> Regla: `.cursor/rules/portal-hackathon-doc.mdc`

## Stack

| Capa | Rol |
|------|-----|
| **Firebase Auth** | Identidad de usuario; ID token = credencial Portal |
| **Neon + REST** | Fuente de verdad de partida / reglas |
| **Portal** | Realtime: sync, presencia, inbox, late-join |

Docs: https://docs.useportal.co/

## Qué usamos

### Cliente
- `@portalsdk/core` — `Portal` singleton en `src/lib/portal.ts`
- `@portalsdk/react` — `PortalProvider`, `useChannel`, `useInbox`
- `PortalAppProvider` — pasa Firebase ID token (o anonymous sin sesión)

### Canales
- `lobby:presence` — quién está en el lobby (`useLobbyPresence`)
- `match:{id}` — sync de partida (`useMatchRealtime`)

### Matchmaking (cola + Portal)
- Neon es autoridad: `POST /api/matches/queue` → `fn_enqueue_matchmaking` (FIFO mismo time control); poll `GET /queue`; cancel; tras ~15s sin rival → `POST /queue/bot`
- Portal acelera UX: metadata `searching: true`, ephemeral `looking` / `match_ready` en `lobby:presence` → el peer hace poll Neon al instante
- UI: `MatchmakingModal` + `useQuickMatchFlow` (Landing / Shell)

### Mensajes (match)
- **`match_dirty`** (persistente) → peers hacen refetch REST
- **`match_over`** (persistente) → fin de partida (`result`, `winner_id`, fen); refetch + overlay victoria/derrota
- **`match_board`** (ephemeral) → pulso FEN + `clock_running_for` + tiempos (≤2KB); `preview: true` = solo FEN (no reloj)
- **`match_clocks`** (ephemeral) → tiempos + `clock_running_for`
- Reconexión / `visibilitychange`: refetch Neon para no perder el fin si saliste del navegador
- Reloj en vivo: solo el lado de `clock_running_for`; Petrificus congela; Arresto ×2 visual
- Tienda: 60s (`shop_ends_at`); `shop_ready` por jugador; wait UI + peek tablero; bot auto-ready
- Tienda: dismiss por `cycle_index` para no reabrir por buy/ext stale; modal de fase; cierre optimista
- Comodines: preview FEN + destello (Aparición / Avada / Morsmordre) mientras llega REST
- Fix buy (`ply` desde match_moves); fix superlike (`sl.to_profile_id`)
- Drag live + board pulse optimista (sin dirty prematuro)
- Overlay de victoria / derrota / tablas

### Presence
- Metadata en lobby (username, mood, uid, searching) y en partida (color, role)
- Chip en MatchPage: status Portal, rival en canal, activity `shopping`
- Badge inbox en avatar del Shell

### Inbox / retos
- `useInbox` + toasts con **Aceptar** → `POST /matches/:id/join`
- Ranking / perfil: **Retar** → `POST /matches/challenge` + `challenge` Portal (`matchId`)
- Host en `waiting` hace poll hasta que el rival acepta

### Activity / emotes
- `sendActivity('shopping')` en fase tienda
- Emotes efímeros `match_emote` (👍😮🔥♟️) en partida
- `shop_ready` ephemeral al marcar listo en tienda

### Config / deploy
- `portal.config.ts` — auth JWKS Firebase, canales, notify, extension
- `portal/extensions/matchState.ts`
- Deploy: `npm run portal:deploy` con env `PORTAL_SECRET` = secret key (`sk_…` de `.env`)
- Último deploy: `cfg_a6b21995…` — canales `lobby:presence`, `match:*` + extensión `matchState`

## Flujo jugada

1. Cliente POST `/api/matches/:id/move` → Neon
2. Respuesta → `publishState` en Portal
3. Peers: ephemeral board inmediato + dirty → GET estado completo

## Pendiente doc final

- Diagrama visual
- Screenshots / demo PvP
- Mencionar límite content ≤2KB y por qué dirty+lean
