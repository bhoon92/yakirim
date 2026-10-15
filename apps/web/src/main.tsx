import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import './index.css';
import { AuthProvider } from '@/auth/auth-context';
import { installAuthRefresh } from '@/lib/auth-refresh';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';

installAuthRefresh();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
