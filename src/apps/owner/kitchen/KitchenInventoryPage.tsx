import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { inventoryService } from '../../../shared/services/inventoryService';
import { IStockIngredient, IStockMovement } from '../../../shared/domain/inventory/types';

// UI Kit
import Card from '../../../components/ui/Card/Card';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import Badge from '../../../components/ui/Badge/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Icons
import { 
  Package, 
  Plus, 
  Minus, 
  Trash2, 
  Sliders, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Search, 
  History, 
  Clock, 
  MapPin, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  RotateCcw,
  RefreshCw,
  Layers,
  Filter,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export const KitchenInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // Real-time Firestore States
  const [ingredients, setIngredients] = useState<IStockIngredient[]>([]);
  const [movements, setMovements] = useState<IStockMovement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out_of_stock' | 'healthy'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Operational Action Modal States
  const [activeAction, setActiveAction] = useState<'receive' | 'usage' | 'waste' | 'adjust' | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<IStockIngredient | null>(null);
  const [actionQuantity, setActionQuantity] = useState<string>('');
  const [actionReason, setActionReason] = useState<string>('');
  const [wasteReason, setWasteReason] = useState<'spoilage' | 'expired' | 'damaged' | 'staff_mistake' | 'customer_return'>('spoilage');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 1. Subscribe to canonical Firestore collections in real time
  useEffect(() => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Canonical Inventory listener: restaurants/{tenantId}/inventory
    const inventoryCol = collection(db, 'restaurants', tenantId, 'inventory');
    const unsubInventory = onSnapshot(
      inventoryCol,
      (snap) => {
        const list: IStockIngredient[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) } as IStockIngredient);
        });
        // Alphabetical sort by ingredient name
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setIngredients(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('[KitchenInventory] Inventory listener error:', err);
        setError('Failed to connect to real-time inventory feed.');
        setIsLoading(false);
      }
    );

    // Canonical Stock Movements listener: restaurants/{tenantId}/stockMovements
    const movementsCol = collection(db, 'restaurants', tenantId, 'stockMovements');
    const qMovements = query(movementsCol, orderBy('timestamp', 'desc'), limit(50));
    const unsubMovements = onSnapshot(
      qMovements,
      (snap) => {
        const list: IStockMovement[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) } as IStockMovement);
        });
        setMovements(list);
      },
      (err) => {
        console.warn('[KitchenInventory] Movements listener warning:', err);
      }
    );

    return () => {
      unsubInventory();
      unsubMovements();
    };
  }, [tenantId]);

  // Derived unique categories
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    ingredients.forEach((i) => {
      if (i.category) cats.add(i.category);
    });
    return ['all', ...Array.from(cats)];
  }, [ingredients]);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesCategory = (item.category || '').toLowerCase().includes(q);
        const matchesLocation = (item.storageLocation || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCategory && !matchesLocation) return false;
      }

      // Status
      if (statusFilter === 'low') {
        const isLow = item.status === 'low' || item.status === 'critical';
        if (!isLow) return false;
      } else if (statusFilter === 'out_of_stock') {
        if (item.status !== 'out_of_stock' && (item.currentStock ?? 0) > 0) return false;
      } else if (statusFilter === 'healthy') {
        if (item.status !== 'healthy' && (item.status as string) !== 'In Stock') return false;
      }

      // Category
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [ingredients, searchQuery, statusFilter, categoryFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    let healthyCount = 0;
    let lowCount = 0;
    let outCount = 0;

    ingredients.forEach((i) => {
      const stock = i.currentStock ?? 0;
      const min = i.minimumStock ?? 5;
      if (stock <= 0 || i.status === 'out_of_stock') {
        outCount++;
      } else if (stock <= min || i.status === 'low' || i.status === 'critical') {
        lowCount++;
      } else {
        healthyCount++;
      }
    });

    return {
      total: ingredients.length,
      healthy: healthyCount,
      low: lowCount,
      out: outCount
    };
  }, [ingredients]);

  // Modal Opener Helpers
  const openActionModal = (action: 'receive' | 'usage' | 'waste' | 'adjust', item: IStockIngredient) => {
    setSelectedIngredient(item);
    setActiveAction(action);
    setActionQuantity('');
    setActionReason(
      action === 'receive' 
        ? 'Shipment received & verified' 
        : action === 'usage' 
        ? 'Service prep & cooking consumption' 
        : action === 'adjust' 
        ? 'Kitchen physical stock count correction' 
        : ''
    );
    setWasteReason('spoilage');
  };

  const closeActionModal = () => {
    setActiveAction(null);
    setSelectedIngredient(null);
    setActionQuantity('');
    setActionReason('');
    setIsSubmitting(false);
  };

  // Operational Action Execution
  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedIngredient || !activeAction) return;

    const qty = parseFloat(actionQuantity);
    if (isNaN(qty) || (qty <= 0 && activeAction !== 'adjust')) {
      toast.error('Please enter a valid quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeAction === 'receive') {
        await inventoryService.receiveStock(tenantId, selectedIngredient.id, {
          quantityAdded: qty,
          reason: actionReason.trim() || 'Shipment received',
          user
        });
        toast.success(`Received ${qty} ${selectedIngredient.unit} of ${selectedIngredient.name}!`);
      } else if (activeAction === 'usage') {
        if (qty > (selectedIngredient.currentStock ?? 0)) {
          toast.error(`Cannot deduct more than available stock (${selectedIngredient.currentStock} ${selectedIngredient.unit}).`);
          setIsSubmitting(false);
          return;
        }
        await inventoryService.recordUsage(tenantId, selectedIngredient.id, {
          quantityUsed: qty,
          reason: actionReason.trim() || 'Service consumption',
          user
        });
        toast.success(`Deducted ${qty} ${selectedIngredient.unit} of ${selectedIngredient.name}.`);
      } else if (activeAction === 'waste') {
        if (qty > (selectedIngredient.currentStock ?? 0)) {
          toast.error(`Wasted quantity exceeds available stock (${selectedIngredient.currentStock} ${selectedIngredient.unit}).`);
          setIsSubmitting(false);
          return;
        }
        const costPerUnit = selectedIngredient.purchaseCost || 0;
        const valueLost = qty * costPerUnit;

        await inventoryService.recordWaste(tenantId, {
          ingredientId: selectedIngredient.id,
          ingredientName: selectedIngredient.name,
          quantity: qty,
          unit: selectedIngredient.unit,
          reason: wasteReason,
          notes: actionReason.trim(),
          valueLost,
          submittedBy: user?.uid || 'kitchen-staff',
          submittedByName: user?.displayName || user?.email || 'Kitchen Chef',
          performedByRole: user?.role || 'kitchen'
        });
        toast.success(`Logged ${qty} ${selectedIngredient.unit} waste for ${selectedIngredient.name}.`);
      } else if (activeAction === 'adjust') {
        const newStock = Math.max(0, qty);
        await inventoryService.adjustStock(tenantId, selectedIngredient.id, {
          newStock,
          reason: actionReason.trim() || 'Physical inventory audit',
          user
        });
        toast.success(`Adjusted ${selectedIngredient.name} stock to ${newStock} ${selectedIngredient.unit}!`);
      }

      closeActionModal();
    } catch (err: any) {
      console.error('[KitchenInventory] Action execution error:', err);
      toast.error(err.message || 'Failed to update stock. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left pb-12 animate-in fade-in duration-200">
      {/* ─── Top Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-400 mb-1.5">
            <Package className="w-3.5 h-3.5" />
            <span>Kitchen Operational Inventory</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-textPearl tracking-tight">
            Inventory & Ingredients
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Live day-to-day stock monitoring, usage deductions, and waste logging synchronized in real-time with Owner.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 text-xs bg-slate-900 border-slate-800 hover:bg-slate-850 text-textPearl"
          >
            <History className="w-4 h-4 text-amber-400" />
            <span>Stock Movements ({movements.length})</span>
          </Button>
        </div>
      </div>

      {/* ─── KPI Metrics Strip ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
            <span className="text-2xl font-black font-mono text-textPearl mt-0.5 block">{metrics.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 text-slate-300 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">In Stock (Healthy)</span>
            <span className="text-2xl font-black font-mono text-emerald-400 mt-0.5 block">{metrics.healthy}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Low Stock Alerts</span>
            <span className={`text-2xl font-black font-mono mt-0.5 block ${metrics.low > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {metrics.low}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Out of Stock</span>
            <span className={`text-2xl font-black font-mono mt-0.5 block ${metrics.out > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
              {metrics.out}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* ─── Search & Status Filters ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ingredient, category, location..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-slate-800 text-textPearl rounded-xl text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Status Pills */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-textPearl border border-slate-800'
            }`}
          >
            All ({ingredients.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('low')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'low'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock ({metrics.low})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('out_of_stock')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'out_of_stock'
                ? 'bg-rose-500 text-slate-950 shadow-xs'
                : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Out of Stock ({metrics.out})</span>
          </button>

          {/* Category Filter Select */}
          {availableCategories.length > 2 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500 shrink-0"
            >
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ─── Main Ingredients Grid ─── */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <LoadingSpinner label="Loading live inventory..." />
        </div>
      ) : error ? (
        <Card className="p-8 text-center bg-rose-500/5 border-rose-500/20 max-w-md mx-auto space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold text-textPearl">{error}</h3>
          <p className="text-xs text-slate-400">Please verify your restaurant permissions and connection.</p>
        </Card>
      ) : filteredIngredients.length === 0 ? (
        <Card className="p-12 text-center bg-slate-900/40 border-slate-800 space-y-3 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-amber-400">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-textPearl">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'No matching ingredients found'
              : 'No inventory configured yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your search query or filter settings.'
              : 'Ingredients created by the restaurant owner will appear here live with full stock controls.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredIngredients.map((item) => {
            const stock = item.currentStock ?? 0;
            const minStock = item.minimumStock ?? 5;
            const isOutOfStock = stock <= 0 || item.status === 'out_of_stock';
            const isLowStock = !isOutOfStock && (stock <= minStock || item.status === 'low' || item.status === 'critical');
            const stockPercentage = Math.min(100, Math.round((stock / (item.maximumStock || minStock * 3 || 10)) * 100));

            return (
              <Card
                key={item.id}
                className={`p-5 flex flex-col justify-between space-y-4 transition-all ${
                  isOutOfStock
                    ? 'bg-rose-950/15 border-rose-500/30'
                    : isLowStock
                    ? 'bg-amber-950/15 border-amber-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header: Title + Status Badge */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-textPearl leading-tight">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-semibold">
                        {item.category && (
                          <span className="bg-slate-800/80 px-2 py-0.5 rounded-md text-slate-300">
                            {item.category}
                          </span>
                        )}
                        {item.storageLocation && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            <span>{item.storageLocation}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 border ${
                        isOutOfStock
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                          : isLowStock
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>
                </div>

                {/* Stock Level Display & Progress */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Current Stock
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className={`text-2xl font-black font-mono ${
                          isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-textPearl'
                        }`}>
                          {stock}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{item.unit}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Min Safety Limit
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-300 mt-0.5 block">
                        {minStock} {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Stock Level Bar */}
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOutOfStock ? 'bg-rose-500 w-0' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(5, stockPercentage)}%` }}
                    />
                  </div>

                  {item.expiryDate && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      <span>Expires: {item.expiryDate}</span>
                    </div>
                  )}
                </div>

                {/* Operational Actions Strip */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => openActionModal('receive', item)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-850 hover:bg-emerald-500/20 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/40 text-slate-300 text-[11px] font-bold transition-all cursor-pointer group active:scale-95"
                  >
                    <Plus className="w-4 h-4 mb-0.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Receive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openActionModal('usage', item)}
                    disabled={isOutOfStock}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-850 hover:bg-amber-500/20 hover:text-amber-400 border border-slate-800 hover:border-amber-500/40 text-slate-300 text-[11px] font-bold transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Minus className="w-4 h-4 mb-0.5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>Use</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openActionModal('waste', item)}
                    disabled={isOutOfStock}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-850 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 text-slate-300 text-[11px] font-bold transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Trash2 className="w-4 h-4 mb-0.5 text-rose-400 group-hover:scale-110 transition-transform" />
                    <span>Waste</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Operational Action Modal ─── */}
      <Modal
        isOpen={activeAction !== null}
        onClose={closeActionModal}
        title={
          activeAction === 'receive'
            ? `Receive Stock — ${selectedIngredient?.name}`
            : activeAction === 'usage'
            ? `Record Kitchen Usage — ${selectedIngredient?.name}`
            : activeAction === 'waste'
            ? `Log Waste / Spoilage — ${selectedIngredient?.name}`
            : `Adjust Stock Count — ${selectedIngredient?.name}`
        }
      >
        {selectedIngredient && (
          <form onSubmit={handleExecuteAction} className="space-y-4 text-left">
            {/* Context Badge Banner */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Stock Level</span>
                <span className="text-base font-black font-mono text-textPearl mt-0.5 block">
                  {selectedIngredient.currentStock ?? 0} {selectedIngredient.unit}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Safety Limit</span>
                <span className="text-xs font-bold font-mono text-slate-300 block">
                  {selectedIngredient.minimumStock ?? 5} {selectedIngredient.unit}
                </span>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                {activeAction === 'receive'
                  ? `Quantity Received (${selectedIngredient.unit})`
                  : activeAction === 'usage'
                  ? `Quantity Used (${selectedIngredient.unit})`
                  : activeAction === 'waste'
                  ? `Quantity Wasted (${selectedIngredient.unit})`
                  : `New Total Stock (${selectedIngredient.unit})`}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                autoFocus
                value={actionQuantity}
                onChange={(e) => setActionQuantity(e.target.value)}
                placeholder={`e.g., ${activeAction === 'adjust' ? selectedIngredient.currentStock : '5'}`}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-textPearl rounded-xl text-base font-mono font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Waste Reason Selector (only for waste) */}
            {activeAction === 'waste' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Reason for Waste</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-textPearl rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="spoilage">Spoilage / Rotten</option>
                  <option value="expired">Expired Date</option>
                  <option value="damaged">Damaged in Handling</option>
                  <option value="staff_mistake">Kitchen / Cooking Mistake</option>
                  <option value="customer_return">Customer Return</option>
                </select>
              </div>
            )}

            {/* Operational Reason / Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Operational Notes / Reason
              </label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g., Morning prep, Delivery invoice #482, Drop on floor..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 text-textPearl rounded-xl text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={closeActionModal}
                disabled={isSubmitting}
                className="bg-slate-900 border-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={
                  activeAction === 'waste'
                    ? 'bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold'
                    : activeAction === 'receive'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold'
                }
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </span>
                ) : activeAction === 'receive' ? (
                  'Confirm Receipt'
                ) : activeAction === 'usage' ? (
                  'Confirm Usage'
                ) : activeAction === 'waste' ? (
                  'Log Wastage'
                ) : (
                  'Update Stock'
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Real-Time Stock Movement History Modal ─── */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Live Inventory Movement History"
        size="2xl"
      >
        <div className="space-y-3 text-left">
          <p className="text-xs text-slate-400">
            Real-time audit log of stock received, service consumption, adjustments, and kitchen wastage.
          </p>

          {movements.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
              No stock movements recorded yet. Movements will automatically log here whenever stock is received or used.
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {movements.map((m) => {
                const isPositive = (m.quantity || 0) > 0;
                const isWaste = m.type === 'waste';

                return (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-950/80 rounded-xl border border-slate-850 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isWaste
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : isWaste ? (
                          <Trash2 className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-textPearl font-extrabold">{m.ingredientName}</strong>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              isPositive
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isWaste
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {m.type?.replace('_', ' ') || 'Movement'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{m.reason || 'Operational update'}</p>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 font-medium">
                          <span>By: {m.submittedByName || 'Staff'} ({m.performedByRole || 'Kitchen'})</span>
                          <span>•</span>
                          <span>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-black font-mono block ${
                          isPositive ? 'text-emerald-400' : isWaste ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        {isPositive ? `+${m.quantity}` : m.quantity} {m.unit || ''}
                      </span>
                      {m.previousStock !== undefined && m.newStock !== undefined && (
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {m.previousStock} → {m.newStock}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 text-right">
            <Button
              variant="secondary"
              onClick={() => setShowHistoryModal(false)}
              className="bg-slate-900 border-slate-800 text-slate-300 text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default KitchenInventoryPage;
