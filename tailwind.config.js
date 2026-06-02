/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tech: {
          bg: '#F8FAFC',
          primary: '#10B981',
          deep: '#1E293B',
          danger: '#EF4444',
        },
      },
      boxShadow: {
        panel: '0 14px 40px rgba(30, 41, 59, 0.12)',
      },
    },
  },
  plugins: [],
}

