/** Utilidades de geometría de tablero (a1..h8). */

export function fileOf(sq: string): number {
  return sq.charCodeAt(0) - 97
}

export function rankOf(sq: string): number {
  return Number(sq[1]) - 1
}

export function squareAt(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return String.fromCharCode(97 + file) + String(rank + 1)
}

export function isSquare(sq: unknown): sq is string {
  return typeof sq === 'string' && /^[a-h][1-8]$/.test(sq)
}

/** Distancia Chebyshev (número de "pasos" de una pieza deslizante). */
export function chebyshev(a: string, b: string): number {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)))
}

/**
 * Casillas estrictamente entre a y b sobre línea recta o diagonal.
 * Devuelve [] si no están alineadas (p.ej. salto de caballo).
 */
export function pathBetween(a: string, b: string): string[] {
  const df = fileOf(b) - fileOf(a)
  const dr = rankOf(b) - rankOf(a)
  const straight = df === 0 || dr === 0
  const diagonal = Math.abs(df) === Math.abs(dr)
  if (!straight && !diagonal) return []
  const steps = Math.max(Math.abs(df), Math.abs(dr))
  if (steps <= 1) return []
  const sf = Math.sign(df)
  const sr = Math.sign(dr)
  const out: string[] = []
  for (let i = 1; i < steps; i++) {
    const sq = squareAt(fileOf(a) + sf * i, rankOf(a) + sr * i)
    if (sq) out.push(sq)
  }
  return out
}

/** Casilla "hacia atrás" para el color dado (blancas retroceden hacia rank 1). */
export function backwardSquare(sq: string, color: 'white' | 'black'): string | null {
  return squareAt(fileOf(sq), rankOf(sq) + (color === 'white' ? -1 : 1))
}

/** Vecindad 3x3 centrada en sq (incluye el centro). */
export function area3x3(sq: string): string[] {
  const out: string[] = []
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const s = squareAt(fileOf(sq) + df, rankOf(sq) + dr)
      if (s) out.push(s)
    }
  }
  return out
}

/** Adyacencia rey (Chebyshev 1). */
export function isAdjacent(a: string, b: string): boolean {
  return a !== b && chebyshev(a, b) === 1
}

/**
 * Casillas ordenadas por distancia creciente desde origin (anillos),
 * con orden determinista dentro de cada anillo.
 */
export function ringsFrom(origin: string): string[] {
  const all: { sq: string; d: number }[] = []
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const sq = squareAt(f, r)!
      if (sq === origin) continue
      all.push({ sq, d: chebyshev(origin, sq) })
    }
  }
  all.sort((x, y) => x.d - y.d || x.sq.localeCompare(y.sq))
  return all.map((x) => x.sq)
}
