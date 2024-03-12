import idmp from 'idmp'
import storageWrap, { getCacheKey } from 'idmp/browser-storage'
import React, { useEffect, useState } from 'react'
import { getUserData } from '../../api'
import { Link } from 'react-router-dom'

const lsIdmp = storageWrap(idmp, 'localStorage')

const getUserDataWithLsIdmp = (userId: string) =>
  lsIdmp(`getUserDataWithLsIdmp${userId}`, () => getUserData(userId), {
    maxAge: 5000,
  })

export default () => {
  const [data, setData] = useState(null)
  useEffect(() => {
    getUserDataWithLsIdmp('123').then((data) => {
      setData(data)
    })
  }, [])

  if (!data) return <>waiting server's data...</>

  return (
    <div>
      Refresh the browser and still use the same data in 5 seconds. No network
      request occurred there. See the{' '}
      <a
        href="https://github.com/ha0z1/idmp/blob/main/demo/pages/Storage/index.tsx#L7"
        target="_blank"
      >
        source
      </a>{' '}
      and{' '}
      <a
        href="https://github.com/ha0z1/idmp/blob/main/plugins/browser-storage/README.md"
        target="_blank"
      >
        document
      </a>{' '}
      here.
      <Link to="/">Back home</Link>
      <br />
      useData: {JSON.stringify(data)}
    </div>
  )
}
