import idmpSWRMiddleware from 'idmp/swr'
import { SWRConfig } from 'swr'
import DemoComponent from './DemoComponent'

function App() {
  return (
    <SWRConfig value={{ use: [idmpSWRMiddleware] }}>
      <DemoComponent />
    </SWRConfig>
  )
}

export default App
