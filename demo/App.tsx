import React, { useState } from 'react'
import Item from './Item'
import ItemIdmp from './ItemIdmp'

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
      </button>
      {type && (
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
      )}
    </>
  )
}
