import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { RestaurantProvider } from './context/RestaurantContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { UserProvider } from './context/UserContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes/AppRoutes';
import { ToastContainer } from './components/ui/Toast/Toast';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './shared/ui/feedback/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary fallbackTitle="SpiralDine Application Notice" fallbackSubtitle="An unexpected issue occurred. Click retry to reload.">
        <AuthProvider>
          <WorkspaceProvider>
            <UserProvider>
              <RestaurantProvider>
                <CurrencyProvider>
                  <CartProvider>
                    <ThemeProvider>
                      {/* Master Application Routing */}
                      <AppRoutes />
                      
                      {/* Global toast notification system overlay */}
                      <ToastContainer />
                      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
                    </ThemeProvider>
                  </CartProvider>
                </CurrencyProvider>
              </RestaurantProvider>
            </UserProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};
export default App;
