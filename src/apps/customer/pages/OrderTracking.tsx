import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  doc, onSnapshot, getDoc, setDoc, collection, query, 
  where, getDocs, addDoc, updateDoc, increment, limit 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useCurrency } from '../../../context/CurrencyContext';
import { useAuth } from '../../../context/AuthContext';
import { customerService } from '../../../shared/services/customerService';
import { getMenuItemPath } from '../../../shared/firebase/collections';
import CustomerHeader from '../../../shared/ui/navigation/CustomerHeader';
import CustomerReceiptView from '../components/CustomerReceiptView';
import ErrorBoundary from '../../../shared/ui/feedback/ErrorBoundary';
import { billingService } from '../../../shared/services/billingService';
import { IBill } from '../../../shared/domain/billing/types';
import { CanonicalBillModal } from '../../../shared/ui/billing/CanonicalBillModal';

// Icons
import { 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  AlertTriangle, 
  Clock, 
  Bell, 
  DollarSign, 
  CheckCircle2, 
  Star, 
  Sparkles, 
  Utensils, 
  Heart, 
  Plus, 
  AlertCircle, 
  Copy, 
  CheckCheck, 
  Package, 
  Store, 
  MapPin, 
  FileText, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  LifeBuoy, 
  Receipt 
} from 'lucide-react';
import toast from 'react-hot-toast';

// Safe Image Thumbnail Component with Graceful Fallback
const ItemThumbnail: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-[#F3E8DF] border border-[#E5DCD5] flex items-center justify-center shrink-0 text-[#C85A3F]/70">
        <Utensils className="w-5 h-5 text-[#C85A3F]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover shrink-0 border border-[#E5DCD5]"
    />
  );
};

