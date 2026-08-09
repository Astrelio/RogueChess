import { createPortal } from 'react-dom'
import {
  DimensionAtmosphere,
  type AtmosphereClocks,
} from '@/components/match/DimensionAtmosphere'
import { normalizeDimensionId, type DimensionTheme } from '@/lib/dimensions'
import { cn } from '@/lib/utils'

type Props = {
  theme: DimensionTheme | string
  persistent?: boolean
  intensity?: number
  clocks?: AtmosphereClocks
  className?: string
}

/**
 * Fondo sólido + atmósfera Canvas por dimensión (full bleed).
 */
export function DimensionEnv({ theme, persistent, intensity, clocks, className }: Props) {
  const id = normalizeDimensionId(theme)
  const node = (
    <div
      className={cn(
        'rc-dim-env',
        `rc-dim-env--${id}`,
        persistent && 'rc-dim-env--persistent',
        className,
      )}
      aria-hidden
    >
      <DimensionAtmosphere
        theme={id}
        intensity={intensity ?? (persistent ? 0.72 : 1)}
        clocks={clocks}
      />
    </div>
  )

  if (persistent && typeof document !== 'undefined') {
    return createPortal(node, document.body)
  }
  return node
}
