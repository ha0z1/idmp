import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from 'vite-plugin-dts'

export default defineConfig(() => {
  return {
    base: 'https://ha0z1.github.io/idmp/',
    plugins: [react(), dts()],
    
    build: {
      outDir: 'docs'
      // minify: !false,
      // esbuild:
      //   mode !== 'development'
      //     ? {
      //         drop: ['console', 'debugger'],
      //       }
      //     : null,
      // lib: {
      //   formats: ['es'],
      //   entry: './src/index.ts',
      //   name: 'idmp',
      //   fileName: 'index',
      // },
    },
    define: {
      // 'process.env.NODE_ENV': JSON.stringify('production'),
      // 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    },
  }
})
