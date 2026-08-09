import { cn } from '@/lib/utils'

type Props = {
  /** Ms restantes. */
  ms: number
  /** Capacidad visual (ms “llenos”). */
  fullMs?: number
  /** Reloj activo (gotea). */
  active?: boolean
  className?: string
  size?: number
}

/**
 * Reloj de arena visual para Mercado Negro: la arena refleja el tiempo restante.
 */
export function HourglassClock({
  ms,
  fullMs = 5 * 60 * 1000,
  active,
  className,
  size = 28,
}: Props) {
  const fill = Math.max(0, Math.min(1, ms / Math.max(fullMs, 1)))
  const topH = `${Math.max(4, fill * 42)}%`
  const botH = `${Math.max(4, (1 - fill) * 42)}%`

  return (
    <span
      className={cn('rc-hourglass', active && 'rc-hourglass--active', className)}
      style={{ width: size, height: Math.round(size * 1.35) }}
      aria-hidden
    >
      <span className="rc-hourglass-glass">
        <span className="rc-hourglass-sand rc-hourglass-sand--top" style={{ height: topH }} />
        <span className="rc-hourglass-neck" />
        <span className="rc-hourglass-sand rc-hourglass-sand--bot" style={{ height: botH }} />
      </span>
      {active ? <span className="rc-hourglass-drip" /> : null}
    </span>
  )
}
