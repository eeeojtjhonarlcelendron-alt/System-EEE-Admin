/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f2',
          100: '#fde8e8',
          200: '#f5d0d0',
          300: '#f0b1b1',
          400: '#e07e7e',
          500: '#c94c4c',
          600: '#a83030',
          700: '#8b2222',
          800: '#741f1f',
          900: '#601c1c',
        },
        maroon: {
          50: '#fdf2f2',
          100: '#fde8e8',
          200: '#f5d0d0',
          300: '#f0b1b1',
          400: '#e07e7e',
          500: '#c94c4c',
          600: '#a83030',
          700: '#8b2222',
          800: '#741f1f',
          900: '#601c1c',
        },
      },
    },
  },
  plugins: [],
}
