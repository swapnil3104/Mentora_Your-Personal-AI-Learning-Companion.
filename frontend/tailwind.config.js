/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mentora Brand System (DESIGN.md)
        primary: {
          DEFAULT: '#6D5CE7',
          hover: '#5948D6',
          light: '#8B7CF6',
          dark: '#9B8AFB',
        },
        secondary: {
          DEFAULT: '#8B7CF6',
          hover: '#7A6BE0',
        },
        background: {
          light: '#F8F9FC',
          dark: '#11121A',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1B1D29',
          elevated: '#242636',
        },
        text: {
          primary: '#171923',
          secondary: '#667085',
          darkPrimary: '#F9FAFB',
          darkSecondary: '#A1A1AA',
        },
        border: {
          light: '#E5E7EB',
          dark: '#303344',
        },
        status: {
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626',
          info: '#2563EB',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        elevated: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
};

