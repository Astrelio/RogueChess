---
name: Ivory Tactics
colors:
  surface: '#faf9f4'
  surface-dim: '#dbdad5'
  surface-bright: '#faf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ef'
  surface-container: '#efeee9'
  surface-container-high: '#e9e8e3'
  surface-container-highest: '#e3e3de'
  on-surface: '#1b1c19'
  on-surface-variant: '#4d4635'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f1ec'
  outline: '#7f7663'
  outline-variant: '#d0c5af'
  surface-tint: '#735c00'
  primary: '#735c00'
  on-primary: '#ffffff'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#e9c349'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e4e2e1'
  on-secondary-container: '#656464'
  tertiary: '#415ba4'
  on-tertiary: '#ffffff'
  tertiary-container: '#97b0ff'
  on-tertiary-container: '#254188'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#27438a'
  background: '#faf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e3e3de'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system embodies the spirit of a high-end physical chess set or a luxury tactical manual. It shifts away from digital coldness toward a "Tactile Academic" aesthetic. The personality is sophisticated, strategic, and authoritative, evoking the feeling of a grandmaster’s study.

The visual style is a hybrid of **Minimalism** and **Glassmorphism**, utilizing "Physical Minimalism." It focuses on material honesty, using soft parchment-like textures, fine-line detailing, and intentional white space to create a sense of premium quality and focus. The interface should feel like an heirloom object: deliberate, weighted, and timeless.

## Colors

The palette is anchored by **Surface Ivory** (#FDFCF7) and **Neutral Parchment** (#F9F8F3), providing a warm, organic foundation that avoids the sterile nature of pure white.

- **Primary (Gold):** Used exclusively for headlines, significant calls to action, and structural highlights. It represents value and command.
- **Secondary (Ink Black):** Reserved for body text and primary iconography to ensure maximum legibility and a "printed" feel.
- **Faction Accents:** Purple, Red/Orange, and Cyan/Blue are saturated and slightly deepened to maintain WCAG 2.1 AA contrast ratios against the ivory background. Use these sparingly for functional state indicators and faction-specific UI elements.
- **Borders:** Fine, 1px lines using a dimmed gold or light grey to simulate the edges of high-quality vellum or metallic inlays.

## Typography

This design system uses a high-contrast typographic pairing to reinforce the "Tactical Manual" aesthetic.

- **Headlines (Libre Caslon Text):** A classic serif that conveys authority and heritage. Rendered in rich gold to act as the primary visual anchor.
- **Body (Work Sans):** A grounded, professional sans-serif that ensures high readability for tactical descriptions and data.
- **Data/Labels (Space Grotesk):** Used for technical metadata, coordinates, or faction stats. Its geometric nature adds a subtle "modern-tactical" edge to the otherwise classical layout.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop to mimic the centered, structured pages of a physical book or manual. 

- **Grid:** 12-column system with generous gutters (24px) to allow the "parchment" background to breathe.
- **Margins:** Large outer margins (64px on desktop) create a "letterboxed" feel, focusing the user's attention on the central tactical data.
- **Mobile Adaption:** On mobile, the grid collapses to 4 columns. Large display serif type should scale down significantly (see `headline-lg-mobile`) to prevent awkward line breaks while maintaining its elegant character.

## Elevation & Depth

Depth is conveyed through **Tonal Layering** and **Subtle Glassmorphism** rather than heavy shadows.

- **Panels:** Use a "Frosted Ivory" effect—background blur (12px) combined with a 70% opaque white fill. This creates a layered, translucent feel like tracing paper over a map.
- **Shadows:** Avoid dark, muddy shadows. Use extremely soft, high-diffusion shadows (Blur 20px, Opacity 4%) tinted with the primary gold color to create a "lifted" parchment effect.
- **Dividers:** Use 1px solid lines in `border_gold_dim`. Horizontal dividers should be used liberally to separate content sections, echoing the layout of a ledger.

## Shapes

The shape language is disciplined and "Soft-Modern." 

- **Corners:** A base roundedness of `0.25rem` (4px) is used for most UI elements. This provides enough softness to feel premium without losing the structural integrity of a tactical interface.
- **Interactive Elements:** Buttons and input fields use the same 4px radius. 
- **Large Containers:** Can utilize `rounded-lg` (8px) to distinguish main panels from smaller components.

## Components

- **Buttons:** 
  - *Primary:* Solid Ink Black with Gold text. This high contrast commands immediate attention.
  - *Secondary:* Transparent background with a 1px Gold border.
- **Cards:** Ivory glassmorphism panels with a 1px gold-tinted top border. No heavy drop shadows; use a subtle inner glow to define edges.
- **Input Fields:** Minimalist style. No background fill, just a bottom-border (1px) in Gold. Labels should use the `label-sm` (Space Grotesk) style.
- **Chips/Badges:** Use faction accent colors for the background at 10% opacity, with 100% opacity text for the labels to ensure contrast against the ivory surface.
- **Lists:** Separated by "Hairline Gold" dividers. Leading icons should be monochrome (Ink Black) unless they represent a specific faction.
- **Tactical Map Elements:** Borders around map units should be crisp and 2px wide, using the faction's accent color to ensure they "pop" against the neutral parchment.