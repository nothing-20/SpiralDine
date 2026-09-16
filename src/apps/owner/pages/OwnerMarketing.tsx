import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { logAuditEvent } from '../../../shared/services/auditService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Toast & Icons
import toast from 'react-hot-toast';
import { 
  Megaphone, 
  Plus, 
  Calendar, 
  Tag, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Play, 
  Pause, 
  StopCircle, 
  Trash2, 
  Edit3, 
  Eye, 
  CheckCircle, 
  Sparkles,
  Search,
  Filter,
  Ticket
} from 'lucide-react';

export interface ICampaign {
  id: string;
  name: string;
  description?: string;
  restaurantId: string;
  restaurantName?: string;
  targetAudience: 'All Diners' | 'New Customers' | 'Returning Customers' | 'Inactive Diners (30+ Days)' | 'High Spenders / VIP';
  discountType: 'percentage' | 'flat';
  discountValue: number;
  promoCode?: string;
  minOrderValue?: number;
  maxDiscount?: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'paused' | 'ended' | 'archived';
  metrics?: {
    reachedCount: number;
    redemptions: number;
    ordersGenerated: number;
    revenueGenerated: number;
    totalDiscountAmount: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export const OwnerMarketing: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [campaigns, setCampaigns] = useState<ICampaign[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  // Create / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string>('');

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAudience, setFormAudience] = useState<ICampaign['targetAudience']>('All Diners');
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(15);
  const [formPromoCode, setFormPromoCode] = useState<string>('SPIRAL15');
  const [formMinSpend, setFormMinSpend] = useState<number>(20);
  const [formStartDate, setFormStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formRestaurantId, setFormRestaurantId] = useState<string>(tenantId || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete / End dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    campaign: ICampaign;
    action: 'delete' | 'end' | 'pause' | 'activate';
  } | null>(null);

  // 1. Subscribe to campaigns
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const targetTenant = tenantId || 'default';

    // Fetch restaurants
    const fetchRest = async () => {
      try {
        const snap = await getDocs(collection(db, 'restaurants'));
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setRestaurants(list);
      } catch (_) {}
    };
    fetchRest();

    const unsub = onSnapshot(
      collection(db, 'restaurants', targetTenant, 'campaigns'),
      (snapshot) => {
        const list: ICampaign[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ICampaign);
        });

        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCampaigns(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Campaigns stream error:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [user, tenantId]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchPromo = c.promoCode?.toLowerCase().includes(q);
        const matchDesc = c.description?.toLowerCase().includes(q);
        if (!matchName && !matchPromo && !matchDesc) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (c.status !== statusFilter) return false;
      }

      // 3. Restaurant Filter
      if (restaurantFilter !== 'all') {
        if (c.restaurantId !== restaurantFilter) return false;
      }

      return true;
    });
  }, [campaigns, searchQuery, statusFilter, restaurantFilter]);

  // Overall Campaign Analytics
  const metrics = useMemo(() => {
    const activeCount = campaigns.filter(c => c.status === 'active').length;
    const totalRedemptions = campaigns.reduce((sum, c) => sum + (c.metrics?.redemptions || 0), 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + (c.metrics?.revenueGenerated || 0), 0);
    const totalDiscounts = campaigns.reduce((sum, c) => sum + (c.metrics?.totalDiscountAmount || 0), 0);

    return { activeCount, totalRedemptions, totalRevenue, totalDiscounts };
  }, [campaigns]);

  // Open Create modal
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId('');
    setFormName('');
    setFormDescription('');
    setFormAudience('All Diners');
    setFormDiscountType('percentage');
    setFormDiscountValue(15);
    setFormPromoCode(`SAVE${Math.floor(10 + Math.random() * 90)}`);
    setFormMinSpend(25);
    setFormStartDate(new Date().toISOString().split('T')[0]);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    setFormEndDate(nextMonth.toISOString().split('T')[0]);
    setFormRestaurantId(tenantId || '');
    setIsFormOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (c: ICampaign) => {
    setIsEditing(true);
    setEditingId(c.id);
    setFormName(c.name || '');
    setFormDescription(c.description || '');
    setFormAudience(c.targetAudience || 'All Diners');
    setFormDiscountType(c.discountType || 'percentage');
    setFormDiscountValue(c.discountValue || 10);
    setFormPromoCode(c.promoCode || '');
    setFormMinSpend(c.minOrderValue || 0);
    setFormStartDate(c.startDate || new Date().toISOString().split('T')[0]);
    setFormEndDate(c.endDate || '');
    setFormRestaurantId(c.restaurantId || tenantId || '');
    setIsFormOpen(true);
  };

  // Save Campaign
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formStartDate) {
      toast.error('Campaign name and start date are required');
      return;
    }

    setIsSubmitting(true);
    const targetTenant = formRestaurantId || tenantId || 'default';
    const campaignId = isEditing ? editingId : `CAMP-${Date.now().toString(36).toUpperCase()}`;

    try {
      const payload: Partial<ICampaign> = {
        id: campaignId,
        name: formName.trim(),
        description: formDescription.trim(),
        restaurantId: targetTenant,
        restaurantName: restaurants.find(r => r.id === targetTenant)?.name || 'SpiralDine Bistro',
        targetAudience: formAudience,
        discountType: formDiscountType,
        discountValue: Number(formDiscountValue),
        promoCode: formPromoCode.trim().toUpperCase(),
        minOrderValue: Number(formMinSpend),
        startDate: formStartDate,
        endDate: formEndDate,
        status: isEditing ? (campaigns.find(c => c.id === editingId)?.status || 'draft') : 'active',
        updatedAt: new Date().toISOString(),
        ...(isEditing ? {} : {
          createdAt: new Date().toISOString(),
          metrics: {
            reachedCount: 0,
            redemptions: 0,
            ordersGenerated: 0,
            revenueGenerated: 0,
            totalDiscountAmount: 0
          }
        })
      };

      await setDoc(doc(db, 'restaurants', targetTenant, 'campaigns', campaignId), payload, { merge: true });

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        module: 'Marketing',
        action: isEditing ? 'UPDATE' : 'CREATE',
        targetEntity: `Campaign "${payload.name}" (${payload.promoCode})`,
        newValue: payload
      });

      toast.success(isEditing ? 'Campaign updated' : 'Campaign created & activated');
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Save campaign error:', err);
      toast.error('Failed to save campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Action handler (Activate, Pause, End, Delete)
  const handleExecuteStatusAction = async () => {
    if (!confirmDialog) return;
    const { campaign, action } = confirmDialog;
    const targetTenant = campaign.restaurantId || tenantId || 'default';

    try {
      if (action === 'delete') {
        await deleteDoc(doc(db, 'restaurants', targetTenant, 'campaigns', campaign.id));
        await logAuditEvent({
          userId: user?.uid || '',
          userEmail: user?.email || '',
          userName: user?.displayName || 'Owner',
          userRole: user?.role || 'owner',
          tenantId: targetTenant,
          module: 'Marketing',
          action: 'DELETE',
          targetEntity: `Campaign "${campaign.name}"`
        });
        toast.success('Campaign deleted');
      } else {
        const newStatus = action === 'activate' ? 'active' : action === 'pause' ? 'paused' : 'ended';
        await updateDoc(doc(db, 'restaurants', targetTenant, 'campaigns', campaign.id), {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });

        await logAuditEvent({
          userId: user?.uid || '',
          userEmail: user?.email || '',
          userName: user?.displayName || 'Owner',
          userRole: user?.role || 'owner',
          tenantId: targetTenant,
          module: 'Marketing',
          action: 'STATUS_CHANGE',
          targetEntity: `Campaign "${campaign.name}" set to ${newStatus}`,
          previousValue: campaign.status,
          newValue: newStatus
        });
        toast.success(`Campaign ${newStatus}`);
      }

      setConfirmDialog(null);
    } catch (err) {
      console.error('Campaign action error:', err);
      toast.error('Failed to perform campaign action');
    }
  };

  // Helper status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>;
      case 'paused': return <Badge variant="warning">Paused</Badge>;
      case 'ended': return <Badge variant="neutral">Ended</Badge>;
      case 'archived': return <Badge variant="neutral">Archived</Badge>;
      default: return <Badge variant="neutral">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <Megaphone className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Marketing & Promotions
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Build promotional offers, target customer segments, manage promo codes, and track redemption revenue.
          </p>
        </div>

        <Button 
          variant="primary" 
          onClick={handleOpenCreate}
          className="bg-[#C9533B] hover:bg-[#B34530] text-white flex items-center space-x-2 rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Create Campaign</span>
        </Button>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D]">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Active Campaigns</p>
            <p className="text-xl font-bold font-serif text-[#12352D]">{metrics.activeCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#16845B]/10 flex items-center justify-center text-[#16845B]">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Total Redemptions</p>
            <p className="text-xl font-bold font-serif text-[#16845B]">{metrics.totalRedemptions}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9533B]/10 flex items-center justify-center text-[#C9533B]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Revenue Generated</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">${metrics.totalRevenue}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Discount Given</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">${metrics.totalDiscounts}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search campaigns, promo code..." 
          />
        </div>

        <div className="flex items-center space-x-2.5 overflow-x-auto w-full md:w-auto">
          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
            <option value="draft">Draft</option>
          </select>

          {/* Restaurant Filter */}
          {restaurants.length > 1 && (
            <select 
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
            >
              <option value="all">All Locations</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Campaigns Cards Grid ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Loading promotional campaigns..." />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState 
          title="No campaigns found"
          description={searchQuery ? "No campaign matches your search." : "You haven't launched any promotional campaigns yet."}
          actionLabel="Create Your First Campaign"
          onActionClick={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCampaigns.map((c) => (
            <div 
              key={c.id} 
              className="rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#C9533B]/40 transition-all shadow-sm flex flex-col justify-between overflow-hidden"
            >
              {/* Card Header & Offer Details */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#17202A] line-clamp-1">
                      {c.name}
                    </h3>
                    <p className="text-xs text-[#6B7280] line-clamp-1 mt-0.5">
                      {c.description || 'Targeted diner promotion'}
                    </p>
                  </div>
                  {getStatusBadge(c.status)}
                </div>

                {/* Promo Code & Discount Banner */}
                <div className="p-3 rounded-xl bg-[#12352D]/5 border border-[#12352D]/10 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-[#C9533B]" />
                    <span className="font-mono font-bold text-xs tracking-wider text-[#12352D]">
                      {c.promoCode || 'NO CODE'}
                    </span>
                  </div>
                  <span className="font-serif font-bold text-sm text-[#16845B]">
                    {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `$${c.discountValue} OFF`}
                  </span>
                </div>

                {/* Audience & Dates */}
                <div className="space-y-1 text-xs text-[#6B7280]">
                  <div className="flex justify-between">
                    <span>Target Audience:</span>
                    <span className="font-semibold text-[#17202A]">{c.targetAudience}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Order:</span>
                    <span className="font-semibold text-[#17202A]">${c.minOrderValue || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Period:</span>
                    <span className="font-semibold text-[#17202A]">
                      {c.startDate} to {c.endDate || 'Ongoing'}
                    </span>
                  </div>
                </div>

                {/* Performance Analytics Snapshot */}
                <div className="pt-2 border-t border-[#E5E7EB] grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-[#F8F6F2]">
                    <p className="text-[10px] uppercase font-semibold text-[#6B7280]">Redemptions</p>
                    <p className="font-bold font-serif text-[#17202A] mt-0.5">{c.metrics?.redemptions || 0}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#F8F6F2]">
                    <p className="text-[10px] uppercase font-semibold text-[#6B7280]">Revenue</p>
                    <p className="font-bold font-serif text-[#16845B] mt-0.5">${c.metrics?.revenueGenerated || 0}</p>
                  </div>
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="p-3 bg-[#F8F6F2] border-t border-[#E5E7EB] flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5">
                  {c.status === 'active' ? (
                    <button
                      onClick={() => setConfirmDialog({ campaign: c, action: 'pause' })}
                      className="px-2.5 py-1 rounded-lg font-bold text-xs text-amber-700 hover:bg-amber-100 flex items-center space-x-1"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  ) : c.status === 'paused' || c.status === 'draft' ? (
                    <button
                      onClick={() => setConfirmDialog({ campaign: c, action: 'activate' })}
                      className="px-2.5 py-1 rounded-lg font-bold text-xs text-[#16845B] hover:bg-green-100 flex items-center space-x-1"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Activate</span>
                    </button>
                  ) : null}

                  {c.status !== 'ended' && (
                    <button
                      onClick={() => setConfirmDialog({ campaign: c, action: 'end' })}
                      className="px-2.5 py-1 rounded-lg font-bold text-xs text-slate-600 hover:bg-slate-200"
                    >
                      End
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#17202A] hover:bg-white transition-colors"
                    title="Edit Campaign"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setConfirmDialog({ campaign: c, action: 'delete' })}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Campaign Modal ── */}
      {isFormOpen && (
        <Modal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          title={isEditing ? 'Edit Marketing Campaign' : 'Create New Promotional Campaign'}
        >
          <form onSubmit={handleSaveCampaign} className="space-y-4 p-1">
            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Campaign Name *</label>
              <Input 
                value={formName} 
                onChange={(e) => setFormName(e.target.value)} 
                placeholder="e.g. Weekend Biryani Festival"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Description / Offer Summary</label>
              <Input 
                value={formDescription} 
                onChange={(e) => setFormDescription(e.target.value)} 
                placeholder="e.g. 20% discount on all family platters over $30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Target Audience</label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                >
                  <option value="All Diners">All Diners</option>
                  <option value="New Customers">New Customers Only</option>
                  <option value="Returning Customers">Returning Customers</option>
                  <option value="Inactive Diners (30+ Days)">Inactive Diners (30+ Days)</option>
                  <option value="High Spenders / VIP">High Spenders / VIP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Promo Code</label>
                <Input 
                  value={formPromoCode} 
                  onChange={(e) => setFormPromoCode(e.target.value.toUpperCase())} 
                  placeholder="e.g. FESTIVAL20"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Discount Type</label>
                <select
                  value={formDiscountType}
                  onChange={(e) => setFormDiscountType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Discount Value</label>
                <Input 
                  type="number"
                  min={1}
                  value={formDiscountValue} 
                  onChange={(e) => setFormDiscountValue(Number(e.target.value))} 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Min Spend ($)</label>
                <Input 
                  type="number"
                  min={0}
                  value={formMinSpend} 
                  onChange={(e) => setFormMinSpend(Number(e.target.value))} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Start Date *</label>
                <Input 
                  type="date"
                  value={formStartDate} 
                  onChange={(e) => setFormStartDate(e.target.value)} 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">End Date</label>
                <Input 
                  type="date"
                  value={formEndDate} 
                  onChange={(e) => setFormEndDate(e.target.value)} 
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2">
              <Button variant="secondary" type="button" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={isSubmitting}
                className="bg-[#C9533B] hover:bg-[#B34530] text-white"
              >
                {isSubmitting ? 'Saving...' : (isEditing ? 'Update Campaign' : 'Launch Campaign')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Status Action Confirmation Dialog ── */}
      {confirmDialog && (
        <Dialog
          isOpen={Boolean(confirmDialog)}
          onClose={() => setConfirmDialog(null)}
          onConfirm={handleExecuteStatusAction}
          title={`${confirmDialog.action.toUpperCase()} Campaign?`}
          message={`Are you sure you want to ${confirmDialog.action} "${confirmDialog.campaign.name}"?`}
          confirmLabel={confirmDialog.action === 'delete' ? 'Delete' : 'Confirm'}
          isDangerous={confirmDialog.action === 'delete'}
        />
      )}
    </div>
  );
};

export default OwnerMarketing;
