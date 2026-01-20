import fs from 'fs-extra'
import JSON from 'json-web3'
;(async () => {
  fs.outputJSONSync(
    './package.json',
    JSON.parse(
      JSON.stringify({
        ...fs.readJsonSync('./package.json'),
        devDependencies: undefined,
        scripts: undefined,
        type: undefined,
        packageManager: undefined,
        engines: undefined,
        pnpm: undefined,
        publishConfig: undefined,
      }),
    ),
    { spaces: 2 },
  )
  fs.removeSync('./plugins/browser-storage/package.json')
  fs.removeSync('./plugins/node-fs/package.json')
  fs.removeSync('./plugins/redis/package.json')
})()
