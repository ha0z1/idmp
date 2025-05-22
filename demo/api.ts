import idmp from '../src'
// ;(window as any).idmp = idmp
// ;(window as any).g = g
// export const getUserData = async (userId: string) => {
//   const API = `http://127.0.0.1:3000/api/user-info?id=${userId}&t=${Math.random()}`
//   const res: { id: string } = await fetch(API).then((d) => d.json())
//   return res
// }

const sleep = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay))

export const getUserData = async (userId: string) => {
  const API = `https://haozi.me/?id=${userId}&t=${Math.random()}`
  await fetch(API).then((d) => d.text())

  await sleep(2000)
  const res = {
    id: userId,
    val: Math.random(),
  }
  return res
}

export const getUserDataIdmp = (userId: string) => {
  const key = `getUserData:${userId}`
  return idmp(key, () => getUserData(userId), { maxAge: 5 * 1000 })
}

export const getUserDataIdmp2 = (userId: string) => {
  const key = `getUserData:${userId}`
  return idmp(key, () => getUserData(userId))
}
