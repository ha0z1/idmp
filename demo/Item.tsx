import React, { useEffect, useState } from 'react'
import { getUserData } from './api'

interface IProps {
  id: string
}
export default (props: IProps) => {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    getUserData(props.id).then((res) => {
      setData(res)
    })
  }, [])
  if (!data) return <>waiting server's data...</>
  return <>{JSON.stringify(data)}</>
}
