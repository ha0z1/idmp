import React, { useEffect, useState } from 'react'
import { getUserDataIdmp } from './api'

interface IProps {
  id: string
}
export default (props: IProps) => {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    getUserDataIdmp(props.id).then((res) => {
      setData(res)
    })
  }, [])

  if (!data) return <span className="text-neutral-500">Loading...</span>
  return <span className="text-neutral-900">{JSON.stringify(data)}</span>
}
