/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,lib,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  safelist: [
    'bg-store-navy',
    'bg-store-navy-light',
    'bg-store-surface',
    'text-store-navy',
    'text-store-ink',
    'border-store-navy',
    'hover:bg-store-navy',
    'hover:bg-store-navy-light',
    'hover:bg-store-surface',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Manrope', 'system-ui', 'sans-serif'],
        script: ['Caveat', 'cursive'],
      },
      colors: {
        brand: {
          espresso: '#111111',
          nude: '#F4F4F4',
          champagne: '#C5A46A',
          mauve: '#6B6B6B',
          rose: '#C5A46A',
          cream: '#FFFFFF',
          cocoa: '#2A2A2A',
          DEFAULT: '#111111',
          light: '#F4F4F4',
          dark: '#111111',
          accent: '#C5A46A',
        },
        store: {
          navy: '#111111',
          'navy-light': '#2A2A2A',
          primary: '#111111',
          'primary-dark': '#000000',
          ink: '#111111',
          muted: '#6B6B6B',
          surface: '#FFFFFF',
        },
      },
      letterSpacing: {
        'widest-lg': '0.2em',
        'widest-xl': '0.3em',
      },
      boxShadow: {
        luxury: '0 10px 40px -10px rgba(197, 164, 106, 0.16)',
        'luxury-lg': '0 20px 60px -15px rgba(17, 17, 17, 0.12)',
        soft: '0 8px 30px -12px rgba(197, 164, 106, 0.18)',
      },
      transitionDuration: {
        luxury: '500ms',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        shimmer: 'shimmer 3s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
