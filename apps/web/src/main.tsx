import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const WEBSITE_REFRESH_INTERVAL_MS = 8 * 60 * 60 * 1000

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: WEBSITE_REFRESH_INTERVAL_MS,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: WEBSITE_REFRESH_INTERVAL_MS,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
