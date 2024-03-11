import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Item from '../Item'
import ItemIdmp from '../ItemIdmp'
// import idmp from '../src'
// import { getUserDataIdmp } from './api'

// getUserDataIdmp('123').then((d) => {
//   console.log(123, d)
//   d.extra.a = {
//     a: 1,
//     b: 2,
//   }
// })

// const getInfo = async () => {
//   // const API = `https://haozi.meaa/?api/your-info`
//   const API = `http://127.0.0.1:3000/`
//   return await fetch(API).then((d) => d.json())
// }

// // Only this line changed
// export const getInfoIdmp = () =>
//   idmp('/api/your-info', getInfo, { maxRetry: 50 , maxAge: 86400000})

// for (let i = 0; i < 10; ++i) {
//   getInfoIdmp()
//     .then((d) => {
//       console.log(111)
//       // console.log(d)
//     })
//     .catch(() => {
//       console.log(444)
//     })
// }
// for (let i = 0; i < 10; ++i) {
//   getInfoIdmp()
//     .then((d) => {
//       console.log(111)
//       // console.log(d)
//     })
//     .catch(() => {
//       console.log(444)
//     })
// }
const list = [
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
  '123',
  '456',
  '789',
]
const N = list.length

export default () => {
  type Type = 'idmp' | 'normal' | ''
  const [type, _setType] = useState<Type>('')
  const setType = (type: Type) => {
    _setType('')
    setTimeout(() => _setType(type))
  }
  const navigate = useNavigate()

  return (
    <>
      <button
        onClick={() => {
          setType('idmp')
        }}
      >
        Make {N} parallel requests
      </button>{' '}
      <button
        onClick={() => {
          setType('normal')
        }}
      >
        Make {N} parallel requests(without idmp)
      </button>{' '}
      <button
        onClick={() => {
          navigate('/storage')
        }}
      >
        localStorage/sessionStorage
      </button>
      {type && (
        <>
          <div>
            See the source{' '}
            <a
              href="https://github.com/ha0z1/idmp/blob/main/demo/ItemIdmp.tsx#L10"
              target="_blank"
            >
              here
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/ha0z1/idmp/blob/main/demo/Item.tsx#L10"
              target="_blank"
            >
              here
            </a>
            . The two codes are exactly the same, so <strong>idmp</strong> will
            not invade your business logic code and it is very clean and
            elegant.
          </div>
          <ul>
            {list.map((id, i) => {
              return (
                <li key={i}>
                  id:{id}{' '}
                  {type === 'idmp' ? <ItemIdmp id={id} /> : <Item id={id} />}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
