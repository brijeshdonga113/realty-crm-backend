/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e6f4f4',
          100: '#c0e4e3',
          200: '#99d3d2',
          300: '#73c2c1',
          400: '#4db1b0',
          500: '#167876',
          600: '#146b69',
          700: '#115e5c',
          800: '#0e5150',
          900: '#0b4443',
        },
        accent: {
          50:  '#f4faec',
          100: '#e4f4c9',
          200: '#c9e9a0',
          300: '#b0df78',
          400: '#9dd452',
          500: '#92C83E',
          600: '#7fb535',
          700: '#6ca12d',
          800: '#598e25',
          900: '#467a1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
