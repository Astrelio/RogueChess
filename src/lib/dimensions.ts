/** Presentación de dimensiones: copy, tablero y atmósfera (según refs de diseño). */

export type DimensionTheme =
  | 'primo'
  | 'espejo'
  | 'bluriel'
  | 'gravitacional'
  | 'cadena_sangre'
  | 'ruina'
  | 'mercado_negro'
  | 'fragilidad'

export type DimensionInfo = {
  id: DimensionTheme
  title: string
  /** Etiqueta corta del reveal (ej. GRIETA · ZONAS MUERTAS). */
  eyebrow: string
  blurb: string
  board: { light: string; dark: string; frame?: string }
}

/** Orden de laboratorio / picker. */
export const DIMENSION_IDS: DimensionTheme[] = [
  'primo',
  'espejo',
  'bluriel',
  'gravitacional',
  'cadena_sangre',
  'ruina',
  'mercado_negro',
  'fragilidad',
]

const DIMENSIONS: Record<DimensionTheme, DimensionInfo> = {
  primo: {
    id: 'primo',
    title: 'Tablero Primo',
    eyebrow: 'Grieta · Origen',
    blurb: 'Ajedrez clásico, sin rarezas. La primera fase de cada partida: coloca y toma tempo.',
    board: { light: '#f5f4ef', dark: '#d0c5af', frame: 'rgba(212,175,55,0.35)' },
  },
  espejo: {
    id: 'espejo',
    title: 'Dimensión Espejo',
    eyebrow: 'Grieta · Reflexión',
    blurb:
      'Todo se invierte: derecha es izquierda, arriba es abajo. Los peones avanzan hacia tu propio bando (sin entrar en tu fila base).',
    board: { light: '#e8eef5', dark: '#5a7390', frame: 'rgba(140,190,230,0.55)' },
  },
  bluriel: {
    id: 'bluriel',
    title: 'Dimensión Bluriel',
    eyebrow: 'Grieta · Niebla',
    blurb:
      'Tras tu jugada, el rival ve tus piezas borrosas. El jaque siempre se anuncia, niebla o no.',
    board: { light: '#ece8f2', dark: '#6e6580', frame: 'rgba(170,150,210,0.4)' },
  },
  gravitacional: {
    id: 'gravitacional',
    title: 'Dimensión Gravitacional',
    eyebrow: 'Grieta · Peso',
    blurb:
      'Dama, torre y alfil solo llegan a 3 casillas. Más lejos no dan jaque ni clavan.',
    board: { light: '#f0ebe2', dark: '#8a7358', frame: 'rgba(180,140,80,0.4)' },
  },
  cadena_sangre: {
    id: 'cadena_sangre',
    title: 'Cadena de Sangre',
    eyebrow: 'Grieta · Obligación',
    blurb:
      'Si puedes capturar de forma legal, debes hacerlo. No cuentan las capturas que dejen a tu rey en jaque.',
    board: { light: '#f3e8e6', dark: '#8a4a4a', frame: 'rgba(180,50,50,0.45)' },
  },
  ruina: {
    id: 'ruina',
    title: 'Dimensión Ruina',
    eyebrow: 'Grieta · Zonas muertas',
    blurb:
      'Cada captura deja esa casilla destruida. Nadie la pisa ni la atraviesa el resto de la fase (el caballo sí salta).',
    board: { light: '#e8e0d4', dark: '#6a6358', frame: 'rgba(160,150,130,0.35)' },
  },
  mercado_negro: {
    id: 'mercado_negro',
    title: 'Mercado Negro',
    eyebrow: 'Grieta · Tiempo',
    blurb:
      'Monolitos de tiempo en el tablero: písalos o atraviésalos para ganar segundos. Capturar también suma reloj a tu favor.',
    board: { light: '#f2e6c4', dark: '#1a1814', frame: 'rgba(212,175,55,0.65)' },
  },
  fragilidad: {
    id: 'fragilidad',
    title: 'Dimensión Fragilidad',
    eyebrow: 'Grieta · Cristal',
    blurb:
      'Si al cerrar el turno una pieza (no el rey) está amenazada por dos enemigos, se destroza sola.',
    board: { light: '#e4eaef', dark: '#4a5c6e', frame: 'rgba(160,190,210,0.4)' },
  },
}

export function normalizeDimensionId(id: string | null | undefined): DimensionTheme {
  if (!id) return 'primo'
  const key = id.trim().toLowerCase()
  if (key in DIMENSIONS) return key as DimensionTheme
  if (key === 'sangre' || key === 'cadena') return 'cadena_sangre'
  if (key === 'mercado') return 'mercado_negro'
  return 'primo'
}

export function getDimension(id: string | null | undefined): DimensionInfo {
  return DIMENSIONS[normalizeDimensionId(id)]
}

export function listDimensions(): DimensionInfo[] {
  return DIMENSION_IDS.map((id) => DIMENSIONS[id])
}

/** Fondos oscuros (UI clara). Primo = pergamino claro. */
export function isDarkDimension(id: string | null | undefined): boolean {
  return normalizeDimensionId(id) !== 'primo'
}
