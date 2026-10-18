import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { 
  IPromotion, 
  PromotionType, 
  PromotionStatus, 
  PromotionPlacement 
} from '../../../shared/domain/promotions/types';
import { promotionService, isPromotionActive } from '../../../shared/services/promotionEngine';
import { getMenuItemPath, getMenuCategoryPath } from '../../../shared/firebase/collections';

// UI Kit
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Icons & Toast
import toast from 'react-hot-toast';
import { 
  Tag, Plus, Search, Filter, Calendar, Percent, 
  DollarSign, Play, Pause, Trash2, Edit3, Eye, Copy, 
  Sparkles, CheckCircle, AlertCircle, ArrowUpRight, 
  Layers, Gift, ShoppingBag, ShieldCheck, Clock
} from 'lucide-react';

export const OwnerPromotions: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [promotions, setPromotions] = useState<IPromotion[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [menuItems, setMenuItems] = useState<{ id: string; name: string; price: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string>('');
  const [previewPromo, setPreviewPromo] = useState<IPromotion | null>(null);
  const [deleteConfirmPromo, setDeleteConfirmPromo] = useState<IPromotion | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formType, setFormType] = useState<PromotionType>('percentage');
  const [formValue, setFormValue] = useState<number>(20);
  const [formCode, setFormCode] = useState<string>('');
  const [formBadgeText, setFormBadgeText] = useState<string>('20% OFF');
  const [formApplicableCategories, setFormApplicableCategories] = useState<string[]>([]);
  const [formApplicableItems, setFormApplicableItems] = useState<string[]>([]);
  const [formMinOrderValue, setFormMinOrderValue] = useState<number | ''>('');
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | ''>('');
  const [formStartDate, setFormStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState<string>(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [formGlobalLimit, setFormGlobalLimit] = useState<number | ''>('');
  const [formPlacements, setFormPlacements] = useState<PromotionPlacement[]>(['restaurant_menu', 'cart_suggestion', 'home_carousel']);
  const [formAllowStacking, setFormAllowStacking] = useState<boolean>(false);
  const [formStatus, setFormStatus] = useState<PromotionStatus>('active');

  // Load Real-time Promotions and Menu Metadata
  useEffect(() => {
    if (!tenantId) return;

    setIsLoading(true);
    const unsubscribe = promotionService.subscribeToRestaurantPromotions(tenantId, (data) => {
      setPromotions(data);
      setIsLoading(false);
    });

    // Fetch categories and items for multi-selectors
    const loadMenuData = async () => {
      try {
        const catSnap = await getDocs(collection(db, getMenuCategoryPath(tenantId)));
        const catList: { id: string; name: string }[] = [];
        catSnap.forEach(d => {
          const dData = d.data();
          catList.push({ id: d.id, name: dData.name || d.id });
        });
        setCategories(catList);

        const itemSnap = await getDocs(collection(db, getMenuItemPath(tenantId)));
        const iList: { id: string; name: string; price: number }[] = [];
        itemSnap.forEach(d => {
          const iData = d.data();
          iList.push({ id: d.id, name: iData.name || d.id, price: Number(iData.price || 0) });
        });
        setMenuItems(iList);
      } catch (err) {
        console.warn('[OwnerPromotions] Menu data load notice:', err);
      }
    };
    loadMenuData();

    return () => unsubscribe();
  }, [tenantId]);

  // Computed Metrics
  const summary = useMemo(() => {
    const total = promotions.length;
    const active = promotions.filter(p => isPromotionActive(p)).length;
    const scheduled = promotions.filter(p => p.status === 'scheduled' || (p.startDate && new Date(p.startDate).getTime() > Date.now())).length;
    const draft = promotions.filter(p => p.status === 'draft').length;
    const pausedOrExpired = promotions.filter(p => p.status === 'paused' || p.status === 'expired' || (p.endDate && new Date(p.endDate).getTime() < Date.now())).length;
    const totalRedemptions = promotions.reduce((sum, p) => sum + (p.redemptionCount || 0), 0);
    const totalRevenue = promotions.reduce((sum, p) => sum + (p.metrics?.totalRevenueGenerated || 0), 0);
    return { total, active, scheduled, draft, pausedOrExpired, totalRedemptions, totalRevenue };
  }, [promotions]);

  // Filtered List
  const filteredPromotions = useMemo(() => {
    return promotions.filter(p => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCode = (p.code || '').toLowerCase().includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && !isPromotionActive(p)) return false;
        if (statusFilter === 'paused' && p.status !== 'paused') return false;
        if (statusFilter === 'draft' && p.status !== 'draft') return false;
        if (statusFilter === 'expired' && (p.status !== 'expired' && new Date(p.endDate).getTime() >= Date.now())) return false;
      }
      if (typeFilter !== 'all' && p.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [promotions, searchQuery, statusFilter, typeFilter]);

  // Form Handlers
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId('');
    setFormName('');
    setFormDescription('');
    setFormType('percentage');
    setFormValue(20);
    setFormCode('');
    setFormBadgeText('20% OFF');
    setFormApplicableCategories([]);
    setFormApplicableItems([]);
    setFormMinOrderValue('');
    setFormMaxDiscount('');
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormEndDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setFormGlobalLimit('');
    setFormPlacements(['restaurant_menu', 'cart_suggestion', 'home_carousel']);
    setFormAllowStacking(false);
    setFormStatus('active');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: IPromotion) => {
    setIsEditing(true);
    setEditingId(p.id);
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormType(p.type);
    setFormValue(p.value);
    setFormCode(p.code || '');
    setFormBadgeText(p.badgeText || '');
    setFormApplicableCategories(p.applicableCategoryIds || []);
    setFormApplicableItems(p.applicableItemIds || []);
    setFormMinOrderValue(p.minOrderValue ?? '');
    setFormMaxDiscount(p.maxDiscountAmount ?? '');
    setFormStartDate((p.startDate || '').slice(0, 10));
    setFormEndDate((p.endDate || '').slice(0, 10));
    setFormGlobalLimit(p.globalUsageLimit ?? '');
    setFormPlacements(p.placements || ['restaurant_menu']);
    setFormAllowStacking(p.allowStacking || false);
    setFormStatus(p.status);
    setIsFormOpen(true);
  };

  const handleDuplicate = async (p: IPromotion) => {
    if (!tenantId) return;
    try {
      const copy: Partial<IPromotion> = {
        ...p,
        id: undefined,
        name: `${p.name} (Copy)`,
        code: p.code ? `${p.code}_COPY` : undefined,
        status: 'draft',
        redemptionCount: 0,
        createdAt: new Date().toISOString()
      };
      await promotionService.savePromotion(tenantId, copy);
      toast.success('Promotion duplicated as Draft');
    } catch (err) {
      toast.error('Failed to duplicate promotion');
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!formName.trim()) {
      toast.error('Please enter a promotion title.');
      return;
    }
    if (formValue <= 0) {
      toast.error('Discount value must be greater than 0.');
      return;
    }
    if (formType === 'percentage' && formValue > 100) {
      toast.error('Percentage discount cannot exceed 100%.');
      return;
    }
    if (formType === 'coupon_code' && !formCode.trim()) {
      toast.error('Coupon code promotions require an active promo code.');
      return;
    }
    if (new Date(formEndDate).getTime() < new Date(formStartDate).getTime()) {
      toast.error('Expiry date cannot precede start date.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<IPromotion> = {
        name: formName.trim(),
        description: formDescription.trim(),
        type: formType,
        value: Number(formValue),
        code: formCode.trim() ? formCode.trim().toUpperCase() : undefined,
        badgeText: formBadgeText.trim() || undefined,
        applicableCategoryIds: formApplicableCategories,
        applicableItemIds: formApplicableItems,
        minOrderValue: formMinOrderValue === '' ? undefined : Number(formMinOrderValue),
        maxDiscountAmount: formMaxDiscount === '' ? undefined : Number(formMaxDiscount),
        startDate: new Date(formStartDate).toISOString(),
        endDate: new Date(formEndDate).toISOString(),
        globalUsageLimit: formGlobalLimit === '' ? undefined : Number(formGlobalLimit),
        placements: formPlacements,
        allowStacking: formAllowStacking,
        status: formStatus
      };

      if (isEditing && editingId) {
        payload.id = editingId;
      }

      await promotionService.savePromotion(tenantId, payload);
      toast.success(isEditing ? 'Promotion updated successfully!' : 'Promotion created and published!');
      setIsFormOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save promotion');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (p: IPromotion) => {
    if (!tenantId) return;
    try {
      await promotionService.toggleStatus(tenantId, p.id, p.status, p.code);
      toast.success(`Promotion ${p.status === 'active' ? 'paused' : 'activated'}`);
    } catch (_) {
      toast.error('Failed to change status');
    }
  };

  const handleDelete = async () => {
    if (!tenantId || !deleteConfirmPromo) return;
    try {
      await promotionService.deletePromotion(tenantId, deleteConfirmPromo.id, deleteConfirmPromo.code);
      toast.success('Promotion deleted');
      setDeleteConfirmPromo(null);
    } catch (_) {
      toast.error('Failed to delete promotion');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied "${text}" to clipboard`);
  };

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-16">
      
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-[#D8DDD6] shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FAF8F4] text-[#D94F2B] border border-[#D8DDD6] rounded-2xl">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#202820] tracking-tight">
                Offers &amp; Promotions
              </h1>
              <p className="text-xs text-[#5F675F] font-medium mt-0.5">
                Create, monitor, and manage automated discounts, coupons, BOGO deals, and homepage banners.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenCreate}
            className="bg-[#D94F2B] hover:bg-[#C2411F] text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-xs cursor-pointer focus:ring-2 focus:ring-[#D94F2B]/20 focus:outline-none transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Offer</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#D8DDD6] shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-[#5F675F] uppercase tracking-wider block">Total Offers</span>
          <div className="text-xl font-extrabold text-[#202820]">{summary.total}</div>
          <span className="text-[10px] text-[#5F675F]">All campaigns</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#A6E1C4] bg-[#E8F5EE]/40 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-[#167647] uppercase tracking-wider block">Active Now</span>
          <div className="text-xl font-extrabold text-[#167647]">{summary.active}</div>
          <span className="text-[10px] text-[#167647] font-semibold">Live on customer app</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#B2DDFF] bg-[#EFF8FF]/40 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-[#175CD3] uppercase tracking-wider block">Scheduled</span>
          <div className="text-xl font-extrabold text-[#175CD3]">{summary.scheduled}</div>
          <span className="text-[10px] text-[#175CD3] font-semibold">Upcoming validity</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D8DDD6] shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-[#5F675F] uppercase tracking-wider block">Drafts</span>
          <div className="text-xl font-extrabold text-[#202820]">{summary.draft}</div>
          <span className="text-[10px] text-[#5F675F]">Unpublished</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D8DDD6] shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-[#5F675F] uppercase tracking-wider block">Redemptions</span>
          <div className="text-xl font-extrabold text-[#D94F2B]">{summary.totalRedemptions}</div>
          <span className="text-[10px] text-[#5F675F]">Orders converted</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#D8DDD6] shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-[#5F675F] uppercase tracking-wider block">Attributed Sales</span>
          <div className="text-xl font-extrabold text-[#202820]">₹{summary.totalRevenue.toLocaleString()}</div>
          <span className="text-[10px] text-[#167647] font-semibold">Promoted GMV</span>
        </div>
      </div>

      {/* 3. Search and Filtering Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#D8DDD6] shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#747C74]" />
          <input
            type="text"
            placeholder="Search promotions by name, description, or coupon code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#D8DDD6] rounded-xl text-xs font-semibold text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#D8DDD6] rounded-xl text-xs font-bold text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="paused">Paused Only</option>
            <option value="draft">Drafts</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#D8DDD6] rounded-xl text-xs font-bold text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all"
          >
            <option value="all">All Types</option>
            <option value="percentage">Percentage Off</option>
            <option value="fixed_amount">Fixed Amount (₹)</option>
            <option value="bogo">Buy 1 Get 1</option>
            <option value="coupon_code">Coupon Codes</option>
            <option value="item_specific">Item Specific</option>
            <option value="category_specific">Category Specific</option>
            <option value="restaurant_wide">Store-Wide</option>
          </select>
        </div>
      </div>

      {/* 4. Promotions Table / List */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-3xl border border-[#D8DDD6] text-center shadow-2xs">
          <LoadingSpinner />
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-[#D8DDD6] text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF8F4] text-[#D94F2B] border border-[#D8DDD6] flex items-center justify-center mx-auto">
            <Tag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-[#202820]">No promotions found</h3>
          <p className="text-xs text-[#5F675F] max-w-sm mx-auto">
            {promotions.length === 0 
              ? 'Get started by creating your first restaurant promotion or coupon discount to drive customer orders.'
              : 'No promotions match your current search query or filter.'}
          </p>
          {promotions.length === 0 && (
            <Button
              onClick={handleOpenCreate}
              className="bg-[#D94F2B] hover:bg-[#C2411F] text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Create First Offer
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#D8DDD6] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#D8DDD6] text-[#5F675F] uppercase text-[10px] font-extrabold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Offer Details</th>
                  <th className="py-3 px-4">Type &amp; Value</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DDD6]">
                {filteredPromotions.map((p) => {
                  const isActive = isPromotionActive(p);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF8F4]/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#202820] text-sm">
                              {p.name}
                            </span>
                            {p.badgeText && (
                              <Badge className="bg-[#D94F2B]/10 text-[#D94F2B] border border-[#D94F2B]/20 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                                {p.badgeText}
                              </Badge>
                            )}
                          </div>
                          {p.description && (
                            <p className="text-xs text-[#5F675F] line-clamp-1">
                              {p.description}
                            </p>
                          )}
                          {p.code && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FAF8F4] border border-[#D8DDD6] text-[#202820] font-mono font-bold text-[10px]">
                              <span>CODE: {p.code}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(p.code!)}
                                className="text-[#5F675F] hover:text-[#D94F2B] cursor-pointer"
                                title="Copy promo code"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-[#202124]">
                        <div className="text-[#202820]">
                          {p.type === 'percentage' && `${p.value}% OFF`}
                          {p.type === 'fixed_amount' && `₹${p.value} FLAT OFF`}
                          {p.type === 'bogo' && 'BUY 1 GET 1'}
                          {p.type === 'fixed_price_combo' && `Combo @ ₹${p.value}`}
                          {p.type === 'coupon_code' && `${p.value}% OFF with Code`}
                          {p.type === 'item_specific' && `${p.value}% OFF Selected Items`}
                          {p.type === 'category_specific' && `${p.value}% OFF Category`}
                          {p.type === 'restaurant_wide' && `${p.value}% Store-Wide`}
                        </div>
                        {p.minOrderValue && (
                          <div className="text-[10px] text-[#5F675F] font-normal">
                            Min Order: ₹{p.minOrderValue}
                          </div>
                        )}
                        {p.maxDiscountAmount && (
                          <div className="text-[10px] text-[#5F675F] font-normal">
                            Max Cap: ₹{p.maxDiscountAmount}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#5F675F] text-[11px] font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#D94F2B]" />
                          <span>{new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-[#202820]">
                        <div>{p.redemptionCount || 0} used</div>
                        {p.globalUsageLimit ? (
                          <div className="text-[10px] text-[#5F675F] font-normal">
                            Limit: {p.globalUsageLimit}
                          </div>
                        ) : (
                          <div className="text-[10px] text-[#5F675F] font-normal">
                            Unlimited
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <Badge className="bg-[#E8F5EE] text-[#167647] border border-[#A6E1C4] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            Active
                          </Badge>
                        ) : p.status === 'paused' ? (
                          <Badge className="bg-[#FEF3D6] text-[#8A5700] border border-[#FDE68A] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            Paused
                          </Badge>
                        ) : p.status === 'draft' ? (
                          <Badge className="bg-[#F0F2F0] text-[#5F675F] border border-[#D8DDD6] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            Draft
                          </Badge>
                        ) : (
                          <Badge className="bg-[#FEE4E2] text-[#B42318] border border-[#FECDCA] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            Expired
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewPromo(p)}
                            className="p-1.5 text-[#5F675F] hover:text-[#202820] hover:bg-[#FAF8F4] border border-transparent hover:border-[#D8DDD6] rounded-lg transition-colors cursor-pointer"
                            title="Preview customer view"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p)}
                            className={`p-1.5 rounded-lg border border-transparent transition-colors cursor-pointer ${
                              p.status === 'active' 
                                ? 'text-[#8A5700] hover:bg-[#FEF3D6] hover:border-[#FDE68A]' 
                                : 'text-[#167647] hover:bg-[#E8F5EE] hover:border-[#A6E1C4]'
                            }`}
                            title={p.status === 'active' ? 'Pause Offer' : 'Resume Offer'}
                          >
                            {p.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-[#5F675F] hover:text-[#202820] hover:bg-[#FAF8F4] border border-transparent hover:border-[#D8DDD6] rounded-lg transition-colors cursor-pointer"
                            title="Edit offer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicate(p)}
                            className="p-1.5 text-[#5F675F] hover:text-[#202820] hover:bg-[#FAF8F4] border border-transparent hover:border-[#D8DDD6] rounded-lg transition-colors cursor-pointer"
                            title="Duplicate offer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmPromo(p)}
                            className="p-1.5 text-[#B42318] hover:bg-[#FEE4E2] border border-transparent hover:border-[#FECDCA] rounded-lg transition-colors cursor-pointer"
                            title="Delete offer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Create / Edit Promotion Modal */}
      {isFormOpen && (
        <Modal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          title={isEditing ? 'Edit Promotion' : 'Create New Promotion'}
          variant="light"
          size="2xl"
        >
          <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-[#202820] block text-xs">
                Offer Title <span className="text-[#B42318] font-bold">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Weekend Biryani Feast, Festive 20% Off"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-semibold text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#202820] block text-xs">
                Description &amp; Terms
              </label>
              <textarea
                placeholder="Explain the offer conditions to diners (e.g. Valid on all main course items above ₹499)..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-medium text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">
                  Offer Type <span className="text-[#B42318] font-bold">*</span>
                </label>
                <select
                  value={formType}
                  onChange={(e) => {
                    const t = e.target.value as PromotionType;
                    setFormType(t);
                    if (t === 'percentage') setFormBadgeText('20% OFF');
                    else if (t === 'bogo') setFormBadgeText('BUY 1 GET 1');
                    else if (t === 'fixed_amount') setFormBadgeText('FLAT ₹100 OFF');
                  }}
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                >
                  <option value="percentage">Percentage Discount (%)</option>
                  <option value="fixed_amount">Fixed Amount Discount (₹)</option>
                  <option value="bogo">Buy 1 Get 1 Free (BOGO)</option>
                  <option value="coupon_code">Coupon Code Discount</option>
                  <option value="item_specific">Item-Specific Discount</option>
                  <option value="category_specific">Category-Specific Discount</option>
                  <option value="restaurant_wide">Restaurant-Wide Offer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">
                  {formType === 'percentage' || formType === 'coupon_code' ? 'Discount Percentage (%)' : 'Discount Amount (₹)'} <span className="text-[#B42318] font-bold">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={formType === 'percentage' || formType === 'coupon_code' ? 100 : 10000}
                  value={formValue}
                  onChange={(e) => setFormValue(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">Coupon Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. BIRYANI20 (Auto-capitalized)"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-mono font-bold text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">Badge Text</label>
                <input
                  type="text"
                  placeholder="e.g. 20% OFF, BOGO, CHEF SPECIAL"
                  value={formBadgeText}
                  onChange={(e) => setFormBadgeText(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                />
              </div>
            </div>

            {/* Thresholds & Caps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">Minimum Order Subtotal (₹)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 499 (optional)"
                  value={formMinOrderValue}
                  onChange={(e) => setFormMinOrderValue(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">Maximum Discount Cap (₹)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 150 (optional cap on % discounts)"
                  value={formMaxDiscount}
                  onChange={(e) => setFormMaxDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] placeholder-[#747C74] outline-none focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                />
              </div>
            </div>

            {/* Validity Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">
                  Start Date <span className="text-[#B42318] font-bold">*</span>
                </label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">
                  End Date <span className="text-[#B42318] font-bold">*</span>
                </label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                />
              </div>
            </div>

            {/* Category / Item multi-select if applicable */}
            {categories.length > 0 && (formType === 'category_specific' || formType === 'restaurant_wide') && (
              <div className="space-y-1.5">
                <label className="font-bold text-[#202820] block text-xs">Eligible Categories</label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2.5 bg-[#FAF8F4] border border-[#D8DDD6] rounded-xl">
                  {categories.map(c => {
                    const isSelected = formApplicableCategories.includes(c.name);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setFormApplicableCategories(prev => 
                            prev.includes(c.name) ? prev.filter(x => x !== c.name) : [...prev, c.name]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-[#D94F2B] border-[#D94F2B] text-white shadow-xs'
                            : 'bg-white border-[#D8DDD6] text-[#202820] hover:border-[#D94F2B]/60 hover:bg-white'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Placements */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#202820] block text-xs">Display Placements</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'restaurant_menu' as PromotionPlacement, label: 'Restaurant Menu Banner' },
                  { id: 'cart_suggestion' as PromotionPlacement, label: 'Cart 1-Click Coupon Tray' },
                  { id: 'home_carousel' as PromotionPlacement, label: 'Customer Home Carousel' },
                  { id: 'food_card' as PromotionPlacement, label: 'Food Dish Cards' },
                ].map(item => {
                  const isChecked = formPlacements.includes(item.id);
                  return (
                    <label key={item.id} className="flex items-center gap-2.5 p-2.5 bg-white border border-[#D8DDD6] hover:border-[#D94F2B]/50 rounded-xl cursor-pointer transition-all">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setFormPlacements(prev => 
                            prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                          );
                        }}
                        className="accent-[#D94F2B] w-4 h-4 rounded cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-[#202820]">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Stacking & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2.5 p-2.5 bg-white border border-[#D8DDD6] hover:border-[#D94F2B]/50 rounded-xl cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={formAllowStacking}
                  onChange={(e) => setFormAllowStacking(e.target.checked)}
                  className="accent-[#D94F2B] w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[#202820] block text-xs">Allow Coupon Stacking</span>
                  <span className="text-[10px] text-[#5F675F]">Can be combined with other offers</span>
                </div>
              </label>

              <div className="space-y-1">
                <label className="font-bold text-[#202820] block text-xs">Initial Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as PromotionStatus)}
                  className="w-full px-3 py-2.5 bg-white border border-[#D8DDD6] rounded-xl font-bold text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all text-xs"
                >
                  <option value="active">Active (Live immediately)</option>
                  <option value="draft">Draft (Private)</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-[#D8DDD6] flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 border border-[#D8DDD6] bg-white text-[#202820] hover:bg-[#FAF8F4] font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#D94F2B] hover:bg-[#C2411F] text-white text-xs font-extrabold px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer focus:ring-2 focus:ring-[#D94F2B]/20 focus:outline-none disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Publish Offer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Customer Preview Modal */}
      {previewPromo && (
        <Modal
          isOpen={Boolean(previewPromo)}
          onClose={() => setPreviewPromo(null)}
          title="Customer View Preview"
          variant="light"
          size="xl"
        >
          <div className="space-y-5 text-left text-xs">
            <p className="text-[#5F675F] font-medium text-xs">
              Here is how diners will see and experience this promotion across the customer portal.
            </p>

            {/* Preview: Customer Home Carousel Card */}
            <div className="space-y-1.5">
              <span className="font-extrabold uppercase text-[10px] text-[#5F675F] tracking-wider block">
                1. Customer Home Carousel Preview
              </span>
              <div className="bg-gradient-to-r from-[#202820] to-[#3a221d] rounded-2xl p-4 text-white shadow-md relative overflow-hidden border border-[#D8DDD6]">
                <div className="space-y-1 max-w-sm">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D94F2B] text-white text-[10px] font-extrabold">
                    <Sparkles className="w-3 h-3" />
                    <span>{previewPromo.badgeText || 'SPECIAL OFFER'}</span>
                  </div>
                  <h4 className="text-base font-extrabold tracking-tight">
                    {previewPromo.name}
                  </h4>
                  <p className="text-xs text-white/90 line-clamp-2">
                    {previewPromo.description || `Get ${previewPromo.value}% off your meal order!`}
                  </p>
                  {previewPromo.code && (
                    <div className="pt-2 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 font-mono font-bold text-xs text-white">
                        USE CODE: {previewPromo.code}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview: Restaurant Menu Promotional Banner */}
            <div className="space-y-1.5">
              <span className="font-extrabold uppercase text-[10px] text-[#5F675F] tracking-wider block">
                2. Restaurant Menu Header Banner Preview
              </span>
              <div className="bg-[#FAF8F4] border border-[#D94F2B]/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#D8DDD6] text-[#D94F2B] flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#202820]">
                        {previewPromo.name}
                      </span>
                      {previewPromo.code && (
                        <span className="text-[10px] font-mono font-extrabold bg-[#D94F2B]/10 text-[#D94F2B] border border-[#D94F2B]/20 px-1.5 py-0.5 rounded">
                          {previewPromo.code}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#5F675F] font-medium">
                      {previewPromo.description || 'Applicable on verified dining orders'}
                    </p>
                  </div>
                </div>

                {previewPromo.code && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(previewPromo.code!)}
                    className="px-3 py-1.5 bg-[#D94F2B] hover:bg-[#C2411F] text-white text-[11px] font-extrabold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Copy Code
                  </button>
                )}
              </div>
            </div>

            {/* Preview: Food Card Pricing */}
            <div className="space-y-1.5">
              <span className="font-extrabold uppercase text-[10px] text-[#5F675F] tracking-wider block">
                3. Food Card Discount Preview
              </span>
              <div className="bg-white border border-[#D8DDD6] rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs max-w-sm">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-[#202820]">Special Chicken Biryani</span>
                    <Badge className="bg-[#D94F2B] text-white text-[9px] px-1.5 py-0.5 font-extrabold">
                      {previewPromo.badgeText || `${previewPromo.value}% OFF`}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs font-extrabold text-[#202820]">
                      ₹{Math.round(300 * (1 - (previewPromo.value || 20) / 100))}
                    </span>
                    <span className="text-[11px] text-[#5F675F] line-through">
                      ₹300
                    </span>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-[#FAF8F4] border border-[#D8DDD6] text-[#D94F2B] font-extrabold text-xs rounded-xl">
                  ADD +
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D8DDD6] flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPromo(null)}
                className="px-4 py-2 border border-[#D8DDD6] bg-white text-[#202820] hover:bg-[#FAF8F4] font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. Delete Confirmation Dialog */}
      {deleteConfirmPromo && (
        <Dialog
          isOpen={Boolean(deleteConfirmPromo)}
          onClose={() => setDeleteConfirmPromo(null)}
          title="Delete Promotion?"
          message={`Are you sure you want to delete "${deleteConfirmPromo.name}"? This will remove the offer immediately from customer menus, home banners, and cart suggestions. Historical order records will remain preserved.`}
          onConfirm={handleDelete}
          confirmLabel="Delete Offer"
          isDangerous={true}
          variant="light"
        />
      )}

    </div>
  );
};

export default OwnerPromotions;
