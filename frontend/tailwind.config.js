/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0F1117',
          secondary: '#161923',
          tertiary: '#1E2433',
          card: '#252D3D',
        },
        border: {
          DEFAULT: '#2A3347',
          hover: '#333D52',
        },
        text: {
          primary: '#E8EDF5',
          secondary: '#8892A4',
          muted: '#4D5668',
        },
        accent: {
          DEFAULT: '#4ECDC4',
          hover: '#45B7AA',
          dim: 'rgba(78,205,196,0.12)',
        },
        hui: {
          gold: '#F7B731',
          red: '#FF6B6B',
          green: '#51CF66',
          blue: '#74C0FC',
          purple: '#B197FC',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      borderRadius: {
        hui: '8px',
        'hui-lg': '12px',
        'hui-xl': '16px',
      },
    },
  },
  plugins: [],
};
