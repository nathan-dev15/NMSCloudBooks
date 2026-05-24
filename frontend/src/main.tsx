import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { store } from './app/store'
import ToastContainer from './components/ui/Toast/ToastContainer'
import { ThemeSettingsProvider } from './contexts/ThemeSettingsContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeSettingsProvider>
          <App />
          <ToastContainer />
        </ThemeSettingsProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
)
