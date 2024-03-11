import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { createHtmlPlugin } from 'vite-plugin-html'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), createHtmlPlugin()],
  define: {
    // __DEV__: "process.env.NODE_ENV !== 'production'",
    // 'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  },
})
