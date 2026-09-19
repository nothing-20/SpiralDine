import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../../../context/CurrencyContext';
import CustomerHeader from '../../../shared/ui/navigation/CustomerHeader';
import {
  Receipt as ReceiptIcon,
  ArrowLeft,
  Printer,
  RotateCcw,
  CheckCircle2,
  Clock,
  MapPin,
  Utensils,
  ChevronDown,
  ChevronUp,
  Store,
  ShieldCheck,
  CreditCard,
  Building,
  UserCheck,
  Star
} from 'lucide-react';

interface OrderItem {
  itemId?: string;
  name: string;
  count?: number;
  quantity?: number;
  pricePerUnit?: number;
  price?: number;
  notes?: string;
  isVeg?: boolean;
  image?: string;
}

interface TimelineEvent {
  title?: string;
  type?: string;
  timestamp?: string;
  performedBy?: string;
  description?: string;
}

interface CustomerReceiptViewProps {
  order: {
    id: string;
    orderId?: string;
    tenantId?: string;
    restaurantId?: string;
    restaurantName?: string;
    tableNumber?: string | number;
    tableId?: string;
    items?: OrderItem[];
    subtotal?: number;
    tax?: number;
    serviceCharge?: number;
    discount?: number;
    tip?: number;
    total?: number;
    totalAmount?: number;
    status?: string;
    paymentStatus?: string;
    paymentMethods?: Record<string, number>;
    createdAt?: string;
    completedAt?: string;
    customerName?: string;
    phone?: string;
    timeline?: TimelineEvent[];
    assignedChefName?: string;
    [key: string]: any;
  };
  restaurantData?: {
    name?: string;
    restaurantName?: string;
    logoUrl?: string;
    logo?: string;
    address?: any;
    city?: string;
    state?: string;
    fssaiNumber?: string;
    gstNumber?: string;
    phone?: string;
    [key: string]: any;
  } | null;
  tenantId?: string;
}

