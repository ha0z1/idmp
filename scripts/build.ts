import { build, mergeConfig, type InlineConfig } from 'vite'
// import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from 'vite-plugin-dts'

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T
const buildFile = async (buildOptions: DeepPartial<InlineConfig>) => {
  await build(
    mergeConfig(
      {
        plugins: [react(), dts()],
        build: {
          sourcemap: false,
          // target: "chrome51",
          target: 'es6',
          lib: {
            formats: ['es'],
            entry: 'src/index.ts',
            name: 'idmp',
            fileName: 'index',
          },
        },
      },
      buildOptions,
    ),
  )
}
;(async () => {
  await Promise.all([
    // base
    buildFile({
      build: {
        minify: false,
        sourcemap: true,
        lib: {
          formats: ['es'],
          fileName: () => 'index.js',
        },
      },
    }),

    // browser
    buildFile({
      build: {
        minify: true,
        lib: {
          formats: ['umd'],
          fileName: () => 'index.browser.umd.js',
        },
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
    }),

    // browser esm
    buildFile({
      build: {
        minify: true,
        lib: {
          formats: ['es'],
          fileName: () => 'index.browser.esm.js',
        },
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
    }),

    // node.cjs
    buildFile({
      build: {
        minify: false,
        lib: {
          formats: ['cjs'],
          fileName: () => 'index.node.cjs',
        },
      },
    }),

    // deno
    buildFile({
      build: {
        minify: false,
        lib: {
          formats: ['es'],
          fileName: () => 'index.deno.js',
        },
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
    }),
  ])
})()
