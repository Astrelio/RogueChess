const ART: Record<string, string> = {
  paso_fantasma: '/jokers/paso_fantasma.webp',
  imperius: '/jokers/imperius.webp',
  capa_invisibilidad: '/jokers/capa_invisibilidad.webp',
  morsmordre: '/jokers/morsmordre.webp',
  expecto_patronum: '/jokers/expecto_patronum.webp',
  bombarda: '/jokers/bombarda.webp',
  aparicion: '/jokers/aparicion.webp',
  pocion_multijugos: '/jokers/pocion_multijugos.webp',
  defodio: '/jokers/defodio.webp',
  avada_kedavra: '/jokers/avada_kedavra.webp',
  axio_tempus: '/jokers/axio_tempus.webp',
  arresto_momentum: '/jokers/arresto_momentum.webp',
  petrificus_totalus: '/jokers/petrificus_totalus.webp',
  giratiempo: '/jokers/giratiempo.webp',
}

export function jokerArtUrl(code: string) {
  return ART[code] ?? '/jokers/paso_fantasma.webp'
}

export const rarityLabel: Record<string, string> = {
  common: 'Común',
  epic: 'Épico',
  legendary: 'Legendario',
}

export const factionLabel: Record<string, string> = {
  spectral: 'Espectral',
  antimatter: 'Antimateria',
  tempus: 'Tempus',
}
