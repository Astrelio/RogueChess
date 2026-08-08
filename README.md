# RogueChess — Fase 1

Landing, auth (Firebase), perfiles, ranking, estado de ánimo, popularidad y supercorazones a devs.

## Diseño de tienda (actualizado)

No hay elección de baraja al inicio. En cada fase de compra salen **3 comodines aleatorios del pool global** (pesados por rareza). Las facciones (Espectral / Antimateria / Tempus) son solo categoría visual del comodín.

Tras un bootstrap previo, aplica en Neon: `db/patch_no_deck_select.sql`.


1. Crea un proyecto en [Neon](https://neon.tech).
2. Abre **SQL Editor**.
3. Pega y ejecuta **una sola vez**:

`db/roguechess_neon.sql`

Cubre **todo el juego**, no solo la fase 1:

| Dominio | Tablas / seeds |
|---|---|
| Social | profiles, super_likes, developers, hearts, rating |
| Catálogo | dimensions (7+primo), jokers (14), shop weights |
| Partida | matches, match_players, moves, piece_flags, board_cells, effects |
| Tienda | shop_offers, match_inventory (máx 3) |
| Ciclo | dimension_history, fases primo→shop→grieta |
| Social live | spectators, spectator_emojis (cooldown) |
| Matchmaking | queue, invites |

Funciones clave: `fn_create_match`, `fn_join_match`, `fn_select_deck`, `fn_enqueue_matchmaking`, `fn_buy_joker`, `fn_sell_joker`, `fn_consume_joker`, `fn_record_chess_move`, `fn_close_shop`, `fn_reveal_dimension`, `fn_get_match_state`, etc.

Si ya corriste la versión Fase 1, el script intenta ampliar enums; si falla, **resetea la branch de Neon** y vuelve a ejecutar este archivo limpio.

Copia la connection string (preferible **pooled**) a `.env` como `DATABASE_URL`.

## 2. Variables de entorno

```bash
cp .env.example .env
cp .env.example .env.local
```

Rellena:

| Variable | Dónde |
|---|---|
| `DATABASE_URL` | `.env` (API) |
| `FIREBASE_*` Admin | `.env` (API) |
| `VITE_FIREBASE_*` | `.env.local` (frontend) |

En local sin Admin SDK puedes poner `VERIFY_SKIP=true` y usar tokens `dev:<uid>:<email>` solo para pruebas de API.

## 3. Arrancar

```bash
npm install
npm run dev:all
```

- Web: http://localhost:5173  
- API: http://localhost:8787  

## Rutas Fase 1 + 2

| Ruta | Qué hace |
|---|---|
| `/` | Landing + partida rápida |
| `/login` | Login / registro |
| `/ranking` | Clasificación |
| `/perfil` | Perfil + mood |
| `/partida/:id` | Tablero vs bot, tienda, grieta |
| `/devs` | Supercorazones |


## API útil

- `POST /api/auth/sync` — upsert perfil tras Firebase
- `GET /api/leaderboard`
- `PATCH /api/profiles/me` / `.../mood`
- `POST /api/profiles/super-like`
- `POST /api/developers/heart`
- `POST /api/presence/heartbeat`
