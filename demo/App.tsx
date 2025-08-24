import * as React from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './App.css'
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
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

const App = () => <RouterProvider router={router} />

export default App
