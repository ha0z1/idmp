import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: 'demo/public',
  plugins: [react(), createHtmlPlugin(), tailwindcss()],
  resolve: {
    alias: [
      { find: 'refractor/core', replacement: 'refractor/lib/core.js' },
      { find: 'refractor/all', replacement: 'refractor/lib/all.js' },
      { find: 'refractor/common', replacement: 'refractor/lib/common.js' },
      { find: /^refractor\/(.*)$/, replacement: 'refractor/lang/$1.js' },
    ],
  },
  define: {
    // __DEV__: "process.env.NODE_ENV !== 'production'",
    // 'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
})
