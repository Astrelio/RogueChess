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
- **`match_board`** (ephemeral) → pulso FEN + `clock_running_for` + tiempos + `current_dimension` (≤2KB); `preview: true` = solo FEN (no reloj)
- Tras tienda→grieta: el pulso lleva la dimensión; el refetch Neon se fuerza (sin throttle 200ms) para no quedarse con la dim anterior
- **`match_clocks`** (ephemeral) → tiempos + `clock_running_for`
- Publish: **board + ext + dirty en paralelo**; previews de comodín sí (FEN vía `match_board` preview + `match_joker_fx.fen`)
- Anti-stale: progreso cycle/phase/moves (action < shop < next cycle); GET fuera de orden se descarta
- Cambio de fase (tienda↔acción) via `match_board` + dirty → UI inmediata + refetch Neon (inventario)
- Metadata del canal match: `joinedAt` estable (evita “channel already created with different options”)
- Reconexión / `visibilitychange`: refetch Neon para no perder el fin si saliste del navegador
- Reloj en vivo: solo el lado de `clock_running_for`; Petrificus congela; Arresto ×2 visual
- Tienda: 60s (`shop_ends_at`); `shop_ready` por jugador; wait UI + peek tablero; bot auto-ready
- Safety poll: ~1.2s si Portal no ready; ~7s si ready (por si el WS no entrega)
- Tienda: dismiss por `cycle_index` para no reabrir por buy/ext stale; modal de fase; cierre optimista
- Comodines: preview FEN + destello (Aparición / Avada / Morsmordre / Multijugos) + publish Portal al castear
- Fix buy (`ply` desde match_moves); fix superlike (`sl.to_profile_id`)
- Drag live + board pulse optimista (sin dirty prematuro)
- Overlay de victoria / derrota / tablas
- **`spectator_emoji`** (persistente + dirty) → reacciones de espectador (`emoji`, `targetColor`, `emojiId`); Neon valida cooldown vía REST; `recent_emojis` en estado como respaldo por poll

### Fase 3 — espectadores + ranking en vivo
- REST: `POST /matches/:id/spectate`, `POST /matches/:id/spectator-emoji`; perfil `liveMatch` (`v_match_live`); leaderboard `is_in_match` / `is_searching`
- Portal lobby: ephemeral **`ranking_pulse`** al entrar/salir de cola o partida; RankingPage refresca badges
- Metadata lobby: `playing` / `searching` → DuelBadge / SearchingBadge
- UI: Espectar desde perfil (`?cheer=username`), columnas de reacción + paleta PixelEmoji

### Fase 4 — salas personalizadas
- REST: `POST /matches/custom`, `POST /matches/join-by-code`, `GET /matches/invites/pending`; `/challenge` acepta `mode`/`allowSpectators`/`inviteUsername`
- Portal: challenge broadcast + inbox; bandeja Neon (`getPendingInvites`) si el WS no empuja
- UI: `CustomMatchModal` en Landing; waiting room muestra `invite_code` copiable

### Presence
- Metadata en lobby (username, mood, uid, searching, playing) y en partida (color, role player|spectator)
- Chip en MatchPage: status Portal, rival en canal, activity `shopping`
- Badge inbox en avatar del Shell

### Inbox / retos
- `useInbox` + toasts con **Aceptar** → `POST /matches/:id/join`
- Ranking / perfil: **Retar** → `POST /matches/challenge` (mode custom) + `challenge` Portal (`matchId`)
- Host en `waiting` hace poll hasta que el rival acepta
- Respaldo Neon: poll `GET /matches/invites/pending` → toasts/invites en `usePortalInbox`

### Activity / emotes
- `sendActivity('shopping')` en fase tienda
- Emotes efímeros `match_emote` (👍😮🔥♟️) en partida
- `shop_ready` ephemeral al marcar listo en tienda
- `match_joker_fx` ephemeral al castear (code + squares + `fen?`) → peers FX + tablero preview sin esperar Neon

### Config / deploy
- `portal.config.ts` — auth JWKS Firebase, canales, notify, extension
- `portal/extensions/matchState.ts`
- Deploy: `npm run portal:deploy` con env `PORTAL_SECRET` = secret key (`sk_…` de `.env`)
- Último deploy: `cfg_a6b21995…` — canales `lobby:presence`, `match:*` + extensión `matchState`
- **Orígenes del browser** (si no, 403 + WS cerrado → sin realtime):
  ```bash
  portal login
  portal origins add https://rogue-chess-psi.vercel.app --env env_b1efbe9ecaa6419a8cd17cbf6ab757a8
  portal origins add http://localhost:5173 --env env_b1efbe9ecaa6419a8cd17cbf6ab757a8
  ```
- Fallback: si Portal no está `ready`, MatchPage hace poll a Neon ~1.5s

## Flujo jugada

1. Cliente POST `/api/matches/:id/move` → Neon
2. Respuesta → `publishState` en Portal (**board ephemeral + dirty + ext en paralelo**)
3. Peers: FEN/turno inmediato vía `match_board`; inventarios vía dirty → GET Neon

## Pendiente doc final

- Diagrama visual
- Screenshots / demo PvP
- Mencionar límite content ≤2KB y por qué dirty+lean
