/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        "app": [0.22, 1, 0.36, 1],
      },
      boxShadow: {
        "app": "0 24px 80px rgba(0,0,0,.32)",
      },
    },
  },
  plugins: [],
};
