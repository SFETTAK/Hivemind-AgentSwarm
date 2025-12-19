import React from 'react'
import ReactDOM from 'react-dom/client'
import FileBrowserPreview from './components/FileBrowserPreview'
import './index.css'

ReactDOM.createRoot(document.getElementById('preview-root')).render(
  <React.StrictMode>
    <FileBrowserPreview />
  </React.StrictMode>,
)

