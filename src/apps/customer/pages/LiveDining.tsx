import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { 
  Clock, Coffee, User, ChevronLeft, CreditCard, Play, 
  Sparkles, ThumbsUp, Send, CheckCircle2, ShieldCheck, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isOrderActive } from '../../../shared/utils/orderUtils';

export const LiveDining: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const tenantId = 'l-ambroisie'; // Default demo restaurant
  const tableId = 'TBL-04';
  const tableNumber = '04';

  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCallingService, setIsCallingService] = useState(false);

  // 1. Subscribe to active orders for this table in real-time
  useEffect(() => {
    const ordersRef = collection(db, 'restaurants', tenantId, 'orders');
    const q = query(
      ordersRef, 
      where('tableNumber', '==', tableNumber)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Ignore completed, terminal or paid orders for active tab tracking
        if (isOrderActive(data)) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActiveOrders(list);
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [tenantId, tableNumber]);

  // 2. Subscribe to active service requests for this table in real-time
  useEffect(() => {
    const reqRef = collection(db, 'restaurants', tenantId, 'waiterRequests');
    const q = query(
      reqRef,
      where('tableNumber', '==', tableNumber),
      where('status', '!=', 'Completed')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setWaiterRequests(list);
    }, (err) => {
      console.error(err);
    });

    return () => unsub();
  }, [tenantId, tableNumber]);

  // Handle service calls mapping to Waiter Dashboard Firestore collection
  const handleRequestService = async (type: string) => {
    setIsCallingService(true);
    try {
      const requestId = `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const docRef = doc(db, 'restaurants', tenantId, 'waiterRequests', requestId);
      
      const payload = {
        id: requestId,
        requestId,
        tableNumber: tableNumber,
        tableNum: tableNumber,
        type,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, payload);
      toast.success(`Request for ${type} sent to waiter!`);
    } catch (e) {
      console.error(e);
      toast.error('Service request failed.');
    } finally {
      setIsCallingService(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left select-none">
      
      <div className="flex items-center space-x-1.5 text-slate-400" onClick={() => navigate('/customer/home')}>
        <ChevronLeft className="w-4 h-4 cursor-pointer" />
        <span className="text-xs font-semibold cursor-pointer">Portal Home</span>
      </div>

      {/* Title Seating Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-extrabold text-white flex items-center gap-1.5">
            Live Table Console <Sparkles className="w-5 h-5 text-primary" />
          </h2>
          <p className="text-xs text-slate-405 font-semibold">Active seating at Table {tableNumber} | L'Ambroisie</p>
        </div>
        <Badge variant="success" className="w-fit text-[9px] uppercase font-bold py-1 px-3 border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
          CONNECTED LIVE
        </Badge>
      </div>

      <hr className="border-slate-900" />

      {/* Grid: Support Calls Panel */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Service Call Assist</h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Call Waiter', type: 'Call Waiter', icon: User },
            { label: 'Need Water', type: 'Need Water', icon: Coffee },
            { label: 'Need Spoon', type: 'Need Spoon', icon: Sparkles },
            { label: 'Need Tissue', type: 'Need Tissue', icon: Send },
            { label: 'Need Bill', type: 'Request Bill', icon: CreditCard },
          ].map((item) => {
            const hasActiveRequest = waiterRequests.some(r => {
              const matchesType = r.type === item.type || r.requestType === item.type;
              const isInactive = ['completed', 'cancelled', 'rejected'].includes((r.status || '').toLowerCase());
              return matchesType && !isInactive;
            });
            return (
              <button
                key={item.label}
                disabled={isCallingService || hasActiveRequest}
                onClick={() => handleRequestService(item.type)}
                className={`p-4 border rounded-2xl flex flex-col items-center justify-center space-y-2 transition-all text-center relative overflow-hidden group ${
                  hasActiveRequest 
                    ? 'bg-primary/10 border-primary text-primary animate-pulse' 
                    : 'bg-slate-900/40 border-slate-900 hover:border-slate-800 text-slate-350 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 text-slate-450 group-hover:scale-105 transition-transform" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">{item.label}</span>
                {hasActiveRequest && (
                  <span className="absolute top-1 right-2 text-[7.5px] font-bold text-primary">Pending</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Seating Order Progress Stepper */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Active Order Status</h3>
        
        {isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <LoadingSpinner label="Loading order trackers..." />
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/20 border border-slate-900 rounded-2xl space-y-2">
            <Info className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">No active orders placed on this table session yet.</p>
            <button 
              onClick={() => navigate(`/customer/restaurant/${tenantId}/menu`)}
              className="text-xs text-primary font-bold hover:underline"
            >
              Order Dishes Now
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => (
              <Card key={order.id} className="p-5 border-slate-850 bg-slate-900/35 rounded-2xl space-y-4.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase">Ticket ID: {order.id.substring(0, 8)}</span>
                    <h4 className="text-xs font-extrabold text-slate-200 mt-0.5">
                      {order.items?.map((it: any) => `${it.name} x${it.count}`).join(', ')}
                    </h4>
                  </div>
                  <Badge 
                    variant={
                      order.status === 'READY' 
                        ? 'success' 
                        : (order.status === 'PREPARING' || order.status === 'ACCEPTED') 
                          ? 'warning' 
                          : 'muted'
                    }
                    className="text-[8.5px] uppercase font-bold py-0.5"
                  >
                    {order.status}
                  </Badge>
                </div>

                {/* Progress Stepper bar layout */}
                <div className="grid grid-cols-4 gap-2 text-center text-[9px] font-bold text-slate-500 relative before:absolute before:left-0 before:right-0 before:top-2 before:h-0.5 before:bg-slate-900">
                  {[
                    { key: 'NEW', label: 'Accepted', active: true },
                    { key: 'PREPARING', label: 'Cooking', active: order.status === 'PREPARING' || order.status === 'READY' },
                    { key: 'READY', label: 'Ready', active: order.status === 'READY' },
                    { key: 'DELIVERED', label: 'Served', active: false }
                  ].map((step, sIdx) => (
                    <div key={sIdx} className="space-y-3 relative z-10">
                      <span className={`w-4 h-4 mx-auto rounded-full border-2 flex items-center justify-center ${
                        step.active ? 'bg-primary border-primary text-slate-950' : 'bg-slate-950 border-slate-900 text-slate-700'
                      }`}>
                        {step.active && <CheckCircle2 className="w-2.5 h-2.5 fill-current shrink-0" />}
                      </span>
                      <span className={step.active ? 'text-slate-200' : 'text-slate-500'}>{step.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-450 pt-3 border-t border-slate-900">
                  <span>Chef Assignment: {order.assignedChefName || 'Assigning...'}</span>
                  <span>Prep duration: ~15 mins</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default LiveDining;
