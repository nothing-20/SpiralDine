import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { IBill } from '../../domain/billing/types';
import { IOrder } from '../../../types';
import { billingService } from '../../services/billingService';
import { generateQrSvg } from '../../utils/qrCode';
import { formatPrice } from '../../utils/format';
import { useCurrency } from '../../../context/CurrencyContext';
import { useAuth } from '../../../context/AuthContext';
import { paymentService } from '../../services/paymentService';
import { 
  Receipt, 
  X, 
  CheckCircle2, 
  Clock, 
  QrCode, 
  DollarSign, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle,
  FileText,
  ArrowRight,
  Info,
  CreditCard,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface ICanonicalBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  orderId: string;
  initialBill?: IBill | null;
  mode?: 'customer' | 'waiter' | 'owner';
  restaurantName?: string;
  restaurantLogo?: string;
  merchantVpa?: string;
  onPaymentSettled?: (bill: IBill) => void;
  onOpenReceipt?: (orderId: string) => void;
}

export const CanonicalBillModal: React.FC<ICanonicalBillModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  orderId,
  initialBill,
  mode = 'customer',
  restaurantName,
  restaurantLogo,
  merchantVpa = 'spiraldine@upi',
  onPaymentSettled,
  onOpenReceipt
}) => {
  const { user } = useAuth();
  const { currency, currencySymbol } = useCurrency();

  const isCustomer = mode === 'customer';
  const [bill, setBill] = useState<IBill | null>(initialBill || null);
  const [isLoading, setIsLoading] = useState(!initialBill);
  const [activeTab, setActiveTab] = useState<'details' | 'upi' | 'cash'>('details');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [isOnlinePaying, setIsOnlinePaying] = useState(false);
  const [onlineStatusText, setOnlineStatusText] = useState<string | null>(null);

  // 1. Real-time authoritative bill subscription with resilient Order fallback
  useEffect(() => {
    if (!isOpen || !tenantId || !orderId) return;

    setIsLoading(true);
    const unsub = billingService.subscribeToCanonicalBill(tenantId, orderId, async (updatedBill) => {
      if (updatedBill) {
        setBill(updatedBill);
        setIsLoading(false);
      } else {
        // Fallback: fetch order document directly from Firestore to construct authoritative draft bill
        try {
          const orderSnap = await getDoc(doc(db, 'restaurants', tenantId, 'orders', orderId));
          if (orderSnap.exists()) {
            const oData = orderSnap.data() as IOrder;
            const subtotal = Number(oData.subtotal || 0);
            const discount = Number(oData.discount || 0);
            const tax = Number(oData.tax || 0);
            const serviceCharge = Number(oData.serviceCharge || 0);
            const tip = Number((oData as any).tip || 0);
            const roundOff = Number(oData.roundOff || 0);
            const total = Number(oData.total || (subtotal - discount + tax + serviceCharge + tip + roundOff));

            const draftBill: IBill = {
              id: billingService.getCanonicalBillId(orderId),
              billId: billingService.getCanonicalBillId(orderId),
              orderId,
              tenantId,
              tableNumber: String(oData.tableNumber || (oData.tableId ? String(oData.tableId).replace(/^TBL-/i, '') : 'Walk-in')),
              tableId: oData.tableId,
              items: oData.items || [],
              subtotal,
              discount,
              tax,
              taxPercent: (oData as any).taxPercent || 8,
              serviceCharge,
              serviceChargePercent: (oData as any).serviceChargePercent || 5,
              tip,
              roundOff,
              total,
              invoiceNumber: oData.invoiceNumber || `INV-${orderId}`,
              restaurantName: restaurantName || (oData as any).restaurantName || '',
              paymentStatus: (oData.paymentStatus || 'pending') as any,
              paymentMethods: oData.paymentMethods || { cash: 0, upi: 0, card: 0, wallet: 0 },
              createdAt: oData.createdAt || new Date().toISOString()
            };
            setBill(draftBill);
          }
        } catch (orderFetchErr) {
          console.warn('[CanonicalBillModal] Draft bill construction warning:', orderFetchErr);
        }
        setIsLoading(false);
      }
    });

    return () => unsub();
  }, [isOpen, tenantId, orderId, restaurantName]);

  // Set default tab based on bill status
  useEffect(() => {
    if (bill?.paymentStatus === 'paid') {
      setActiveTab('details');
    }
  }, [bill?.paymentStatus]);

  // UPI configuration & Intent URI
  const vpa = merchantVpa || 'spiraldine@upi';
  const payeeName = restaurantName || bill?.restaurantName || 'Spiral Dine Restaurant';
  const totalInCents = bill?.total || 0;

  const { uri: upiUri } = useMemo(() => {
    return billingService.generateUpiUri({
      vpa,
      payeeName,
      amountInCents: totalInCents,
      billId: bill?.billId || billingService.getCanonicalBillId(orderId),
      orderId,
      tableNumber: bill?.tableNumber,
      currency: bill?.currency || currency || 'INR'
    });
  }, [vpa, payeeName, totalInCents, bill, orderId, currency]);

  // Generate clean SVG for QR Code
  const qrSvg = useMemo(() => {
    if (!upiUri) return '';
    return generateQrSvg(upiUri, 220);
  }, [upiUri]);

  // Copy UPI string or VPA
  const handleCopyVpa = () => {
    navigator.clipboard.writeText(vpa);
    setCopiedUpi(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Staff/Owner Manual Payment Settlement Confirmation (Never accessible to customer)
  const handleConfirmSettlement = async (method: 'cash' | 'upi') => {
    if (isCustomer) {
      toast.error('Payment confirmation is restricted to authorized restaurant staff.');
      return;
    }

    if (!tenantId || !bill) return;

    // Idempotency check: prevent duplicate settlement
    if (bill.paymentStatus === 'paid') {
      toast.error('Payment already completed');
      return;
    }

    if (isSettling) return; // Prevent double clicking

    setIsSettling(true);
    try {
      const actorName = user?.displayName || user?.email || (mode === 'waiter' ? 'Staff Waiter' : 'Restaurant Owner');
      const actorRole = user?.role || mode;
      const actorUid = user?.uid || 'staff-uid';

      const res = await billingService.settleBillPayment(tenantId, bill.billId || orderId, {
        method,
        transactionRef: method === 'upi' ? `DEMO-MANUAL-UPI-${Date.now().toString(36).toUpperCase()}` : `MANUAL-CASH-${Date.now().toString(36).toUpperCase()}`,
        actor: {
          uid: actorUid,
          displayName: actorName,
          email: user?.email || '',
          role: actorRole
        }
      });

      setBill(res.bill);
      toast.success(method === 'cash' ? 'Cash payment confirmed & bill settled!' : 'UPI Demo payment confirmed & bill settled!', { icon: '✅' });
      if (onPaymentSettled) onPaymentSettled(res.bill);
    } catch (err: any) {
      console.error('[CanonicalBillModal] Settlement error:', err);
      const errMsg = err?.message || '';
      if (errMsg.includes('already completed')) {
        toast.error('Payment already completed');
      } else if (errMsg.includes('permission') || errMsg.includes('PERMISSION_DENIED') || err?.code === 'permission-denied') {
        toast.error('Notice: In accordance with restaurant security rules, payment confirmation requires authorized staff verification.');
      } else {
        toast.error(errMsg || 'Failed to settle payment.');
      }
    } finally {
      setIsSettling(false);
    }
  };

  // Customer Online Payment via Razorpay Test Mode Gateway
  const handlePayOnline = async () => {
    if (!tenantId || !orderId) return;

    if (bill?.paymentStatus === 'paid') {
      toast.error('Payment already completed');
      return;
    }

    if (isOnlinePaying) return;

    setIsOnlinePaying(true);
    setOnlineStatusText('Initializing secure payment session...');

    try {
      // 1. Create order on server (authoritative canonical amount enforcement)
      setOnlineStatusText('Connecting to payment gateway...');
      const orderRes = await paymentService.createPaymentOrder(
        tenantId,
        orderId,
        bill?.billId,
        {
          id: user?.uid || (bill as any)?.customerId || 'guest_diner',
          name: user?.displayName || bill?.customerName || 'Guest Diner',
          email: user?.email || '',
          phone: (user as any)?.phone || bill?.customerPhone || ''
        }
      );

      // 2. Open Razorpay Checkout modal
      setOnlineStatusText('Opening Razorpay Test Checkout...');
      const razorpayKey = (orderRes.rawResponse as any)?.keyId || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || '';

      const checkoutResult = await paymentService.openRazorpayCheckout({
        key: razorpayKey,
        amount: orderRes.amountInCents,
        currency: orderRes.currency || 'INR',
        name: 'Spiral Dine',
        description: `Order #${orderId} - Bill Settlement`,
        order_id: orderRes.providerOrderId,
        prefill: {
          name: user?.displayName || bill?.customerName || 'Guest Diner',
          email: user?.email || '',
          contact: (user as any)?.phone || bill?.customerPhone || ''
        },
        theme: {
          color: '#C85A3F'
        }
      });

      if (checkoutResult.dismissed) {
        toast('Payment checkout closed.', { icon: 'ℹ️' });
        return;
      }

      if (!checkoutResult.success || !checkoutResult.razorpay_payment_id) {
        toast.error(checkoutResult.error?.message || 'Payment was not completed.');
        return;
      }

      // 3. Verify payment authoritatively server-side upon modal completion
      setOnlineStatusText('Verifying payment with gateway...');
      const verifyRes = await paymentService.verifyPayment(
        tenantId,
        orderId,
        bill?.billId || orderRes.providerOrderId,
        orderRes.providerOrderId,
        {
          razorpay_order_id: checkoutResult.razorpay_order_id || orderRes.providerOrderId,
          razorpay_payment_id: checkoutResult.razorpay_payment_id,
          razorpay_signature: checkoutResult.razorpay_signature
        }
      );

      if (verifyRes.success) {
        toast.success('Payment verified & bill settled successfully!', { icon: '🎉' });
        if (onPaymentSettled && bill) {
          onPaymentSettled({
            ...bill,
            paymentStatus: 'paid',
            paidAt: verifyRes.verifiedAt,
            transactionRef: verifyRes.paymentReference
          });
        }
      } else if (verifyRes.status === 'PENDING') {
        toast('Payment is processing. Updates will sync automatically.', { icon: '⏳' });
      } else {
        toast.error(verifyRes.failureReason || 'Payment was not completed.');
      }
    } catch (err: any) {
      console.error('[CanonicalBillModal] Online payment error:', err);
      toast.error(err.message || 'Payment initiation failed.');
    } finally {
      setIsOnlinePaying(false);
      setOnlineStatusText(null);
    }
  };

  if (!isOpen) return null;

  const isPaid = (bill?.paymentStatus || '').toLowerCase() === 'paid';
  const tableLabel = bill?.tableNumber ? (bill.tableNumber.toLowerCase().includes('walk') ? 'Walk-in' : `Table ${bill.tableNumber}`) : 'Dine-in Table';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn select-none">
      <div 
        className="bg-white border border-[#E5DCD5] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left animate-scaleUp"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#FCFAF7] border-b border-[#E5DCD5] flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#F3E8DF] border border-[#E5DCD5] text-[#C85A3F] flex items-center justify-center shrink-0 shadow-2xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#202124] truncate">
                  {restaurantName || bill?.restaurantName || 'Restaurant Bill'}
                </h3>
                <span className="text-[10px] bg-white border border-[#E5DCD5] px-2 py-0.5 rounded-full text-[#756B64] font-bold shrink-0">
                  {tableLabel}
                </span>
              </div>
              <p className="text-[11px] text-[#756B64] font-mono mt-0.5">
                {bill?.billId || billingService.getCanonicalBillId(orderId)} • Order #{orderId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#756B64] hover:text-[#C85A3F] flex items-center justify-center transition-all cursor-pointer shrink-0"
            aria-label="Close bill"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Strip */}
        <div className={`px-6 py-2.5 border-b flex items-center justify-between text-xs font-bold ${
          isPaid 
            ? 'bg-emerald-50 text-[#2E8B57] border-emerald-200' 
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          <div className="flex items-center space-x-2">
            {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4 animate-pulse" />}
            <span>{isPaid ? 'PAYMENT COMPLETED' : 'PAYMENT PENDING'}</span>
          </div>
          <span className="font-mono text-sm font-black">
            {formatPrice(totalInCents)}
          </span>
        </div>

        {/* Navigation Tabs (if not paid) */}
        {!isPaid && (
          <div className="flex border-b border-[#E5DCD5] bg-[#FCFAF7] text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
                activeTab === 'details'
                  ? 'border-[#C85A3F] text-[#C85A3F] bg-white'
                  : 'border-transparent text-[#756B64] hover:text-[#202124]'
              }`}
            >
              Bill Breakdown
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upi')}
              className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'upi'
                  ? 'border-[#C85A3F] text-[#C85A3F] bg-white'
                  : 'border-transparent text-[#756B64] hover:text-[#202124]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{isCustomer ? 'UPI Payment' : 'UPI — Demo'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cash')}
              className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'cash'
                  ? 'border-[#C85A3F] text-[#C85A3F] bg-white'
                  : 'border-transparent text-[#756B64] hover:text-[#202124]'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{isCustomer ? 'Cash' : 'Cash Collection'}</span>
            </button>
          </div>
        )}

        {/* Body Content (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isLoading && !bill ? (
            <div className="py-12 text-center text-xs text-[#756B64]">
              <Clock className="w-6 h-6 animate-spin mx-auto text-[#C85A3F] mb-2" />
              Loading canonical bill details...
            </div>
          ) : isPaid ? (
            /* Genuine Success State: Post Settlement Confirmation (Updated in real-time across all screens) */
            <div className="space-y-4 text-left">
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#2E8B57] shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-emerald-950">Payment Successful</h4>
                    <p className="text-xs text-emerald-700">Bill settled successfully.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-emerald-200/70">
                  <div>
                    <span className="text-[#52606D] block text-[10.5px]">Bill Number</span>
                    <strong className="font-mono text-[#202124]">{bill?.billId || billingService.getCanonicalBillId(orderId)}</strong>
                  </div>
                  <div>
                    <span className="text-[#52606D] block text-[10.5px]">Amount Paid</span>
                    <strong className="font-mono text-[#16845B] text-sm">{formatPrice(totalInCents)}</strong>
                  </div>
                  <div>
                    <span className="text-[#52606D] block text-[10.5px]">Payment Method</span>
                    <strong className="text-[#202124]">
                      {bill?.paymentMethod ? (
                        bill.paymentMethod === 'upi' ? 'UPI' :
                        bill.paymentMethod === 'card' ? 'Credit / Debit Card' :
                        bill.paymentMethod === 'netbanking' ? 'Netbanking' :
                        bill.paymentMethod === 'online' ? 'Online Gateway (Razorpay)' :
                        bill.paymentMethod.toUpperCase()
                      ) : 'Settled'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#52606D] block text-[10.5px]">Paid At</span>
                    <strong className="text-[#202124]">
                      {bill?.paidAt ? new Date(bill.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Today'}
                    </strong>
                  </div>
                </div>

                {bill?.transactionRef && (
                  <div className="pt-2 border-t border-emerald-200/70 text-[10.5px] text-[#52606D]">
                    <span>Reference: </span>
                    <strong className="font-mono text-[#202124]">{bill.transactionRef}</strong>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenReceipt) onOpenReceipt(orderId);
                  }}
                  className="flex-1 py-3 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Back to Order
                </button>
              </div>
            </div>
          ) : activeTab === 'upi' ? (
            /* UPI Payment View */
            <div className="space-y-4 text-center">
              {/* Dynamic QR Code Box */}
              <div className="p-4 bg-white border border-[#E5DCD5] rounded-3xl w-56 h-56 mx-auto flex items-center justify-center shadow-xs">
                {qrSvg ? (
                  <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="w-full h-full" />
                ) : (
                  <div className="text-xs text-[#756B64]">Generating QR...</div>
                )}
              </div>

              {/* Text Below QR */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-[#202124]">Pay with UPI</h4>
                <p className="text-xs text-[#756B64]">Scan this QR code using any UPI app</p>
              </div>

              {/* Details and Payee Information */}
              <div className="p-3.5 bg-[#FCFAF7] border border-[#E5DCD5] rounded-2xl text-left space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#756B64]">Merchant VPA:</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono font-bold text-[#202124]">{vpa}</span>
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="p-1 hover:bg-white rounded-md text-[#756B64] hover:text-[#C85A3F] cursor-pointer"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#2E8B57]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E5DCD5]">
                  <span className="text-[#756B64]">Payee:</span>
                  <span className="font-semibold text-[#202124]">{payeeName}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E5DCD5]">
                  <span className="text-[#756B64]">Payable Amount:</span>
                  <span className="font-mono font-black text-base text-[#C85A3F]">
                    {formatPrice(totalInCents)}
                  </span>
                </div>
              </div>

              {/* Open in UPI App link */}
              <a
                href={upiUri}
                className="inline-flex items-center justify-center space-x-1.5 w-full py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold rounded-xl transition-all shadow-2xs"
              >
                <span>Open Supported UPI App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Online Payment Option for Customer */}
              {isCustomer && (
                <button
                  type="button"
                  disabled={isOnlinePaying}
                  onClick={handlePayOnline}
                  className="w-full py-3.5 bg-gradient-to-r from-[#C85A3F] to-[#E26D50] hover:from-[#B54D34] hover:to-[#C85A3F] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#C85A3F]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isOnlinePaying ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>{onlineStatusText || 'Connecting to Razorpay...'}</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pay Online via Gateway (Razorpay Test Mode)</span>
                    </>
                  )}
                </button>
              )}

              {/* Notice Area: Differentiated by Role */}
              {isCustomer ? (
                /* Customer View: Explanation of Razorpay Test Mode Gateway */
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-left flex items-start gap-2.5 text-xs text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="font-bold flex items-center gap-1.5">
                      <span>Razorpay Test Mode Online Payment</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-full border border-blue-300 uppercase">Test Mode</span>
                    </strong>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Click <strong>Pay Online via Gateway</strong> to open the Razorpay Checkout modal and complete payment using test Cards, UPI, or Netbanking. Your bill will be verified and settled in real-time.
                    </p>
                  </div>
                </div>
              ) : (
                /* Staff / Owner View: Explicit Manual Settlement Confirmation */
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    disabled={isSettling}
                    onClick={() => handleConfirmSettlement('upi')}
                    className="w-full py-3.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#C85A3F]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSettling ? 'Recording Settlement...' : `Confirm UPI Payment Received`}</span>
                  </button>
                  <p className="text-[10px] text-[#756B64] text-center">
                    Verify the credit alert/SMS on the merchant device before confirming.
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === 'cash' ? (
            /* Cash View */
            <div className="space-y-4 text-left">
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-1 text-xs">
                <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-700" />
                  <span>Cash Payment</span>
                </h4>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  {isCustomer 
                    ? 'Please pay the amount to the restaurant staff.' 
                    : `Collect physical cash of ${formatPrice(totalInCents)} from the customer.`}
                </p>
              </div>

              <div className="p-4 bg-white border border-[#E5DCD5] rounded-2xl space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#756B64]">Total Bill Amount:</span>
                  <span className="font-mono font-bold text-sm text-[#202124]">
                    {formatPrice(totalInCents)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#756B64]">Table:</span>
                  <span className="font-bold text-[#202124]">{tableLabel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#756B64]">Bill Number:</span>
                  <span className="font-mono font-bold text-[#202124]">{bill?.billId || billingService.getCanonicalBillId(orderId)}</span>
                </div>
                {!isCustomer && (
                  <div className="flex justify-between items-center pt-2 border-t border-[#E5DCD5]">
                    <span className="text-[#756B64]">Operator / Cashier:</span>
                    <span className="font-semibold text-[#202124]">
                      {user?.displayName || user?.email || (mode === 'waiter' ? 'Staff Waiter' : 'Restaurant Owner')}
                    </span>
                  </div>
                )}
              </div>

              {isCustomer ? (
                /* Customer Guidance Notice */
                <div className="p-3.5 bg-[#FCFAF7] border border-[#E5DCD5] rounded-2xl flex items-start gap-2.5 text-xs text-[#756B64]">
                  <Info className="w-4 h-4 text-[#C85A3F] shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed text-[#52606D]">
                    Cash payment will be confirmed by restaurant staff. Please hand physical cash of <strong>{formatPrice(totalInCents)}</strong> to your server or at the cashier desk. Once recorded, your official tax receipt will be available immediately.
                  </p>
                </div>
              ) : (
                /* Staff Confirmation Control */
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isSettling}
                    onClick={() => handleConfirmSettlement('cash')}
                    className="w-full py-3.5 bg-[#2E8B57] hover:bg-[#246B43] text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSettling ? 'Recording Settlement...' : `Confirm Cash Received`}</span>
                  </button>
                  <p className="text-[10px] text-[#756B64] text-center mt-1.5">
                    Confirm only after cash has been physically received.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Details & Bill Breakdown View */
            <div className="space-y-4">
              {/* Ordered Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-[#756B64] uppercase tracking-wider">
                  Ordered Dishes ({bill?.items?.length || 0})
                </h4>
                <div className="divide-y divide-[#E5DCD5] bg-white border border-[#E5DCD5] rounded-2xl p-3 sm:p-4 text-xs">
                  {bill?.items && bill.items.length > 0 ? (
                    bill.items.map((item, idx) => {
                      const qty = Number(item.count || (item as any).quantity || 1);
                      const unitPrice = Number(item.pricePerUnit || (item as any).price || 0);
                      const lineTotal = unitPrice * qty;

                      return (
                        <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              {item.isVeg !== undefined && (
                                <span className={`w-2 h-2 rounded-full shrink-0 ${item.isVeg ? 'bg-[#2E8B57]' : 'bg-[#A94332]'}`} />
                              )}
                              <span className="font-bold text-[#202124] truncate">{item.name}</span>
                            </div>
                            <span className="text-[11px] text-[#756B64] block mt-0.5">
                              ×{qty} @ {formatPrice(unitPrice)} each
                            </span>
                            {item.notes && (
                              <p className="text-[10px] text-[#C85A3F] italic mt-0.5">"{item.notes}"</p>
                            )}
                          </div>
                          <span className="font-mono font-bold text-[#202124] shrink-0">
                            {formatPrice(lineTotal)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-3 text-center text-xs text-[#756B64]">No items recorded in bill.</div>
                  )}
                </div>
              </div>

              {/* Financial Calculation Summary */}
              <div className="p-4 bg-[#FCFAF7] border border-[#E5DCD5] rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-[#756B64]">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-[#202124]">{formatPrice(bill?.subtotal || 0)}</span>
                </div>

                {Boolean(bill?.discount && bill.discount > 0) && (
                  <div className="flex justify-between text-[#2E8B57]">
                    <span>Discount {bill?.discountLabel ? `(${bill.discountLabel})` : ''}</span>
                    <span className="font-mono font-semibold">-{formatPrice(bill?.discount || 0)}</span>
                  </div>
                )}

                {Boolean(bill?.tax && bill.tax > 0) && (
                  <div className="flex justify-between text-[#756B64]">
                    <span>Tax ({bill?.taxPercent || 8}%)</span>
                    <span className="font-mono font-semibold text-[#202124]">{formatPrice(bill?.tax || 0)}</span>
                  </div>
                )}

                {Boolean(bill?.serviceCharge && bill.serviceCharge > 0) && (
                  <div className="flex justify-between text-[#756B64]">
                    <span>Service Fee ({bill?.serviceChargePercent || 5}%)</span>
                    <span className="font-mono font-semibold text-[#202124]">{formatPrice(bill?.serviceCharge || 0)}</span>
                  </div>
                )}

                {Boolean(bill?.tip && bill.tip > 0) && (
                  <div className="flex justify-between text-[#756B64]">
                    <span>Staff Tip / Gratuity</span>
                    <span className="font-mono font-semibold text-[#202124]">{formatPrice(bill?.tip || 0)}</span>
                  </div>
                )}

                <div className="pt-2 border-t-2 border-[#E5DCD5] flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-black uppercase text-[#202124] block">Grand Total</span>
                    <span className="text-[10px] text-[#756B64]">Inclusive of all charges</span>
                  </div>
                  <span className="text-xl font-black text-[#C85A3F] font-mono">
                    {formatPrice(totalInCents)}
                  </span>
                </div>
              </div>

              {/* Action to proceed to payment */}
              {!isPaid && (
                <div className="pt-1 space-y-2">
                  {isCustomer ? (
                    <>
                      <button
                        type="button"
                        disabled={isOnlinePaying}
                        onClick={handlePayOnline}
                        className="w-full py-3.5 bg-gradient-to-r from-[#C85A3F] to-[#E26D50] hover:from-[#B54D34] hover:to-[#C85A3F] text-white text-xs font-extrabold rounded-xl shadow-md shadow-[#C85A3F]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isOnlinePaying ? (
                          <>
                            <Clock className="w-4 h-4 animate-spin" />
                            <span>{onlineStatusText || 'Connecting to Razorpay...'}</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>Pay Online (UPI / Card / Netbanking)</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('upi')}
                        className="w-full py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#C85A3F]" />
                        <span>Other Options (Manual UPI QR / Cash)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('upi')}
                      className="w-full py-3 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Proceed to Settlement Options</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 bg-[#FCFAF7] border-t border-[#E5DCD5] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {isPaid ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenReceipt) onOpenReceipt(orderId);
                }}
                className="px-4 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Receipt</span>
              </button>
            ) : isCustomer ? (
              <button
                type="button"
                disabled={isOnlinePaying}
                onClick={handlePayOnline}
                className="px-5 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isOnlinePaying ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Online</span>
                  </>
                )}
              </button>
            ) : (
              activeTab !== 'cash' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('cash')}
                  className="px-5 py-2.5 bg-[#2E8B57] hover:bg-[#246B43] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Record Cash</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanonicalBillModal;
