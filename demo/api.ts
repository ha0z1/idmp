import idmp, { g } from '../src'
;(window as any).idmp = idmp
;(window as any).g = g
// export const getUserData = async (userId: string) => {
//   const API = `http://127.0.0.1:3000/api/user-info?id=${userId}&t=${Math.random()}`
//   const res: { id: string } = await fetch(API).then((d) => d.json())
//   return res
// }

export const getUserData = async (userId: string) => {
  const API = `https://haozi.me/?id=${userId}&t=${Math.random()}`
  await fetch(API).then((d) => d.text())

  const res = { id: userId, val: Math.random() }
  return res
}

export const getUserDataIdmp = (userId: string) => {
  const key = `getUserData:${userId}`
  return idmp(key, () => getUserData(userId))
}

export const getUserDataIdmp2 = (userId: string) => {
  const key = `getUserData:${userId}`
  return idmp(key, () => getUserData(userId))
}
