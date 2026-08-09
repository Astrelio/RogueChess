import { Link } from 'react-router-dom'

/** Enlace de retorno al lobby para páginas secundarias (perfil, ranking, galería…). */
export function BackToHome({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`font-label inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-primary)] ${className ?? ''}`}
    >
      <span aria-hidden>←</span> Inicio
    </Link>
  )
}
