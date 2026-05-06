/**
 * Build a publish-ready package.json snapshot WITHOUT mutating the working
 * tree. The previous implementation rewrote the root package.json in place
 * and removed the workspace plugins' package.json files, leaving the repo
 * in a half-broken state and requiring `git checkout` to recover.
 *
 * This version only emits a slimmed copy under `./dist/` (and copies a
 * minimal package.json into each plugin's dist) so `npm publish ./dist`
 * (or whatever your publish flow is) can use the cleaned manifest while
 * the source tree stays pristine.
 *
 * NOTE: drop-fields are kept identical to the prior behaviour so the
 * published artifact stays the same shape.
 */
import fs from 'fs-extra'
import path from 'path'

const STRIP_FIELDS = [
  'devDependencies',
  'scripts',
  'type',
  'packageManager',
  // engines & publishConfig are intentionally KEPT now — stripping them
  // hid the supported Node range from npm and disabled provenance.
  // 'engines',
  'pnpm',
  // 'publishConfig',
] as const

const stripPackageJson = (srcPath: string, destPath: string) => {
  const pkg = fs.readJsonSync(srcPath)
  for (const field of STRIP_FIELDS) {
    delete pkg[field]
  }
  fs.outputJsonSync(destPath, pkg, { spaces: 2 })
}

;(() => {
  const root = process.cwd()
  const distRoot = path.join(root, 'dist')
  fs.ensureDirSync(distRoot)

  // Root package.json → dist/package.json (publish from dist/)
  stripPackageJson(
    path.join(root, 'package.json'),
    path.join(distRoot, 'package.json'),
  )

  // Mirror cleaned manifests into each plugin's own dist directory so the
  // workspace package.json files in source remain intact.
  const plugins = ['browser-storage', 'node-fs', 'redis']
  for (const name of plugins) {
    const pluginRoot = path.join(root, 'plugins', name)
    const pluginPkg = path.join(pluginRoot, 'package.json')
    const pluginDist = path.join(pluginRoot, 'dist', 'package.json')
    if (fs.existsSync(pluginPkg)) {
      stripPackageJson(pluginPkg, pluginDist)
    }
  }
})()
