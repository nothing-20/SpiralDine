import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Tag, 
  Calendar, 
  Percent, 
  DollarSign, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';

export const MobilePromotions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();
  const tenantId = user?.tenantId;

  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState('15');
  const [minOrder, setMinOrder] = useState('25');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const promoCol = collection(db, 'restaurants', tenantId, 'promotions');
    const unsubscribe = onSnapshot(promoCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPromotions(list);
      setLoading(false);
    }, (err) => {
      console.warn('[MobilePromotions] Snapshot error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !title.trim() || !code.trim()) {
      setErrorMsg('Title and promo code are required.');
      return;
    }

    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Please enter a valid discount value.');
      return;
    }

    if (discountType === 'percentage' && val > 100) {
      setErrorMsg('Percentage discount cannot exceed 100%.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const colRef = collection(db, 'restaurants', tenantId, 'promotions');
      const docRef = doc(colRef);

      await setDoc(docRef, {
        title: title.trim(),
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: val,
        minOrder: Number(minOrder) || 0,
        active: true,
        tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setShowAddModal(false);
      setTitle('');
      setCode('');
    } catch (err: any) {
      console.error('[MobilePromotions] Create error:', err);
      setErrorMsg(err.message || 'Failed to create promotion.');
    } finally {
      setSaving(false);
    }
  };

  const togglePromoStatus = async (promo: any) => {
    if (!tenantId || !promo.id) return;
    const current = promo.active !== false;

    try {
      const docRef = doc(db, 'restaurants', tenantId, 'promotions', promo.id);
      await updateDoc(docRef, {
        active: !current,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[MobilePromotions] Toggle error:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/business')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="font-extrabold text-sm text-[#202124]">Promotions & Deals</h1>
          <p className="text-[11px] text-[#707070]">{promotions.length} offers active</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-9 h-9 rounded-full bg-[#FF7518] text-white flex items-center justify-center shadow-sm shadow-[#FF7518]/25"
          aria-label="Add Promotion"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <MobileLoadingSkeleton count={3} />
        ) : promotions.length === 0 ? (
          <MobileEmptyState
            icon={Tag}
            title="No Active Promotions"
            description="Create promotional discounts and coupon codes to attract repeat diners."
            actionLabel="Create First Promo"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          promotions.map((promo) => {
            const isActive = promo.active !== false;
            const isPercent = promo.discountType !== 'flat';

            return (
              <div
                key={promo.id}
                className="bg-white rounded-2xl border border-[#EBEBEB] p-4 flex flex-col justify-between shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-[#202124]">{promo.title}</h3>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF]">
                        {promo.code}
                      </span>
                    </div>

                    <div className="text-xs text-[#707070]">
                      <span>Discount: </span>
                      <strong className="text-[#16A34A]">
                        {isPercent ? `${promo.discountValue}% OFF` : `${formatCurrency(promo.discountValue)} OFF`}
                      </strong>
                      {Number(promo.minOrder) > 0 && (
                        <span> (Min order {formatCurrency(promo.minOrder)})</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => togglePromoStatus(promo)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                      isActive
                        ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                        : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
                    }`}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Promo Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-[#202124]">Create Promotional Offer</h3>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FEE2E2] text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreatePromotion} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Promo Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekend Feast Special"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SPIRAL20"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full h-11 px-3 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat ({currencySymbol})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Discount Value</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="15"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Min Order Amount ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  placeholder="25"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF7518] text-white text-xs font-bold shadow-sm"
                >
                  {saving ? 'Creating...' : 'Launch Promo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePromotions;
