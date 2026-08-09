import type { DimensionTheme } from '@/lib/dimensions'

/** Entorno visual de una dimensión (full-bleed o embebido detrás del tablero). */
export function DimensionEnv({ theme }: { theme: DimensionTheme }) {
  switch (theme) {
    case 'bluriel':
      return (
        <div className="rc-env rc-env-bluriel" aria-hidden>
          <div className="rc-env-sky" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={`f${i}`} className="rc-env-mist" style={{ ['--i' as string]: i }} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <span key={`e${i}`} className="rc-env-wisp" style={{ ['--i' as string]: i }} />
          ))}
          <span className="rc-env-silhouette rc-env-silhouette--l" />
          <span className="rc-env-silhouette rc-env-silhouette--r" />
          <span className="rc-env-eye rc-env-eye--1" />
          <span className="rc-env-eye rc-env-eye--2" />
          {['recuerda…', '¿dónde estaba?', 'niebla…', 'no mires atrás'].map((w, i) => (
            <span key={w} className="rc-env-whisper" style={{ ['--i' as string]: i }}>
              {w}
            </span>
          ))}
        </div>
      )
    case 'espejo':
      return (
        <div className="rc-env rc-env-espejo" aria-hidden>
          <div className="rc-env-mirror-half rc-env-mirror-half--a" />
          <div className="rc-env-mirror-half rc-env-mirror-half--b" />
          <div className="rc-env-mirror-seam" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span key={i} className="rc-env-mirror-tile" style={{ ['--i' as string]: i }} />
          ))}
          <span className="rc-env-mirror-ghost" />
        </div>
      )
    case 'gravitacional':
      return (
        <div className="rc-env rc-env-grav" aria-hidden>
          <div className="rc-env-horizon" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <span key={i} className="rc-env-meteor" style={{ ['--i' as string]: i }} />
          ))}
          <span className="rc-env-well" />
          <span className="rc-env-crush-ring" />
        </div>
      )
    case 'cadena_sangre':
      return (
        <div className="rc-env rc-env-sangre" aria-hidden>
          <div className="rc-env-vein rc-env-vein--1" />
          <div className="rc-env-vein rc-env-vein--2" />
          <div className="rc-env-vein rc-env-vein--3" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="rc-env-link" style={{ ['--i' as string]: i }} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={`d${i}`} className="rc-env-blood" style={{ ['--i' as string]: i }} />
          ))}
          <span className="rc-env-pulse-heart" />
        </div>
      )
    case 'ruina':
      return (
        <div className="rc-env rc-env-ruina" aria-hidden>
          <div className="rc-env-dust" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="rc-env-rubble" style={{ ['--i' as string]: i }} />
          ))}
          <span className="rc-env-scar rc-env-scar--1" />
          <span className="rc-env-scar rc-env-scar--2" />
          <span className="rc-env-scar rc-env-scar--3" />
          <span className="rc-env-dead-zone" />
        </div>
      )
    case 'mercado_negro':
      return (
        <div className="rc-env rc-env-mercado" aria-hidden>
          <div className="rc-env-void" />
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="rc-env-stele" style={{ ['--i' as string]: i }} />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={`s${i}`} className="rc-env-spark" style={{ ['--i' as string]: i }} />
          ))}
          <span className="rc-env-clock-halo" />
        </div>
      )
    case 'fragilidad':
      return (
        <div className="rc-env rc-env-cristal" aria-hidden>
          <div className="rc-env-prism-glow" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span key={i} className="rc-env-crystal" style={{ ['--i' as string]: i }} />
          ))}
          <span className="rc-env-fracture" />
          <span className="rc-env-glint" />
        </div>
      )
    default:
      return (
        <div className="rc-env rc-env-primo" aria-hidden>
          <div className="rc-env-parchment" />
          <span className="rc-env-crest" />
          <span className="rc-env-orbit rc-env-orbit--1" />
          <span className="rc-env-orbit rc-env-orbit--2" />
        </div>
      )
  }
}
