import React, { useEffect, useState } from 'react'
import { getUserDataIdmp } from './api'

interface IProps {
  id: string
}
export default (props: IProps) => {
  const [data, setData] = useState({})
  useEffect(() => {
    getUserDataIdmp(props.id).then((res) => {
      setData(res)
    })
  }, [])
  return <>{JSON.stringify(data)}</>
}
