# Si Vercel da 404 en /ranking o /api

## Settings del proyecto (Dashboard → Settings → General / Build)

1. **Root Directory**: vacío (`.`) — no `dist`, no `src`
2. **Framework Preset**: `Other` (no Next.js; si Vite ignora `vercel.json`, usa Other)
3. **Build Command**: `npm run vercel-build`
4. **Output Directory**: `dist`
5. **Install Command**: `npm install`

Luego **Redeploy** sin caché (Redeploy → uncheck "Use existing Build Cache").

## Comprobar

- `https://tu-app.vercel.app/` → RogueChess
- `https://tu-app.vercel.app/api/health` → `{"ok":true,...}`
- `https://tu-app.vercel.app/ranking` → ranking (no 404 de Vercel)

## Env (Production)

Además de `VITE_*`: `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `PORTAL_PUBLIC_KEY`, `PORTAL_SECRET_KEY`.
