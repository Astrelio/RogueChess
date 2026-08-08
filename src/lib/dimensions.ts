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
  /** Una línea: qué cambia en el tablero. */
  blurb: string
  /** Etiqueta corta sobre el overlay (grieta / entorno). */
  eyebrow: string
  accent: string
}

export const DIMENSIONS: Record<string, DimensionInfo> = {
  primo: {
    id: 'primo',
    title: 'Tablero Primo',
    eyebrow: 'Entorno base',
    blurb: 'Ajedrez clásico: sin giros de física ni niebla. Solo piezas, reloj y comodines.',
    accent: '#735c00',
  },
  espejo: {
    id: 'espejo',
    title: 'Dimensión Espejo',
    eyebrow: 'Grieta · controles',
    blurb: 'Los ejes se invierten: derecha es izquierda, arriba es abajo. Los peones caminan hacia tu propio bando.',
    accent: '#415ba4',
  },
  bluriel: {
    id: 'bluriel',
    title: 'Dimensión Bluriel',
    eyebrow: 'Grieta · niebla',
    blurb: 'Niebla táctica: tras mover, tus piezas se vuelven borrosas o invisibles para el rival. Juega de memoria.',
    accent: '#5f5e5e',
  },
  gravitacional: {
    id: 'gravitacional',
    title: 'Dimensión Gravitacional',
    eyebrow: 'Grieta · gravedad',
    blurb: 'Gravedad aplastante: reinas, torres y alfiles solo alcanzan 3 casillas. Más allá no hay línea de visión.',
    accent: '#4d4635',
  },
  cadena_sangre: {
    id: 'cadena_sangre',
    title: 'Cadena de Sangre',
    eyebrow: 'Grieta · agresividad',
    blurb: 'Si puedes capturar, debes capturar. Nada de paseos defensivos mientras haya sangre al alcance.',
    accent: '#ba1a1a',
  },
  ruina: {
    id: 'ruina',
    title: 'Dimensión Ruina',
    eyebrow: 'Grieta · zonas muertas',
    blurb: 'Cada captura deja la casilla destruida. Nadie pisa ni atraviesa esa zona el resto de la fase (el caballo sí salta).',
    accent: '#3d3428',
  },
  mercado_negro: {
    id: 'mercado_negro',
    title: 'Mercado Negro',
    eyebrow: 'Grieta · monolitos',
    blurb: 'Monolitos de tiempo en casillas al azar: pisarlos o atravesarlos regala segundos. Capturar también sangra reloj a tu favor.',
    accent: '#d4af37',
  },
  fragilidad: {
    id: 'fragilidad',
    title: 'Dimensión Fragilidad',
    eyebrow: 'Grieta · cristal',
    blurb: 'Cristalización: si dos enemigos amenazan la misma pieza (salvo el rey), estalla sola al final del turno.',
    accent: '#8a8e94',
  },
}

export function getDimension(id: string | null | undefined): DimensionInfo {
  if (id && DIMENSIONS[id]) return DIMENSIONS[id]
  return {
    id: 'primo',
    title: id || 'Dimensión',
    eyebrow: 'Grieta',
    blurb: 'El tablero cambia sus reglas. Observa el entorno antes de mover.',
    accent: '#735c00',
  }
}

/** Fases del ciclo (doc maestro). */
export const LOOP_PHASES = {
  action: {
    key: 'action',
    title: 'Fase de Acción',
    blurb: 'Movimientos de ajedrez. Ocho jugadas en total y se abre el mercado.',
  },
  shop: {
    key: 'shop',
    title: 'Fase de Tienda',
    blurb: 'Pausa táctica: compra comodines pagando con el tiempo de tu reloj.',
  },
  rift: {
    key: 'rift',
    title: 'Fase de Grieta',
    blurb: 'El entorno muda de dimensión y altera la física o la visión de la partida.',
  },
} as const
