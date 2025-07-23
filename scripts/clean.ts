import fs from 'fs-extra'
;(async () => {
  fs.outputJSONSync('./package.json', {
    ...fs.readJsonSync('./package.json'),
    devDependencies: undefined,
    scripts: undefined,
    type: undefined,
    packageManager: undefined,
    engines: undefined,
  })
  fs.removeSync('./plugins/browser-storage/package.json')
  fs.removeSync('./plugins/node-fs/package.json')
})()
