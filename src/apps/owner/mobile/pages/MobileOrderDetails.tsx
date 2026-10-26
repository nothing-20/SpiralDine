import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  CreditCard, 
  Receipt, 
  ChefHat, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Share2
} from 'lucide-react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import MobileStatusBadge from '../components/MobileStatusBadge';
import MobileCard from '../components/MobileCard';

export const MobileOrderDetails: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, formatPrice } = useCurrency();
  const tenantId = user?.tenantId;

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!tenantId || !orderId) {
      setLoading(false);
      return;
    }

    const orderDocRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
    const unsubscribe = onSnapshot(orderDocRef, (snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() });
      } else {
        setOrder(null);
      }
      setLoading(false);
    }, (err) => {
      console.warn('[MobileOrderDetails] Snapshot error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId, orderId]);

  const updateOrderStatus = async (newStatus: string) => {
    if (!tenantId || !orderId) return;
    setUpdating(true);
    try {
      const orderDocRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
      await updateDoc(orderDocRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(newStatus === 'COMPLETED' ? { completedAt: new Date().toISOString() } : {}),
      });
      setShowCancelModal(false);
    } catch (e) {
      console.error('[MobileOrderDetails] Update error:', e);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] p-4 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#FF7518] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#707070] font-medium">Loading order details...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-[#9E9E9E] mb-3" />
        <h2 className="text-base font-bold text-[#202124]">Order Not Found</h2>
        <p className="text-xs text-[#707070] mt-1 mb-4">This order may have been removed or does not exist.</p>
        <button
          onClick={() => navigate('/owner/orders')}
          className="px-4 py-2 bg-[#FF7518] text-white text-xs font-bold rounded-xl"
        >
          Return to Orders
        </button>
      </div>
    );
  }

  const orderNum = order.orderNumber || `#${order.id.slice(-5).toUpperCase()}`;
  const statusUpper = String(order.status || '').toUpperCase();
  const tableText = order.tableNumber ? `Table ${order.tableNumber}` : (order.diningOption || 'Dine-In');
  const subtotal = Number(order.subtotal || order.subTotal || (order.total ? order.total * 0.9 : 0));
  const tax = Number(order.tax || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.total || order.totalAmount || 0);
  const isPaid = order.paymentStatus === 'paid' || order.isPaid === true;

  // Timeline steps
  const steps = [
    { label: 'Placed', done: true },
    { label: 'Preparing', done: ['PREPARING', 'READY', 'SERVED', 'COMPLETED'].includes(statusUpper) },
    { label: 'Ready', done: ['READY', 'SERVED', 'COMPLETED'].includes(statusUpper) },
    { label: 'Completed', done: ['SERVED', 'COMPLETED'].includes(statusUpper) },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/orders')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB] transition-colors"
          aria-label="Back to orders"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="font-extrabold text-sm text-[#202124]">{orderNum}</h1>
          <span className="text-[11px] text-[#707070]">{tableText}</span>
        </div>

        <div className="w-9 flex items-center justify-end">
          <MobileStatusBadge status={order.status || 'PENDING'} size="sm" />
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Timeline Progression Bar */}
        <MobileCard className="py-3">
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute top-3 left-6 right-6 h-0.5 bg-[#EBEBEB] -z-0" />
            {steps.map((step, idx) => (
              <div key={idx} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.done
                      ? 'bg-[#FF7518] text-white ring-4 ring-[#FFF4EE]'
                      : 'bg-white border border-[#D1D5DB] text-[#9E9E9E]'
                  }`}
                >
                  {step.done ? '✓' : idx + 1}
                </div>
                <span className={`text-[10px] mt-1 font-semibold ${step.done ? 'text-[#FF7518]' : 'text-[#9E9E9E]'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </MobileCard>

        {/* Customer & Fulfillment Info */}
        <MobileCard className="space-y-2.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider">Customer & Table</h3>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#F7F7F7] text-[#707070] flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-[#9E9E9E]">Guest Name</div>
                <div className="text-xs font-bold text-[#202124] truncate">{order.customerName || 'Dine-In Customer'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#F7F7F7] text-[#707070] flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-[#9E9E9E]">Location / Table</div>
                <div className="text-xs font-bold text-[#202124] truncate">{tableText}</div>
              </div>
            </div>
          </div>
        </MobileCard>

        {/* Ordered Line Items */}
        <MobileCard className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#F5F5F5] pb-2">
            <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider">Ordered Items</h3>
            <span className="text-xs text-[#9E9E9E]">
              {order.items?.length || 0} items
            </span>
          </div>

          <div className="divide-y divide-[#F5F5F5]">
            {order.items?.map((item: any, i: number) => {
              const qty = Number(item.count || item.quantity || 1);
              const unitPrice = Number(item.pricePerUnit || item.price || 0);
              const itemTotal = unitPrice * qty;
              return (
                <div key={i} className="py-2.5 flex items-start justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-[#FFF4EE] text-[#FF7518] text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {qty}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-[#202124] leading-snug">{item.name}</div>
                      {item.notes && (
                        <div className="text-[10px] text-[#FF7518] italic mt-0.5">"{item.notes}"</div>
                      )}
                      <div className="text-[11px] text-[#707070] mt-0.5">{formatPrice(unitPrice)} each</div>
                    </div>
                  </div>
                  <span className="font-bold text-xs text-[#202124] flex-shrink-0">
                    {formatPrice(itemTotal)}
                  </span>
                </div>
              );
            })}
          </div>
        </MobileCard>

        {/* Financial Breakdown */}
        <MobileCard className="space-y-2">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider mb-2">Payment Summary</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-[#707070]">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[#16A34A]">
                <span>Discount</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#707070]">
              <span>Taxes & Fees</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-[#202124] pt-2 border-t border-[#F5F5F5]">
              <span>Total Bill</span>
              <span className="text-[#FF7518]">{formatPrice(total)}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#707070]">
              <CreditCard className="w-3.5 h-3.5" />
              <span>{order.paymentMethod || 'Pay at Counter / UPI'}</span>
            </div>
            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
              isPaid ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEF3C7] text-[#D97706]'
            }`}>
              {isPaid ? 'Paid' : 'Payment Pending'}
            </span>
          </div>
        </MobileCard>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-[#EBEBEB] p-3 pb-safe select-none shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex items-center gap-2">
          {statusUpper !== 'CANCELLED' && statusUpper !== 'COMPLETED' && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={updating}
              className="px-3.5 py-3 rounded-xl border border-[#FCA5A5] text-[#DC2626] font-bold text-xs hover:bg-[#FEE2E2]/50 transition-colors"
            >
              Cancel
            </button>
          )}

          {(statusUpper === 'PENDING' || statusUpper === 'NEW') && (
            <button
              onClick={() => updateOrderStatus('PREPARING')}
              disabled={updating}
              className="flex-1 py-3 bg-[#FF7518] hover:bg-[#E05D07] text-white font-bold text-xs rounded-xl shadow-md shadow-[#FF7518]/25 flex items-center justify-center gap-2"
            >
              <ChefHat className="w-4 h-4" />
              <span>Accept & Start Cooking</span>
            </button>
          )}

          {statusUpper === 'PREPARING' && (
            <button
              onClick={() => updateOrderStatus('READY')}
              disabled={updating}
              className="flex-1 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Food Ready</span>
            </button>
          )}

          {statusUpper === 'READY' && (
            <button
              onClick={() => updateOrderStatus('COMPLETED')}
              disabled={updating}
              className="flex-1 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs rounded-xl shadow-md shadow-green-500/25 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete & Close Order</span>
            </button>
          )}

          {(statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED') && (
            <div className="w-full text-center py-2 text-xs font-semibold text-[#707070]">
              This order is closed ({statusUpper.toLowerCase()}).
            </div>
          )}
        </div>
      </div>

      {/* Cancel Order Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 space-y-3 shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
              <XCircle className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-sm text-[#202124]">Cancel Order?</h3>
              <p className="text-xs text-[#707070] mt-1">
                Are you sure you want to cancel order {orderNum}? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Go Back
              </button>
              <button
                onClick={() => updateOrderStatus('CANCELLED')}
                disabled={updating}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileOrderDetails;
