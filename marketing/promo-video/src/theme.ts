// Palette derived from the product's own brand tokens (see index.html :root),
// re-grounded for a dark presentation surface.
export const C = {
  bg: '#140609',
  bgDeep: '#0C0406',
  ink: '#2A0F14',
  paper: '#F8FAF7',
  body: '#D9C9CD',
  muted: '#9A868B',
  yellow: '#FAE261',
  softYellow: '#FDF1B0',
  pink: '#FFDCEF',
  sage: '#DDEEE4',
  lilac: '#EAE5FC',
  purple: '#7C63FF',
  line: 'rgba(248,250,247,0.10)',
  surface: 'rgba(248,250,247,0.045)',
} as const;

export const F = {
  display: '"Bricolage Grotesque", system-ui, sans-serif',
  sans: '"Figtree", system-ui, sans-serif',
  mono: '"DM Mono", ui-monospace, monospace',
} as const;

// Single horizontal rhythm for every scene.
export const PAD = 132;

export const SPRING = { damping: 200, mass: 0.6, stiffness: 110 } as const;
