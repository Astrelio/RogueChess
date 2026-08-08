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

### Mensajes (match)
- **`match_dirty`** (persistente) → peers hacen refetch REST
- **`match_board`** (ephemeral) → pulso FEN + `clock_running_for` + tiempos (≤2KB); `preview: true` = solo FEN (no reloj)
- **`match_clocks`** (ephemeral) → tiempos + `clock_running_for`
- Reloj en vivo: solo el lado de `clock_running_for`; Petrificus congela; Arresto ×2 visual
- Tienda: dismiss por `cycle_index` para no reabrir por buy/ext stale; modal de fase; cierre optimista
- Comodines: preview FEN + destello (Aparición / Avada / Morsmordre) mientras llega REST
- Fix buy (`ply` desde match_moves); fix superlike (`sl.to_profile_id`)
- Drag live + board pulse optimista (sin dirty prematuro)
- Overlay de victoria / derrota / tablas

### Presence
- Metadata en lobby (username, mood, uid) y en partida (color, role)

### Inbox
- `useInbox` + toasts en `PortalLiveChrome`
- Retos: `send({ to, mentions })` + `notify` en `portal.config.ts` para `type: challenge`

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
