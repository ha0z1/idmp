import http from 'http'

const hostname = '127.0.0.1'
const port = 3000

const sleep = (delay: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay)
  })

const server = http.createServer(async (req, res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  // await sleep(2000)
  const id = new URL(`http://127.0.0.1${req.url}`).searchParams.get('id')
  if (Math.random() > 0.1) {
    res.statusCode = 500
    res.end('error')
    return
  }
  res.end(
    JSON.stringify({
      id,
      val: Math.random(),
    }),
  )
})
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`)
})
