import { defineConfig, allow } from '@portalsdk/config'

/**
 * Config Portal (deploy: `npx portal deploy` con PORTAL_SECRET / PORTAL_SECRET_KEY).
 * Auth: Firebase ID tokens verificados vía JWKS público.
 */
export default defineConfig({
  auth: {
    issuer: 'https://securetoken.google.com/roguechess-55c16',
    jwksUrl:
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    claimMap: {
      userId: 'sub',
      username: 'name',
    },
  },
  channels: {
    'lobby:presence': {
      anonymous: true,
      authz: () => allow({ publish: true, sendDirect: true }),
      notify: (ctx) => {
        const c = ctx.message.content as { type?: string; title?: string } | null
        if (c?.type !== 'challenge') return null
        return {
          title: c.title ?? 'Reto de RogueChess',
          data: { ...(typeof c === 'object' && c ? c : {}), messageId: ctx.message.id },
          to: ctx.message.to ? [ctx.message.to] : undefined,
        }
      },
    },
    'match:*': {
      anonymous: true,
      authz: (ctx) => {
        if (ctx.claims.anon) {
          // Visitantes / pre-login: lectura ok vía anonymous; publish permitido en MVP
          return allow({ publish: true, sendDirect: false })
        }
        return allow({ publish: true, sendDirect: true })
      },
      extensions: {
        matchState: './portal/extensions/matchState.ts',
      },
      onPublish: [],
    },
  },
})
