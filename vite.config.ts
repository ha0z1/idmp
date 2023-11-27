/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from 'vite-plugin-dts'

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), dts()],
    build: {
      // minify: !false,
      // esbuild:
      //   mode !== 'development'
      //     ? {
      //         drop: ['console', 'debugger'],
      //       }
      //     : null,
      sourcemap: true,

      lib: {
        formats: ['es'],
        entry: './src/index.ts',
        name: 'idmp',
        fileName: 'index',
      },
    },
    define: {
      // __DEV__: "process.env.NODE_ENV !== 'production'",
      // 'process.env.NODE_ENV': JSON.stringify('production'),
      // 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
    },
    test: {
      testTimeout: 60 * 1000,
      coverage: {
        provider: 'istanbul',
        clean: true,
        include: ['src/**/*.ts?(x)'],
      },
    },
  }
})
