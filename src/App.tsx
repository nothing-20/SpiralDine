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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
};
export default App;
