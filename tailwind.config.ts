import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background:   'var(--background)',
        surface:      'var(--surface)',
        'surface-2':  'var(--surface-2)',
        'surface-3':  'var(--surface-3)',
        border:       'var(--border)',
        accent:       'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',
        brilliant:    'var(--brilliant)',
        excellent:    'var(--excellent)',
        good:         'var(--good)',
        inaccuracy:   'var(--inaccuracy)',
        mistake:      'var(--mistake)',
        blunder:      'var(--blunder)',
        win:          'var(--win)',
        loss:         'var(--loss)',
        draw:         'var(--draw)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body:    ['var(--font-body)',    'Georgia', 'serif'],
        mono:    ['var(--font-mono)',    'Courier New', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'var(--border)',
      },
    },
  },
  plugins: [],
};

export default config;
