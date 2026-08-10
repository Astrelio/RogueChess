/**
 * Modos de apuntado por código de comodín (alineado con Zod en /joker/use).
 * Sin target → cast inmediato. Con targets → clicks en el tablero.
 */

export type TargetSlot =
  | { key: 'square'; label: string; hint: string }
  | { key: 'a'; label: string; hint: string }
  | { key: 'b'; label: string; hint: string }
  | { key: 'from'; label: string; hint: string }
  | { key: 'to'; label: string; hint: string }

export type JokerTargetMode = {
  code: string
  slots: TargetSlot[]
  /** Cast inmediato (Tempus / flags); no pide casillas. */
  instant: boolean
}

const INSTANT: JokerTargetMode = { code: '', slots: [], instant: true }

const MODES: Record<string, JokerTargetMode> = {
  axio_tempus: { ...INSTANT, code: 'axio_tempus' },
  petrificus_totalus: { ...INSTANT, code: 'petrificus_totalus' },
  arresto_momentum: { ...INSTANT, code: 'arresto_momentum' },
  giratiempo: { ...INSTANT, code: 'giratiempo' },
  expecto_patronum: { ...INSTANT, code: 'expecto_patronum' },
  paso_fantasma: { ...INSTANT, code: 'paso_fantasma' },

  aparicion: {
    code: 'aparicion',
    instant: false,
    slots: [
      { key: 'a', label: 'Primera pieza', hint: 'Elige una pieza tuya' },
      { key: 'b', label: 'Segunda pieza', hint: 'Elige otra pieza tuya para intercambiar' },
    ],
  },
  imperius: {
    code: 'imperius',
    instant: false,
    slots: [
      { key: 'from', label: 'Pieza enemiga', hint: 'Elige la pieza enemiga a mover ahora (no el rey)' },
      { key: 'to', label: 'Destino', hint: 'A dónde la mueves (puede capturar a las suyas)' },
    ],
  },
  avada_kedavra: {
    code: 'avada_kedavra',
    instant: false,
    slots: [
      {
        key: 'square',
        label: 'Víctima',
        hint: 'Elige un peón enemigo (o pieza que fue peón)',
      },
    ],
  },
  morsmordre: {
    code: 'morsmordre',
    instant: false,
    slots: [
      {
        key: 'square',
        label: 'Objetivo',
        hint: 'Pieza enemiga junto a una tuya (no el rey)',
      },
    ],
  },
  bombarda: {
    code: 'bombarda',
    instant: false,
    slots: [{ key: 'square', label: 'Peón', hint: 'Sacrifica un peón tuyo: quema un área 3×3' }],
  },
  defodio: {
    code: 'defodio',
    instant: false,
    slots: [
      { key: 'square', label: 'Trampa', hint: 'Casilla vacía: quien caiga muere (salvo el rey)' },
    ],
  },
  capa_invisibilidad: {
    code: 'capa_invisibilidad',
    instant: false,
    slots: [{ key: 'square', label: 'Pieza', hint: 'Invisible hasta que capture o la capturen' }],
  },
  pocion_multijugos: {
    code: 'pocion_multijugos',
    instant: false,
    slots: [
      {
        key: 'square',
        label: 'Peón',
        hint: 'Peón tuyo → dama por una jugada; luego se desvanece',
      },
    ],
  },
}

export function getJokerTargetMode(code: string): JokerTargetMode | null {
  return MODES[code] ?? null
}

export function needsBoardTarget(code: string): boolean {
  const mode = getJokerTargetMode(code)
  if (!mode) return true
  return !mode.instant
}

/** Arma el payload Zod a partir de casillas elegidas en orden. */
export function buildJokerPayload(
  mode: JokerTargetMode,
  squares: string[],
): Record<string, string> | null {
  if (mode.instant) return {}
  if (squares.length < mode.slots.length) return null
  const out: Record<string, string> = {}
  mode.slots.forEach((slot, i) => {
    out[slot.key] = squares[i]!
  })
  return out
}
