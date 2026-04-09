/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* MasterLeadFlow custom */
        forest: 'hsl(14 99% 57%)',
        cream: 'hsl(39 32% 97%)',
        sand: 'hsl(35 25% 93%)',
        mint: 'hsl(152 46% 85%)',
        leaf: 'hsl(140 50% 92%)',
        bark: 'hsl(40 8% 10%)',
        stone: 'hsl(40 4% 42%)',
        /* Dark Premium Design System (Uber/Wolt inspired) */
        'd-base': '#0a0a0a',
        'd-card': '#141414',
        'd-surface': '#1c1c1e',
        'd-subtle': '#2c2c2e',
        brand: {
          DEFAULT: '#ff6b35',
          glow: 'rgba(255,107,53,0.15)',
          muted: 'rgba(255,107,53,0.2)',
          dark: '#e05a20',
        },
        txt: {
          primary: '#ffffff',
          secondary: '#a1a1a6',
          tertiary: '#636366',
          disabled: '#48484a',
        },
        sem: {
          success: '#30d158',
          error: '#ff453a',
          warning: '#ffd60a',
          info: '#0a84ff',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'shimmer': {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.8)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'in': 'fade-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        'in-1': 'fade-in 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.06s both',
        'in-2': 'fade-in 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.12s both',
        'in-3': 'fade-in 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.18s both',
        'in-4': 'fade-in 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.24s both',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
