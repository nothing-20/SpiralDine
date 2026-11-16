import React, { useEffect, useState, useCallback } from 'react';
import { 
  Award, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  Percent, 
  UserCheck, 
  X, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../shared/firebase/config';
import type { 
  ISpecialBenefit, 
  ISpecialBenefitRedemption, 
  TSpecialBenefitFunding, 
  TSpecialBenefitScope, 
  TSpecialBenefitStatus, 
  TSpecialBenefitFrequency 
} from '../../../shared/domain/specialBenefits/types';

interface IRestaurantOption {
  id: string;
  name: string;
}

export const SuperAdminSpecialBenefits: React.FC = () => {
  const [benefits, setBenefits] = useState<ISpecialBenefit[]>([]);
  const [restaurants, setRestaurants] = useState<IRestaurantOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<ISpecialBenefit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState<number>(50);
  const [status, setStatus] = useState<TSpecialBenefitStatus>('active');
  const [scope, setScope] = useState<TSpecialBenefitScope>('all_restaurants');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [fundingModel, setFundingModel] = useState<TSpecialBenefitFunding>('platform_funded');
  const [usageFrequency, setUsageFrequency] = useState<TSpecialBenefitFrequency>('once_per_day');
  const [maxUsageTotal, setMaxUsageTotal] = useState<string>('');
  const [maxDiscountPerOrder, setMaxDiscountPerOrder] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Redemptions Drawer State
  const [selectedBenefitForRedemptions, setSelectedBenefitForRedemptions] = useState<ISpecialBenefit | null>(null);
  const [redemptions, setRedemptions] = useState<ISpecialBenefitRedemption[]>([]);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(false);

  // Fetch real-time benefits list
  useEffect(() => {
    setIsLoading(true);
    const unsub = onSnapshot(collection(db, 'specialBenefits'), (snap) => {
      const list: ISpecialBenefit[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ISpecialBenefit);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBenefits(list);
      setIsLoading(false);
    }, (err) => {
      console.error('[SuperAdminSpecialBenefits] Firestore listener error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  // Fetch active restaurants for restaurant scoping
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const snap = await getDocs(collection(db, 'restaurants'));
        const list: IRestaurantOption[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.restaurantName || data.name || d.id
          });
        });
        setRestaurants(list);
      } catch (err) {
        console.warn('[SuperAdminSpecialBenefits] Failed to load restaurants:', err);
      }
    };
    fetchRestaurants();
  }, []);

  const resetForm = () => {
    setMemberName('');
    setMemberEmail('');
    setMemberPhone('');
    setDiscountPercentage(50);
    setStatus('active');
    setScope('all_restaurants');
    setSelectedTenantIds([]);
    setFundingModel('platform_funded');
    setUsageFrequency('once_per_day');
    setMaxUsageTotal('');
    setMaxDiscountPerOrder('');
    setStartDate('');
    setExpiryDate('');
    setNotes('');
    setEditingBenefit(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: ISpecialBenefit) => {
    setEditingBenefit(b);
    setMemberName(b.memberName || '');
    setMemberEmail(b.memberEmail || '');
    setMemberPhone(b.memberPhone || '');
    setDiscountPercentage(b.discountPercentage || 50);
    setStatus(b.status || 'active');
    setScope(b.scope || 'all_restaurants');
    setSelectedTenantIds(b.applicableTenantIds || []);
    setFundingModel(b.fundingModel || 'platform_funded');
    setUsageFrequency(b.usageFrequency || 'once_per_day');
    setMaxUsageTotal(b.maxUsageTotal ? String(b.maxUsageTotal) : '');
    setMaxDiscountPerOrder(b.maxDiscountPerOrder ? String(b.maxDiscountPerOrder) : '');
    setStartDate(b.startDate ? b.startDate.slice(0, 16) : '');
    setExpiryDate(b.expiryDate ? b.expiryDate.slice(0, 16) : '');
    setNotes(b.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!memberName.trim()) {
      toast.error('Please enter an administrative member name.');
      return;
    }

    if (!memberEmail.trim() && !memberPhone.trim()) {
      toast.error('At least one contact method (Verified Email or Mobile Number) is required.');
      return;
    }

    if (discountPercentage < 1 || discountPercentage > 100) {
      toast.error('Discount percentage must be between 1% and 100%.');
      return;
    }

    if (scope === 'selected_restaurants' && selectedTenantIds.length === 0) {
      toast.error('Please select at least one restaurant when scope is restricted.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(editingBenefit ? 'Updating member benefit...' : 'Registering member benefit...');

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Authentication expired. Please sign in again.');
      }

      const payload = {
        memberName: memberName.trim(),
        memberEmail: memberEmail.trim() || undefined,
        memberPhone: memberPhone.trim() || undefined,
        discountPercentage: Number(discountPercentage),
        status,
        scope,
        applicableTenantIds: scope === 'selected_restaurants' ? selectedTenantIds : [],
        fundingModel,
        platformContributionPercent: fundingModel === 'platform_funded' ? 100 : fundingModel === 'restaurant_funded' ? 0 : 50,
        restaurantContributionPercent: fundingModel === 'restaurant_funded' ? 100 : fundingModel === 'platform_funded' ? 0 : 50,
        usageFrequency,
        maxUsageTotal: maxUsageTotal ? Number(maxUsageTotal) : null,
        maxDiscountPerOrder: maxDiscountPerOrder ? Number(maxDiscountPerOrder) : null,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        notes: notes.trim()
      };

      const url = editingBenefit ? `/api/special-benefits/admin?id=${editingBenefit.id}` : '/api/special-benefits/admin';
      const method = editingBenefit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save special benefit.');
      }

      toast.success(editingBenefit ? 'Special benefit updated successfully!' : 'Eligible member registered successfully!', { id: toastId });
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('[SuperAdminSpecialBenefits] Submit error:', err);
      toast.error(err.message || 'Operation failed.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (benefit: ISpecialBenefit) => {
    const newStatus: TSpecialBenefitStatus = benefit.status === 'active' ? 'inactive' : 'active';
    const toastId = toast.loading(`${newStatus === 'active' ? 'Activating' : 'Deactivating'} benefit...`);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication expired.');

      const res = await fetch(`/api/special-benefits/admin?id=${benefit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status.');
      }

      toast.success(`Special benefit is now ${newStatus}.`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status.', { id: toastId });
    }
  };

  const handleDelete = async (benefit: ISpecialBenefit) => {
    const confirm = window.confirm(
      `Are you sure you want to remove or inactivate "${benefit.memberName}"? If redemptions exist, it will be marked inactive to preserve audit records.`
    );
    if (!confirm) return;

    const toastId = toast.loading('Removing benefit...');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication expired.');

      const res = await fetch(`/api/special-benefits/admin?id=${benefit.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove benefit.');
      }

      toast.success(data.message || 'Special benefit removed.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove.', { id: toastId });
    }
  };

  const handleViewRedemptions = useCallback(async (benefit: ISpecialBenefit) => {
    setSelectedBenefitForRedemptions(benefit);
    setIsLoadingRedemptions(true);
    setRedemptions([]);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication expired.');

      const res = await fetch(`/api/special-benefits/admin?id=${benefit.id}`, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.redemptions)) {
        setRedemptions(data.redemptions);
      }
    } catch (err) {
      console.warn('[SuperAdminSpecialBenefits] Failed to load redemptions:', err);
    } finally {
      setIsLoadingRedemptions(false);
    }
  }, []);

  const filteredBenefits = benefits.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;

    const q = searchTerm.toLowerCase();
    return (
      (b.memberName || '').toLowerCase().includes(q) ||
      (b.memberEmail || '').toLowerCase().includes(q) ||
      (b.memberPhone || '').toLowerCase().includes(q) ||
      (b.memberUid || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q)
    );
  });

  const activeCount = benefits.filter(b => b.status === 'active').length;
  const totalRedemptionsCount = benefits.reduce((acc, b) => acc + (b.redemptionCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-white tracking-tight">Special Benefits</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage exclusive membership benefits, automatic discount rates, and member registry
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register Eligible Member</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0C111D] border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Registered Members</span>
            <UserCheck className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white tracking-tight">{benefits.length}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Active directory entries</span>
        </div>

        <div className="bg-[#0C111D] border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Benefits</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 tracking-tight">{activeCount}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Ready for automatic checkout</span>
        </div>

        <div className="bg-[#0C111D] border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Default Discount Rate</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400 tracking-tight">50%</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Configurable per member (1-100%)</span>
        </div>

        <div className="bg-[#0C111D] border border-slate-800/80 rounded-2xl p-4.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Redemptions</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-400 tracking-tight">{totalRedemptionsCount}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Completed order benefits</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-[#0C111D] border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 shrink-0">Status:</span>
          <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
            {(['all', 'active', 'inactive'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setStatusFilter(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  statusFilter === mode
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-[#0C111D] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-xs text-slate-400">Loading special benefits directory...</span>
          </div>
        ) : filteredBenefits.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">No special benefits found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchTerm
                ? 'No registered member records matched your search filter.'
                : 'Click "Register Eligible Member" to register your first verified member.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Verified Identifier</th>
                  <th className="py-3 px-4">UID Status</th>
                  <th className="py-3 px-4 text-center">Discount</th>
                  <th className="py-3 px-4">Scope & Funding</th>
                  <th className="py-3 px-4 text-center">Usage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBenefits.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-100">{b.memberName}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">{b.id}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex flex-col gap-0.5">
                        {b.memberEmail && (
                          <span className="text-slate-300 font-mono text-[11px]">{b.memberEmail}</span>
                        )}
                        {b.memberPhone && (
                          <span className="text-amber-400/90 font-mono text-[11px]">{b.memberPhone}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {b.memberUid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={`Bound UID: ${b.memberUid}`}>
                          <CheckCircle className="w-2.5 h-2.5" /> Bound
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          <Clock className="w-2.5 h-2.5" /> Pending First Order
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs tracking-tight">
                        {b.discountPercentage}%
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-[11px] space-y-0.5">
                        <span className="text-slate-300 font-medium">
                          {b.scope === 'all_restaurants' ? 'All Restaurants' : `${b.applicableTenantIds?.length || 0} Restaurants`}
                        </span>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {b.fundingModel.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-slate-200">
                          {b.redemptionCount || 0}
                          {b.maxUsageTotal ? ` / ${b.maxUsageTotal}` : ''}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {b.usageFrequency.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(b)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          b.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                        }`}
                        title="Click to toggle status"
                      >
                        {b.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span className="capitalize">{b.status}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewRedemptions(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                          title="View Redemptions Audit History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Edit Configuration"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                          title="Remove Benefit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0C111D] border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingBenefit ? 'Edit Special Benefit' : 'Register Eligible Member'}
                  </h3>
                  <span className="text-[11px] text-slate-400 block">
                    Zero-trust automatic membership discount configuration
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Member Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Member Administrative Label <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Verified Contact Identifiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Verified Email Address
                  </label>
                  <input
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Requires email_verified == true
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Mobile Number (Phone OTP)
                  </label>
                  <input
                    type="text"
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Standard E.164 phone format
                  </span>
                </div>
              </div>

              {/* Discount Percentage */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">
                    Discount Percentage (1% - 100%) <span className="text-amber-500">*</span>
                  </label>
                  <span className="text-amber-400 font-bold text-sm">{discountPercentage}%</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-500">Quick Presets:</span>
                  {[25, 50, 75, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDiscountPercentage(val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                        discountPercentage === val
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Restaurant Scope & Funding Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Restaurant Scope</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as TSpecialBenefitScope)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all_restaurants">All Restaurants (Platform-wide)</option>
                    <option value="selected_restaurants">Selected Participating Locations</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Funding Model</label>
                  <select
                    value={fundingModel}
                    onChange={(e) => setFundingModel(e.target.value as TSpecialBenefitFunding)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="platform_funded">Platform Funded (100% SaaS Subsidized)</option>
                    <option value="restaurant_funded">Restaurant Funded (100% Absorbed)</option>
                    <option value="joint_funded">Joint Funded (50% / 50%)</option>
                  </select>
                </div>
              </div>

              {/* Multi-select restaurants if selected_restaurants */}
              {scope === 'selected_restaurants' && (
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 space-y-2">
                  <span className="text-slate-300 font-semibold block text-[11px]">
                    Select Participating Restaurants ({selectedTenantIds.length} selected)
                  </span>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {restaurants.map((r) => {
                      const isSelected = selectedTenantIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-[11px] transition-colors ${
                            isSelected ? 'bg-amber-500/10 text-amber-300' : 'text-slate-400 hover:bg-slate-800/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTenantIds([...selectedTenantIds, r.id]);
                              } else {
                                setSelectedTenantIds(selectedTenantIds.filter((id) => id !== r.id));
                              }
                            }}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0"
                          />
                          <span>{r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Usage Frequency & Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Frequency Limit</label>
                  <select
                    value={usageFrequency}
                    onChange={(e) => setUsageFrequency(e.target.value as TSpecialBenefitFrequency)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="once_per_day">Once per day</option>
                    <option value="once_per_week">Once per week</option>
                    <option value="once_total">Once total (Single use)</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Lifetime Cap</label>
                  <input
                    type="number"
                    min="1"
                    value={maxUsageTotal}
                    onChange={(e) => setMaxUsageTotal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max Cap / Order (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={maxDiscountPerOrder}
                    onChange={(e) => setMaxDiscountPerOrder(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Validity Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expiry Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Administrative Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium hover:bg-slate-800/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingBenefit ? 'Update Benefit' : 'Save Eligible Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redemptions Audit Drawer */}
      {selectedBenefitForRedemptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0C111D] border-l border-slate-800 w-full max-w-lg h-full flex flex-col p-6 space-y-4 shadow-2xl animate-slide-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Redemptions History</span>
                </h3>
                <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                  {selectedBenefitForRedemptions.memberName} ({selectedBenefitForRedemptions.discountPercentage}% Discount)
                </span>
              </div>
              <button
                onClick={() => setSelectedBenefitForRedemptions(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingRedemptions ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                <span className="text-xs text-slate-500">Retrieving audit records...</span>
              </div>
            ) : redemptions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Clock className="w-8 h-8 text-slate-600" />
                <span className="text-xs font-semibold text-slate-400">No redemptions recorded yet</span>
                <p className="text-[11px] text-slate-500">
                  When this member authenticates and places an order, the discount reservation and settlement will appear here.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {redemptions.map((r) => (
                  <div key={r.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400">{r.orderId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        r.status === 'finalized'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.status === 'reserved'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Restaurant</span>
                        <span className="text-slate-200 font-medium truncate block">{r.restaurantName || r.tenantId}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Reserved At</span>
                        <span className="text-slate-300 font-mono text-[10px]">{new Date(r.reservedAt).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                      <span className="text-slate-400">Subtotal: ₹{(r.originalSubtotal / 100).toFixed(2)}</span>
                      <span className="text-amber-400 font-semibold">Discount: -₹{(r.discountAmount / 100).toFixed(2)}</span>
                      <span className="text-white font-bold">Total: ₹{(r.finalPayableAmount / 100).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSpecialBenefits;
