import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../../../context/AuthContext';
import { collection, query, where, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { inventoryService } from '../../services/inventoryService';
import { automationService } from '../../services/automationService';
import ErrorBoundary from '../feedback/ErrorBoundary';

export const useInventoryAutomation = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  useEffect(() => {
    if (!tenantId) return;

    const ordersCol = collection(db, 'restaurants', tenantId, 'orders');

    // Listener for COMPLETED orders that need stock deductions
    const qCompleted = query(ordersCol, where('status', '==', 'COMPLETED'), limit(15));
    const unsubCompleted = onSnapshot(qCompleted, (snap) => {
      snap.forEach(docSnap => {
        const orderData = docSnap.data();
        if (!orderData.inventoryDeducted) {
          inventoryService.deductStockForOrder(tenantId, docSnap.id).catch(err => {
            console.error('[InventoryAutomation] Deduction error:', err);
          });
        }
        if (!orderData.batchServingsDeducted) {
          inventoryService.deductBatchServings(tenantId, docSnap.id).catch(err => {
            console.error('[InventoryAutomation] Batch servings deduction error:', err);
          });
        }
      });
    }, (err) => {
      console.error('[InventoryAutomation] Completed listener error:', err);
    });

    // Listener for PREPARING orders that need batch portion deductions early
    const qPreparing = query(ordersCol, where('status', '==', 'PREPARING'), limit(15));
    const unsubPreparing = onSnapshot(qPreparing, (snap) => {
      snap.forEach(docSnap => {
        const orderData = docSnap.data();
        if (!orderData.batchServingsDeducted) {
          inventoryService.deductBatchServings(tenantId, docSnap.id).catch(err => {
            console.error('[InventoryAutomation] Batch servings deduction error (PREPARING):', err);
          });
        }
      });
    }, (err) => {
      console.error('[InventoryAutomation] Preparing listener error:', err);
    });

    // Listener for CANCELLED orders that need stock restocks
    const qCancelled = query(ordersCol, where('status', '==', 'CANCELLED'), limit(15));
    const unsubCancelled = onSnapshot(qCancelled, (snap) => {
      snap.forEach(docSnap => {
        const orderData = docSnap.data();
        if (orderData.inventoryDeducted && !orderData.inventoryRestocked) {
          inventoryService.restockStockForOrder(tenantId, docSnap.id, 'cancellation_restock').catch(err => {
            console.error('[InventoryAutomation] Restock error:', err);
          });
        }
        if (orderData.batchServingsDeducted && !orderData.batchServingsRestocked) {
          inventoryService.restockBatchServings(tenantId, docSnap.id, 'cancellation_restock').catch(err => {
            console.error('[InventoryAutomation] Batch servings restock error:', err);
          });
        }
      });
    }, (err) => {
      console.error('[InventoryAutomation] Cancelled listener error:', err);
    });

    // Listener for REFUNDED orders that need batch portion restocks
    const qRefunded = query(ordersCol, where('paymentStatus', '==', 'refunded'), limit(15));
    const unsubRefunded = onSnapshot(qRefunded, (snap) => {
      snap.forEach(docSnap => {
        const orderData = docSnap.data();
        if (orderData.batchServingsDeducted && !orderData.batchServingsRestocked) {
          inventoryService.restockBatchServings(tenantId, docSnap.id, 'refund_restock').catch(err => {
            console.error('[InventoryAutomation] Batch servings refund restock error:', err);
          });
        }
      });
    }, (err) => {
      console.error('[InventoryAutomation] Refunded listener error:', err);
    });

    return () => {
      unsubCompleted();
      unsubPreparing();
      unsubCancelled();
      unsubRefunded();
    };
  }, [tenantId]);
};

export const useAutomationEngine = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  useEffect(() => {
    if (!tenantId) return;

    let active = true;
    let localSchedules: any[] = [];
    let isSubscribed = false;
    let unsubscribeSnapshot: (() => void) | null = null;

    // Subscribe to automation schedules (do not auto-seed documents into Firestore)
    unsubscribeSnapshot = onSnapshot(collection(db, 'restaurants', tenantId, 'automationSchedules'), (snap) => {
      if (!active) return;
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      localSchedules = list;
      isSubscribed = true;
    }, (err) => {
      console.warn('[DashboardLayout] Automation schedules listener error:', err);
    });

    // Check loop every 15 seconds in memory
    const interval = setInterval(() => {
      if (!isSubscribed || localSchedules.length === 0 || !active) return;
      const now = new Date();

      localSchedules.forEach(schedule => {
        if (!schedule.enabled) return;

        const nextRun = schedule.nextExecutionTime ? new Date(schedule.nextExecutionTime) : null;
        if (nextRun && now >= nextRun && schedule.executionStatus !== 'running') {
          if (active) {
            automationService.runScheduledJob(tenantId, schedule.id, schedule.name).catch(console.error);
          }
        }
      });
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [tenantId]);
};

export const DashboardLayout: React.FC = () => {
  // Mount background stock deduction listeners
  useInventoryAutomation();
  useAutomationEngine();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { role } = useAuth();
  const isKitchen = location.pathname.startsWith('/dashboard/kitchen') || role === 'kitchen';
  const isWaiter = location.pathname.startsWith('/dashboard/waiter') || role === 'waiter';
  const isRestaurantTheme = isKitchen || isWaiter;
  const isOwner = location.pathname.startsWith('/owner') || location.pathname.startsWith('/dashboard/owner') || (role === 'owner' && !isKitchen && !isWaiter);

  return (
    <div className={`flex h-screen overflow-hidden ${
      isOwner 
        ? 'owner-theme bg-[#F8F6F2] text-[#17202A]' 
        : isRestaurantTheme 
        ? 'kds-theme bg-[#F7F4EE] text-[#18201D]' 
        : 'bg-background'
    }`}>
      {/* Sidebar Backdrop Overlay on Mobile/Tablet */}
      {isSidebarOpen && (
        <div 
          className={`fixed inset-0 z-30 lg:hidden ${
            isOwner
              ? 'bg-[#12352D]/60 backdrop-blur-sm'
              : isRestaurantTheme 
              ? 'bg-[#13241F]/60 backdrop-blur-sm' 
              : 'bg-slate-950/80 backdrop-blur-sm'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (drawer behavior below lg breakpoint) */}
      <div className={`
        fixed inset-y-0 left-0 w-64 z-40 flex flex-col transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${isOwner ? 'bg-[#12352D] border-r border-[#1A473C]' : isRestaurantTheme ? 'bg-[#13241F] border-r border-[#1E3B33]' : 'bg-slate-950 border-r border-slate-900'}
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className={`flex-1 overflow-x-hidden overflow-y-auto p-6 relative ${isOwner ? 'bg-[#F8F6F2]' : isRestaurantTheme ? 'bg-[#F7F4EE]' : 'bg-background'}`}>
          {!isRestaurantTheme && !isOwner && (
            <>
              <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
              <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
            </>
          )}
          <div className="relative z-10 max-w-7xl mx-auto">
            <ErrorBoundary fallbackTitle="Dashboard Page Notice" fallbackSubtitle="This view encountered an issue while loading.">
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