// Dietary Indicator Badge
const DietaryBadge: React.FC<{ isVeg?: boolean }> = ({ isVeg }) => {
  if (isVeg === undefined) return null;
  return isVeg ? (
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border border-[#2E8B57] p-0.5" title="Vegetarian">
      <span className="w-2 h-2 rounded-full bg-[#2E8B57]" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border border-[#A94332] p-0.5" title="Non-Vegetarian">
      <span className="w-2 h-2 rounded-full bg-[#A94332]" />
    </span>
  );
};

// Safe timestamp ms converter supporting Firestore Timestamp (.toDate(), .seconds), ISO strings, numbers, Date
const getTimestampMs = (val: any): number => {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof val?.toDate === 'function') {
    try { return val.toDate().getTime(); } catch (_) {}
  }
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
};

// Safe localized order time formatter
const formatOrderTime = (val: any): string => {
  if (!val) return 'Just now';
  try {
    const ms = getTimestampMs(val);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? 'Just now' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Just now';
  }
};

export const OrderTracking: React.FC = () => {
  const { tenantId, orderId } = useParams<{ tenantId: string; orderId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReceiptRequested = searchParams.get('view') === 'receipt';
  const { user } = useAuth();
  const { formatPrice, formatCurrency } = useCurrency();

  // Core Data States
  const [order, setOrder] = useState<any | null>(null);
  const [restaurantData, setRestaurantData] = useState<any | null>(null);
  const [restaurantName, setRestaurantName] = useState('Restaurant');
  const [restaurantImage, setRestaurantImage] = useState<string>('');
  const [restaurantLocality, setRestaurantLocality] = useState<string>('');
  const [waiterRequests, setWaiterRequests] = useState<any[]>([]);
  const [menuLookup, setMenuLookup] = useState<Record<string, any>>({});
  const [session, setSession] = useState<any>(null);

  // Status & Timers
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [hasCopiedOrderId, setHasCopiedOrderId] = useState(false);

  // UI / Modal States
  const [isRequestAlertOpen, setIsRequestAlertOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [cancelDialogRequest, setCancelDialogRequest] = useState<any | null>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);
  
  // Canonical Bill States (real-time sync across Customer, Waiter, and Owner)
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(tenantId || '');
  const [canonicalBill, setCanonicalBill] = useState<IBill | null>(null);
  const [isCanonicalBillModalOpen, setIsCanonicalBillModalOpen] = useState(false);
  const [isMarkingDiningCompleted, setIsMarkingDiningCompleted] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  // Feedback form states
  const [ratingCategory, setRatingCategory] = useState<'Excellent' | 'Good' | 'Neutral' | 'Needs Attention' | 'Complaint'>('Excellent');
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [cleanlinessRating, setCleanlinessRating] = useState(5);
  const [ambienceRating, setAmbienceRating] = useState(5);
  const [comments, setComments] = useState('');
  const [repeatCustomer, setRepeatCustomer] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Status Timeline Steps (Strict separation: Order Lifecycle vs Payment Lifecycle)
  const trackingSteps = [
    { key: 'NEW', label: 'Order Received', desc: 'Your ticket is in the kitchen queue.' },
    { key: 'ACCEPTED', label: 'Accepted', desc: 'The kitchen has accepted your order.' },
    { key: 'PREPARING', label: 'Preparing', desc: 'The chef is cooking your dishes.' },
    { key: 'READY', label: 'Ready', desc: 'Food is plated and ready for serving.' },
    { key: 'SERVED', label: 'Served', desc: 'Food is delivered to your table. Enjoy!' },
    { key: 'DINING_COMPLETED', label: 'Dining Completed', desc: 'Dining finished. Settle your canonical bill.' }
  ];

  const getStepIndex = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'NEW':
      case 'PLACED': return 0;
      case 'ACCEPTED': return 1;
      case 'PREPARING': return 2;
      case 'READY': return 3;
      case 'DELIVERED':
      case 'SERVED': return 4;
      case 'DINING_COMPLETED':
      case 'COMPLETED': return 5;
      default: return 0;
    }
  };

  // 1. Fetch dining session from sessionStorage / localStorage
  useEffect(() => {
    const savedSessionStr = sessionStorage.getItem('restaurantos_dining_session') || localStorage.getItem('restaurantos_dining_session');
    if (savedSessionStr) {
      try {
        setSession(JSON.parse(savedSessionStr));
      } catch (e) {
        console.error('[OrderTracking] Failed to parse cached session', e);
      }
    }
  }, []);

  // 1.5. Real-time Canonical Bill Listener & Sync
  useEffect(() => {
    const effectiveTenant = order?.tenantId || resolvedTenantId || tenantId;
    if (!effectiveTenant || !orderId) return;
    const unsub = billingService.subscribeToCanonicalBill(effectiveTenant, orderId, (b) => {
      setCanonicalBill(b);
      if (b?.paymentStatus === 'paid') {
        setPaymentCompleted(true);
      }
    });
    return () => unsub();
  }, [tenantId, resolvedTenantId, order?.tenantId, orderId]);

  // Canonical bill generation trigger: Only generate when dining is explicitly completed
  useEffect(() => {
    const effectiveTenant = order?.tenantId || resolvedTenantId || tenantId;
    if (!effectiveTenant || !order || !orderId) return;
    const st = (order.status || '').toUpperCase();
    if (st === 'DINING_COMPLETED' && !canonicalBill) {
      billingService.getOrCreateCanonicalBill(effectiveTenant, order, restaurantData).catch(err => {
        console.warn('[OrderTracking] Canonical bill auto-generation warning:', err);
      });
    }
  }, [tenantId, resolvedTenantId, order?.tenantId, orderId, order?.status, canonicalBill, restaurantData]);

  // 2. Real-time Listeners for Order & Waiter Requests, plus Tenant & Menu Info
  useEffect(() => {
    if (!tenantId || !orderId) return;

    setIsLoading(true);
    setLoadError(null);

    let isSubscribed = true;
    let unsubOrderListener = () => {};
    let unsubRequestsListener = () => {};

    const initializeTracking = async () => {
      try {
        // A. Resolve Tenant / Restaurant ID (handling slugs vs document IDs)
        let effectiveTenantId = tenantId;
        let tenantDoc = await getDoc(doc(db, 'tenants', effectiveTenantId));
        if (!tenantDoc.exists()) {
          tenantDoc = await getDoc(doc(db, 'restaurants', effectiveTenantId));
        }

        // If not found directly, check by slug
        if (!tenantDoc.exists()) {
          try {
            const qSlug = query(collection(db, 'tenants'), where('slug', '==', tenantId), limit(1));
            const snapSlug = await getDocs(qSlug);
            if (!snapSlug.empty) {
              tenantDoc = snapSlug.docs[0];
              effectiveTenantId = tenantDoc.id;
            } else {
              const qRestSlug = query(collection(db, 'restaurants'), where('slug', '==', tenantId), limit(1));
              const snapRestSlug = await getDocs(qRestSlug);
              if (!snapRestSlug.empty) {
                tenantDoc = snapRestSlug.docs[0];
                effectiveTenantId = tenantDoc.id;
              }
            }
          } catch (slugErr) {
            console.warn('[OrderTracking] Slug lookup warning:', slugErr);
          }
        }

        setResolvedTenantId(effectiveTenantId);

        if (tenantDoc.exists()) {
          const tData = tenantDoc.data();
          setRestaurantData(tData);
          setRestaurantName(tData.restaurantName || tData.name || tData.title || 'Restaurant');
          setRestaurantImage(tData.coverImageUrl || tData.coverImage || tData.bannerImage || tData.logoUrl || tData.logo || '');

          const city = typeof tData.address === 'object' && tData.address?.city ? tData.address.city : (tData.city || '');
          const street = typeof tData.address === 'string' ? tData.address : (tData.address?.street || tData.address?.area || tData.area || '');
          const locationStr = [street, city].filter(Boolean).join(', ');
          setRestaurantLocality(locationStr || 'Hyderabad, India');
        }

        // Fetch menu collection once for image & dietary lookup
        try {
          const itemsSnap = await getDocs(collection(db, getMenuItemPath(effectiveTenantId)));
          const lookup: Record<string, any> = {};
          itemsSnap.forEach(d => {
            lookup[d.id] = d.data();
          });
          setMenuLookup(lookup);
        } catch (menuErr) {
          console.warn('[OrderTracking] Menu items lookup warning:', menuErr);
        }

        // B. Real-time Order Subscription with Resilient Order ID Fallback
        const targetOrderRef = doc(db, 'restaurants', effectiveTenantId, 'orders', orderId);

        unsubOrderListener = onSnapshot(targetOrderRef, async (docSnap) => {
          if (!isSubscribed) return;

          if (docSnap.exists()) {
            const orderData = docSnap.data();
            setOrder({ id: docSnap.id, ...orderData });

            if (orderData.createdAt) {
              const diffMs = Date.now() - getTimestampMs(orderData.createdAt);
              setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)));
            }

            if ((orderData.paymentStatus || '').toLowerCase() === 'paid') {
              setPaymentCompleted(true);
            }

            // Synchronize status with local recent orders index
            try {
              const localOrdersStr = localStorage.getItem('restaurantos_customer_orders');
              if (localOrdersStr) {
                const list = JSON.parse(localOrdersStr);
                if (Array.isArray(list)) {
                  let changed = false;
                  const updated = list.map((it: any) => {
                    if (it.orderId === docSnap.id) {
                      changed = true;
                      return {
                        ...it,
                        status: orderData.status,
                        paymentStatus: orderData.paymentStatus
                      };
                    }
                    return it;
                  });
                  if (changed) {
                    localStorage.setItem('restaurantos_customer_orders', JSON.stringify(updated));
                    window.dispatchEvent(new Event('storage'));
                  }
                }
              }
            } catch (_) {}

            setIsLoading(false);
          } else {
            // Document not found directly: attempt fallback lookup (fuzzy, transposed chars, case-insensitive)
            try {
              const ordersCol = collection(db, 'restaurants', effectiveTenantId, 'orders');
              const recentSnap = await getDocs(ordersCol);
              let matchedDoc: any = null;
              const targetNorm = orderId.trim().toUpperCase();

              for (const d of recentSnap.docs) {
                const curId = d.id.trim().toUpperCase();
                const dataId = (d.data().orderId || '').trim().toUpperCase();

                if (curId === targetNorm || dataId === targetNorm) {
                  matchedDoc = d;
                  break;
                }

                if (curId.length === targetNorm.length && curId.startsWith('ORD-')) {
                  let diffs = 0;
                  for (let i = 0; i < curId.length; i++) {
                    if (curId[i] !== targetNorm[i]) diffs++;
                  }
                  if (diffs <= 2) {
                    matchedDoc = d;
                    break;
                  }
                }
              }

              if (matchedDoc && isSubscribed) {
                const resolvedData = matchedDoc.data();
                setOrder({ id: matchedDoc.id, ...resolvedData });
                if (resolvedData.createdAt) {
                  const diffMs = Date.now() - getTimestampMs(resolvedData.createdAt);
                  setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)));
                }
                if ((resolvedData.paymentStatus || '').toLowerCase() === 'paid') {
                  setPaymentCompleted(true);
                }
                setIsLoading(false);
                return;
              }
            } catch (fallbackErr) {
              console.warn('[OrderTracking] Fallback order search warning:', fallbackErr);
            }

            if (isSubscribed) {
              setOrder(null);
              setIsLoading(false);
            }
          }
        }, (err: any) => {
          if (!isSubscribed) return;
          console.error('[OrderTracking] Order subscription error:', err);
          if (err?.code === 'permission-denied') {
            setLoadError('Access denied: You do not have permission to view this order.');
          } else if (err?.code === 'unavailable') {
            setLoadError('Network connection issue. Unable to connect to restaurant order service.');
          } else {
            setLoadError('Unable to connect to real-time order tracking.');
          }
          setIsLoading(false);
        });

        // C. Subscribe to Diner Requests for active table
        const reqColRef = collection(db, 'restaurants', effectiveTenantId, 'waiterRequests');
        unsubRequestsListener = onSnapshot(reqColRef, (snap) => {
          if (!isSubscribed) return;
          const list: any[] = [];
          snap.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          list.sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
          setWaiterRequests(list);
        }, (err) => {
          console.warn('[OrderTracking] waiterRequests subscription warning:', err);
        });

      } catch (err: any) {
        if (!isSubscribed) return;
        console.error('[OrderTracking] Initialization error:', err);
        setLoadError('Unable to load restaurant and order details.');
        setIsLoading(false);
      }
    };

    initializeTracking();

    return () => {
      isSubscribed = false;
      unsubOrderListener();
      unsubRequestsListener();
    };
  }, [tenantId, orderId]);

  // 3. Elapsed Timer increment interval
  useEffect(() => {
    if (!order?.createdAt) return;

    const updateElapsed = () => {
      const ms = getTimestampMs(order.createdAt);
      const diffMs = Date.now() - ms;
      setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 60000);
    return () => clearInterval(timer);
  }, [order?.createdAt]);

  // Copy Order ID to clipboard
  const handleCopyOrderId = () => {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId);
    setHasCopiedOrderId(true);
    toast.success('Order ID copied to clipboard');
    setTimeout(() => setHasCopiedOrderId(false), 2000);
  };

  // Helper to determine if a request status is active
  const isRequestActive = (status?: string) => {
    const s = (status || '').toLowerCase();
    return s === 'pending' || s === 'accepted' || s === 'in_progress' || s === 'acknowledged';
  };

  const isRequestPending = (status?: string) => {
    const s = (status || '').toLowerCase();
    return s === 'pending';
  };

  // 4. Submit Waiter / Dining alerts with duplicate prevention
  const handleCallWaiter = async (requestType: string) => {
    if (!tenantId || !order) return;
    if (isSubmittingRequest) return;

    // Check if an active request for this service type already exists for this table/order
    const existingActive = waiterRequests.find(r => 
      r.requestType === requestType &&
      (r.orderId ? r.orderId === orderId : r.tableNumber === order.tableNumber) &&
      isRequestActive(r.status)
    );

    if (existingActive) {
      toast.error(`A request for "${requestType}" is already pending.`);
      setIsRequestAlertOpen(false);
      return;
    }

    setIsSubmittingRequest(true);

    try {
      const requestId = `REQ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const requestRef = doc(db, 'restaurants', tenantId, 'waiterRequests', requestId);

      const priority = requestType === 'Bill Request' ? 'high' : 'normal';
      const requestPayload = {
        id: requestId,
        orderId: orderId || null,
        tableNumber: order.tableNumber || 'Walk-in',
        requestType,
        status: 'Pending',
        priority,
        createdAt: new Date().toISOString(),
        deviceId: localStorage.getItem('restaurantos_device_id') || 'unknown',
        sessionId: session?.sessionId || 'ANON-SESSION',
        customerId: user?.uid || session?.customerId || 'anonymous',
        cancelledAt: null,
        cancelledBy: null
      };

      await setDoc(requestRef, requestPayload);

      // Trigger Audit event logs
      await customerService.logCustomerEvent(tenantId, 'Waiter Alert', `Diner requested assistance: ${requestType} from Table ${order.tableNumber}`, {
        tableNumber: order.tableNumber,
        requestType,
        priority
      });

      toast.success(`Request for "${requestType}" sent to staff!`);
      setIsRequestAlertOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // 5. Submit Bill Request with single-active-request guarantee & deterministic key
  const handleRequestBill = async () => {
    if (!tenantId || !orderId || !order) return;
    if (isSubmittingRequest) return;

    // Guard against duplicate active bill request
    const existingActiveBill = waiterRequests.find(r => 
      r.requestType === 'Bill Request' &&
      (r.orderId ? r.orderId === orderId : r.tableNumber === order.tableNumber) &&
      isRequestActive(r.status)
    );

    if (existingActiveBill) {
      toast.error('Our staff has already been notified of your bill request.');
      return;
    }

    setIsSubmittingRequest(true);

    try {
      const requestId = `BILL-${orderId}`;
      const requestRef = doc(db, 'restaurants', tenantId, 'waiterRequests', requestId);

      await setDoc(requestRef, {
        id: requestId,
        orderId,
        tableNumber: order.tableNumber || 'Walk-in',
        requestType: 'Bill Request',
        status: 'Pending',
        priority: 'high',
        createdAt: new Date().toISOString(),
        customerId: user?.uid || session?.customerId || 'anonymous',
        sessionId: session?.sessionId || 'ANON-SESSION',
        deviceId: localStorage.getItem('restaurantos_device_id') || 'unknown',
        cancelledAt: null,
        cancelledBy: null
      }, { merge: true });

      // Update Order billRequestedAt
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
      await updateDoc(orderRef, {
        billRequestedAt: new Date().toISOString()
      });

      // Update Table Status to 'bill_requested'
      const tableId = session?.tableId || (order.tableNumber ? `TBL-${order.tableNumber}` : '');
      if (tableId) {
        try {
          const tableRef = doc(db, 'restaurants', tenantId, 'tables', tableId);
          await updateDoc(tableRef, {
            status: 'bill_requested'
          });
        } catch (_) {}
      }

      // Generate or fetch canonical authoritative bill for immediate display
      const bill = await billingService.getOrCreateCanonicalBill(tenantId, order, restaurantData);
      setCanonicalBill(bill);
      setIsCanonicalBillModalOpen(true);

      // Log event
      await customerService.logCustomerEvent(tenantId, 'Bill Requested', `Customer requested bill for Table ${order.tableNumber}`, {
        tableNumber: order.tableNumber,
        orderId
      });

      toast.success('Bill generated & staff notified!');
    } catch (e) {
      console.error(e);
      toast.error('Unable to send your bill request. Please try again.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // 5.2. Mark Dining Completed (lifecycle transition: SERVED -> DINING_COMPLETED)
  const handleCompleteDining = async () => {
    if (!tenantId || !orderId || !order) return;
    setIsMarkingDiningCompleted(true);
    try {
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'DINING_COMPLETED',
        diningCompletedAt: new Date().toISOString()
      });

      const bill = await billingService.getOrCreateCanonicalBill(tenantId, {
        ...order,
        status: 'DINING_COMPLETED'
      }, restaurantData);
      setCanonicalBill(bill);
      setIsCanonicalBillModalOpen(true);
      toast.success('Dining completed! Here is your bill.');
    } catch (e) {
      console.error('[OrderTracking] Dining completion error:', e);
      toast.error('Could not complete dining. Opening bill anyway.');
      setIsCanonicalBillModalOpen(true);
    } finally {
      setIsMarkingDiningCompleted(false);
    }
  };

  // 5.5. Customer Cancel / Withdraw Request
  const handleConfirmCancelRequest = async () => {
    if (!cancelDialogRequest || !tenantId) return;
    const req = cancelDialogRequest;
    setIsCancellingRequest(true);

    try {
      const requestRef = doc(db, 'restaurants', tenantId, 'waiterRequests', req.id);
      await updateDoc(requestRef, {
        status: 'Cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'customer'
      });

      // If this was a Bill Request, also clear billRequestedAt on the order
      if (req.requestType === 'Bill Request' && orderId) {
        try {
          const orderRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
          await updateDoc(orderRef, {
            billRequestedAt: null
          });
        } catch (_) {}

        // Reset table status if needed
        const tableId = session?.tableId || (order.tableNumber ? `TBL-${order.tableNumber}` : '');
        if (tableId) {
          try {
            await updateDoc(doc(db, 'restaurants', tenantId, 'tables', tableId), {
              status: 'occupied'
            });
          } catch (_) {}
        }
      }

      toast.success('Request cancelled successfully.');
      setCancelDialogRequest(null);
    } catch (e) {
      console.error(e);
      toast.error('Unable to cancel the request. Please try again.');
    } finally {
      setIsCancellingRequest(false);
    }
  };

  // 6. Open Canonical Authoritative Bill (Shared modal across Customer, Waiter, and Owner)
  const handleOpenCanonicalBill = async () => {
    const effectiveTenant = order?.tenantId || resolvedTenantId || tenantId;
    const effectiveOrderId = order?.orderId || orderId;
    if (!effectiveTenant || !effectiveOrderId) return;

    // Open modal immediately so user receives clear, instant UI feedback
    setIsCanonicalBillModalOpen(true);

    try {
      // If the order is not yet in DINING_COMPLETED or COMPLETED status,
      // transition order to DINING_COMPLETED first so that customer canonical bill creation
      // satisfies Firestore security rules (isValidCustomerBillCreation).
      const currentStatus = (order?.status || '').toUpperCase();
      let activeOrder = order;

      if (currentStatus !== 'DINING_COMPLETED' && currentStatus !== 'COMPLETED') {
        try {
          const orderRef = doc(db, 'restaurants', effectiveTenant, 'orders', effectiveOrderId);
          await updateDoc(orderRef, {
            status: 'DINING_COMPLETED',
            diningCompletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          activeOrder = { ...order, status: 'DINING_COMPLETED' };
          setOrder(activeOrder);
        } catch (statusErr) {
          console.warn('[OrderTracking] Dining completion sync warning:', statusErr);
        }
      }

      const bill = await billingService.getOrCreateCanonicalBill(
        effectiveTenant, 
        activeOrder || { orderId: effectiveOrderId, tenantId: effectiveTenant, total: order?.total || 0, items: order?.items || [] }, 
        restaurantData
      );
      setCanonicalBill(bill);
    } catch (e: any) {
      console.warn('[OrderTracking] Open bill warning:', e);
      // CanonicalBillModal also handles real-time loading/fallback if the bill document is still syncing
    }
  };

  // 7. Submit Ratings and Feedback review
  const handleSubmitFeedback = async () => {
    if (!tenantId || !orderId || !order) return;

    try {
      const isPositive = ratingCategory === 'Excellent' || ratingCategory === 'Good';
      const isComplaint = ratingCategory === 'Complaint' || ratingCategory === 'Needs Attention';

      const feedbackPayload = {
        rating: ratingCategory,
        starRating: ratingCategory === 'Excellent' ? 5 : ratingCategory === 'Good' ? 4 : ratingCategory === 'Neutral' ? 3 : ratingCategory === 'Needs Attention' ? 2 : 1,
        foodQuality: foodRating,
        serviceSpeed: serviceRating,
        cleanliness: cleanlinessRating,
        ambience: ambienceRating,
        repeatCustomer,
        notes: comments.trim() || 'No comments',
        submittedBy: user?.displayName || 'Table Guest',
        submittedByName: user?.displayName || 'Table Guest',
        submittedAt: new Date().toISOString(),
        orderId,
        tableNumber: order.tableNumber || 'Walk-in',
        tenantId,
        isPositive,
        isComplaint
      };

      const reviewsCol = collection(db, 'restaurants', tenantId, 'satisfactionRatings');
      const ratingRef = await addDoc(reviewsCol, feedbackPayload);

      // If a complaint is raised, trigger manager review tasks
      if (isComplaint) {
        const taskRef = collection(db, 'restaurants', tenantId, 'tasks');
        await addDoc(taskRef, {
          tenantId,
          customerIssue: `Diner rating: ${ratingCategory}. Comments: ${comments || 'None'}`,
          priority: ratingCategory === 'Complaint' ? 'Critical' : 'High',
          assignedManager: 'Pending',
          resolutionStatus: 'Pending',
          resolutionNotes: '',
          submittedAt: new Date().toISOString(),
          submittedByName: user?.displayName || 'Table Guest',
          submittedBy: 'customer',
          tableNumber: order.tableNumber || 'Walk-in',
          rating: ratingCategory,
          satisfactionRatingId: ratingRef.id
        });
      }

      // Note: Table status transitions to 'cleaning' on bill settlement and remains
      // in cleaning until the waiter inspects and confirms the table is sanitized.
      // Do NOT reset table to Available here.

      // Clear local dining session cache
      sessionStorage.removeItem('restaurantos_dining_session');
      localStorage.removeItem('restaurantos_dining_session');

      await customerService.logCustomerEvent(tenantId, 'Feedback Submitted', `Customer submitted satisfaction rating: ${ratingCategory}`, {
        rating: ratingCategory,
        orderId
      });

      setFeedbackSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (e) {
      console.error('[Feedback] Submit error:', e);
      toast.error('Failed to log review details.');
    }
  };

  // Active step and state computations (defensively computed at top level to obey Rules of Hooks)
  const activeIndex = getStepIndex(order?.status || '');
  const isCancelled = (order?.status || '').toUpperCase() === 'CANCELLED';

  // Historical Bill computations from Firestore order snapshot
  const orderSubtotal = Number(order?.subtotal ?? 0);
  const orderTax = Number(order?.tax ?? 0);
  const orderServiceCharge = Number(order?.serviceCharge ?? 0);
  const orderDiscount = Number(order?.discount ?? 0);
  const orderTip = Number(order?.tip ?? 0);
  const orderTotal = Number(
    order?.total ??
    order?.totalAmount ??
    (orderSubtotal + orderTax + orderServiceCharge - orderDiscount + orderTip)
  );

  // Scoped requests strictly for this specific order / table session (unconditional hooks)
  const orderRequests = useMemo(() => {
    if (!order) return [];
    const targetOrderId = order.orderId || order.id || orderId;
    const targetTableNumber = order.tableNumber;
    return waiterRequests.filter(r => {
      if (r.orderId && targetOrderId) {
        return r.orderId === targetOrderId;
      }
      return targetTableNumber ? r.tableNumber === targetTableNumber : false;
    });
  }, [waiterRequests, orderId, order?.orderId, order?.id, order?.tableNumber]);

  // Active bill request for this order (at most ONE)
  const activeBillRequest = useMemo(() => {
    return orderRequests.find(r => 
      r.requestType === 'Bill Request' && isRequestActive(r.status)
    );
  }, [orderRequests]);

  // Active service assistance requests (excluding Bill Requests)
  const activeServiceRequests = useMemo(() => {
    return orderRequests.filter(r => 
      r.requestType !== 'Bill Request' && isRequestActive(r.status)
    );
  }, [orderRequests]);

  // Placed At Formatted Timestamp (safe across all timestamp types)
  const placedAtFormatted = order?.createdAt ? formatOrderTime(order.createdAt) : 'Just now';

  // Estimated preparation time calculation
  const estimatedTimeText = restaurantData?.avgPrepTime 
    ? `${restaurantData.avgPrepTime}–${restaurantData.avgPrepTime + 10} minutes`
    : '20–30 minutes';

  // Customer Authorization & Tenant Isolation check
  const isAuthorized = (() => {
    if (!order) return true;
    // When customer account exists and order specifies customerId
    if (user?.uid && order.customerId && order.customerId !== 'guest-uid') {
      return order.customerId === user.uid;
    }
    // Matching active dining session for walk-ins / guest table QR
    if (session?.sessionId && order.sessionId) {
      return order.sessionId === session.sessionId;
    }
    // Guest or walk-in order without customerId attached
    if (!order.customerId || order.customerId === 'guest-uid') return true;
    // Authenticated customer trying to access another customer's order
    if (user?.uid && order.customerId && order.customerId !== user.uid) {
      return false;
    }
    return true;
  })();

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-left">
        <CustomerHeader />
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-8 space-y-8 animate-pulse">
          <div className="h-5 w-36 bg-[#F3E8DF] rounded-md" />
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-[#F3E8DF]" />
            <div className="space-y-2">
              <div className="h-8 w-64 bg-[#F3E8DF] rounded-lg" />
              <div className="h-4 w-48 bg-[#F3E8DF] rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 bg-white border border-[#E5DCD5] rounded-2xl p-6 space-y-4">
              <div className="h-6 w-48 bg-[#F3E8DF] rounded-md" />
              <div className="h-64 bg-[#FCFAF7] rounded-xl border border-[#E5DCD5]" />
            </div>
            <div className="lg:col-span-4 bg-white border border-[#E5DCD5] rounded-2xl p-6 space-y-4">
              <div className="h-6 w-40 bg-[#F3E8DF] rounded-md" />
              <div className="h-48 bg-[#FCFAF7] rounded-xl border border-[#E5DCD5]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry and navigation
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-left">
        <CustomerHeader />
        <div className="max-w-[1240px] mx-auto px-4 py-16 text-center">
          <div className="max-w-md mx-auto bg-white border border-[#E5DCD5] rounded-3xl p-8 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-[#A94332] flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold text-[#202124]">Unable to load your order</h2>
            <p className="text-xs text-[#756B64]">{loadError}</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                onClick={() => navigate('/customer/orders')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to My Orders</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Order Not Found state
  if (!order) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-left">
        <CustomerHeader />
        <div className="max-w-[1240px] mx-auto px-4 py-16 text-center">
          <div className="max-w-md mx-auto bg-white border border-[#E5DCD5] rounded-3xl p-8 space-y-5 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#F3E8DF] text-[#C85A3F] flex items-center justify-center mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-[#202124]">Order Not Found</h2>
              <p className="text-xs text-[#756B64] leading-relaxed">
                We could not locate order <span className="font-mono font-bold text-[#202124]">#{orderId}</span>.
                It may have expired or been removed.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                onClick={() => navigate('/customer/orders')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to My Orders</span>
              </button>
              {tenantId && (
                <button
                  onClick={() => navigate(`/customer/restaurant/${tenantId}`)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <Store className="w-4 h-4 text-[#C85A3F]" />
                  <span>Restaurant Page</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-left">
        <CustomerHeader />
        <div className="max-w-[1240px] mx-auto px-4 py-16 text-center">
          <div className="max-w-md mx-auto bg-white border border-[#E5DCD5] rounded-3xl p-8 space-y-5 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-[#A94332] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-[#202124]">Access Denied</h2>
              <p className="text-xs text-[#756B64] leading-relaxed">
                You don't have access to this order.
              </p>
            </div>
            <button
              onClick={() => navigate('/customer/orders')}
              className="inline-flex items-center gap-1.5 px-6 py-3 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to My Orders</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authoritative Payment Settlement Status
  const isOrderPaid = (order.paymentStatus || '').toLowerCase() === 'paid' || canonicalBill?.paymentStatus === 'paid';
  const isCompleted = (order.status || '').toUpperCase() === 'COMPLETED' && isOrderPaid;

  // 1. Explicit Receipt View Request (?view=receipt)
  if (isReceiptRequested) {
    return (
      <CustomerReceiptView
        order={order}
        restaurantData={restaurantData}
        tenantId={tenantId}
      />
    );
  }

  // 2. Thank You Exit Screen after Feedback Submission
  if (feedbackSubmitted) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-left">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-8 space-y-6 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-[#2E8B57] flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8 fill-current animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-extrabold text-[#202124]">Thank You for Dining!</h2>
              <p className="text-xs text-[#756B64] leading-relaxed">
                Your feedback helps us continually refine our recipes and dining experience. Have a wonderful rest of your day!
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => navigate('?view=receipt')}
                className="w-full text-xs font-bold py-3 bg-[#FCFAF7] border border-[#E5DCD5] hover:bg-[#F3E8DF] text-[#202124] rounded-xl transition-all cursor-pointer"
              >
                View Final Receipt
              </button>
              <button
                onClick={() => navigate('/customer/home')}
                className="w-full text-xs font-bold py-3 bg-[#C85A3F] hover:bg-[#A94332] text-white rounded-xl shadow-md transition-all cursor-pointer"
              >
                Finish & Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Post-Payment Dining Experience Feedback Loop (Triggered after bill is settled)
  if (paymentCompleted || isOrderPaid) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-left">
        <CustomerHeader />
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="text-center space-y-1.5 pb-4 border-b border-[#E5DCD5]">
              <h2 className="text-2xl font-display font-extrabold text-[#202124]">Dining Experience Feedback</h2>
              <p className="text-xs text-[#756B64]">How was your meal at {restaurantName}?</p>
            </div>

            {/* Overall Experience select */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#756B64] block">
                Overall Experience
              </label>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[
                  { key: 'Excellent', label: '😍' },
                  { key: 'Good', label: '😊' },
                  { key: 'Neutral', label: '😐' },
                  { key: 'Needs Attention', label: '🙁' },
                  { key: 'Complaint', label: '😡' }
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRatingCategory(opt.key as any)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                      ratingCategory === opt.key 
                        ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#C85A3F] shadow-xs' 
                        : 'bg-white border-[#E5DCD5] text-[#756B64] hover:bg-[#FCFAF7]'
                    }`}
                  >
                    <span className="text-2xl">{opt.label}</span>
                    <span className="text-[9px] font-bold mt-1 block truncate w-full">{opt.key.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rating Stars Grid */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              {[
                { label: 'Food Quality', val: foodRating, set: setFoodRating },
                { label: 'Service Speed', val: serviceRating, set: setServiceRating },
                { label: 'Cleanliness', val: cleanlinessRating, set: setCleanlinessRating },
                { label: 'Ambience', val: ambienceRating, set: setAmbienceRating }
              ].map(cat => (
                <div key={cat.label} className="space-y-1">
                  <label className="text-[10px] font-bold text-[#756B64] block uppercase">{cat.label}</label>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => cat.set(star)}
                        className="text-[#E5DCD5] hover:text-amber-500 transition-colors cursor-pointer"
                      >
                        <Star className={`w-4 h-4 ${star <= cat.val ? 'text-amber-500 fill-current' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Comments Box */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#756B64] block">
                Additional Comments
              </label>
              <textarea
                placeholder="Tell us what you loved or how we can improve..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full bg-white border border-[#E5DCD5] focus:border-[#C85A3F] focus:ring-1 focus:ring-[#C85A3F] rounded-xl p-3 text-xs text-[#202124] placeholder-[#756B64]/60 outline-none h-20 resize-none transition-all"
              />
            </div>

            {/* Repeat Customer Checkbox */}
            <div className="flex items-center space-x-2.5">
              <input
                type="checkbox"
                id="repeatCustomer"
                checked={repeatCustomer}
                onChange={(e) => setRepeatCustomer(e.target.checked)}
                className="w-4 h-4 accent-[#C85A3F] cursor-pointer"
              />
              <label htmlFor="repeatCustomer" className="text-xs font-semibold text-[#756B64] cursor-pointer">
                I would gladly visit {restaurantName} again!
              </label>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSubmitFeedback}
                className="w-full text-xs font-extrabold py-3.5 bg-[#C85A3F] hover:bg-[#A94332] text-white rounded-xl shadow-md shadow-[#C85A3F]/20 transition-all cursor-pointer"
              >
                Submit Feedback Review
              </button>
              <button
                type="button"
                onClick={() => navigate('?view=receipt')}
                className="w-full text-xs font-semibold py-2 text-[#756B64] hover:text-[#202124] transition-colors cursor-pointer"
              >
                Skip & View Receipt →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for terminal/completed orders where feedback wasn't triggered
  if (isCompleted) {
    return (
      <CustomerReceiptView
        order={order}
        restaurantData={restaurantData}
        tenantId={tenantId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-left select-none pb-16">
      
      {/* 1. TOP CUSTOMER NAVIGATION */}
      <CustomerHeader />

      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(tenantId ? `/customer/restaurant/${tenantId}` : -1 as any)}
            className="inline-flex items-center space-x-2 text-xs font-bold text-[#756B64] hover:text-[#C85A3F] transition-colors cursor-pointer group py-1"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Restaurant</span>
          </button>

          <span className="hidden sm:block text-xs font-serif italic text-[#C85A3F]/80">
            Real-Time Dining Updates
          </span>
        </div>

        {/* 2. RESTAURANT CONTEXT HEADER */}
        <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {/* Restaurant Cover / Logo image */}
            {restaurantImage ? (
              <img
                src={restaurantImage}
                alt={restaurantName}
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover border border-[#E5DCD5] shadow-xs shrink-0"
              />
            ) : (
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-[#F3E8DF] border border-[#E5DCD5] flex items-center justify-center shrink-0 text-[#C85A3F]">
                <Store className="w-7 h-7" />
              </div>
            )}

            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-display font-extrabold text-[#202124] tracking-tight">
                {restaurantName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#756B64]">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#C85A3F]" />
                  <span>{restaurantLocality}</span>
                </span>
                {(order.tableNumber || order.tableId) && (
                  <>
                    <span className="text-[#E5DCD5]">•</span>
                    <span className="font-bold text-[#202124]">
                      {(() => {
                        const raw = String(order.tableNumber || order.tableId?.replace(/^TBL-/i, '') || '');
                        return raw.toLowerCase().includes('walk') ? 'Walk-in' : `Table #${raw}`;
                      })()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge Top Right */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold border ${
              isCancelled 
                ? 'bg-rose-50 text-[#A94332] border-rose-200' 
                : activeIndex >= 4 
                  ? 'bg-emerald-50 text-[#2E8B57] border-emerald-200' 
                  : 'bg-[#F3E8DF] text-[#C85A3F] border-[#E5DCD5]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isCancelled ? 'bg-[#A94332]' : activeIndex >= 4 ? 'bg-[#2E8B57]' : 'bg-[#C85A3F] animate-pulse'
              }`} />
              <span>
                {isCancelled ? 'Cancelled' : activeIndex === 5 ? 'Completed' : activeIndex === 4 ? 'Delivered' : 'In Preparation'}
              </span>
            </span>
          </div>
        </div>

        {/* 3. MAIN TWO-COLUMN DASHBOARD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ======================================================== */}
          {/* LEFT COLUMN: ORDER TRACKING TIMELINE & WHILE YOU WAIT   */}
          {/* ======================================================== */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Card 1: Live Status Timeline */}
            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
              
              {/* Header Title */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-[#C85A3F]" />
                  <h2 className="text-xl font-display font-extrabold text-[#202124]">
                    Order Tracking
                  </h2>
                </div>
                <p className="text-xs text-[#756B64]">
                  Track your delicious food in real-time
                </p>
              </div>

              {/* Order Meta Strip */}
              <div className="bg-[#FCFAF7] border border-[#E5DCD5] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                    Order ID
                  </span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <strong className="font-mono font-bold text-[#202124] text-xs md:text-sm uppercase">
                      {orderId}
                    </strong>
                    <button
                      type="button"
                      onClick={handleCopyOrderId}
                      className="text-[#756B64] hover:text-[#C85A3F] p-1 rounded transition-colors cursor-pointer"
                      title="Copy Order ID"
                      aria-label="Copy Order ID"
                    >
                      {hasCopiedOrderId ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#2E8B57]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                    Placed At
                  </span>
                  <strong className="font-bold text-[#202124] text-xs md:text-sm block mt-0.5">
                    {placedAtFormatted}
                  </strong>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                    Elapsed Time
                  </span>
                  <div className="flex items-center space-x-1 text-[#C85A3F] font-bold text-xs md:text-sm mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{elapsedMinutes} mins</span>
                  </div>
                </div>
              </div>

              {/* Order Cancelled Alert */}
              {isCancelled ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-[#A94332] text-xs font-semibold">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <span>This order has been cancelled by the restaurant. Please consult your server or manager.</span>
                </div>
              ) : (
                /* Vertical Status Timeline */
                <div className="relative pl-8 pt-2 pb-2 space-y-7 border-l-2 border-[#E5DCD5] ml-4">
                  {trackingSteps.map((step, idx) => {
                    const isCompleted = idx < activeIndex;
                    const isActive = idx === activeIndex;

                    return (
                      <div key={step.key} className="relative">
                        
                        {/* Status Circle Pin */}
                        <div className={`absolute -left-[45px] w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all ${
                          isCompleted
                            ? 'bg-[#2E8B57] border-[#2E8B57] text-white shadow-xs'
                            : isActive
                              ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-md shadow-[#C85A3F]/30 ring-4 ring-[#C85A3F]/15 animate-pulse'
                              : 'bg-white border-[#E5DCD5] text-[#756B64]'
                        }`}>
                          {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                        </div>

                        {/* Status Content Card */}
                        <div className={`transition-all ${
                          isActive 
                            ? 'bg-[#F3E8DF]/60 border border-[#C85A3F]/30 rounded-xl p-3.5 shadow-xs' 
                            : 'p-1'
                        }`}>
                          <div className="flex items-center justify-between">
                            <h3 className={`text-sm md:text-base font-extrabold ${
                              isActive ? 'text-[#C85A3F]' : isCompleted ? 'text-[#202124]' : 'text-[#756B64]'
                            }`}>
                              {step.label}
                            </h3>
                            {isActive && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C85A3F] text-white">
                                Current Step
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 ${
                            isActive ? 'text-[#202124] font-medium' : 'text-[#756B64]'
                          }`}>
                            {step.desc}
                          </p>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Card 2: Contextual "While You Wait" Card */}
            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#C85A3F]" />
                  <h3 className="text-sm md:text-base font-extrabold text-[#202124]">
                    {activeIndex >= 5 ? 'Enjoyed your meal?' : 'While you wait...'}
                  </h3>
                </div>
                <p className="text-xs text-[#756B64] leading-relaxed max-w-md">
                  {activeIndex >= 5 
                    ? `Thank you for dining at ${restaurantName}. We hope to serve you again soon!`
                    : `Explore more delicious appetizers, beverages or desserts from ${restaurantName}.`
                  }
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/customer/restaurant/${tenantId}/active-order`)}
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active Dining Session</span>
                </button>
                <button
                  onClick={() => navigate(`/customer/restaurant/${tenantId}/menu`)}
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-[#F3E8DF] hover:bg-[#E5DCD5] text-[#C85A3F] hover:text-[#A94332] font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  <span>Order More Food</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: STICKY ORDER SUMMARY & SERVICE ASSISTANCE  */}
          {/* ======================================================== */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">
            
            {/* Card 1: Order Summary */}
            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-6 shadow-sm space-y-5">
              
              <div className="flex items-center space-x-2 pb-3 border-b border-[#E5DCD5]">
                <FileText className="w-4 h-4 text-[#C85A3F]" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#202124]">
                  Order Summary
                </h2>
              </div>

              {/* Items List */}
              <div className="space-y-3 divide-y divide-[#E5DCD5]/60 max-h-64 overflow-y-auto pr-1">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item: any, idx: number) => {
                    const lookup = menuLookup[item.itemId] || {};
                    const thumb = item.image || item.imageUrl || lookup.imageUrl || lookup.image;
                    const isVegItem = item.isVeg ?? item.veg ?? lookup.isVeg ?? lookup.veg;
                    const qty = Number(item.count || item.quantity || 1);
                    const unitPrice = Number(item.pricePerUnit || item.price || 0);

                    return (
                      <div key={idx} className="flex items-center justify-between pt-3 first:pt-0 gap-3">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <ItemThumbnail src={thumb} alt={item.name || 'Dish'} />
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <DietaryBadge isVeg={isVegItem} />
                              <h4 className="text-xs font-bold text-[#202124] truncate">
                                {item.name || item.itemName || 'Dish'}
                              </h4>
                            </div>
                            <span className="text-[11px] font-semibold text-[#756B64] block">
                              Qty: ×{qty}
                            </span>
                            {item.notes && (
                              <span className="text-[10px] text-[#C85A3F] font-medium block truncate max-w-[150px]">
                                "{item.notes}"
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-xs font-extrabold text-[#202124] shrink-0 font-mono">
                          {formatPrice(unitPrice * qty)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-xs text-[#756B64]">
                    No items recorded for this order.
                  </div>
                )}
              </div>

              {/* Price Calculations Breakdown (from historical order snapshot) */}
              <div className="bg-[#FCFAF7] border border-[#E5DCD5] p-4 rounded-xl text-xs text-[#756B64] space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#202124]">{formatPrice(orderSubtotal)}</span>
                </div>

                {orderDiscount > 0 && (
                  <div className="flex justify-between text-[#2E8B57] font-semibold">
                    <span>Discount</span>
                    <span>-{formatPrice(orderDiscount)}</span>
                  </div>
                )}

                {orderTax > 0 && (
                  <div className="flex justify-between">
                    <span>VAT / Tax</span>
                    <span className="font-bold text-[#202124]">{formatPrice(orderTax)}</span>
                  </div>
                )}

                {orderServiceCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Service Fee</span>
                    <span className="font-bold text-[#202124]">{formatPrice(orderServiceCharge)}</span>
                  </div>
                )}

                {orderTip > 0 && (
                  <div className="flex justify-between text-[#C85A3F] font-semibold">
                    <span>Staff Tip</span>
                    <span>{formatCurrency(orderTip / 100)}</span>
                  </div>
                )}

                <div className="border-t border-[#E5DCD5] pt-2.5 flex justify-between items-baseline">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    Grand Total
                  </span>
                  <span className="text-2xl font-black text-[#C85A3F]">
                    {formatPrice(orderTotal)}
                  </span>
                </div>
              </div>

              {/* Estimated Prep Time Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center space-x-2.5 text-xs text-[#2E8B57]">
                <Clock className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-bold block">Estimated Prep Time: {estimatedTimeText}</span>
                  <span className="text-[10.5px] text-[#2E8B57]/80">Freshly prepared to order by the kitchen</span>
                </div>
              </div>

              {/* Invoicing / Canonical Bill Section */}
              <div className="pt-1 space-y-3">
                {order.paymentStatus === 'paid' ? (
                  <div className="space-y-2">
                    <div className="w-full py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-[#2E8B57] flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Invoice Settled Successfully</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`?view=receipt`)}
                      className="w-full py-2.5 bg-white hover:bg-[#FCFAF7] border border-[#E5DCD5] text-[#202124] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5 text-[#C85A3F]" />
                      <span>View Official Tax Receipt</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Prompt to mark dining completed when food has been served */}
                    {(order.status === 'SERVED' || order.status === 'DELIVERED') && (
                      <div className="bg-[#FFF8F2] border border-[#C85A3F]/30 rounded-xl p-3.5 space-y-2 text-left">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#202124]">
                          <Sparkles className="w-4 h-4 text-[#C85A3F]" />
                          <span>Finished your meal?</span>
                        </div>
                        <p className="text-[11px] text-[#756B64]">
                          Click below to wrap up your dining experience and generate your final bill.
                        </p>
                        <button
                          type="button"
                          disabled={isMarkingDiningCompleted}
                          onClick={handleCompleteDining}
                          className="w-full py-2 bg-[#C85A3F] hover:bg-[#A94332] text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Utensils className="w-3.5 h-3.5" />
                          <span>{isMarkingDiningCompleted ? 'Finalizing Bill...' : 'Done Eating — Get Bill'}</span>
                        </button>
                      </div>
                    )}

                    {/* Canonical Authoritative Bill Card */}
                    {canonicalBill ? (
                      <div className="bg-white border-2 border-[#C85A3F]/30 rounded-xl p-4 space-y-3 text-left shadow-xs">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F] shrink-0">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-[#202124]">Canonical Bill Ready</h4>
                              <p className="text-[10.5px] text-[#756B64] font-mono">#{canonicalBill.billId}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            {canonicalBill.paymentStatus.toUpperCase()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenCanonicalBill}
                          className="w-full bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-md shadow-[#C85A3F]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>View & Settle Bill</span>
                        </button>
                      </div>
                    ) : activeBillRequest ? (
                      isRequestPending(activeBillRequest.status) ? (
                        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 space-y-3 text-left">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                                <Receipt className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-amber-950">Bill Request — Pending</h4>
                                <p className="text-[11px] text-amber-700">Staff has been notified and is preparing your bill.</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                              Pending
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
                            <span className="text-[10.5px] text-amber-700">Need to cancel?</span>
                            <button
                              type="button"
                              onClick={() => setCancelDialogRequest(activeBillRequest)}
                              className="px-3 py-1.5 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            >
                              Cancel Request
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleOpenCanonicalBill}
                            className="w-full bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold py-2.5 px-4 rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Open Bill & Settle</span>
                          </button>
                        </div>
                      ) : (
                        <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 space-y-3 text-left">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                                <Receipt className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-blue-950">Staff is Preparing Your Bill</h4>
                                <p className="text-[11px] text-blue-700">Your server has acknowledged the request.</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
                              Acknowledged
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleOpenCanonicalBill}
                            className="w-full bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-md shadow-[#C85A3F]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>View & Settle Bill</span>
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmittingRequest}
                        onClick={handleRequestBill}
                        className="w-full bg-white hover:bg-[#F3E8DF] border-2 border-[#C85A3F] text-[#C85A3F] hover:text-[#A94332] font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>{isSubmittingRequest ? 'Requesting Bill...' : 'Request Bill & Pay'}</span>
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>

            {/* Card 2: Service Assistance */}
            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5DCD5]">
                <div className="flex items-center space-x-2">
                  <LifeBuoy className="w-4 h-4 text-[#C85A3F]" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    Service Assistance
                  </h3>
                </div>
                <button
                  onClick={() => setIsRequestAlertOpen(true)}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-[#C85A3F] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Request</span>
                </button>
              </div>

              <p className="text-xs text-[#756B64] leading-relaxed">
                Need extra water, plates, or a server? Our staff is here to help.
              </p>

              {/* Table requests status stream */}
              {activeServiceRequests.length === 0 ? (
                <div className="bg-[#FCFAF7] border border-[#E5DCD5] rounded-xl p-3 text-center text-[11px] font-semibold text-[#756B64]">
                  No active assistance requests.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeServiceRequests.map((req) => (
                    <div key={req.id} className="bg-[#FCFAF7] p-2.5 border border-[#E5DCD5] rounded-xl flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-[#202124] block">{req.requestType}</span>
                        <span className="text-[9.5px] text-[#756B64] block">
                          {formatOrderTime(req.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'Completed' 
                            ? 'bg-emerald-50 text-[#2E8B57] border border-emerald-200' 
                            : req.status === 'Accepted' || req.status === 'Acknowledged'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {req.status}
                        </span>
                        {isRequestPending(req.status) && (
                          <button
                            type="button"
                            onClick={() => setCancelDialogRequest(req)}
                            className="text-[10.5px] font-bold text-rose-600 hover:text-rose-700 hover:underline px-1 py-0.5 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* 4. BOTTOM TRUST STRIP */}
        <div className="border-t border-[#E5DCD5] pt-8 mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex items-center justify-center gap-2.5 text-xs text-[#756B64] font-semibold">
            <Sparkles className="w-4 h-4 text-[#C85A3F]" />
            <span>Freshly Prepared to Order</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-xs text-[#756B64] font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#2E8B57]" />
            <span>Secure & Contactless Ordering</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 text-xs text-[#756B64] font-semibold">
            <Heart className="w-4 h-4 text-[#C85A3F]" />
            <span>Support Local Dining</span>
          </div>
        </div>

      </div>

      {/* 5. NEW ASSISTANCE ALERT SELECTOR MODAL */}
      {isRequestAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-6 max-w-md w-full shadow-xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5DCD5]">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-[#C85A3F]" />
                <h3 className="text-base font-extrabold text-[#202124]">Request Service Staff</h3>
              </div>
              <button
                onClick={() => setIsRequestAlertOpen(false)}
                className="text-[#756B64] hover:text-[#202124] font-bold text-xs p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#756B64] leading-relaxed">
              Select an alert below. A notification will route to the server commands desk.
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-1 max-h-[60vh] overflow-y-auto pr-1">
              {[
                { label: 'Water', desc: 'Fresh drinking water' },
                { label: 'Extra Plates', desc: 'Clean dining plates' },
                { label: 'Cutlery', desc: 'Forks, spoons & knives' },
                { label: 'Tissues', desc: 'Paper napkins' },
                { label: 'Condiments', desc: 'Salt, pepper, sauces' },
                { label: 'Call Waiter', desc: 'Staff assistance' },
                { label: 'Request Bill', desc: 'Prepare final check', isBill: true },
                { label: 'Table Cleaning', desc: 'Wipe & sanitize table' },
                { label: 'Change Table', desc: 'Request seat change' },
                { label: 'Other Assistance', desc: 'Special requests' }
              ].map(opt => (
                <button
                  key={opt.label}
                  disabled={isSubmittingRequest}
                  onClick={() => {
                    if (opt.isBill) {
                      setIsRequestAlertOpen(false);
                      handleRequestBill();
                    } else {
                      handleCallWaiter(opt.label);
                    }
                  }}
                  className="p-3 bg-[#FCFAF7] hover:bg-[#F3E8DF] border border-[#E5DCD5] hover:border-[#C85A3F]/50 rounded-xl flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
                >
                  <span className="font-bold text-xs text-[#202124] group-hover:text-[#C85A3F]">
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-[#756B64]">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. CANONICAL AUTHORITATIVE BILL & PAYMENT MODAL */}
      {isCanonicalBillModalOpen && (order?.tenantId || resolvedTenantId || tenantId) && (
        <CanonicalBillModal
          isOpen={isCanonicalBillModalOpen}
          onClose={() => setIsCanonicalBillModalOpen(false)}
          tenantId={order?.tenantId || resolvedTenantId || tenantId}
          orderId={orderId || order?.orderId}
          initialBill={canonicalBill}
          mode="customer"
          restaurantName={restaurantName}
          restaurantLogo={restaurantImage}
          onPaymentSettled={(settledBill) => {
            setCanonicalBill(settledBill);
            setPaymentCompleted(true);
          }}
          onOpenReceipt={() => {
            setIsCanonicalBillModalOpen(false);
            navigate(`?view=receipt`);
          }}
        />
      )}

      {/* 7. CANCEL REQUEST CONFIRMATION MODAL */}
      {cancelDialogRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-[#202124]">
                  {cancelDialogRequest.requestType === 'Bill Request' ? 'Cancel bill request?' : 'Cancel service request?'}
                </h3>
                <p className="text-xs text-[#756B64] leading-relaxed">
                  {cancelDialogRequest.requestType === 'Bill Request'
                    ? 'Are you sure you want to cancel your bill request? You can request it again later.'
                    : `Are you sure you want to cancel your request for "${cancelDialogRequest.requestType}"?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E5DCD5]">
              <button
                type="button"
                disabled={isCancellingRequest}
                onClick={() => setCancelDialogRequest(null)}
                className="px-4 py-2 text-xs font-bold text-[#756B64] hover:bg-[#F3E8DF] rounded-xl transition-all cursor-pointer"
              >
                Keep Request
              </button>
              <button
                type="button"
                disabled={isCancellingRequest}
                onClick={handleConfirmCancelRequest}
                className="px-4 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isCancellingRequest ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export const OrderTrackingWrapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isReceiptRequested = searchParams.get('view') === 'receipt';

  return (
    <ErrorBoundary
      fallbackTitle={isReceiptRequested ? "Unable to load your receipt" : "Unable to load order tracking"}
      fallbackSubtitle={
        isReceiptRequested
          ? "An unexpected issue occurred while rendering your receipt. Please return to your orders or try again."
          : "An unexpected issue occurred while rendering your live order tracking. Please check back shortly."
      }
      onReset={() => navigate('/customer/orders')}
    >
      <OrderTracking />
    </ErrorBoundary>
  );
};

export default OrderTrackingWrapper;
