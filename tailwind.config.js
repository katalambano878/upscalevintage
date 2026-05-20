/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Cormorant Garamond"', '"Playfair Display"', 'serif'],
      },
      colors: {
        brand: {
          espresso: '#6B3E2E',
          nude: '#E8D7CC',
          champagne: '#D4B06A',
          mauve: '#C58A94',
          rose: '#C58A94',
          cream: '#FAF6F2',
          cocoa: '#2E1F1B',
          DEFAULT: '#6B3E2E',
          light: '#E8D7CC',
          dark: '#2E1F1B',
          accent: '#D4B06A',
        },
      },
      boxShadow: {
        luxury: '0 4px 24px -4px rgba(107, 62, 46, 0.1)',
        'luxury-lg': '0 12px 40px -8px rgba(107, 62, 46, 0.14)',
        soft: '0 8px 30px -12px rgba(197, 138, 148, 0.25)',
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
