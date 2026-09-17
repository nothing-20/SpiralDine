import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  query 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { restaurantService } from '../../../shared/services/restaurantService';
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
  ArrowLeftRight, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  Clock, 
  Package, 
  Building2, 
  ChevronRight, 
  AlertCircle,
  FileText,
  User,
  Check
} from 'lucide-react';

export type TTransferStatus = 'Requested' | 'Approved' | 'Dispatched' | 'Received' | 'Completed' | 'Rejected';

export interface IBranchTransfer {
  id: string;
  sourceRestaurantId: string;
  sourceRestaurantName: string;
  destRestaurantId: string;
  destRestaurantName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  requesterName: string;
  requesterId?: string;
  approverName?: string;
  approverId?: string;
  status: TTransferStatus;
  notes?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export const OwnerBranchTransfers: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [transfers, setTransfers] = useState<IBranchTransfer[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  // Create Transfer Modal State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [sourceId, setSourceId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(10);
  const [transferUnit, setTransferUnit] = useState<string>('kg');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Action Confirmation Dialog
  const [actionDialog, setActionDialog] = useState<{
    transfer: IBranchTransfer;
    targetStatus: TTransferStatus;
    title: string;
    message: string;
  } | null>(null);

  // 1. Fetch transfers, restaurants, and inventory
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const targetTenant = tenantId || 'default';

    // Fetch authorized restaurants
    const fetchRestaurants = async () => {
      try {
        const list = await restaurantService.getAuthorizedRestaurants(user);
        setRestaurants(list);
        if (list.length > 0 && !sourceId) {
          setSourceId(list[0].id);
          if (list.length > 1) setDestId(list[1].id);
        }
      } catch (_) {}
    };
    fetchRestaurants();

    // Fetch available inventory items from current tenant
    const fetchInventory = async () => {
      try {
        const snap = await getDocs(collection(db, 'restaurants', targetTenant, 'inventory'));
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setInventoryItems(list);
        if (list.length > 0) {
          setSelectedItemId(list[0].id);
          setTransferUnit(list[0].unit || 'kg');
        }
      } catch (_) {}
    };
    fetchInventory();

    // Real-time listener for branch transfers
    const unsub = onSnapshot(
      collection(db, 'restaurants', targetTenant, 'branchTransfers'),
      (snapshot) => {
        const list: IBranchTransfer[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as IBranchTransfer);
        });

        // Sort descending by date
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransfers(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Branch transfers stream error:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [user, tenantId]);

  // Update unit when selected item changes
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = inventoryItems.find(i => i.id === itemId);
    if (item?.unit) {
      setTransferUnit(item.unit);
    }
  };

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchItem = t.itemName?.toLowerCase().includes(q);
        const matchSrc = t.sourceRestaurantName?.toLowerCase().includes(q);
        const matchDest = t.destRestaurantName?.toLowerCase().includes(q);
        const matchId = t.id?.toLowerCase().includes(q);
        if (!matchItem && !matchSrc && !matchDest && !matchId) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (t.status !== statusFilter) return false;
      }

      // 3. Restaurant Filter
      if (restaurantFilter !== 'all') {
        if (t.sourceRestaurantId !== restaurantFilter && t.destRestaurantId !== restaurantFilter) return false;
      }

      return true;
    });
  }, [transfers, searchQuery, statusFilter, restaurantFilter]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = transfers.length;
    const requested = transfers.filter(t => t.status === 'Requested').length;
    const inTransit = transfers.filter(t => t.status === 'Dispatched').length;
    const completed = transfers.filter(t => t.status === 'Completed' || t.status === 'Received').length;

    return { total, requested, inTransit, completed };
  }, [transfers]);

  // Create Transfer Request
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !destId || sourceId === destId) {
      toast.error('Source and Destination restaurants must be different');
      return;
    }
    if (transferQty <= 0) {
      toast.error('Transfer quantity must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    const targetTenant = tenantId || sourceId || 'default';
    const transferId = `TRF-${Date.now().toString(36).toUpperCase()}`;

    const srcName = restaurants.find(r => r.id === sourceId)?.name || 'Source Restaurant';
    const dstName = restaurants.find(r => r.id === destId)?.name || 'Destination Restaurant';
    const selectedItem = inventoryItems.find(i => i.id === selectedItemId);
    const itemName = selectedItem?.name || 'Bulk Inventory Item';

    try {
      const payload: IBranchTransfer = {
        id: transferId,
        sourceRestaurantId: sourceId,
        sourceRestaurantName: srcName,
        destRestaurantId: destId,
        destRestaurantName: dstName,
        itemId: selectedItemId,
        itemName,
        quantity: Number(transferQty),
        unit: transferUnit,
        requesterName: user?.displayName || user?.email || 'Owner',
        requesterId: user?.uid,
        status: 'Requested',
        notes: transferNotes.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      // Write to source restaurant transfer collection
      await setDoc(doc(db, 'restaurants', targetTenant, 'branchTransfers', transferId), payload);

      // Audit log
      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        module: 'BranchTransfers',
        action: 'TRANSFER',
        targetEntity: `Transfer ${transferQty} ${transferUnit} of ${itemName} from ${srcName} to ${dstName}`,
        newValue: payload
      });

      toast.success('Branch transfer request created');
      setIsCreateOpen(false);
      setTransferNotes('');
    } catch (err: any) {
      console.error('Create transfer error:', err);
      toast.error('Failed to create transfer request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lifecycle status transition
  const handleTransitionStatus = async (transfer: IBranchTransfer, targetStatus: TTransferStatus) => {
    const targetTenant = tenantId || transfer.sourceRestaurantId || 'default';

    try {
      const now = new Date().toISOString();
      const updateData: any = {
        status: targetStatus,
        updatedAt: now
      };

      if (targetStatus === 'Approved') {
        updateData.approverName = user?.displayName || 'Owner';
        updateData.approverId = user?.uid;
      } else if (targetStatus === 'Dispatched') {
        updateData.dispatchedAt = now;
      } else if (targetStatus === 'Received' || targetStatus === 'Completed') {
        updateData.receivedAt = now;
        updateData.status = 'Completed';
      }

      await updateDoc(doc(db, 'restaurants', targetTenant, 'branchTransfers', transfer.id), updateData);

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        module: 'BranchTransfers',
        action: 'STATUS_CHANGE',
        targetEntity: `Transfer ${transfer.id} status updated to ${targetStatus}`,
        previousValue: transfer.status,
        newValue: targetStatus
      });

      toast.success(`Transfer status updated to ${targetStatus}`);
      setActionDialog(null);
    } catch (err) {
      console.error('Update transfer status error:', err);
      toast.error('Failed to update status');
    }
  };

  // Helper status badge
  const getStatusBadge = (status: TTransferStatus) => {
    switch (status) {
      case 'Requested': return <Badge variant="warning">Requested</Badge>;
      case 'Approved': return <Badge variant="primary">Approved</Badge>;
      case 'Dispatched': return <Badge variant="warning">In Transit / Dispatched</Badge>;
      case 'Received':
      case 'Completed': return <Badge variant="success">Completed</Badge>;
      case 'Rejected': return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <ArrowLeftRight className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Branch Inventory Transfers
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Controlled inter-restaurant inventory transfer lifecycle: request, approve, dispatch, and receive stock.
          </p>
        </div>

        <Button 
          variant="primary" 
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#C9533B] hover:bg-[#B34530] text-white flex items-center space-x-2 rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>New Transfer</span>
        </Button>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D]">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Total Transfers</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{metrics.total}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Pending Approval</p>
            <p className="text-xl font-bold font-serif text-amber-600">{metrics.requested}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">In Transit</p>
            <p className="text-xl font-bold font-serif text-blue-600">{metrics.inTransit}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#16845B]/10 flex items-center justify-center text-[#16845B]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Completed</p>
            <p className="text-xl font-bold font-serif text-[#16845B]">{metrics.completed}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search items, branches, transfer ID..." 
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
            <option value="Requested">Requested</option>
            <option value="Approved">Approved</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Completed">Completed</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Restaurant Filter */}
          {restaurants.length > 1 && (
            <select 
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
            >
              <option value="all">All Branches</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Main Transfers List ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Loading branch transfers..." />
        </div>
      ) : filteredTransfers.length === 0 ? (
        <EmptyState 
          title="No branch transfers found"
          description={
            searchQuery 
              ? "No transfer records match your active search." 
              : "No inter-restaurant inventory transfers requested yet."
          }
          actionLabel="Create Branch Transfer"
          onActionClick={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map((t) => (
            <div 
              key={t.id} 
              className="p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#C9533B]/40 transition-all shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              {/* Left Column: Transfer Route & Item */}
              <div className="flex items-start space-x-3.5 min-w-[280px]">
                <div className="w-10 h-10 rounded-xl bg-[#12352D] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Package className="w-5 h-5 text-[#C9533B]" />
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-serif font-bold text-sm text-[#17202A]">
                      {t.quantity} {t.unit} &middot; {t.itemName}
                    </h3>
                    {getStatusBadge(t.status)}
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-[#6B7280] mt-1">
                    <span className="font-semibold text-[#12352D]">{t.sourceRestaurantName}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C9533B]" />
                    <span className="font-semibold text-[#17202A]">{t.destRestaurantName}</span>
                  </div>

                  {t.notes && (
                    <p className="text-[11px] text-[#6B7280] italic mt-1">
                      "{t.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Middle Column: Requester & Approver */}
              <div className="flex items-center space-x-6 text-xs text-[#17202A] border-y md:border-y-0 md:border-x border-[#E5E7EB] py-2 md:py-0 md:px-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#6B7280]">Requested By</p>
                  <p className="font-bold text-[#17202A] mt-0.5">{t.requesterName}</p>
                </div>

                {t.approverName && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6B7280]">Approved By</p>
                    <p className="font-bold text-[#16845B] mt-0.5">{t.approverName}</p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase font-bold text-[#6B7280]">Date</p>
                  <p className="text-[#6B7280] mt-0.5">{new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Right Column: Lifecycle Actions */}
              <div className="flex items-center space-x-2 shrink-0 justify-end">
                {t.status === 'Requested' && (
                  <>
                    <button
                      onClick={() => handleTransitionStatus(t, 'Approved')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#16845B] text-white hover:bg-[#136E4B] shadow-sm flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => handleTransitionStatus(t, 'Rejected')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </>
                )}

                {t.status === 'Approved' && (
                  <button
                    onClick={() => handleTransitionStatus(t, 'Dispatched')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center space-x-1"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Dispatch Stock</span>
                  </button>
                )}

                {t.status === 'Dispatched' && (
                  <button
                    onClick={() => handleTransitionStatus(t, 'Completed')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#12352D] text-white hover:bg-[#1A473C] shadow-sm flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Received</span>
                  </button>
                )}

                {t.status === 'Completed' && (
                  <span className="text-xs font-bold text-[#16845B] flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Branch Transfer Modal ── */}
      {isCreateOpen && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Branch Inventory Transfer"
        >
          <form onSubmit={handleCreateTransfer} className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Source Restaurant *</label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                  required
                >
                  <option value="">-- Select Source --</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>{r.name || r.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Destination Restaurant *</label>
                <select
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                  required
                >
                  <option value="">-- Select Destination --</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>{r.name || r.id}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-[#17202A] mb-1">Inventory Item *</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                  required
                >
                  {inventoryItems.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.currentStock || i.stockLevel || 0} {i.unit || 'units'} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Quantity ({transferUnit}) *</label>
                <Input 
                  type="number"
                  min={1}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Transfer Notes / Reason</label>
              <Input 
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="e.g. Weekend stock rebalance due to private event reservation."
              />
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2">
              <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={isSubmitting}
                className="bg-[#C9533B] hover:bg-[#B34530] text-white"
              >
                {isSubmitting ? 'Submitting...' : 'Request Transfer'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default OwnerBranchTransfers;
