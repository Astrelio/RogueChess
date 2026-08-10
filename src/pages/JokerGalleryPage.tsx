import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { JokerCard } from '@/components/jokers/JokerCard'
import { BackToHome } from '@/components/BackToHome'
import { PageTransition } from '@/components/PageTransition'
import { api } from '@/lib/api'
import {
  catalogAsJokers,
  groupJokersByFaction,
} from '@/lib/jokerCatalog'
import { factionLabel } from '@/lib/jokerArt'
import { riseItem, stagger } from '@/lib/motion'
import type { Joker } from '@/types/match'

/**
 * Galería pública de comodines: cartas grandes + tooltip que sigue al cursor.
 * Ruta: /comodines
 */
export function JokerGalleryPage() {
  const [jokers, setJokers] = useState<Joker[]>(() => catalogAsJokers())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { jokers: rows } = await api.jokersCatalog()
        if (alive && rows?.length) setJokers(rows)
      } catch {
        /* fallback local */
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const groups = groupJokersByFaction(jokers)

  return (
    <PageTransition>
      <motion.section variants={stagger} initial="initial" animate="animate">
        <motion.div variants={riseItem} className="mb-4">
          <BackToHome />
        </motion.div>
        <motion.p
          variants={riseItem}
          className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]"
        >
          Colección
        </motion.p>
        <motion.h1
          variants={riseItem}
          className="font-display mt-2 text-3xl text-[var(--color-primary)] sm:text-4xl"
        >
          Galería de comodines
        </motion.h1>
        <motion.p
          variants={riseItem}
          className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base"
        >
          Pasa el cursor (o toca la carta) para leer nombre, rareza, baraja y efecto. En partida se
          compran en el mercado con segundos del reloj.
        </motion.p>
        {loading ? (
          <motion.p
            variants={riseItem}
            className="font-label mt-4 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]"
          >
            Actualizando catálogo…
          </motion.p>
        ) : null}

        <div className="mt-10 space-y-12">
          {groups.map((group) => (
            <motion.section key={group.faction} variants={riseItem}>
              <h2 className="font-label text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)]">
                {factionLabel[group.faction] ?? group.faction}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                {group.items.length} comodín{group.items.length === 1 ? '' : 'es'}
              </p>
              <ul className="mt-5 flex flex-wrap justify-center gap-4 sm:justify-start sm:gap-8">
                {group.items.map((joker) => (
                  <li key={joker.id || joker.code} className="flex flex-col items-center gap-2">
                    <JokerCard joker={joker} cssWidth="var(--rc-joker-gallery)" tooltipSide="below" />
                    <p className="font-display max-w-[var(--rc-joker-gallery)] text-center text-sm text-[var(--color-ink)]">
                      {joker.name}
                    </p>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>

        <motion.p
          variants={riseItem}
          className="mt-14 text-xs text-[var(--color-ink-muted)]"
        >
          ¿Quieres probar animaciones?{' '}
          <Link to="/lab/jokers" className="text-[var(--color-primary)] hover:underline">
            Laboratorio de FX
          </Link>
        </motion.p>
      </motion.section>
    </PageTransition>
  )
}
