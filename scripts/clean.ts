import fs from 'fs-extra'
;(async () => {
  fs.outputJSONSync(
    './package.json',
    {
      ...fs.readJsonSync('./package.json'),
      devDependencies: undefined,
      scripts: undefined,
    },
    {
      spaces: 2,
    },
  )
})()
