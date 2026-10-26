import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import MobileOwnerBottomNav from '../components/MobileOwnerBottomNav';
import ErrorBoundary from '../../../../shared/ui/feedback/ErrorBoundary';

export const MobileOwnerLayout: React.FC = () => {
  const { user, role, authStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const tenantId = user?.tenantId;

  // Real-time listener for live/pending orders badge
  useEffect(() => {
    if (!tenantId) return;

    try {
      const ordersCol = collection(db, 'restaurants', tenantId, 'orders');
      const q = query(ordersCol, where('status', 'in', ['PENDING', 'NEW', 'PREPARING']));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPendingOrdersCount(snapshot.size);
      }, (err) => {
        console.warn('[MobileOwnerLayout] Orders badge subscription warning:', err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('[MobileOwnerLayout] Setup error for orders badge listener:', e);
    }
  }, [tenantId]);

  // Determine if current route is a sub-page where bottom nav should be hidden (e.g. order details or login)
  const hideBottomNavRoutes = ['/login', '/owner/login', '/owner/mobile/login', '/owner/orders/', '/owner/mobile/orders/'];
  const shouldHideBottomNav = hideBottomNavRoutes.some(p => location.pathname.startsWith(p) && location.pathname !== '/owner/orders' && location.pathname !== '/owner/mobile/orders');

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-[#202124] flex flex-col font-sans antialiased selection:bg-[#FF7518]/20">
      <main className={`flex-1 w-full max-w-xl mx-auto px-0 sm:px-2 transition-all duration-200 ${shouldHideBottomNav ? '' : 'pb-20'}`}>
        <ErrorBoundary fallbackTitle="Mobile View Error" fallbackSubtitle="We encountered an issue rendering this section.">
          <Outlet />
        </ErrorBoundary>
      </main>

      {!shouldHideBottomNav && (
        <MobileOwnerBottomNav pendingOrdersCount={pendingOrdersCount} />
      )}
    </div>
  );
};

export default MobileOwnerLayout;
