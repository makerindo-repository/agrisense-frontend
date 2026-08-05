import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';

import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import { GoogleOAuthProvider } from '@react-oauth/google';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'client_id_anda'}>
      <BrowserRouter>
        <Toaster richColors position="top-center" expand={false} />
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
);
