import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { store } from './store';
import { lightTheme, darkTheme } from './theme';
import ErrorBoundary from './components/common/ErrorBoundary';
import NotificationSnackbar from './components/common/NotificationSnackbar';
import './index.css';
import './styles/pages.css';
import './styles/theme.css';

function ThemeWrapper() {
  const themeMode = useSelector((state) => state.ui.themeMode);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
      <NotificationSnackbar />
    </ThemeProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeWrapper />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

// PWA: only register in production — in dev, cache-first SW serves stale bundles
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((error) => {
        console.log('SW registration failed: ', error);
      });
  });
}
