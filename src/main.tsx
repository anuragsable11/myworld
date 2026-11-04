import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { registerServiceWorker } from './lib/pwa';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // 'offlineFirst' still runs requests while offline, so the service worker can answer them
    // from its cache; only retries wait for the connection to come back.
    queries: { refetchOnWindowFocus: false, networkMode: 'offlineFirst' },
  },
});

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
