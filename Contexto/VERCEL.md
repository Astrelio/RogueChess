# Si Vercel da 404 en /ranking o /api

## Antes de cada deploy (local)

```bash
npm run preflight
```

Eso corre: typecheck app + typecheck API como `@vercel/node` (NodeNext) + tests del motor.
Si `preflight` pasa, el build de Vercel no debería morir por TypeScript.

## Settings del proyecto (Dashboard → Settings → General / Build)

1. **Root Directory**: vacío (`.`) — no `dist`, no `src`
2. **Framework Preset**: `Other` (no Next.js; si Vite ignora `vercel.json`, usa Other)
3. **Build Command**: `npm run vercel-build`
4. **Output Directory**: `dist`
5. **Install Command**: `npm install`

Luego **Redeploy** sin caché (Redeploy → uncheck "Use existing Build Cache").

## Comprobar

- `https://tu-app.vercel.app/` → RogueChess
- `https://tu-app.vercel.app/api/health` → `{"ok":true,"env":{"database":true,"firebase":true,"portal":true}}`
- `https://tu-app.vercel.app/ranking` → ranking (no 404 de Vercel)

## Env (Production)

Además de `VITE_*`: `DATABASE_URL` (**sin comillas**), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (con `\n` escapados), `PORTAL_PUBLIC_KEY`, `PORTAL_SECRET_KEY`.

## Runtime (no es error de build, pero rompe partida)

1. **Portal origins** — cada dominio nuevo de Vercel:
   ```bash
   portal login
   portal origins add https://TU-URL.vercel.app --env env_b1efbe9ecaa6419a8cd17cbf6ab757a8
   ```
2. **Firebase Auth → Authorized domains** — añade el mismo host de Vercel (si no, Google/login fallan).
3. Si consola dice origin not registered → 403 Portal → el rival no ve turnos (ya hay poll Neon de respaldo).