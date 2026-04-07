/**
 * Color palettes available for the app theme.
 * Each shade is stored as "R G B" space-separated for Tailwind's
 * opacity modifier support: rgb(var(--primary-500) / 0.2)
 */

function hex(h) {
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

export const THEMES = [
  {
    key:    'teal',
    label:  'Teal',
    swatch: '#167876',
    vars: {
      '--primary-50':  hex('#e6f4f4'),
      '--primary-100': hex('#c0e4e3'),
      '--primary-200': hex('#99d3d2'),
      '--primary-300': hex('#73c2c1'),
      '--primary-400': hex('#4db1b0'),
      '--primary-500': hex('#167876'),
      '--primary-600': hex('#146b69'),
      '--primary-700': hex('#115e5c'),
      '--primary-800': hex('#0e5150'),
      '--primary-900': hex('#0b4443'),
    },
  },
  {
    key:    'blue',
    label:  'Blue',
    swatch: '#3b82f6',
    vars: {
      '--primary-50':  hex('#eff6ff'),
      '--primary-100': hex('#dbeafe'),
      '--primary-200': hex('#bfdbfe'),
      '--primary-300': hex('#93c5fd'),
      '--primary-400': hex('#60a5fa'),
      '--primary-500': hex('#3b82f6'),
      '--primary-600': hex('#2563eb'),
      '--primary-700': hex('#1d4ed8'),
      '--primary-800': hex('#1e40af'),
      '--primary-900': hex('#1e3a8a'),
    },
  },
  {
    key:    'indigo',
    label:  'Indigo',
    swatch: '#6366f1',
    vars: {
      '--primary-50':  hex('#eef2ff'),
      '--primary-100': hex('#e0e7ff'),
      '--primary-200': hex('#c7d2fe'),
      '--primary-300': hex('#a5b4fc'),
      '--primary-400': hex('#818cf8'),
      '--primary-500': hex('#6366f1'),
      '--primary-600': hex('#4f46e5'),
      '--primary-700': hex('#4338ca'),
      '--primary-800': hex('#3730a3'),
      '--primary-900': hex('#312e81'),
    },
  },
  {
    key:    'purple',
    label:  'Purple',
    swatch: '#a855f7',
    vars: {
      '--primary-50':  hex('#faf5ff'),
      '--primary-100': hex('#f3e8ff'),
      '--primary-200': hex('#e9d5ff'),
      '--primary-300': hex('#d8b4fe'),
      '--primary-400': hex('#c084fc'),
      '--primary-500': hex('#a855f7'),
      '--primary-600': hex('#9333ea'),
      '--primary-700': hex('#7c3aed'),
      '--primary-800': hex('#6b21a8'),
      '--primary-900': hex('#581c87'),
    },
  },
  {
    key:    'green',
    label:  'Green',
    swatch: '#22c55e',
    vars: {
      '--primary-50':  hex('#f0fdf4'),
      '--primary-100': hex('#dcfce7'),
      '--primary-200': hex('#bbf7d0'),
      '--primary-300': hex('#86efac'),
      '--primary-400': hex('#4ade80'),
      '--primary-500': hex('#22c55e'),
      '--primary-600': hex('#16a34a'),
      '--primary-700': hex('#15803d'),
      '--primary-800': hex('#166534'),
      '--primary-900': hex('#14532d'),
    },
  },
  {
    key:    'orange',
    label:  'Orange',
    swatch: '#f97316',
    vars: {
      '--primary-50':  hex('#fff7ed'),
      '--primary-100': hex('#ffedd5'),
      '--primary-200': hex('#fed7aa'),
      '--primary-300': hex('#fdba74'),
      '--primary-400': hex('#fb923c'),
      '--primary-500': hex('#f97316'),
      '--primary-600': hex('#ea580c'),
      '--primary-700': hex('#c2410c'),
      '--primary-800': hex('#9a3412'),
      '--primary-900': hex('#7c2d12'),
    },
  },
  {
    key:    'rose',
    label:  'Rose',
    swatch: '#f43f5e',
    vars: {
      '--primary-50':  hex('#fff1f2'),
      '--primary-100': hex('#ffe4e6'),
      '--primary-200': hex('#fecdd3'),
      '--primary-300': hex('#fda4af'),
      '--primary-400': hex('#fb7185'),
      '--primary-500': hex('#f43f5e'),
      '--primary-600': hex('#e11d48'),
      '--primary-700': hex('#be123c'),
      '--primary-800': hex('#9f1239'),
      '--primary-900': hex('#881337'),
    },
  },
]

export const DEFAULT_THEME = 'teal'

export function applyTheme(key) {
  const theme = THEMES.find(t => t.key === key) ?? THEMES[0]
  const root  = document.documentElement
  Object.entries(theme.vars).forEach(([prop, val]) => {
    root.style.setProperty(prop, val)
  })
}
