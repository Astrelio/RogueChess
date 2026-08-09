/** SVG decorativos para casillas (monolitos / ruinas). */

/** Reloj de arena dorado — monolito Mercado Negro. */
export const MONOLITH_HOURGLASS_BG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56" fill="none">
    <path d="M8 4h24v6L22 28l10 18v6H8v-6l10-18L8 10V4z" stroke="#d4af37" stroke-width="2.4" fill="#1a1408" fill-opacity="0.72"/>
    <path d="M12 10h16l-8 14-8-14z" fill="#e8c86e" fill-opacity="0.95"/>
    <path d="M14 42h12l-6 8-6-8z" fill="#d4af37" fill-opacity="0.88"/>
    <circle cx="20" cy="28" r="1.6" fill="#ffe08a"/>
  </svg>`,
)}")`

/** Escombros — casilla en ruina. */
export const RUINED_DEBRIS_BG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#1a1712" fill-opacity="0.35"/>
    <path d="M6 48l10-14 8 6 12-18 10 10 12-8v26H6z" fill="#3a342c" fill-opacity="0.85"/>
    <path d="M14 40l6-8 5 4 7-10 5 6" stroke="#6a6258" stroke-width="1.5" fill="none"/>
    <rect x="22" y="28" width="9" height="7" transform="rotate(18 26 31)" fill="#4a443c"/>
    <rect x="38" y="34" width="11" height="6" transform="rotate(-12 43 37)" fill="#524c42"/>
    <circle cx="18" cy="44" r="2" fill="#585048"/>
    <circle cx="48" cy="46" r="1.5" fill="#605850"/>
  </svg>`,
)}")`
