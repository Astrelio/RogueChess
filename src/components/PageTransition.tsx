/** Wrapper semántico; la transición de ruta la maneja Shell. */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}
