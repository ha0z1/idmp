import * as React from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import Home from './pages/Home'
import Storage from './pages/Storage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: 'storage',
    element: <Storage />,
  },
])

const App = () => <RouterProvider router={router} />

export default App
