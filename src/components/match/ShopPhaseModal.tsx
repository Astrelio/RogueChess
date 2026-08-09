import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { JokerCard } from '@/components/jokers/JokerCard'
import { isDarkDimension, normalizeDimensionId } from '@/lib/dimensions'
import { easeOut, riseItem, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { MatchInventoryItem, ShopOffer } from '@/types/match'
import type { Joker } from '@/types/match'

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

const DRAG_OFFER = 'application/x-roguechess-offer'

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
  justBoughtOfferId?: string | null
  justBoughtInventoryId?: string | null
  /** Dimensión actual (tiñe la tienda). */
  dimensionId?: string | null
  onBuy: (offerId: string) => void
  onSell: (inventoryId: string) => void
  onContinue: () => void
}

/**
 * Fase de tienda a pantalla completa — UX tipo Balatro:
 * cartas mudas, click → acción debajo, arrastrar oferta a slot vacío.
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
  justBoughtOfferId,
  justBoughtInventoryId,
  dimensionId,
  onBuy,
  onSell,
  onContinue,
}: Props) {
  const [flashOffer, setFlashOffer] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null)
  const [draggingOfferId, setDraggingOfferId] = useState<string | null>(null)
  const [dropHover, setDropHover] = useState(false)
  const urgent = shopLeftMs > 0 && shopLeftMs <= 15000
  const dim = normalizeDimensionId(dimensionId)
  const darkShop = isDarkDimension(dim) || dim === 'cadena_sangre'

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setSelectedOfferId(null)
      setSelectedInvId(null)
      setDraggingOfferId(null)
      setDropHover(false)
    }
  }, [open])

  useEffect(() => {
    if (!justBoughtOfferId) return
    setFlashOffer(justBoughtOfferId)
    setSelectedOfferId(null)
    const t = window.setTimeout(() => setFlashOffer(null), 700)
    return () => window.clearTimeout(t)
  }, [justBoughtOfferId])

  useEffect(() => {
    if (justBoughtInventoryId) setSelectedInvId(null)
  }, [justBoughtInventoryId])

  const emptySlots = Math.max(0, inventorySlots - inventory.length)
  const canBuy = inventory.length < inventorySlots
  const visibleOffers = offers.filter((o) => !o.purchased && !o.expired)

  function pickOffer(id: string) {
    setSelectedInvId(null)
    setSelectedOfferId((prev) => (prev === id ? null : id))
  }

  function pickInv(id: string) {
    setSelectedOfferId(null)
    setSelectedInvId((prev) => (prev === id ? null : id))
  }

  function tryBuy(offerId: string) {
    if (busy || !canBuy) return
    const offer = visibleOffers.find((o) => o.id === offerId)
    if (!offer || timeMs < offer.cost_seconds * 1000) return
    onBuy(offerId)
  }

  function trySell(inventoryId: string) {
    if (busy) return
    onSell(inventoryId)
    setSelectedInvId(null)
  }

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
            className={cn(
              'absolute inset-0 backdrop-blur-[10px]',
              darkShop
                ? 'bg-[color-mix(in_srgb,#050403_72%,transparent)]'
                : 'bg-[color-mix(in_srgb,var(--color-ink)_42%,transparent)]',
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-title"
            className={cn(
              'rc-shop relative z-10 flex h-[min(100dvh,820px)] w-full max-w-5xl flex-col overflow-hidden border sm:h-[min(92dvh,780px)] sm:rounded-md',
              `rc-shop--${dim}`,
              darkShop
                ? 'border-white/10 bg-[color-mix(in_srgb,#14110e_94%,transparent)] text-[#f2efe8] shadow-[0_28px_80px_rgba(0,0,0,0.55)]'
                : 'border-[var(--color-outline-soft)]/50 bg-[color-mix(in_srgb,var(--color-surface)_94%,#fff)] shadow-[0_28px_80px_rgba(27,28,25,0.28)]',
            )}
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <header className="relative shrink-0 overflow-hidden border-b hairline px-4 py-3 sm:px-6 sm:py-4">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    'radial-gradient(ellipse at 20% 0%, rgba(212,175,55,0.18), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(115,92,0,0.08), transparent 50%)',
                }}
              />
              <div className="relative flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p
                    className={cn(
                      'font-label text-[10px] uppercase tracking-[0.22em]',
                      darkShop ? 'text-[var(--rc-shop-accent,#e9c349)]' : 'text-[var(--color-primary)]',
                    )}
                  >
                    Fase de mercado · ciclo {cycleIndex}
                  </p>
                  <h2
                    id="shop-title"
                    className={cn(
                      'font-display mt-0.5 text-2xl sm:text-3xl',
                      darkShop ? 'text-[#f7f3ea]' : 'text-[var(--color-primary)]',
                    )}
                  >
                    Mercado de comodines
                  </h2>
                </div>
                <div className="flex gap-5 text-right">
                  <div>
                    <p
                      className={cn(
                        'font-label text-[10px] uppercase tracking-[0.16em]',
                        darkShop ? 'text-white/55' : 'text-[var(--color-ink-muted)]',
                      )}
                    >
                      Cierra en
                    </p>
                    <motion.p
                      key={Math.floor(shopLeftMs / 1000)}
                      initial={{ scale: 1.06 }}
                      animate={{ scale: 1 }}
                      className={`font-display text-2xl tabular-nums sm:text-3xl ${
                        urgent
                          ? 'text-[var(--color-error)]'
                          : darkShop
                            ? 'text-[var(--rc-shop-accent,#e9c349)]'
                            : 'text-[var(--color-primary)]'
                      }`}
                    >
                      {formatMs(shopLeftMs)}
                    </motion.p>
                  </div>
                  <div>
                    <p
                      className={cn(
                        'font-label text-[10px] uppercase tracking-[0.16em]',
                        darkShop ? 'text-white/55' : 'text-[var(--color-ink-muted)]',
                      )}
                    >
                      Tu reloj
                    </p>
                    <motion.p
                      key={timeMs}
                      initial={{ scale: 1.08 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.45, ease: easeOut }}
                      className={cn(
                        'font-display text-2xl tabular-nums sm:text-3xl',
                        darkShop ? 'text-[#f2efe8]' : 'text-[var(--color-ink)]',
                      )}
                    >
                      {formatMs(timeMs)}
                    </motion.p>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  'relative mt-3 h-1 overflow-hidden rounded-full',
                  darkShop ? 'bg-white/10' : 'bg-[var(--color-surface-high)]',
                )}
              >
                <motion.div
                  className={`h-full rounded-full ${urgent ? 'bg-[var(--color-error)]' : 'bg-[var(--color-primary-container)]'}`}
                  animate={{ width: `${Math.max(2, Math.min(100, (shopLeftMs / 60000) * 100))}%` }}
                  transition={{ duration: 0.25, ease: 'linear' }}
                />
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 overflow-hidden px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
              {/* Ofertas — cartas mudas */}
              <motion.section
                variants={stagger}
                initial="initial"
                animate="animate"
                className="shrink-0"
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                    Ofertas
                  </h3>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {canBuy
                      ? `${emptySlots} hueco${emptySlots === 1 ? '' : 's'}`
                      : 'Inventario lleno'}
                  </p>
                </div>

                <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-4">
                  <AnimatePresence mode="popLayout">
                    {visibleOffers.map((offer, i) => {
                      if (!offer.joker) return null
                      const affordable = canBuy && timeMs >= offer.cost_seconds * 1000
                      const locked = busy || !affordable
                      return (
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
                          className={cn(
                            'relative flex w-[128px] flex-col items-center sm:w-[148px]',
                            flashOffer === offer.id && 'ring-2 ring-[var(--color-primary)] rounded-sm',
                            draggingOfferId === offer.id && 'opacity-40',
                          )}
                        >
                          {flashOffer === offer.id ? (
                            <motion.span
                              className="font-label absolute inset-x-0 top-0 z-10 flex h-[180px] items-center justify-center bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)] text-sm uppercase tracking-[0.18em] text-[var(--color-primary)] sm:h-[207px]"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            >
                              Comprado
                            </motion.span>
                          ) : null}
                          <JokerCard
                            joker={offer.joker as Joker}
                            size={128}
                            className="sm:!w-[148px] sm:!h-[207px]"
                            disabled={locked}
                            shaded={!affordable}
                            selected={selectedOfferId === offer.id}
                            draggable={affordable && !busy}
                            tooltipSide="below"
                            darkTooltip={darkShop}
                            onClick={() => {
                              if (locked) return
                              pickOffer(offer.id)
                            }}
                            onDragStart={(e) => {
                              e.dataTransfer?.setData(DRAG_OFFER, offer.id)
                              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
                              setDraggingOfferId(offer.id)
                              setSelectedOfferId(offer.id)
                              setSelectedInvId(null)
                            }}
                            onDragEnd={() => {
                              setDraggingOfferId(null)
                              setDropHover(false)
                            }}
                          />
                          <AnimatePresence>
                            {selectedOfferId === offer.id && affordable ? (
                              <motion.div
                                initial={{ opacity: 0, y: -8, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -6, height: 0 }}
                                transition={{ duration: 0.22, ease: easeOut }}
                                className="flex w-full flex-col items-center overflow-hidden"
                              >
                                <div className="mt-1.5 w-full space-y-1">
                                  <p
                                    className={cn(
                                      'truncate text-center font-display text-xs',
                                      darkShop ? 'text-[#f2efe8]' : 'text-[var(--color-ink)]',
                                    )}
                                  >
                                    {offer.joker.name}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => tryBuy(offer.id)}
                                    className="btn-primary w-full !py-1.5 text-[11px] disabled:opacity-40"
                                  >
                                    Comprar −{offer.cost_seconds}s
                                  </button>
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                  {visibleOffers.length === 0 ? (
                    <p className="w-full text-center text-sm text-[var(--color-ink-muted)]">
                      Sin ofertas en este ciclo.
                    </p>
                  ) : null}
                </div>
              </motion.section>

              {/* Inventario + slots drop */}
              <section className="shrink-0">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                    Inventario
                  </h3>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {inventory.length}/{inventorySlots}
                  </p>
                </div>

                <div className="flex flex-wrap items-start justify-center gap-3 sm:gap-4">
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
                          className={cn(
                            'flex w-[100px] flex-col items-center sm:w-[112px]',
                            justBoughtInventoryId === item.id &&
                              'ring-2 ring-[var(--color-primary)] rounded-sm',
                          )}
                        >
                          <JokerCard
                            joker={item.joker as Joker}
                            size={100}
                            className="sm:!w-[112px] sm:!h-[157px]"
                            disabled={busy}
                            selected={selectedInvId === item.id}
                            tooltipSide="below"
                            darkTooltip={darkShop}
                            onClick={() => {
                              if (busy) return
                              pickInv(item.id)
                            }}
                          />
                          <AnimatePresence>
                            {selectedInvId === item.id ? (
                              <motion.div
                                initial={{ opacity: 0, y: -8, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -6, height: 0 }}
                                transition={{ duration: 0.22, ease: easeOut }}
                                className="flex w-full flex-col items-center overflow-hidden"
                              >
                                <div className="mt-1.5 w-full space-y-1">
                                  <p
                                    className={cn(
                                      'truncate text-center font-display text-xs',
                                      darkShop ? 'text-[#f2efe8]' : 'text-[var(--color-ink)]',
                                    )}
                                  >
                                    {item.joker.name}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => trySell(item.id)}
                                    className="btn-ghost w-full !py-1.5 text-[11px] border border-[var(--color-outline-soft)]/50 disabled:opacity-40"
                                  >
                                    Vender +{item.purchased_cost_s ?? item.joker.cost_seconds}s
                                  </button>
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </motion.div>
                      ) : null,
                    )}
                  </AnimatePresence>
                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      onDragOver={(e) => {
                        if (!draggingOfferId || !canBuy) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                        setDropHover(true)
                      }}
                      onDragLeave={() => setDropHover(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDropHover(false)
                        const offerId =
                          e.dataTransfer.getData(DRAG_OFFER) || draggingOfferId || ''
                        setDraggingOfferId(null)
                        if (offerId) tryBuy(offerId)
                      }}
                      className={cn(
                        'flex items-center justify-center border border-dashed transition',
                        'text-[10px] uppercase tracking-wider text-[var(--color-outline)]',
                        dropHover && draggingOfferId
                          ? 'border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary-fixed)_35%,transparent)] text-[var(--color-primary)] scale-[1.03]'
                          : 'border-[var(--color-outline-soft)]/50',
                      )}
                      style={{ width: 100, height: Math.round(100 * 1.4) }}
                    >
                      {dropHover && draggingOfferId ? 'Soltar' : 'Vacío'}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <footer
              className={cn(
                'shrink-0 border-t hairline px-4 py-3 sm:px-6',
                darkShop
                  ? 'border-white/10 bg-black/25'
                  : 'bg-[color-mix(in_srgb,var(--color-surface-low)_80%,transparent)]',
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p
                  className={cn(
                    'text-xs sm:text-sm',
                    darkShop ? 'text-white/60' : 'text-[var(--color-ink-muted)]',
                  )}
                >
                  Al cerrar esperas al rival; luego se revela la dimensión.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onContinue}
                  className="btn-primary min-w-[180px] disabled:opacity-50"
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
            {rivalShopping ? ' El rival sigue eligiendo comodines.' : ''}
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
