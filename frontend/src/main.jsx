import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistStore } from 'redux-persist';

// Performance monitoring can be added here if needed
// Consider using a service like Google Analytics or Sentry for production monitoring

import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { store } from './store/store';

const StrictMode = React.StrictMode;
const persistor = persistStore(store);

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);

// Performance monitoring can be added here
// Example: Initialize Google Analytics or other monitoring tools