export const CustomerReceiptView: React.FC<CustomerReceiptViewProps> = ({
  order,
  restaurantData,
  tenantId
}) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [showTimeline, setShowTimeline] = useState(false);

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-left select-none pb-16">
        <div className="print:hidden">
          <CustomerHeader />
        </div>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-8 space-y-4 shadow-sm">
            <ReceiptIcon className="w-12 h-12 text-[#C85A3F] mx-auto" />
            <h2 className="text-lg font-extrabold text-[#202124]">Receipt Data Unavailable</h2>
            <p className="text-xs text-[#756B64]">We could not load the receipt for this order. It may still be processing.</p>
            <button
              type="button"
              onClick={() => navigate('/customer/orders')}
              className="px-5 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Back to My Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Resolved metadata
  const effectiveTenantId = tenantId || order.tenantId || order.restaurantId || '';
  const orderId = order.orderId || order.id || 'N/A';
  const billId = order.billId || (orderId !== 'N/A' ? (orderId.startsWith('BILL-') ? orderId : `BILL-${orderId}`) : 'BILL-CANONICAL');
  const invoiceNumber = order.invoiceNumber || 'INV-OFFICIAL';
  const restaurantName =
    order.restaurantName ||
    restaurantData?.restaurantName ||
    restaurantData?.name ||
    'Restaurant';

  // Address resolution
  const addressObj = restaurantData?.address;
  const street =
    typeof addressObj === 'string'
      ? addressObj
      : addressObj?.street || restaurantData?.street || '';
  const city =
    typeof addressObj === 'object' && addressObj?.city
      ? addressObj.city
      : restaurantData?.city || '';
  const state =
    typeof addressObj === 'object' && addressObj?.state
      ? addressObj.state
      : restaurantData?.state || '';
  const fullAddress = [street, city, state].filter(Boolean).join(', ');

  // Seating / Context
  const rawTable = order.tableNumber !== undefined && String(order.tableNumber).trim() !== ''
    ? String(order.tableNumber) 
    : (order.tableId ? String(order.tableId).replace(/^TBL-/i, '') : 'Walk-in');
  const isWalkIn = rawTable.toLowerCase().includes('walk');
  const seatingLabel = isWalkIn ? 'Walk-in Dining' : `Table #${rawTable}`;

  // Date formatting safely
  const formatTimestamp = (ts?: any) => {
    if (!ts) return 'N/A';
    try {
      let d: Date;
      if (typeof ts?.toDate === 'function') {
        d = ts.toDate();
      } else if (typeof ts?.seconds === 'number') {
        d = new Date(ts.seconds * 1000);
      } else {
        d = new Date(ts);
      }
      if (isNaN(d.getTime())) return String(ts);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(ts);
    }
  };

  const createdFormatted = formatTimestamp(order.createdAt);
  const completedFormatted = order.completedAt ? formatTimestamp(order.completedAt) : null;

  // Stored historical financial values (in paise/cents as stored in Firestore)
  const subtotal = Number(order.subtotal ?? 0);
  const tax = Number(order.tax ?? 0);
  const serviceCharge = Number(order.serviceCharge ?? 0);
  const discount = Number(order.discount ?? 0);
  const tip = Number(order.tip ?? 0);
  const total = Number(order.total ?? order.totalAmount ?? (subtotal + tax + serviceCharge - discount + tip));

  // Payment status & mode
  const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid';
  const paymentStatusLabel = isPaid ? 'Paid' : 'Payment Pending';
  
  // Method detection if present
  const paymentMethodLabel = (() => {
    if (order.paymentMethod) {
      if (order.paymentMethod === 'online') return 'Online Payment (Razorpay)';
      if (order.paymentMethod === 'upi') return 'UPI';
      if (order.paymentMethod === 'card') return 'Credit / Debit Card';
      if (order.paymentMethod === 'netbanking') return 'Netbanking';
      if (order.paymentMethod === 'wallet') return 'Digital Wallet';
      if (order.paymentMethod === 'cash') return 'Cash';
      return String(order.paymentMethod).toUpperCase();
    }
    if (order.paymentMethods) {
      if (order.paymentMethods.cash) return 'Cash';
      if (order.paymentMethods.upi) return 'UPI';
      if (order.paymentMethods.card) return 'Card';
      if (order.paymentMethods.wallet) return 'Wallet';
    }
    return isPaid ? 'Online / Electronic Payment' : 'Counter Settlement';
  })();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-left select-none pb-16">
      {/* 1. TOP CUSTOMER HEADER (Hidden when printing) */}
      <div className="print:hidden">
        <CustomerHeader />
      </div>

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Navigation Breadcrumb & Actions Bar (Hidden when printing) */}
        <div className="flex items-center justify-between print:hidden">
          <button
            type="button"
            onClick={() => navigate('/customer/orders')}
            className="inline-flex items-center space-x-2 text-xs font-bold text-[#756B64] hover:text-[#C85A3F] transition-colors cursor-pointer group py-1.5"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to My Orders</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] hover:text-[#C85A3F] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            {effectiveTenantId && (
              <button
                type="button"
                onClick={() => navigate(`/customer/restaurant/${effectiveTenantId}/menu`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Order Again</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. THE OFFICIAL RECEIPT SLIP CARD */}
        <div
          id="customer-official-receipt"
          className="bg-white border border-[#E5DCD5] rounded-3xl shadow-sm overflow-hidden print:border-none print:shadow-none print:m-0 print:p-0"
        >
          {/* Receipt Top Header Banner */}
          <div className="p-6 md:p-8 bg-[#FCFAF7] border-b border-[#E5DCD5] text-center space-y-3 relative">
            <div className="w-12 h-12 rounded-2xl bg-[#F3E8DF] border border-[#E5DCD5] text-[#C85A3F] flex items-center justify-center mx-auto shadow-2xs">
              <ReceiptIcon className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-display font-black text-[#202124] tracking-tight">
                {restaurantName}
              </h1>
              {fullAddress && (
                <p className="text-xs text-[#756B64] max-w-md mx-auto leading-relaxed flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-[#C85A3F] shrink-0" />
                  <span>{fullAddress}</span>
                </p>
              )}
              {restaurantData?.phone && (
                <p className="text-[11px] text-[#756B64]">Tel: {restaurantData.phone}</p>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-[#2E8B57] border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                  isPaid
                    ? 'bg-emerald-50 text-[#2E8B57] border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <CreditCard className="w-3 h-3" />
                <span>{paymentStatusLabel}</span>
              </span>
            </div>
          </div>

          {/* Receipt Meta Information Grid */}
          <div className="p-6 border-b border-[#E5DCD5] bg-white grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                Order ID
              </span>
              <strong className="font-mono font-bold text-[#202124] text-xs block mt-0.5">
                {orderId}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                Bill ID
              </span>
              <strong className="font-mono font-bold text-[#C85A3F] text-xs block mt-0.5">
                {billId}
              </strong>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                Dining Context
              </span>
              <span className="font-semibold text-[#202124] block mt-0.5">
                {seatingLabel}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                Order Date
              </span>
              <span className="font-semibold text-[#202124] block mt-0.5">
                {createdFormatted}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider block">
                Settlement
              </span>
              <span className="font-semibold text-[#202124] block mt-0.5">
                {paymentMethodLabel}
              </span>
            </div>
          </div>

          {/* Customer / Staff Note (if present) */}
          {(order.customerName || order.assignedChefName) && (
            <div className="px-6 py-3 bg-[#FCFAF7]/60 border-b border-[#E5DCD5] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#756B64]">
              {order.customerName && (
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#C85A3F]" />
                  <span>Diner: <strong className="text-[#202124]">{order.customerName}</strong></span>
                </span>
              )}
              {order.assignedChefName && (
                <span className="flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-[#C85A3F]" />
                  <span>Chef: <strong className="text-[#202124]">{order.assignedChefName}</strong></span>
                </span>
              )}
            </div>
          )}

          {/* Order Items Table */}
          <div className="p-6 md:p-8 space-y-4">
            <h2 className="text-xs font-extrabold text-[#756B64] uppercase tracking-wider">
              Ordered Items
            </h2>

            <div className="divide-y divide-[#E5DCD5]">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => {
                  const qty = Number(item.count || item.quantity || 1);
                  const unitPrice = Number(item.pricePerUnit || item.price || 0);
                  const itemLineTotal = unitPrice * qty;

                  return (
                    <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        {item.isVeg !== undefined && (
                          <span
                            className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-xs border p-0.5 shrink-0 mt-0.5 ${
                              item.isVeg ? 'border-[#2E8B57]' : 'border-[#A94332]'
                            }`}
                            title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.isVeg ? 'bg-[#2E8B57]' : 'bg-[#A94332]'
                              }`}
                            />
                          </span>
                        )}

                        <div className="min-w-0">
                          <h3 className="font-bold text-[#202124] text-sm truncate">
                            {item.name || (item as any).itemName || 'Dish'}
                          </h3>
                          <div className="text-[11px] text-[#756B64] flex items-center gap-2 mt-0.5">
                            <span>Qty: ×{qty}</span>
                            {unitPrice > 0 && (
                              <>
                                <span>•</span>
                                <span>{formatPrice(unitPrice)} each</span>
                              </>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-[#C85A3F] italic mt-0.5">
                              "{item.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="font-mono font-bold text-[#202124] text-sm shrink-0">
                        {formatPrice(itemLineTotal)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-[#756B64]">
                  No item breakdown details recorded.
                </div>
              )}
            </div>

            {/* Financial Breakdown Summary */}
            <div className="pt-4 border-t border-[#E5DCD5] space-y-2 text-xs">
              <div className="flex justify-between text-[#756B64]">
                <span>Subtotal</span>
                <span className="font-semibold text-[#202124] font-mono">
                  {formatPrice(subtotal)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-[#2E8B57]">
                  <span>Discount</span>
                  <span className="font-semibold font-mono">-{formatPrice(discount)}</span>
                </div>
              )}

              {tax > 0 && (
                <div className="flex justify-between text-[#756B64]">
                  <span>VAT / GST</span>
                  <span className="font-semibold text-[#202124] font-mono">
                    {formatPrice(tax)}
                  </span>
                </div>
              )}

              {serviceCharge > 0 && (
                <div className="flex justify-between text-[#756B64]">
                  <span>Service Fee</span>
                  <span className="font-semibold text-[#202124] font-mono">
                    {formatPrice(serviceCharge)}
                  </span>
                </div>
              )}

              {tip > 0 && (
                <div className="flex justify-between text-[#756B64]">
                  <span>Staff Gratuity / Tip</span>
                  <span className="font-semibold text-[#202124] font-mono">
                    {formatPrice(tip)}
                  </span>
                </div>
              )}

              {/* Grand Total Bar */}
              <div className="pt-3 border-t-2 border-[#E5DCD5] flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-black uppercase tracking-wider text-[#202124] block">
                    Total Amount
                  </span>
                  <span className="text-[10.5px] text-[#756B64]">Inclusive of all applicable taxes</span>
                </div>
                <span className="text-2xl font-black text-[#C85A3F] font-mono">
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            {/* Tax & Compliance Disclaimers */}
            {(restaurantData?.fssaiNumber || restaurantData?.gstNumber) && (
              <div className="pt-4 border-t border-[#E5DCD5] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#756B64] uppercase font-mono">
                {restaurantData.gstNumber && <span>GSTIN: {restaurantData.gstNumber}</span>}
                {restaurantData.fssaiNumber && <span>FSSAI: {restaurantData.fssaiNumber}</span>}
              </div>
            )}
          </div>

          {/* Receipt Footer Message */}
          <div className="p-6 bg-[#FCFAF7] border-t border-[#E5DCD5] text-center space-y-1 text-xs text-[#756B64]">
            <p className="font-bold text-[#202124]">
              Thank you for dining with us at {restaurantName}!
            </p>
            <p className="text-[11px]">
              We hope you enjoyed your culinary experience. Please retain this receipt for your records.
            </p>
            {completedFormatted && (
              <p className="text-[10px] text-[#756B64]/70 pt-1">
                Completed on {completedFormatted}
              </p>
            )}
          </div>
        </div>

        {/* 3. OPTIONAL KITCHEN TIMELINE CHRONICLE (Expandable) */}
        {order.timeline && order.timeline.length > 0 && (
          <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 md:p-6 shadow-2xs space-y-4 print:hidden">
            <button
              type="button"
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full flex items-center justify-between text-left cursor-pointer group"
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#C85A3F]" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124] group-hover:text-[#C85A3F] transition-colors">
                  Order Preparation History ({order.timeline.length} steps)
                </h3>
              </div>
              {showTimeline ? (
                <ChevronUp className="w-4 h-4 text-[#756B64]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#756B64]" />
              )}
            </button>

            {showTimeline && (
              <div className="relative pl-6 pt-2 space-y-4 border-l-2 border-[#E5DCD5] ml-2 text-xs">
                {order.timeline.map((evt, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-[#C85A3F] border-2 border-white" />
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-[#202124]">{evt.title || evt.type}</strong>
                        <span className="text-[10px] text-[#756B64]">
                          {evt.timestamp ? formatTimestamp(evt.timestamp) : ''}
                        </span>
                      </div>
                      {evt.performedBy && (
                        <span className="text-[11px] text-[#756B64] block">
                          By: {evt.performedBy}
                        </span>
                      )}
                      {evt.description && (
                        <p className="text-[11px] text-[#756B64]">{evt.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. BOTTOM ACTION STRIP (Hidden when printing) */}
        <div className="p-6 bg-white border border-[#E5DCD5] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs print:hidden">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-[#F3E8DF] text-[#C85A3F] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#202124]">Verified Digital Receipt</h4>
              <p className="text-[11px] text-[#756B64]">
                Authoritative transaction recorded on Spiral Dine ledger.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate(window.location.pathname)}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#FFF8F2] border border-[#C85A3F]/30 hover:border-[#C85A3F] text-[#C85A3F] text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center shrink-0 flex items-center justify-center gap-1.5"
            >
              <Star className="w-3.5 h-3.5 fill-[#C85A3F]" />
              <span>Rate Your Experience</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/orders')}
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] hover:text-[#C85A3F] text-xs font-bold rounded-xl transition-all cursor-pointer text-center shrink-0"
            >
              Back to My Orders
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerReceiptView;
