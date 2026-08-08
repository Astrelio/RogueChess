import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LOOP_PHASES } from '@/lib/dimensions'
import { JokerCard } from '@/components/jokers/JokerCard'
import { easeOut, riseItem, stagger } from '@/lib/motion'
import type { MatchInventoryItem, ShopOffer } from '@/types/match'
import type { Joker } from '@/types/match'

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

type Props = {
  open: boolean
  cycleIndex: number
  timeMs: number
  /** Ms restantes del minuto de tienda. */
  shopLeftMs: number
  offers: ShopOffer[]
  inventory: MatchInventoryItem[]
  inventorySlots?: number
  busy?: boolean
  error?: string | null
  justBoughtOfferId?: string | null
  justBoughtInventoryId?: string | null
  onBuy: (offerId: string) => void
  onSell: (inventoryId: string) => void
  onContinue: () => void
}

/**
 * Fase de tienda a pantalla completa: empaña el tablero y fuerza el momento de mercado.
 */
export function ShopPhaseModal({
  open,
  cycleIndex,
  timeMs,
  shopLeftMs,
  offers,
  inventory,
  inventorySlots = 3,
  busy,
  error,
  justBoughtOfferId,
  justBoughtInventoryId,
  onBuy,
  onSell,
  onContinue,
}: Props) {
  const [flashOffer, setFlashOffer] = useState<string | null>(null)
  const urgent = shopLeftMs > 0 && shopLeftMs <= 15000

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!justBoughtOfferId) return
    setFlashOffer(justBoughtOfferId)
    const t = window.setTimeout(() => setFlashOffer(null), 700)
    return () => window.clearTimeout(t)
  }, [justBoughtOfferId])

  const emptySlots = Math.max(0, inventorySlots - inventory.length)
  const canBuy = inventory.length < inventorySlots
  const visibleOffers = offers.filter((o) => !o.purchased && !o.expired)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_42%,transparent)] backdrop-blur-[10px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-title"
            className="relative z-10 flex max-h-[min(100dvh,920px)] w-full max-w-4xl flex-col overflow-hidden border border-[var(--color-outline-soft)]/50 bg-[color-mix(in_srgb,var(--color-surface)_94%,#fff)] shadow-[0_28px_80px_rgba(27,28,25,0.28)] sm:rounded-md"
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <header className="relative overflow-hidden border-b hairline px-5 py-5 sm:px-8 sm:py-6">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    'radial-gradient(ellipse at 20% 0%, rgba(212,175,55,0.18), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(115,92,0,0.08), transparent 50%)',
                }}
              />
              <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
                    {LOOP_PHASES.shop.title} · ciclo {cycleIndex}
                  </p>
                  <h2 id="shop-title" className="font-display mt-1 text-3xl text-[var(--color-primary)] sm:text-4xl">
                    Mercado de comodines
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-[var(--color-ink-muted)]">
                    {LOOP_PHASES.shop.blurb} Tiempo es moneda — 1 minuto para comprar o cerrar.
                  </p>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                      Cierra en
                    </p>
                    <motion.p
                      key={Math.floor(shopLeftMs / 1000)}
                      initial={{ scale: 1.06 }}
                      animate={{ scale: 1 }}
                      className={`font-display text-3xl tabular-nums ${
                        urgent ? 'text-[var(--color-error)]' : 'text-[var(--color-primary)]'
                      }`}
                    >
                      {formatMs(shopLeftMs)}
                    </motion.p>
                  </div>
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                      Tu reloj
                    </p>
                    <motion.p
                      key={timeMs}
                      initial={{ scale: 1.08, color: 'var(--color-primary)' }}
                      animate={{ scale: 1, color: 'var(--color-ink)' }}
                      transition={{ duration: 0.45, ease: easeOut }}
                      className="font-display text-3xl tabular-nums"
                    >
                      {formatMs(timeMs)}
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-high)]">
                <motion.div
                  className={`h-full rounded-full ${urgent ? 'bg-[var(--color-error)]' : 'bg-[var(--color-primary-container)]'}`}
                  animate={{ width: `${Math.max(2, Math.min(100, (shopLeftMs / 60000) * 100))}%` }}
                  transition={{ duration: 0.25, ease: 'linear' }}
                />
              </div>
            </header>

            <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8">
              <motion.section variants={stagger} initial="initial" animate="animate">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h3 className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                    Ofertas del ciclo
                  </h3>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {canBuy
                      ? `${emptySlots} hueco${emptySlots === 1 ? '' : 's'} libre${emptySlots === 1 ? '' : 's'}`
                      : 'Inventario lleno'}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {visibleOffers.map((offer, i) =>
                      offer.joker ? (
                        <motion.div
                          key={offer.id}
                          layout
                          variants={riseItem}
                          custom={i}
                          initial={{ opacity: 1, scale: 1 }}
                          exit={{
                            opacity: 0,
                            scale: 0.85,
                            y: -12,
                            filter: 'blur(4px)',
                            transition: { duration: 0.35, ease: easeOut },
                          }}
                          className={`relative flex flex-col items-center gap-3 border border-[var(--color-outline-soft)]/35 bg-[color-mix(in_srgb,#fff_55%,transparent)] p-4 ${
                            flashOffer === offer.id ? 'ring-2 ring-[var(--color-primary)]' : ''
                          }`}
                        >
                          {flashOffer === offer.id ? (
                            <motion.span
                              className="font-label absolute inset-0 z-10 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)] text-sm uppercase tracking-[0.18em] text-[var(--color-primary)]"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              Comprado
                            </motion.span>
                          ) : null}
                          <JokerCard joker={offer.joker as Joker} size={148} disabled={busy || !canBuy} />
                          <div className="text-center">
                            <p className="font-display text-base text-[var(--color-ink)]">{offer.joker.name}</p>
                            <p className="font-label mt-1 text-[11px] uppercase tracking-wider text-[var(--color-primary)]">
                              −{offer.cost_seconds}s
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy || !canBuy || timeMs < offer.cost_seconds * 1000}
                            onClick={() => onBuy(offer.id)}
                            className="btn-primary w-full disabled:opacity-40"
                          >
                            Comprar
                          </button>
                        </motion.div>
                      ) : null,
                    )}
                  </AnimatePresence>
                  {visibleOffers.length === 0 ? (
                    <p className="col-span-full text-sm text-[var(--color-ink-muted)]">Sin ofertas en este ciclo.</p>
                  ) : null}
                </div>
              </motion.section>

              <section>
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h3 className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                    Tu inventario · vender
                  </h3>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {inventory.length}/{inventorySlots}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <AnimatePresence mode="popLayout">
                    {inventory.map((item) =>
                      item.joker ? (
                        <motion.div
                          key={item.id}
                          layout
                          initial={
                            justBoughtInventoryId === item.id
                              ? { opacity: 0, scale: 0.7, y: 16 }
                              : false
                          }
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.4, ease: easeOut }}
                          className={`flex flex-col items-center gap-2 border border-[var(--color-outline-soft)]/30 bg-[color-mix(in_srgb,#fff_40%,transparent)] p-3 ${
                            justBoughtInventoryId === item.id ? 'ring-2 ring-[var(--color-primary)]' : ''
                          }`}
                        >
                          <JokerCard
                            joker={item.joker as Joker}
                            size={124}
                            disabled={busy}
                            onClick={() => onSell(item.id)}
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onSell(item.id)}
                            className="btn-ghost px-3 py-2 text-[10px] disabled:opacity-40"
                          >
                            Vender +{item.purchased_cost_s ?? item.joker.cost_seconds}s
                          </button>
                        </motion.div>
                      ) : null,
                    )}
                  </AnimatePresence>
                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex h-[168px] w-[140px] items-center justify-center border border-dashed border-[var(--color-outline-soft)]/50 text-[10px] uppercase tracking-wider text-[var(--color-outline)]"
                    >
                      Vacío
                    </div>
                  ))}
                  {inventory.length === 0 && emptySlots === 0 ? (
                    <p className="text-sm text-[var(--color-ink-muted)]">Sin comodines.</p>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                  Vender recupera el tiempo que pagaste. No es obligatorio comprar.
                </p>
              </section>

              {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
            </div>

            <footer className="border-t hairline bg-[color-mix(in_srgb,var(--color-surface-low)_80%,transparent)] px-5 py-4 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Al cerrar esperas al rival; cuando ambos listos se revela la dimensión.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onContinue}
                  className="btn-primary min-w-[200px] disabled:opacity-50"
                >
                  {busy ? 'Listo…' : 'Listo · esperar rival'}
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

type WaitProps = {
  open: boolean
  peek: boolean
  shopLeftMs: number
  rivalShopping?: boolean
  onPeek: () => void
  onBack: () => void
}

/** Espera al rival tras cerrar tienda; opcionalmente mira el tablero. */
export function ShopWaitOverlay({ open, peek, shopLeftMs, rivalShopping, onPeek, onBack }: WaitProps) {
  if (!open) return null

  if (peek) {
    return createPortal(
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto fixed bottom-4 left-1/2 z-[125] flex w-[min(100%-2rem,420px)] -translate-x-1/2 flex-col gap-2 border border-[var(--color-outline-soft)]/60 bg-[color-mix(in_srgb,var(--color-surface)_92%,#fff)] px-4 py-3 shadow-[0_16px_40px_rgba(27,28,25,0.18)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">
            Esperando rival · {formatMs(shopLeftMs)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Mirando el tablero</p>
        </div>
        <button type="button" className="btn-ghost shrink-0 px-3 py-2 text-[10px]" onClick={onBack}>
          Volver a espera
        </button>
      </motion.div>,
      document.body,
    )
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_38%,transparent)] backdrop-blur-[8px]"
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shop-wait-title"
          className="panel relative z-10 w-full max-w-md border-[var(--color-outline-soft)]/55 bg-[color-mix(in_srgb,#fff_92%,transparent)] p-8 text-center shadow-[0_24px_60px_rgba(115,92,0,0.14)]"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: easeOut }}
        >
          <p className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
            Mercado cerrado
          </p>
          <h2 id="shop-wait-title" className="font-display mt-2 text-3xl text-[var(--color-primary)]">
            Esperando al rival
          </h2>
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Ya marcaste listo. Cuando el otro cierre la tienda (o acabe el minuto) se abre la grieta.
            {rivalShopping ? ' El rival sigue eligiendo comodines (Portal activity).' : ''}
          </p>
          <p className="font-display mt-6 text-4xl tabular-nums text-[var(--color-ink)]">
            {formatMs(shopLeftMs)}
          </p>
          <div className="mt-6 flex justify-center gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-[var(--color-primary)]"
                animate={{ opacity: [0.25, 1, 0.25], y: [0, -4, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
              />
            ))}
          </div>
          <button type="button" className="btn-primary mt-8 w-full" onClick={onPeek}>
            Ver piezas del tablero
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
