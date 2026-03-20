/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#fe5b25',
        'primary-dark': '#e04d1c',
        dark: '#0b0707',
        cream: '#faf9f6',
        'cream-dark': '#f5f2ed',
        'gray-subtle': '#3b3b3b',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        hebrew: ['Heebo', 'sans-serif'],
      },
      letterSpacing: {
        'tighter-biotix': '-0.05em',
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
