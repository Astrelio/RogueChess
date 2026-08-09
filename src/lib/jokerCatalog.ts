/** Catálogo local (fallback / sin API). Alineado con motor + seed. */
import type { Joker, JokerFaction, JokerRarity } from '@/types/match'

type CatalogEntry = {
  code: string
  name: string
  faction: JokerFaction
  rarity: JokerRarity
  timing: string
  cost_seconds: number
  description: string
  is_passive?: boolean
}

export const JOKER_CATALOG: CatalogEntry[] = [
  {
    code: 'paso_fantasma',
    name: 'Paso Fantasma',
    faction: 'spectral',
    rarity: 'common',
    timing: 'instant',
    cost_seconds: 8,
    description: 'Tu próxima jugada puede saltar o atravesar piezas en la trayectoria.',
  },
  {
    code: 'imperius',
    name: 'Imperius',
    faction: 'spectral',
    rarity: 'legendary',
    timing: 'instant',
    cost_seconds: 32,
    description:
      'Mueves ahora una pieza enemiga (no el rey) como si fuera tuya. Puede capturar incluso a las suyas.',
  },
  {
    code: 'capa_invisibilidad',
    name: 'Capa de invisibilidad',
    faction: 'spectral',
    rarity: 'epic',
    timing: 'duration',
    cost_seconds: 18,
    description:
      'Una pieza tuya queda invisible para el rival hasta que capture o la capturen.',
  },
  {
    code: 'morsmordre',
    name: 'Morsmordre',
    faction: 'spectral',
    rarity: 'epic',
    timing: 'instant',
    cost_seconds: 20,
    description:
      'Empuja una casilla atrás a una pieza enemiga junto a la tuya. Si choca con otra tuya, la aplastas. Sin espacio o con Expecto Patronum, falla.',
  },
  {
    code: 'expecto_patronum',
    name: 'Expecto Patronum',
    faction: 'spectral',
    rarity: 'legendary',
    timing: 'passive',
    cost_seconds: 15,
    description: 'Anula Morsmordre en todo el tablero el resto de la partida.',
    is_passive: true,
  },
  {
    code: 'bombarda',
    name: 'Bombarda',
    faction: 'antimatter',
    rarity: 'epic',
    timing: 'instant',
    cost_seconds: 22,
    description:
      'Sacrifica un peón tuyo y quema un área 3×3 este ciclo. Las piezas se empujan a casillas seguras (el rey no muere).',
  },
  {
    code: 'aparicion',
    name: 'Aparición',
    faction: 'antimatter',
    rarity: 'common',
    timing: 'instant',
    cost_seconds: 12,
    description: 'Intercambia de casilla dos piezas tuyas (un peón no puede acabar en la última fila).',
  },
  {
    code: 'pocion_multijugos',
    name: 'Poción Multijugos',
    faction: 'antimatter',
    rarity: 'legendary',
    timing: 'duration',
    cost_seconds: 35,
    description: 'Un peón tuyo actúa como dama durante tu jugada; al ceder el turno, se desvanece.',
  },
  {
    code: 'defodio',
    name: 'Defodio',
    faction: 'antimatter',
    rarity: 'legendary',
    timing: 'duration',
    cost_seconds: 32,
    description:
      'Trampa en una casilla vacía por ~1 turno: quien caiga muere al instante (salvo el rey).',
  },
  {
    code: 'avada_kedavra',
    name: 'Avada Kedavra',
    faction: 'antimatter',
    rarity: 'legendary',
    timing: 'instant',
    cost_seconds: 25,
    description:
      'Elimina un peón enemigo o una pieza que haya sido peón (coronada o Multijugos).',
  },
  {
    code: 'axio_tempus',
    name: 'Axio Tempus',
    faction: 'tempus',
    rarity: 'common',
    timing: 'instant',
    cost_seconds: 5,
    description: 'Roba 10 segundos del reloj rival y súmalos al tuyo.',
  },
  {
    code: 'arresto_momentum',
    name: 'Arresto Momentum',
    faction: 'tempus',
    rarity: 'legendary',
    timing: 'duration',
    cost_seconds: 28,
    description:
      'El reloj del rival corre al doble en su próximo turno. Petrificus Totalus lo anula.',
  },
  {
    code: 'petrificus_totalus',
    name: 'Petrificus Totalus',
    faction: 'tempus',
    rarity: 'epic',
    timing: 'duration',
    cost_seconds: 18,
    description: 'Tu reloj se congela durante tu próximo movimiento. Gana a Arresto Momentum.',
  },
  {
    code: 'giratiempo',
    name: 'Giratiempo',
    faction: 'tempus',
    rarity: 'legendary',
    timing: 'duration',
    cost_seconds: 28,
    description:
      'Mueve una pieza tuya dos veces en el mismo turno (máx. 1 captura). Si el primer movimiento da jaque, se cancela el segundo.',
  },
]

const FACTION_ORDER: JokerFaction[] = ['spectral', 'antimatter', 'tempus']

export function catalogAsJokers(): Joker[] {
  return JOKER_CATALOG.map((j) => ({
    id: j.code,
    code: j.code,
    name: j.name,
    faction: j.faction,
    rarity: j.rarity,
    timing: j.timing,
    cost_seconds: j.cost_seconds,
    description: j.description,
    is_passive: j.is_passive ?? false,
    is_active: true,
  }))
}

export function sortJokersByFaction(jokers: Joker[]): Joker[] {
  const rarityRank: Record<JokerRarity, number> = { common: 0, epic: 1, legendary: 2 }
  return [...jokers].sort((a, b) => {
    const fa = FACTION_ORDER.indexOf(a.faction)
    const fb = FACTION_ORDER.indexOf(b.faction)
    if (fa !== fb) return fa - fb
    const ra = rarityRank[a.rarity] ?? 0
    const rb = rarityRank[b.rarity] ?? 0
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name, 'es')
  })
}

export function groupJokersByFaction(jokers: Joker[]): { faction: JokerFaction; items: Joker[] }[] {
  const sorted = sortJokersByFaction(jokers)
  return FACTION_ORDER.map((faction) => ({
    faction,
    items: sorted.filter((j) => j.faction === faction),
  })).filter((g) => g.items.length > 0)
}
