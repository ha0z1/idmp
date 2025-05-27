import React from 'react'
import ReactDOM from 'react-dom/client'
import idmp from '../src'
import App from './App'
window['idmp'] = idmp

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
