import { build, mergeConfig, type InlineConfig } from 'vite'
// import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from 'vite-plugin-dts'
import banner from 'vite-plugin-banner'
import { version, dependencies } from '../package.json'

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
          // react(),
          dts(),
          banner(`/*! idmp v${version} | (c) github/haozi | MIT */`),
        ],
        build: {
          sourcemap: false,
          // target: "chrome51",

          target: 'node18',
          rollupOptions: {
            external: [/^node:.*/, 'os', 'fs', ...Object.keys(dependencies)],
          },
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
  ])
})()
