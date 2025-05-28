import * as React from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import Home from './pages/Home'
import Storage from './pages/Storage'
import SWRMiddleware from './pages/SWRMiddleware'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: 'storage',
    element: <Storage />,
  },
  {
    path: 'swr-middleware',
    element: <SWRMiddleware />,
  },
])

const App = () => <RouterProvider router={router} />

export default App
