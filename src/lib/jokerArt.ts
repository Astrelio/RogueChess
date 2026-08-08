const ART: Record<string, string> = {
  paso_fantasma: '/jokers/paso_fantasma.png',
  imperius: '/jokers/imperius.png',
  capa_invisibilidad: '/jokers/capa_invisibilidad.png',
  morsmordre: '/jokers/morsmordre.png',
  expecto_patronum: '/jokers/expecto_patronum.png',
  bombarda: '/jokers/bombarda.png',
  aparicion: '/jokers/aparicion.png',
  pocion_multijugos: '/jokers/pocion_multijugos.png',
  defodio: '/jokers/defodio.png',
  avada_kedavra: '/jokers/avada_kedavra.png',
  axio_tempus: '/jokers/axio_tempus.png',
  arresto_momentum: '/jokers/arresto_momentum.png',
  petrificus_totalus: '/jokers/petrificus_totalus.png',
  giratiempo: '/jokers/giratiempo.png',
}

export function jokerArtUrl(code: string) {
  return ART[code] ?? '/jokers/paso_fantasma.png'
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
