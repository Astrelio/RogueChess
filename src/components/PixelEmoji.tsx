import { useEffect, useRef } from 'react'

const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, res: number) {
  ctx.clearRect(0, 0, res, res)
  ctx.font = `${Math.floor(res * 0.82)}px ${EMOJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, res / 2, res / 2 + res * 0.05)
}

type Props = {
  emoji: string
  /** Tamaño visual en px. */
  size?: number
  /** Resolución interna del canvas: menor = más pixelado. */
  res?: number
  className?: string
}

/**
 * Renderiza un emoji del sistema como pixel-art: se dibuja en un canvas de baja
 * resolución y se escala con image-rendering: pixelated (sin librerías externas).
 */
export function PixelEmoji({ emoji, size = 40, res = 16, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) drawEmoji(ctx, emoji, res)
  }, [emoji, res])

  return (
    <canvas
      ref={ref}
      width={res}
      height={res}
      className={className}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      aria-hidden
    />
  )
}

/**
 * Muestrea colores reales del emoji (píxeles opacos del canvas) para pintar
 * los fragmentos de la animación de "ruptura" pixelada.
 */
export function sampleEmojiColors(emoji: string, count = 6, res = 16): string[] {
  const canvas = document.createElement('canvas')
  canvas.width = res
  canvas.height = res
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  drawEmoji(ctx, emoji, res)
  const data = ctx.getImageData(0, 0, res, res).data
  const opaque: string[] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 140) opaque.push(`rgb(${data[i]},${data[i + 1]},${data[i + 2]})`)
  }
  if (opaque.length === 0) return []
  const picked: string[] = []
  for (let i = 0; i < count; i++) {
    picked.push(opaque[Math.floor((i / count) * opaque.length)])
  }
  return picked
}
