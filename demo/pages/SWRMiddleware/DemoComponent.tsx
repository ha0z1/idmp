import idmp from 'idmp'
import useSWR from 'swr'

const getDataA = async () => {
  await fetch(`https://haozi.me/?id=dataA&t=${Math.random()}`).then((d) =>
    d.text(),
  )
  return { data: 'dataA' }
}

const getDataB = async () => {
  const dataA = await getDataAIdmp()
  await fetch(`https://haozi.me/?id=dataB&t=${Math.random()}`).then((d) =>
    d.text(),
  )
  return { ...{ dataA }, data: 'dataB' }
}

const getDataAIdmp = () => idmp('getDataAIdmp', getDataA)
const getDataBIdmp = () => idmp('getDataBIdmp', getDataB)

export default () => {
  const { data: dataA } = useSWR('dataA', getDataAIdmp)
  const { data: dataB } = useSWR('dataB', getDataBIdmp)
  return (
    <div>
      dataA: {dataA?.data}
      <br />
      dataB: {dataB?.data}
    </div>
  )
}
