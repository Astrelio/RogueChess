import { useEffect, useRef } from 'react'
import { normalizeDimensionId, type DimensionTheme } from '@/lib/dimensions'
import { cn } from '@/lib/utils'

export type AtmosphereClocks = {
  whiteMs: number
  blackMs: number
  runningFor: 'white' | 'black' | null
  /** Capacidad visual de los relojes de arena. */
  fullMs?: number
}

type Props = {
  theme: DimensionTheme | string
  intensity?: number
  clocks?: AtmosphereClocks
  className?: string
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
  life: number
  hue?: number
}

type Star = Particle & { color: string }

/**
 * Atmósfera full-viewport por dimensión (Canvas 2D).
 */
export function DimensionAtmosphere({ theme, intensity = 0.85, clocks, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const id = normalizeDimensionId(theme)
  const clocksRef = useRef<AtmosphereClocks>({
    whiteMs: 0,
    blackMs: 0,
    runningFor: null,
    fullMs: 5 * 60 * 1000,
  })
  clocksRef.current = {
    whiteMs: clocks?.whiteMs ?? 0,
    blackMs: clocks?.blackMs ?? 0,
    runningFor: clocks?.runningFor ?? null,
    fullMs: clocks?.fullMs ?? 5 * 60 * 1000,
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    let running = true
    let w = 0
    let h = 0
    let dpr = 1
    const particles: Particle[] = []
    const stars: Star[] = []
    const cracks: { x1: number; y1: number; x2: number; y2: number; a: number }[] = []
    const streaks: { x: number; y: number; len: number; speed: number; a: number }[] = []
    const shards: {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      rot: number
      vr: number
      a: number
      spark: number
    }[] = []

    const STAR_COLORS = [
      'rgba(255,248,230,',
      'rgba(255,220,160,',
      'rgba(240,200,120,',
      'rgba(255,255,245,',
      'rgba(230,210,170,',
    ]

    const resize = () => {
      const parent = canvas.parentElement
      const pw = parent?.clientWidth || window.innerWidth
      const ph = parent?.clientHeight || window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = pw
      h = ph
      canvas.width = Math.floor(pw * dpr)
      canvas.height = Math.floor(ph * dpr)
      canvas.style.width = `${pw}px`
      canvas.style.height = `${ph}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedScene()
    }

    const seedScene = () => {
      particles.length = 0
      stars.length = 0
      cracks.length = 0
      streaks.length = 0
      shards.length = 0

      const nP =
        id === 'cadena_sangre' ? 50 : id === 'gravitacional' ? 140 : id === 'ruina' ? 55 : 55
      for (let i = 0; i < nP; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: 0.6 + Math.random() * 2.2,
          a: 0.12 + Math.random() * 0.5,
          life: Math.random(),
        })
      }

      if (id === 'gravitacional') {
        for (let i = 0; i < 320; i++) {
          const c = STAR_COLORS[i % STAR_COLORS.length]
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0,
            vy: 0,
            r: 0.55 + Math.random() * 1.65,
            a: 0.55 + Math.random() * 0.45,
            life: Math.random(),
            color: c,
          })
        }
      }

      if (id === 'fragilidad') {
        for (let i = 0; i < 28; i++) {
          shards.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -0.15 - Math.random() * 0.35,
            size: 8 + Math.random() * 22,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.01,
            a: 0.25 + Math.random() * 0.45,
            spark: Math.random(),
          })
        }
      }

      if (id === 'ruina') {
        for (let i = 0; i < 36; i++) {
          const x1 = Math.random() * w
          const y1 = Math.random() * h
          const ang = (Math.random() - 0.5) * 1.4 + (i % 2 === 0 ? -0.6 : 0.6)
          const len = 50 + Math.random() * 200
          cracks.push({
            x1,
            y1,
            x2: x1 + Math.cos(ang) * len,
            y2: y1 + Math.sin(ang) * len,
            a: 0.06 + Math.random() * 0.16,
          })
        }
        // Escombros angulares
        for (let i = 0; i < 42; i++) {
          particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.25,
            vy: 0.2 + Math.random() * 0.55,
            r: 2 + Math.random() * 7,
            a: 0.2 + Math.random() * 0.45,
            life: Math.random(),
          })
        }
      }
    }

    const fillBg = () => {
      switch (id) {
        case 'cadena_sangre':
          ctx.fillStyle = '#14080c'
          break
        case 'gravitacional':
          ctx.fillStyle = '#050403'
          break
        case 'ruina':
          ctx.fillStyle = '#14110f'
          break
        case 'fragilidad':
          ctx.fillStyle = '#0a1016'
          break
        case 'espejo':
          ctx.fillStyle = '#0c1828'
          break
        case 'mercado_negro':
          ctx.fillStyle = '#0a0804'
          break
        case 'bluriel':
          ctx.fillStyle = '#120e18'
          break
        default:
          ctx.fillStyle = '#ebe6d8'
      }
      ctx.fillRect(0, 0, w, h)

      const g = ctx.createRadialGradient(
        w * 0.5,
        h * 0.42,
        0,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.72,
      )
      switch (id) {
        case 'cadena_sangre': {
          const pulse = 0.5 + Math.sin(performance.now() * 0.0016) * 0.5
          g.addColorStop(0, `rgba(70, 14, 24, ${0.55 + pulse * 0.12})`)
          g.addColorStop(0.5, 'rgba(28, 8, 14, 0.65)')
          g.addColorStop(1, 'rgba(0, 0, 0, 0.88)')
          break
        }
        case 'gravitacional':
          g.addColorStop(0, 'rgba(18, 12, 8, 0.5)')
          g.addColorStop(0.55, 'rgba(0, 0, 0, 0.2)')
          g.addColorStop(1, 'rgba(0, 0, 0, 0.92)')
          break
        case 'ruina':
          g.addColorStop(0, 'rgba(40, 34, 28, 0.55)')
          g.addColorStop(1, 'rgba(0, 0, 0, 0.75)')
          break
        case 'fragilidad':
          g.addColorStop(0, 'rgba(30, 48, 62, 0.55)')
          g.addColorStop(1, 'rgba(0, 0, 0, 0.8)')
          break
        case 'espejo':
          g.addColorStop(0, 'rgba(40, 80, 120, 0.45)')
          g.addColorStop(1, 'rgba(0, 0, 0, 0.75)')
          break
        case 'mercado_negro':
          g.addColorStop(0, 'rgba(40, 30, 10, 0.45)')
          g.addColorStop(1, 'rgba(0, 0, 0, 0.85)')
          break
        case 'bluriel':
          g.addColorStop(0, 'rgba(50, 36, 70, 0.45)')
          g.addColorStop(1, 'rgba(0, 0, 0, 0.8)')
          break
        default:
          g.addColorStop(0, 'rgba(255, 252, 240, 0.35)')
          g.addColorStop(1, 'rgba(180, 160, 120, 0.25)')
      }
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    /** Cadena de Sangre — terciopelo borgoña + polvo; sin hilos. */
    const drawBlood = (t: number) => {
      const breath = 0.55 + Math.sin(t * 0.0014) * 0.45

      // Halo central tipo seda
      const silk = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.55)
      silk.addColorStop(0, `rgba(120, 28, 42, ${0.22 * intensity * breath})`)
      silk.addColorStop(0.55, `rgba(50, 10, 18, ${0.12 * intensity})`)
      silk.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = silk
      ctx.fillRect(0, 0, w, h)

      // Polvo / moteado elegante
      for (const p of particles) {
        p.x += Math.sin(t * 0.0006 + p.life * 4) * 0.12
        p.y += 0.04 + p.vy * 0.05
        if (p.y > h) p.y = -2
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        ctx.beginPath()
        ctx.fillStyle = `rgba(200, 90, 100, ${p.a * 0.35 * intensity})`
        ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2)
        ctx.fill()
      }

      // Marco sutil inferior (acento oro-rosa)
      ctx.strokeStyle = `rgba(212, 160, 140, ${0.12 * intensity * breath})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(w * 0.2, h * 0.78)
      ctx.lineTo(w * 0.8, h * 0.78)
      ctx.stroke()
    }

    const drawGravity = (t: number) => {
      const cx = w * 0.5
      const cy = h * 0.48
      const pulse = 1 + Math.sin(t * 0.0018) * 0.05
      const R = Math.min(w, h) * 0.14 * pulse

      const stepStar = (s: Star) => {
        const dx = cx - s.x
        const dy = cy - s.y
        const dist = Math.hypot(dx, dy) || 1
        const pull = (160 / dist) * 0.022 * intensity
        const tang = 0.42
        s.vx = (s.vx + (dx / dist) * pull - (dy / dist) * tang * 0.01) * 0.985
        s.vy = (s.vy + (dy / dist) * pull + (dx / dist) * tang * 0.01) * 0.985
        s.x += s.vx
        s.y += s.vy
        if (dist < R * 0.75 || s.x < -10 || s.x > w + 10 || s.y < -10 || s.y > h + 10) {
          const ang = Math.random() * Math.PI * 2
          const rad = Math.min(w, h) * (0.42 + Math.random() * 0.5)
          s.x = cx + Math.cos(ang) * rad
          s.y = cy + Math.sin(ang) * rad * 0.55
          s.vx = 0
          s.vy = 0
        }
        return Math.hypot(cx - s.x, cy - s.y) || 1
      }

      // Halo de absorción (solo negro / humo) — debajo de las estrellas
      const absorb = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 3.2)
      absorb.addColorStop(0, 'rgba(0,0,0,1)')
      absorb.addColorStop(0.4, 'rgba(0,0,0,0.96)')
      absorb.addColorStop(0.7, 'rgba(0,0,0,0.35)')
      absorb.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = absorb
      ctx.beginPath()
      ctx.arc(cx, cy, R * 3.2, 0, Math.PI * 2)
      ctx.fill()

      // Horizonte de eventos
      ctx.beginPath()
      ctx.fillStyle = '#000'
      ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2)
      ctx.fill()

      // Estrellas arrastradas al agujero (encima del halo para que se noten)
      for (const s of stars) {
        const dist = stepStar(s)
        if (dist < R * 0.85) continue
        const twinkle = 0.6 + Math.sin(t * 0.01 + s.life * 12) * 0.4
        const nearBoost = 0.55 + Math.min(1, (dist - R) / (R * 2.2)) * 0.45
        const alpha = Math.min(1, s.a * intensity * twinkle * nearBoost * 1.15)
        const speed = Math.hypot(s.vx, s.vy)
        // Estela corta hacia el vórtice
        if (speed > 0.35) {
          ctx.beginPath()
          ctx.strokeStyle = `${s.color}${(alpha * 0.45).toFixed(3)})`
          ctx.lineWidth = Math.max(0.6, s.r * 0.55)
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(s.x - s.vx * 4.5, s.y - s.vy * 4.5)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.fillStyle = `${s.color}${alpha.toFixed(3)})`
        ctx.arc(s.x, s.y, s.r * (0.9 + Math.min(0.55, speed * 0.12)), 0, Math.PI * 2)
        ctx.fill()
      }

      // Partículas más grandes en espiral
      for (const p of particles) {
        const dx = cx - p.x
        const dy = cy - p.y
        const dist = Math.hypot(dx, dy) || 1
        const pull = (280 / dist) * 0.032 * intensity
        p.vx += (dx / dist) * pull - (dy / dist) * 0.01
        p.vy += (dy / dist) * pull + (dx / dist) * 0.01
        p.vx *= 0.98
        p.vy *= 0.98
        p.x += p.vx
        p.y += p.vy
        if (dist < R * 0.6 || p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) {
          const ang = Math.random() * Math.PI * 2
          const rad = Math.min(w, h) * (0.38 + Math.random() * 0.45)
          p.x = cx + Math.cos(ang) * rad
          p.y = cy + Math.sin(ang) * rad * 0.5
          p.vx = 0
          p.vy = 0
        }
        if (dist < R * 0.85) continue
        const fade = 0.5 + Math.min(0.5, dist / (R * 5))
        const alpha = Math.min(0.95, p.a * 0.75 * intensity * fade)
        const speed = Math.hypot(p.vx, p.vy)
        if (speed > 0.4) {
          ctx.beginPath()
          ctx.strokeStyle = `rgba(230, 235, 255, ${alpha * 0.4})`
          ctx.lineWidth = Math.max(0.7, p.r * 0.4)
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 5, p.y - p.vy * 5)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(230, 235, 255, ${alpha})`
        ctx.arc(p.x, p.y, p.r * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawRuin = (t: number) => {
      for (const c of cracks) {
        const pulse = 0.85 + Math.sin(t * 0.001 + c.a * 20) * 0.15
        ctx.beginPath()
        ctx.moveTo(c.x1, c.y1)
        const mx = (c.x1 + c.x2) / 2 + Math.sin(t * 0.0005 + c.a * 40) * 3
        const my = (c.y1 + c.y2) / 2 + Math.cos(t * 0.0005 + c.a * 40) * 3
        ctx.lineTo(mx, my)
        ctx.lineTo(c.x2, c.y2)
        ctx.strokeStyle = `rgba(200, 190, 170, ${c.a * intensity * pulse})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
      // Escombros angulares cayendo / flotando
      for (const p of particles) {
        p.y += 0.15 + Math.abs(p.vy) * 0.35
        p.x += p.vx + Math.sin(t * 0.001 + p.life) * 0.12
        p.life += 0.01
        if (p.y > h + 12) {
          p.y = -10
          p.x = Math.random() * w
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.life * 0.4 + p.a)
        ctx.fillStyle = `rgba(120, 108, 92, ${p.a * 0.55 * intensity})`
        ctx.fillRect(-p.r * 0.6, -p.r * 0.35, p.r * 1.2, p.r * 0.7)
        ctx.fillStyle = `rgba(70, 62, 52, ${p.a * 0.4 * intensity})`
        ctx.beginPath()
        ctx.moveTo(-p.r * 0.4, p.r * 0.2)
        ctx.lineTo(p.r * 0.5, p.r * 0.15)
        ctx.lineTo(p.r * 0.1, p.r * 0.7)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }

    const drawCrystal = (t: number) => {
      const cx = w * 0.45
      const cy = h * 0.52
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.4)
      bloom.addColorStop(0, `rgba(170, 220, 235, ${0.16 * intensity})`)
      bloom.addColorStop(1, 'rgba(170, 220, 235, 0)')
      ctx.fillStyle = bloom
      ctx.fillRect(0, 0, w, h)

      for (const s of shards) {
        s.x += s.vx + Math.sin(t * 0.001 + s.spark * 8) * 0.12
        s.y += s.vy
        s.rot += s.vr
        if (s.y < -40) {
          s.y = h + 30
          s.x = Math.random() * w
        }
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.rot)
        const sz = s.size
        // Cristal grande
        ctx.beginPath()
        ctx.moveTo(0, -sz)
        ctx.lineTo(sz * 0.55, sz * 0.35)
        ctx.lineTo(0, sz * 0.75)
        ctx.lineTo(-sz * 0.5, sz * 0.3)
        ctx.closePath()
        const glass = ctx.createLinearGradient(0, -sz, 0, sz)
        glass.addColorStop(0, `rgba(220, 245, 255, ${0.55 * intensity * s.a})`)
        glass.addColorStop(0.5, `rgba(140, 210, 230, ${0.22 * intensity * s.a})`)
        glass.addColorStop(1, `rgba(100, 180, 210, ${0.35 * intensity * s.a})`)
        ctx.fillStyle = glass
        ctx.fill()
        ctx.strokeStyle = `rgba(230, 250, 255, ${0.45 * intensity * s.a})`
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }
    }

    const drawMirror = (_t: number) => {
      // Fondo espejo sin haz central: solo atmósfera suave + partículas
      const wash = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.55)
      wash.addColorStop(0, `rgba(60, 110, 160, ${0.1 * intensity})`)
      wash.addColorStop(1, 'rgba(60, 110, 160, 0)')
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        ctx.fillStyle = `rgba(180, 210, 240, ${p.a * 0.35 * intensity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawMarket = (t: number) => {
      // Atmósfera dorada; los relojes de arena viven en los monolitos del tablero
      const rail = ctx.createLinearGradient(w * 0.65, 0, w, 0)
      rail.addColorStop(0, 'rgba(212,175,55,0)')
      rail.addColorStop(1, `rgba(212,175,55,${0.12 * intensity})`)
      ctx.fillStyle = rail
      ctx.fillRect(w * 0.65, 0, w * 0.35, h)

      for (const p of particles) {
        p.y += 0.18
        p.x += Math.sin(t * 0.001 + p.life) * 0.14
        if (p.y > h) p.y = -2
        ctx.fillStyle = `rgba(212, 175, 55, ${p.a * 0.5 * intensity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawBluriel = (t: number) => {
      for (const p of particles) {
        p.x += p.vx * 0.45
        p.y += p.vy * 0.45
        if (p.x < -40) p.x = w + 40
        if (p.x > w + 40) p.x = -40
        if (p.y < -40) p.y = h + 40
        if (p.y > h + 40) p.y = -40
        const fog = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30 + p.r * 10)
        fog.addColorStop(0, `rgba(140, 120, 180, ${0.075 * intensity * p.a})`)
        fog.addColorStop(1, 'rgba(140, 120, 180, 0)')
        ctx.fillStyle = fog
        ctx.beginPath()
        ctx.arc(p.x, p.y, 42, 0, Math.PI * 2)
        ctx.fill()
      }
      const pulse = 0.5 + Math.sin(t * 0.001) * 0.5
      ctx.fillStyle = `rgba(100, 80, 140, ${0.035 * pulse * intensity})`
      ctx.fillRect(0, 0, w, h)
    }

    const drawPrimo = (t: number) => {
      for (const p of particles) {
        p.x += Math.sin(t * 0.0008 + p.life * 5) * 0.12
        p.y += 0.07
        if (p.y > h) p.y = -2
        ctx.fillStyle = `rgba(180, 140, 40, ${p.a * 0.22 * intensity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const frame = (t: number) => {
      if (!running) return
      fillBg()
      switch (id) {
        case 'cadena_sangre':
          drawBlood(t)
          break
        case 'gravitacional':
          drawGravity(t)
          break
        case 'ruina':
          drawRuin(t)
          break
        case 'fragilidad':
          drawCrystal(t)
          break
        case 'espejo':
          drawMirror(t)
          break
        case 'mercado_negro':
          drawMarket(t)
          break
        case 'bluriel':
          drawBluriel(t)
          break
        default:
          drawPrimo(t)
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(frame)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [id, intensity])

  return <canvas ref={canvasRef} className={cn('rc-dim-atmosphere', className)} aria-hidden />
}
