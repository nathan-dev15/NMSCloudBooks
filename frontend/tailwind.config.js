/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e5f7f8',
          100: '#b3e8ec',
          200: '#7dd7dd',
          300: '#4dc3cb',
          400: '#2aacb5',
          500: '#0e949e',
          600: '#0c7a82',
          700: '#0a6269',
          800: '#094d56',
          900: '#063339',
        },
        accent: {
          cyan:   '#00d4ff',
          purple: '#9d4edd',
          orange: '#ff6b35',
          green:  '#06d6a0',
        },
        dark: {
          900: '#0a0e17',
          800: '#10151f',
          700: '#1a2332',
          600: '#243044',
          500: '#2e3d56',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      backgroundImage: {
        'gradient-primary':  'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)',
        'gradient-tech':     'linear-gradient(135deg, #0c7a82 0%, #9d4edd 50%, #ff6b35 100%)',
        'gradient-dark':     'linear-gradient(135deg, #0a0e17 0%, #10151f 100%)',
        'gradient-card':     'linear-gradient(135deg, rgba(12,122,130,0.15) 0%, rgba(0,212,255,0.05) 100%)',
        'gradient-green':    'linear-gradient(135deg, #06d6a0 0%, #0c7a82 100%)',
        'gradient-purple':   'linear-gradient(135deg, #9d4edd 0%, #0c7a82 100%)',
        'gradient-orange':   'linear-gradient(135deg, #ff6b35 0%, #9d4edd 100%)',
      },
      boxShadow: {
        'glow':        '0 0 20px rgba(12, 122, 130, 0.4)',
        'glow-lg':     '0 0 40px rgba(12, 122, 130, 0.5)',
        'glow-cyan':   '0 0 20px rgba(0, 212, 255, 0.35)',
        'glow-purple': '0 0 20px rgba(157, 78, 221, 0.35)',
        'glow-green':  '0 0 20px rgba(6, 214, 160, 0.35)',
        'glass':       '0 8px 32px rgba(0, 0, 0, 0.4)',
        'card':        '0 4px 24px rgba(0, 0, 0, 0.3)',
        'elevated':    '0 20px 60px rgba(0, 0, 0, 0.5)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-up':     'slideUp 0.35s ease-out',
        'slide-in':     'slideIn 0.3s ease-out',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'float':        'float 3s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'spin-slow':    'spin 3s linear infinite',
        'border-flow':  'borderFlow 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(12,122,130,0.4)' },
          '50%':      { boxShadow: '0 0 40px rgba(12,122,130,0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        borderFlow: {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
    },
  },
  plugins: [],
}
