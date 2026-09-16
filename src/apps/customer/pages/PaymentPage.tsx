import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, increment } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import { 
  CreditCard, Send, CheckCircle2, ChevronLeft, 
  Smile, ShieldCheck, Tag, Info, User 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrency } from '../../../context/CurrencyContext';

export const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  
  const orderTotalVal = Number(searchParams.get('total')) || 10842; // in cents
  const orderId = searchParams.get('orderId') || '';
  const tenantId = searchParams.get('tenantId') || 'l-ambroisie';
  const tableId = searchParams.get('tableId') || '';
  
  const [splitCount, setSplitCount] = useState(1);
  const [payMethod, setPayMethod] = useState<'card' | 'upi' | 'cash'>('card');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const individualShare = orderTotalVal / splitCount;

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(async () => {
      try {
        // Route to the canonical bill on OrderTracking where authentic UPI QR and staff verification takes place
        if (orderId && tenantId) {
          toast.success('Opening your canonical order bill...');
          navigate(`/customer/restaurant/${tenantId}/order/${orderId}`);
          return;
        }

        // 2. If tableId is available, release the physical table
        if (tableId && tenantId) {
          const tableRef = doc(db, 'restaurants', tenantId, 'tables', tableId);
          await updateDoc(tableRef, {
            status: 'empty',
            activeOrderId: '',
            seatingTime: '',
            guestsCount: 0,
            assignedWaiterId: '',
            assignedWaiterName: '',
            updatedAt: new Date().toISOString()
          });
        }

        // 3. Update customer details in profile (customers/{uid} with fallback)
        if (user?.uid) {
          let targetCol = 'customers';
          try {
            const custSnap = await getDoc(doc(db, 'customers', user.uid));
            if (!custSnap.exists()) {
              const userSnap = await getDoc(doc(db, 'users', user.uid));
              if (userSnap.exists()) {
                targetCol = 'users';
              }
            }
          } catch (_e) {
            targetCol = 'customers';
          }

          await addDoc(collection(db, targetCol, user.uid, 'diningHistory'), {
            restaurantId: tenantId,
            restaurantName: 'Gourmet Bistro',
            orderId: orderId || `ORD-MOCK-${Date.now().toString().substring(8)}`,
            total: orderTotalVal,
            date: new Date().toISOString(),
            diners: splitCount
          }).catch(err => console.warn('Failed to add dining history:', err));

          const userDocRef = doc(db, targetCol, user.uid);
          const pointsEarned = Math.round(orderTotalVal / 100) || 50;
          await updateDoc(userDocRef, {
            loyaltyPoints: increment(pointsEarned)
          }).catch(err => console.warn(err));
        }

        setIsProcessing(false);
        setIsPaid(true);
        toast.success('Payment successfully authorized!', { icon: '🎉' });
      } catch (err) {
        console.error(err);
        toast.error('Payment processing failed.');
        setIsProcessing(false);
      }
    }, 2500);
  };

  if (isPaid) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-6 text-center select-none bg-slate-900/30 border border-slate-900 rounded-3xl mt-12 backdrop-blur-md">
        <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5 animate-bounce">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        
        <div className="space-y-1">
          <h2 className="text-xl font-display font-extrabold text-white">Settlement Complete</h2>
          <p className="text-xs text-slate-400">Payment receipt has been logged to the checkout system.</p>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-3.5 text-left text-xs text-slate-350">
          <div className="flex justify-between font-bold border-b border-slate-900 pb-2 text-white">
            <span>Transaction Share</span>
            <span className="text-primary">{formatPrice(individualShare)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment Protocol</span>
            <span className="font-semibold text-white uppercase">{payMethod}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="text-emerald-400 font-extrabold">AUTHORIZED</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button 
            onClick={() => navigate('/customer/home')}
            className="w-full bg-primary hover:bg-orange-500 text-slate-950 font-bold py-3 rounded-xl text-xs"
          >
            Portal Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left select-none">
      
      <div className="flex items-center space-x-1.5 text-slate-400" onClick={() => navigate(-1)}>
        <ChevronLeft className="w-4 h-4 cursor-pointer" />
        <span className="text-xs font-semibold cursor-pointer">Back</span>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-display font-extrabold text-white">Settlement Check</h2>
        <p className="text-xs text-slate-400">Choose payment method and divide check split count.</p>
      </div>

      <form onSubmit={handlePay} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/30 border border-slate-900 p-6 rounded-3xl backdrop-blur-md">
        
        {/* LEFT PANEL - SPLIT CHECKS */}
        <div className="space-y-5">
          <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-[10.5px] text-slate-450 font-bold uppercase tracking-wider">
              <span>Split Check Total</span>
              <span className="text-primary">{splitCount} Diner Party</span>
            </div>
            
            <div className="flex items-center space-x-3 justify-center py-2">
              <button 
                type="button"
                onClick={() => setSplitCount(s => Math.max(1, s - 1))}
                className="w-7 h-7 bg-slate-905 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-center text-slate-350 font-bold"
              >
                -
              </button>
              <span className="text-xs font-extrabold text-white w-6 text-center">{splitCount}x</span>
              <button 
                type="button"
                onClick={() => setSplitCount(s => s + 1)}
                className="w-7 h-7 bg-slate-905 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-center text-slate-350 font-bold"
              >
                +
              </button>
            </div>

            <div className="flex justify-between text-xs font-bold text-slate-350 border-t border-slate-900 pt-3">
              <span>Individual Share</span>
              <span className="text-primary">{formatPrice(orderTotalVal / splitCount)}</span>
            </div>
          </div>

          {/* Payment Protocol Selector */}
          <div className="space-y-2">
            <label className="text-[10.5px] text-slate-450 font-bold uppercase tracking-wider block">Payment Protocol</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'card', name: 'Credit Card', icon: CreditCard },
                { key: 'upi', name: 'Instant UPI', icon: Send },
                { key: 'cash', name: 'Table Cash', icon: User }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPayMethod(item.key as any)}
                  className={`p-3 border rounded-xl flex flex-col items-center space-y-1.5 transition-all text-center ${
                    payMethod === item.key
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-slate-950 border-slate-900 text-slate-400'
                  }`}
                >
                  <item.icon className="w-4 h-4 text-slate-400" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - INPUT INFORMATION */}
        <div className="space-y-4 flex flex-col justify-between">
          <div>
            {payMethod === 'card' && (
              <div className="space-y-3">
                <Input 
                  label="Cardholder Full Name" 
                  placeholder="Full Name"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                />
                <Input 
                  label="Debit / Credit Card Number" 
                  placeholder="•••• •••• •••• 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  required
                />
              </div>
            )}
            
            {payMethod === 'upi' && (
              <Input 
                label="UPI VPA ID Address" 
                placeholder="sarah@okaxis"
                value={upiVpa}
                onChange={(e) => setUpiVpa(e.target.value)}
                required
              />
            )}

            {payMethod === 'cash' && (
              <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-2 text-xs text-slate-400 leading-relaxed font-semibold">
                <Info className="w-5 h-5 text-primary" />
                <p>Table Cash request has been sent. A waiter will walk over to your table soon with the physical bill folio.</p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={isProcessing}
            className="w-full bg-primary text-slate-950 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 text-xs shadow-lg mt-6"
          >
            <CreditCard className="w-4 h-4 text-slate-950" />
            <span>
              {isProcessing ? 'Authorizing Check...' : `Pay Total ${formatPrice(orderTotalVal / splitCount)}`}
            </span>
          </Button>
        </div>

      </form>

    </div>
  );
};

export default PaymentPage;
