import React, { useEffect, useState } from 'react'
import { getUserData } from './api'

interface IProps {
  id: string
}
export default (props: IProps) => {
  const [data, setData] = useState({})
  useEffect(() => {
    getUserData(props.id).then((res) => {
      setData(res)
    })
  }, [])
  return <>{JSON.stringify(data)}</>
}
