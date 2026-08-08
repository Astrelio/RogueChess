import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function medalColor(medal: string) {
  if (medal === 'gold') return 'text-[var(--color-gold)]'
  if (medal === 'silver') return 'text-[var(--color-silver)]'
  if (medal === 'bronze') return 'text-[var(--color-bronze)]'
  return 'text-[var(--color-ink-muted)]'
}

export function presenceLabel(p: string) {
  switch (p) {
    case 'online': return 'En línea'
    case 'playing': return 'Jugando'
    case 'spectating': return 'Espectando'
    case 'away': return 'Ausente'
    default: return 'Desconectado'
  }
}
