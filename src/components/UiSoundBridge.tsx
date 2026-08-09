import { useEffect } from 'react'
import {
  playClickSound,
  playHoverSound,
  unlockAudio,
} from '@/lib/sounds'

const INTERACTIVE =
  'button:not([disabled]), a[href], [role="button"], .btn-primary, .btn-ghost'

function interactiveRoot(el: Element | null): HTMLElement | null {
  if (!el) return null
  if (el.closest('[data-sfx-ignore]')) return null
  const hit = el.closest(INTERACTIVE)
  return hit instanceof HTMLElement ? hit : null
}

/**
 * Hover + click globales para botones/links.
 * Montar una vez en el Shell.
 */
export function UiSoundBridge() {
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const t = e.target
      if (!(t instanceof Element)) return
      const btn = interactiveRoot(t)
      if (!btn) return
      const from = e.relatedTarget instanceof Element ? e.relatedTarget : null
      if (from && btn.contains(from)) return
      playHoverSound()
    }

    const onClick = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (!interactiveRoot(t)) return
      playClickSound()
    }

    document.addEventListener('pointerover', onOver, true)
    document.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      document.removeEventListener('pointerover', onOver, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  return null
}
