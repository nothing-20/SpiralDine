import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  
  const orderTotalVal = Number(searchParams.get('total')) || 0; // in cents
  const orderId = searchParams.get('orderId') || '';
  const tenantId = searchParams.get('tenantId') || '';
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
        // Route to the authoritative canonical bill on OrderTracking where verified payment & staff verification takes place
        if (orderId && tenantId) {
          toast.success('Opening your canonical order bill...');
          navigate(`/customer/restaurant/${tenantId}/order/${orderId}`);
          return;
        }

        // If no active order context, direct customer to orders tab
        toast.error('No active dining order specified. Please select an order from your order list.');
        setIsProcessing(false);
        navigate('/customer/orders');
        return;
      } catch (err) {
        console.error(err);
        toast.error('Payment processing failed.');
        setIsProcessing(false);
      }
    }, 500);
  };

  if (isPaid) {
    return (
      <div className="max-w-md mx-auto p-6 sm:p-8 space-y-6 text-center select-none bg-white border border-[#E5DCD5] rounded-3xl mt-8 shadow-sm">
        <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-xs animate-bounce text-[#2E8B57]">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        
        <div className="space-y-1">
          <h2 className="text-xl font-display font-extrabold text-[#202124]">Settlement Complete</h2>
          <p className="text-xs text-[#756B64]">Payment receipt has been logged to the checkout system.</p>
        </div>

        <div className="p-4 bg-[#FCFAF7] border border-[#E5DCD5] rounded-2xl space-y-3.5 text-left text-xs text-[#756B64]">
          <div className="flex justify-between font-bold border-b border-[#E5DCD5] pb-2 text-[#202124]">
            <span>Transaction Share</span>
            <span className="text-[#C85A3F] font-mono font-extrabold">{formatPrice(individualShare)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment Protocol</span>
            <span className="font-semibold text-[#202124] uppercase">{payMethod}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="text-[#2E8B57] font-extrabold">AUTHORIZED</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button 
            onClick={() => navigate('/customer/home')}
            className="w-full min-h-[44px] bg-[#C85A3F] hover:bg-[#A94332] active:scale-98 text-white font-extrabold py-3 rounded-xl text-xs shadow-xs cursor-pointer"
          >
            Portal Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left select-none pb-16 px-4 sm:px-0">
      
      <button 
        type="button"
        className="flex items-center space-x-1.5 text-[#756B64] hover:text-[#C85A3F] transition-colors cursor-pointer py-1 group" 
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-xs font-bold">Back</span>
      </button>

      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#202124]">Settlement Check</h2>
        <p className="text-xs sm:text-sm text-[#756B64]">Choose payment method and divide check split count.</p>
      </div>

      <form onSubmit={handlePay} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-[#E5DCD5] p-5 sm:p-7 rounded-3xl shadow-sm">
        
        {/* LEFT PANEL - SPLIT CHECKS */}
        <div className="space-y-5">
          <div className="p-4 bg-[#FCFAF7] border border-[#E5DCD5] rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-[10.5px] text-[#756B64] font-bold uppercase tracking-wider">
              <span>Split Check Total</span>
              <span className="text-[#C85A3F] font-bold">{splitCount} Diner Party</span>
            </div>
            
            <div className="flex items-center space-x-3 justify-center py-2">
              <button 
                type="button"
                onClick={() => setSplitCount(s => Math.max(1, s - 1))}
                className="w-9 h-9 sm:w-8 sm:h-8 bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/50 rounded-xl flex items-center justify-center text-[#202124] font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                -
              </button>
              <span className="text-xs font-extrabold text-[#202124] w-8 text-center">{splitCount}x</span>
              <button 
                type="button"
                onClick={() => setSplitCount(s => s + 1)}
                className="w-9 h-9 sm:w-8 sm:h-8 bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/50 rounded-xl flex items-center justify-center text-[#202124] font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="flex justify-between text-xs font-bold text-[#202124] border-t border-[#E5DCD5] pt-3">
              <span>Individual Share</span>
              <span className="text-[#C85A3F] font-mono font-extrabold">{formatPrice(orderTotalVal / splitCount)}</span>
            </div>
          </div>

          {/* Payment Protocol Selector */}
          <div className="space-y-2">
            <label className="text-[10.5px] text-[#756B64] font-bold uppercase tracking-wider block">Payment Protocol</label>
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
                  className={`p-3 min-h-[64px] border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer active:scale-95 ${
                    payMethod === item.key
                      ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#C85A3F] font-bold shadow-2xs'
                      : 'bg-[#FCFAF7] hover:bg-white border-[#E5DCD5] hover:border-[#C85A3F]/40 text-[#756B64]'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${payMethod === item.key ? 'text-[#C85A3F]' : 'text-[#756B64]'}`} />
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
              <div className="p-4 bg-[#FFF8F2] border border-[#C85A3F]/30 rounded-2xl space-y-2 text-xs text-[#756B64] leading-relaxed font-semibold">
                <Info className="w-5 h-5 text-[#C85A3F]" />
                <p>Table Cash request has been sent. A waiter will walk over to your table soon with the physical bill folio.</p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={isProcessing}
            className="w-full min-h-[48px] bg-[#C85A3F] hover:bg-[#A94332] active:scale-98 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-md shadow-[#C85A3F]/20 cursor-pointer disabled:opacity-50 mt-6"
          >
            <CreditCard className="w-4 h-4 text-white" />
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
