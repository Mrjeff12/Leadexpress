/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#fe5b25',
        'brand-light': '#fff3ef',
      },
    },
  },
  plugins: [],
}
