import { MatchToast } from '@/components/match/MatchToast'
import type { JokerTargetMode } from '@/lib/jokerTargets'

type Props = {
  open: boolean
  jokerName: string
  mode: JokerTargetMode
  selected: string[]
  onCancel: () => void
  dark?: boolean
}

/**
 * Notificación flotante mientras se eligen casillas para un comodín.
 */
export function JokerTargetBanner({ open, jokerName, mode, selected, onCancel, dark }: Props) {
  const slot = mode.slots[Math.min(selected.length, Math.max(mode.slots.length - 1, 0))]
  if (!open || !slot) return null

  const progress = `${Math.min(selected.length + 1, mode.slots.length)}/${mode.slots.length}`
  const detailParts = [`Apuntando · ${jokerName} · ${progress}`]
  if (selected.length > 0) detailParts.push(`Elegidas: ${selected.join(' → ')}`)

  return (
    <MatchToast
      message={slot.hint}
      detail={detailParts.join(' · ')}
      tone="aim"
      dark={dark}
      onDismiss={onCancel}
      actionLabel="Cancelar · Esc"
    />
  )
}
