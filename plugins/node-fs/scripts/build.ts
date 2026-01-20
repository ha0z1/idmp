import { build, mergeConfig, type InlineConfig } from 'vite'
// import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import banner from 'vite-plugin-banner'
import dts from 'vite-plugin-dts'
import { version } from '../../../package.json'

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T
const buildFile = async (buildOptions: DeepPartial<InlineConfig>) => {
  await build(
    mergeConfig(
      {
        plugins: [
          react(),
          dts(),
          banner(`/*! idmp v${version} | (c) github/haozi | MIT */`),
        ],
        build: {
          sourcemap: false,
          // target: "chrome51",
          target: 'node14',
          lib: {
            formats: ['es'],
            entry: 'src/index.ts',
            name: 'idmp',
            fileName: 'index',
          },
          rollupOptions: {
            external: [
              'idmp',
              'json-web3',
              'fs-extra',
              'fs',
              'path',
              'os',
              'buffer',
              'stream',
              'url',
              'util',
              'crypto',
              /^node:.*/, // 关键：确保 "node:xxx" 被完全 external
            ],
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
