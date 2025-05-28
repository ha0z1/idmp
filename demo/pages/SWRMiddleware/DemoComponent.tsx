import useSWR from 'swr'

const getDataA = async () => {
  await fetch(`https://haozi.me/?id=123&t=${Math.random()}`).then((d) =>
    d.text(),
  )
  return 'dataA'
}

const getDataB = async () => {
  return 'dataB'
}

export default () => {
  const { data: dataA } = useSWR('dataA', getDataA)
  const { data: dataB } = useSWR('dataB', getDataA)
  return (
    <div>
      dataA: {dataA}
      <br />
      {/* dataB: {dataB} */}
    </div>
  )
}
