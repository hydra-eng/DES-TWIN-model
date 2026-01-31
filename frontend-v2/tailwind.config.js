/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-black': '#0b0c10',
        'cyber-gray': '#1f2833',
        'neon-green': '#66fcf1',
        'neon-red': '#ff003c',
        'neon-blue': '#45a29e',
      },
    },
  },
  plugins: [],
}
