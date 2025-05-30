import idmp from '../src/index'
const random = (min: number = 0, max: number = 1) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

;(async () => {
  const allTasks: Promise<void>[] = []

  const MAX = random(1, 10000)
  for (let i = 1; i <= MAX; i++) {
    const task = (async () => {
      try {
        const controller = new AbortController()
        setTimeout(() => {
          controller.abort(`idmp aborted ${i}`)
        }, 1000)
        await idmp(
          Symbol('idmp abort'),
          () => {
            return new Promise((resolve, reject) => {
              setTimeout(() => reject('fail'), 100)
            })
          },
          { signal: controller.signal, maxRetry: 99999999 },
        )
      } catch (err: any) {
        console.log(err.message ?? `undefined ${i}`)
      }
    })()
    allTasks.push(task)
  }

  allTasks.length && (await Promise.all(allTasks))
  console.log(`MAX: ${MAX}`)
})()
