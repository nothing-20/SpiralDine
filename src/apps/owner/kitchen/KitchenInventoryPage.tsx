import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { inventoryService } from '../../../shared/services/inventoryService';
import { IStockIngredient, IStockMovement } from '../../../shared/domain/inventory/types';

// UI Kit
import Card from '../../../components/ui/Card/Card';
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
  Check,
  Sparkles,
  ChefHat,
  Truck,
  Scale,
  X,
  Flame,
  ShieldCheck,
  ChevronDown,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

// 12 Standard Kitchen Pantry Staples for Quick Setup
const DEFAULT_PANTRY_ESSENTIALS = [
  { name: 'Red Onions', category: 'Vegetables', unit: 'kg', currentStock: 25, minimumStock: 10, reorderLevel: 15, storageLocation: 'Pantry Shelf', purchaseCost: 1.2 },
  { name: 'Fresh Tomatoes', category: 'Vegetables', unit: 'kg', currentStock: 20, minimumStock: 8, reorderLevel: 12, storageLocation: 'Walk-in Chiller', purchaseCost: 1.5 },
  { name: 'Cooking Oil (Sunflower)', category: 'Dry Goods', unit: 'liters', currentStock: 30, minimumStock: 10, reorderLevel: 15, storageLocation: 'Dry Storage', purchaseCost: 2.8 },
  { name: 'Basmati Rice', category: 'Dry Goods', unit: 'kg', currentStock: 50, minimumStock: 15, reorderLevel: 25, storageLocation: 'Dry Storage', purchaseCost: 2.1 },
  { name: 'Fresh Paneer / Cottage Cheese', category: 'Dairy', unit: 'kg', currentStock: 12, minimumStock: 5, reorderLevel: 8, storageLocation: 'Walk-in Chiller', purchaseCost: 4.5 },
  { name: 'Chicken Breast (Boneless)', category: 'Meat', unit: 'kg', currentStock: 18, minimumStock: 8, reorderLevel: 12, storageLocation: 'Deep Freezer', purchaseCost: 6.0 },
  { name: 'Fresh Garlic', category: 'Vegetables', unit: 'kg', currentStock: 6, minimumStock: 3, reorderLevel: 5, storageLocation: 'Pantry Shelf', purchaseCost: 3.0 },
  { name: 'Ginger Root', category: 'Vegetables', unit: 'kg', currentStock: 5, minimumStock: 2, reorderLevel: 4, storageLocation: 'Pantry Shelf', purchaseCost: 3.2 },
  { name: 'Full Cream Milk', category: 'Dairy', unit: 'liters', currentStock: 15, minimumStock: 6, reorderLevel: 10, storageLocation: 'Walk-in Chiller', purchaseCost: 1.1 },
  { name: 'Unsalted Butter', category: 'Dairy', unit: 'kg', currentStock: 8, minimumStock: 3, reorderLevel: 5, storageLocation: 'Walk-in Chiller', purchaseCost: 5.5 },
  { name: 'Iodized Salt', category: 'Spices', unit: 'kg', currentStock: 15, minimumStock: 5, reorderLevel: 8, storageLocation: 'Dry Storage', purchaseCost: 0.6 },
  { name: 'Garam Masala Blend', category: 'Spices', unit: 'kg', currentStock: 4, minimumStock: 1.5, reorderLevel: 2.5, storageLocation: 'Spice Rack', purchaseCost: 8.0 }
] as const;

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Operational Action Modal States
  const [activeAction, setActiveAction] = useState<'receive' | 'usage' | 'waste' | 'adjust' | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<IStockIngredient | null>(null);
  const [actionQuantity, setActionQuantity] = useState<string>('');
  const [actionReason, setActionReason] = useState<string>('');
  const [wasteReason, setWasteReason] = useState<'spoilage' | 'expired' | 'damaged' | 'staff_mistake' | 'customer_return'>('spoilage');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Ingredient Form States
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'Vegetables' | 'Meat' | 'Dairy' | 'Dry Goods' | 'Beverages' | 'Spices' | 'Bakery' | 'Other'>('Vegetables');
  const [newUnit, setNewUnit] = useState<'kg' | 'g' | 'liters' | 'ml' | 'pieces' | 'packs'>('kg');
  const [newStock, setNewStock] = useState('10');
  const [newMinStock, setNewMinStock] = useState('5');
  const [newReorderLevel, setNewReorderLevel] = useState('8');
  const [newStorage, setNewStorage] = useState('Pantry Shelf');
  const [newCost, setNewCost] = useState('0');

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
    const unsubMovements = onSnapshot(
      movementsCol,
      (snap) => {
        const list: IStockMovement[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) } as IStockMovement);
        });
        // Newest movements first
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setMovements(list);
      },
      (err) => {
        console.warn('[KitchenInventory] Movements listener error:', err);
      }
    );

    return () => {
      unsubInventory();
      unsubMovements();
    };
  }, [tenantId]);

  // Categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ['all', ...Array.from(set)];
  }, [ingredients]);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesCat = (item.category || '').toLowerCase().includes(q);
        const matchesLoc = (item.storageLocation || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesLoc) return false;
      }

      // Status Filter
      const stock = Number(item.currentStock ?? 0);
      const min = Number(item.minimumStock ?? 5);
      const computedStatus = inventoryService.calculateStockStatus(stock, min, item.reorderLevel);

      if (statusFilter === 'low') {
        if (computedStatus !== 'low' && computedStatus !== 'critical') return false;
      } else if (statusFilter === 'out_of_stock') {
        if (computedStatus !== 'out_of_stock' && stock > 0) return false;
      } else if (statusFilter === 'healthy') {
        if (computedStatus !== 'healthy') return false;
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
      const stock = Number(i.currentStock ?? 0);
      const min = Number(i.minimumStock ?? 5);
      const computedStatus = inventoryService.calculateStockStatus(stock, min, i.reorderLevel);

      if (computedStatus === 'out_of_stock' || stock <= 0) {
        outCount++;
      } else if (computedStatus === 'low' || computedStatus === 'critical') {
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
        ? 'Prep & service consumption' 
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
        const costLoss = qty * (selectedIngredient.purchaseCost || 0);
        await inventoryService.recordWaste(tenantId, {
          ingredientId: selectedIngredient.id,
          ingredientName: selectedIngredient.name,
          quantity: qty,
          unit: selectedIngredient.unit,
          reason: wasteReason,
          valueLost: costLoss,
          submittedBy: user?.uid || 'kitchen',
          submittedByName: user?.displayName || 'Kitchen Chef',
          performedByRole: 'kitchen',
          notes: actionReason.trim() || `Kitchen ${wasteReason}`
        });
        toast.success(`Waste logged: -${qty} ${selectedIngredient.unit} ${selectedIngredient.name}.`);
      } else if (activeAction === 'adjust') {
        const newStockVal = Math.max(0, qty);
        await inventoryService.adjustStock(tenantId, selectedIngredient.id, {
          newStock: newStockVal,
          reason: actionReason.trim() || 'Physical inventory audit',
          user
        });
        toast.success(`Adjusted ${selectedIngredient.name} stock to ${newStockVal} ${selectedIngredient.unit}!`);
      }

      closeActionModal();
    } catch (err: any) {
      console.error('[KitchenInventory] Action execution error:', err);
      toast.error(err.message || 'Failed to update stock. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Quick Seed Essentials Handler
  const handleSeedEssentials = async () => {
    if (!tenantId) return;
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();

      DEFAULT_PANTRY_ESSENTIALS.forEach((item) => {
        const docId = item.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const ref = doc(db, 'restaurants', tenantId, 'inventory', docId);
        
        const status = inventoryService.calculateStockStatus(item.currentStock, item.minimumStock);
        
        batch.set(ref, {
          id: docId,
          name: item.name,
          category: item.category,
          unit: item.unit,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock,
          reorderLevel: item.reorderLevel,
          storageLocation: item.storageLocation,
          purchaseCost: item.purchaseCost,
          status,
          createdAt: timestamp,
          updatedAt: timestamp,
          lastReceivedDate: timestamp.split('T')[0]
        });

        // Audit movement
        const mvtId = `MVT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        const mvtRef = doc(db, 'restaurants', tenantId, 'stockMovements', mvtId);
        batch.set(mvtRef, {
          id: mvtId,
          tenantId,
          ingredientId: docId,
          ingredientName: item.name,
          quantity: item.currentStock,
          previousStock: 0,
          newStock: item.currentStock,
          unit: item.unit,
          type: 'purchase',
          reason: 'Initial Kitchen Pantry Setup',
          submittedBy: user?.uid || 'kitchen',
          submittedByName: user?.displayName || 'Kitchen Chef',
          performedByRole: user?.role || 'kitchen',
          timestamp
        });
      });

      await batch.commit();
      toast.success('✨ Successfully initialized 12 kitchen pantry staples!');
    } catch (err: any) {
      console.error('Seed error:', err);
      toast.error('Failed to seed essentials: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSeeding(false);
    }
  };

  // Create Custom Ingredient Handler
  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    if (!newName.trim()) {
      toast.error('Please enter ingredient name.');
      return;
    }

    const currentStockVal = parseFloat(newStock) || 0;
    const minStockVal = parseFloat(newMinStock) || 5;
    const reorderVal = parseFloat(newReorderLevel) || minStockVal * 1.5;
    const costVal = parseFloat(newCost) || 0;

    setIsSubmitting(true);
    try {
      const docId = newName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const docRef = doc(db, 'restaurants', tenantId, 'inventory', docId);
      const timestamp = new Date().toISOString();
      const status = inventoryService.calculateStockStatus(currentStockVal, minStockVal);

      await setDoc(docRef, {
        id: docId,
        name: newName.trim(),
        category: newCategory,
        unit: newUnit,
        currentStock: currentStockVal,
        minimumStock: minStockVal,
        reorderLevel: reorderVal,
        storageLocation: newStorage.trim() || 'Pantry Shelf',
        purchaseCost: costVal,
        status,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastReceivedDate: timestamp.split('T')[0]
      });

      // Audit movement
      const mvtId = `MVT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      await setDoc(doc(db, 'restaurants', tenantId, 'stockMovements', mvtId), {
        id: mvtId,
        tenantId,
        ingredientId: docId,
        ingredientName: newName.trim(),
        quantity: currentStockVal,
        previousStock: 0,
        newStock: currentStockVal,
        unit: newUnit,
        type: 'purchase',
        reason: 'Initial Stock Master Entry',
        submittedBy: user?.uid || 'kitchen',
        submittedByName: user?.displayName || 'Kitchen Chef',
        performedByRole: user?.role || 'kitchen',
        timestamp
      });

      toast.success(`"${newName.trim()}" added to inventory!`);
      setShowAddModal(false);
      setNewName('');
      setNewStock('10');
      setNewMinStock('5');
    } catch (err: any) {
      console.error('Create error:', err);
      toast.error('Failed to create ingredient: ' + (err.message || 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left select-none pb-24 font-sans max-w-7xl mx-auto">
      {/* ─── Editorial Header Banner ─── */}
      <div className="bg-white border border-[#E3DED5] rounded-2xl p-6 sm:p-7 shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#F7F4EE] border border-[#E3DED5] text-[11px] font-bold uppercase tracking-wider text-[#6F746F]">
              <Package className="w-3.5 h-3.5 text-[#C84A38]" />
              <span>Kitchen Operational Stock Master</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#18201D] tracking-tight">
              Inventory & Ingredients
            </h1>
            <p className="text-xs sm:text-sm text-[#6F746F] max-w-2xl font-normal">
              Real-time ingredient tracking, rapid kitchen usage deductions, delivery check-ins, and spoilage logging synchronized instantly with Owner.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-bold shadow-[0_1px_3px_rgba(30,30,20,0.04)] transition-all cursor-pointer"
              title="View immutable stock movement ledger"
            >
              <History className="w-4 h-4 text-[#C84A38]" />
              <span>Movement Ledger ({movements.length})</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#13241F] hover:bg-[#1A312B] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>+ Add Ingredient</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── High-Contrast KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Items */}
        <div 
          onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); }}
          className={`p-5 bg-white border rounded-2xl shadow-[0_1px_4px_rgba(30,30,20,0.04)] flex items-center justify-between cursor-pointer transition-all hover:border-[#18201D]/30 ${
            statusFilter === 'all' && categoryFilter === 'all' ? 'border-[#18201D] ring-2 ring-[#18201D]/5' : 'border-[#E3DED5]'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-[#6F746F] uppercase tracking-wider block">
              Total Ingredients
            </span>
            <span className="text-3xl font-serif font-bold text-[#18201D] mt-1 block">
              {metrics.total}
            </span>
            <span className="text-[10px] text-[#6F746F] block mt-0.5">Across all categories</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] flex items-center justify-center">
            <Layers className="w-6 h-6 text-[#18201D]" />
          </div>
        </div>

        {/* Healthy In Stock */}
        <div 
          onClick={() => setStatusFilter('healthy')}
          className={`p-5 bg-white border rounded-2xl shadow-[0_1px_4px_rgba(30,30,20,0.04)] flex items-center justify-between cursor-pointer transition-all hover:border-[#287A55]/40 ${
            statusFilter === 'healthy' ? 'border-[#287A55] ring-2 ring-[#287A55]/10 bg-[#EBF7EE]/20' : 'border-[#E3DED5]'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-[#287A55] uppercase tracking-wider block">
              In Stock (Healthy)
            </span>
            <span className="text-3xl font-serif font-bold text-[#287A55] mt-1 block">
              {metrics.healthy}
            </span>
            <span className="text-[10px] text-[#5F6762] block mt-0.5">Above reorder threshold</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#EBF7EE] border border-[#287A55]/30 text-[#287A55] flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div 
          onClick={() => setStatusFilter('low')}
          className={`p-5 bg-white border rounded-2xl shadow-[0_1px_4px_rgba(30,30,20,0.04)] flex items-center justify-between cursor-pointer transition-all hover:border-[#D79A24]/40 ${
            statusFilter === 'low' ? 'border-[#D79A24] ring-2 ring-[#D79A24]/10 bg-[#FEF5E7]/20' : 'border-[#E3DED5]'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-[#D79A24] uppercase tracking-wider block">
              Low Stock Alerts
            </span>
            <span className="text-3xl font-serif font-bold text-[#D79A24] mt-1 block">
              {metrics.low}
            </span>
            <span className="text-[10px] text-[#5F6762] block mt-0.5">Below minimum buffer</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#FEF5E7] border border-[#D79A24]/30 text-[#D79A24] flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Out of Stock */}
        <div 
          onClick={() => setStatusFilter('out_of_stock')}
          className={`p-5 bg-white border rounded-2xl shadow-[0_1px_4px_rgba(30,30,20,0.04)] flex items-center justify-between cursor-pointer transition-all hover:border-[#C7463A]/40 ${
            statusFilter === 'out_of_stock' ? 'border-[#C7463A] ring-2 ring-[#C7463A]/10 bg-[#FDEEEC]/20' : 'border-[#E3DED5]'
          }`}
        >
          <div>
            <span className="text-[11px] font-bold text-[#C7463A] uppercase tracking-wider block">
              Out of Stock
            </span>
            <span className="text-3xl font-serif font-bold text-[#C7463A] mt-1 block">
              {metrics.out}
            </span>
            <span className="text-[10px] text-[#5F6762] block mt-0.5">Immediate reorder required</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#FDEEEC] border border-[#C7463A]/30 text-[#C7463A] flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ─── Search, Status & Category Filter Bar ─── */}
      <div className="bg-white p-4 rounded-2xl border border-[#E3DED5] shadow-[0_1px_4px_rgba(30,30,20,0.05)] space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#6F746F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ingredient name, category, or storage location..."
              className="w-full pl-10 pr-9 py-2.5 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] placeholder-[#6F746F]/70 rounded-xl text-xs font-medium focus:outline-none focus:border-[#18201D] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F746F] hover:text-[#18201D]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#13241F] text-white shadow-xs'
                  : 'bg-[#F7F4EE] text-[#6F746F] hover:text-[#18201D] border border-[#E3DED5]'
              }`}
            >
              All ({ingredients.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('healthy')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'healthy'
                  ? 'bg-[#287A55] text-white shadow-xs'
                  : 'bg-[#F7F4EE] text-[#287A55] hover:bg-[#EBF7EE] border border-[#E3DED5]'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>In Stock ({metrics.healthy})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'low'
                  ? 'bg-[#D79A24] text-white shadow-xs'
                  : 'bg-[#F7F4EE] text-[#D79A24] hover:bg-[#FEF5E7] border border-[#E3DED5]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Low Stock ({metrics.low})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('out_of_stock')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'out_of_stock'
                  ? 'bg-[#C7463A] text-white shadow-xs'
                  : 'bg-[#F7F4EE] text-[#C7463A] hover:bg-[#FDEEEC] border border-[#E3DED5]'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Out of Stock ({metrics.out})</span>
            </button>
          </div>
        </div>

        {/* Category Pills Strip */}
        {availableCategories.length > 2 && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-[#E3DED5] overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-[10px] uppercase font-bold text-[#6F746F] tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Category:</span>
            </span>
            {availableCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                  categoryFilter === c
                    ? 'bg-[#C84A38] text-white'
                    : 'bg-[#F7F4EE] text-[#6F746F] hover:text-[#18201D] hover:bg-[#EBE7DF]'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Main Content Display ─── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white border border-[#E3DED5] rounded-2xl">
          <LoadingSpinner label="Connecting to real-time inventory..." />
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white border border-[#C7463A]/30 rounded-2xl max-w-md mx-auto space-y-3 shadow-sm">
          <AlertTriangle className="w-10 h-10 text-[#C7463A] mx-auto" />
          <h3 className="text-base font-serif font-bold text-[#18201D]">{error}</h3>
          <p className="text-xs text-[#6F746F]">Please verify your kitchen connection or reload the page.</p>
        </div>
      ) : filteredIngredients.length === 0 ? (
        /* Rich Empty State with One-Click Starter Pack Seeder */
        <div className="p-10 sm:p-14 text-center bg-white border border-[#E3DED5] rounded-2xl shadow-[0_1px_4px_rgba(30,30,20,0.05)] max-w-2xl mx-auto space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#F7F4EE] border border-[#E3DED5] flex items-center justify-center mx-auto text-[#C84A38]">
            <ChefHat className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-xl font-serif font-bold text-[#18201D]">
              {ingredients.length === 0 ? 'No Ingredients in Kitchen Pantry Yet' : 'No Matching Ingredients Found'}
            </h3>
            <p className="text-xs sm:text-sm text-[#6F746F] leading-relaxed">
              {ingredients.length === 0 
                ? 'Get your kitchen operational in seconds! You can initialize standard restaurant kitchen pantry staples or add custom ingredients right away.'
                : 'Try clearing your search query or selecting "All" to view the full inventory.'}
            </p>
          </div>

          {ingredients.length === 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleSeedEssentials}
                disabled={isSeeding}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#C84A38] hover:bg-[#B33F2E] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>{isSeeding ? 'Initializing 12 Staples...' : '✨ Initialize Kitchen Pantry Essentials'}</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#13241F] hover:bg-[#1A312B] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Custom Ingredient</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#F7F4EE] hover:bg-[#EBE7DF] text-[#18201D] border border-[#E3DED5] rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}

          {ingredients.length === 0 && (
            <div className="pt-4 border-t border-[#E3DED5] text-left bg-[#F7F4EE]/60 p-4 rounded-xl text-[11px] text-[#6F746F] space-y-1">
              <div className="font-bold text-[#18201D] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#C84A38]" />
                <span>Shared Real-Time Architecture</span>
              </div>
              <p>
                Any ingredient added here is automatically available to the Restaurant Owner in <span className="font-semibold text-[#18201D]">/owner/inventory</span>, and any recipe batch cooked in the kitchen immediately logs real-time deductions.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ─── Grid of Ingredient Cards ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIngredients.map((item) => {
            const stock = Number(item.currentStock ?? 0);
            const minStock = Number(item.minimumStock ?? 5);
            const reorder = Number(item.reorderLevel ?? minStock * 1.5);
            const computedStatus = inventoryService.calculateStockStatus(stock, minStock, reorder);
            const isOut = computedStatus === 'out_of_stock' || stock <= 0;
            const isCritical = computedStatus === 'critical';
            const isLow = computedStatus === 'low' || isCritical;
            const isHealthy = computedStatus === 'healthy' && stock > minStock;

            // Health bar fill calculation
            const maxCap = Math.max(reorder * 1.5, stock * 1.2, 10);
            const fillPct = Math.min(100, Math.round((stock / maxCap) * 100));

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl p-5 shadow-[0_1px_4px_rgba(30,30,20,0.05)] transition-all flex flex-col justify-between space-y-4 hover:shadow-md ${
                  isOut 
                    ? 'border-[#C7463A]/40 bg-[#FDEEEC]/15' 
                    : isLow 
                    ? 'border-[#D79A24]/40 bg-[#FEF5E7]/15' 
                    : 'border-[#E3DED5]'
                }`}
              >
                {/* Header row */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#18201D] tracking-tight leading-snug">
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F7F4EE] border border-[#E3DED5] text-[#6F746F]">
                          {item.category || 'Pantry'}
                        </span>
                        {item.storageLocation && (
                          <span className="text-[10px] font-semibold text-[#6F746F] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#C84A38]" />
                            <span>{item.storageLocation}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-wider shrink-0 ${
                        isOut
                          ? 'bg-[#FDEEEC] text-[#C7463A] border-[#C7463A]/30'
                          : isCritical
                          ? 'bg-[#FDEEEC] text-[#C7463A] border-[#C7463A]/30'
                          : isLow
                          ? 'bg-[#FEF5E7] text-[#D79A24] border-[#D79A24]/30'
                          : 'bg-[#EBF7EE] text-[#287A55] border-[#287A55]/30'
                      }`}
                    >
                      {isOut ? 'Out of Stock' : isCritical ? 'Critical Low' : isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>
                </div>

                {/* Stock Level Display */}
                <div className="bg-[#F7F4EE] p-3.5 rounded-xl border border-[#E3DED5] space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#6F746F] tracking-wider block">
                        Current Available
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`text-2xl font-serif font-bold ${
                          isOut ? 'text-[#C7463A]' : isLow ? 'text-[#D79A24]' : 'text-[#18201D]'
                        }`}>
                          {stock}
                        </span>
                        <span className="text-xs font-bold text-[#6F746F] uppercase font-mono">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-[#6F746F] block">
                        Min: <span className="font-mono font-bold text-[#18201D]">{minStock} {item.unit}</span>
                      </span>
                      <span className="text-[10px] font-semibold text-[#6F746F] block">
                        Reorder: <span className="font-mono font-bold text-[#18201D]">{reorder} {item.unit}</span>
                      </span>
                    </div>
                  </div>

                  {/* Stock Gauge Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#E3DED5] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOut 
                          ? 'bg-[#C7463A]' 
                          : isLow 
                          ? 'bg-[#D79A24]' 
                          : 'bg-[#287A55]'
                      }`}
                      style={{ width: `${Math.max(4, fillPct)}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons Grid */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => openActionModal('receive', item)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white hover:bg-[#EBF7EE] border border-[#E3DED5] hover:border-[#287A55]/40 text-[#287A55] text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                    title="Check in received shipment"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 mb-0.5" />
                    <span>Receive</span>
                  </button>

                  <button
                    onClick={() => openActionModal('usage', item)}
                    disabled={isOut}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white hover:bg-[#F7F4EE] border border-[#E3DED5] hover:border-[#18201D]/40 text-[#18201D] text-[10px] font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Record kitchen prep or cooking usage"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 mb-0.5 text-[#C84A38]" />
                    <span>Deduct</span>
                  </button>

                  <button
                    onClick={() => openActionModal('waste', item)}
                    disabled={isOut}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white hover:bg-[#FDEEEC] border border-[#E3DED5] hover:border-[#C7463A]/40 text-[#C7463A] text-[10px] font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Log spoiled, expired, or damaged item"
                  >
                    <Trash2 className="w-3.5 h-3.5 mb-0.5" />
                    <span>Waste</span>
                  </button>

                  <button
                    onClick={() => openActionModal('adjust', item)}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-white hover:bg-[#F7F4EE] border border-[#E3DED5] text-[#6F746F] hover:text-[#18201D] text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                    title="Correct count after physical stock take"
                  >
                    <Sliders className="w-3.5 h-3.5 mb-0.5" />
                    <span>Adjust</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: Operational Action Modal (Receive, Deduct, Waste, Adjust) ─── */}
      {activeAction && selectedIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#18201D]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#E3DED5] shadow-2xl max-w-md w-full p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#E3DED5] pb-4">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6F746F]">
                  <Package className="w-3.5 h-3.5 text-[#C84A38]" />
                  <span>{selectedIngredient.category}</span>
                </div>
                <h2 className="text-xl font-serif font-bold text-[#18201D]">
                  {activeAction === 'receive' && 'Receive Stock Shipment'}
                  {activeAction === 'usage' && 'Record Prep / Usage Deduction'}
                  {activeAction === 'waste' && 'Log Kitchen Wastage / Loss'}
                  {activeAction === 'adjust' && 'Adjust Physical Count'}
                </h2>
                <p className="text-xs text-[#6F746F]">
                  Target: <span className="font-bold text-[#18201D]">{selectedIngredient.name}</span> (Current: {selectedIngredient.currentStock} {selectedIngredient.unit})
                </p>
              </div>
              <button
                onClick={closeActionModal}
                className="p-1 rounded-lg text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleExecuteAction} className="space-y-4">
              {/* Quantity Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#18201D]">
                  {activeAction === 'adjust' ? `New Total Stock Level (${selectedIngredient.unit})` : `Quantity (${selectedIngredient.unit})`} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    required
                    value={actionQuantity}
                    onChange={(e) => setActionQuantity(e.target.value)}
                    placeholder={activeAction === 'adjust' ? `e.g. ${selectedIngredient.currentStock}` : 'e.g. 5'}
                    className="w-full px-3.5 py-2.5 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-sm font-bold focus:outline-none focus:border-[#18201D] focus:bg-white transition-all font-mono"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6F746F] uppercase">
                    {selectedIngredient.unit}
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-[#6F746F] font-semibold">Quick add:</span>
                  {[1, 5, 10, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(actionQuantity) || 0;
                        setActionQuantity(String(cur + preset));
                      }}
                      className="px-2 py-0.5 rounded-md bg-[#F7F4EE] hover:bg-[#EBE7DF] border border-[#E3DED5] text-[10px] font-bold text-[#18201D] transition-all cursor-pointer"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Waste Reason Selector (only for waste) */}
              {activeAction === 'waste' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#18201D]">
                    Wastage Reason *
                  </label>
                  <select
                    value={wasteReason}
                    onChange={(e: any) => setWasteReason(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#18201D]"
                  >
                    <option value="spoilage">🥦 Spoilage / Rotten during storage</option>
                    <option value="expired">📅 Passed expiration date</option>
                    <option value="damaged">📦 Damaged / Dropped / Broken container</option>
                    <option value="staff_mistake">👨‍🍳 Cooking burn / Recipe mistake</option>
                    <option value="customer_return">🍽️ Returned from customer dining table</option>
                  </select>
                </div>
              )}

              {/* Reason / Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#18201D]">
                  Operational Notes / Reason
                </label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Morning vendor delivery PO#104"
                  className="w-full px-3.5 py-2.5 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] placeholder-[#6F746F]/70 rounded-xl text-xs font-medium focus:outline-none focus:border-[#18201D] focus:bg-white transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E3DED5]">
                <button
                  type="button"
                  onClick={closeActionModal}
                  className="px-4 py-2 bg-[#F7F4EE] hover:bg-[#EBE7DF] text-[#18201D] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#13241F] hover:bg-[#1A312B] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Create Custom Ingredient ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#18201D]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#E3DED5] shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#E3DED5] pb-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-[#18201D]">Add New Ingredient</h2>
                <p className="text-xs text-[#6F746F] mt-0.5">
                  Synchronizes instantly to both Kitchen KDS and Owner Inventory Master.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIngredient} className="space-y-4">
              {/* Ingredient Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#18201D]">Ingredient Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Heavy Cream 36%"
                  className="w-full px-3.5 py-2.5 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] placeholder-[#6F746F]/70 rounded-xl text-xs font-medium focus:outline-none focus:border-[#18201D] focus:bg-white"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#18201D]">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#18201D]"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Meat">Meat & Poultry</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Dry Goods">Dry Goods</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Spices">Spices & Seasoning</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#18201D]">Measurement Unit</label>
                  <select
                    value={newUnit}
                    onChange={(e: any) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-semibold focus:outline-none focus:border-[#18201D]"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="liters">Liters (l)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pieces">Pieces / Count (pcs)</option>
                    <option value="packs">Packs / Boxes</option>
                  </select>
                </div>
              </div>

              {/* Stock Levels */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#18201D]">Initial Stock</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#18201D]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#18201D]">Min Buffer</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#18201D]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#18201D]">Reorder At</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newReorderLevel}
                    onChange={(e) => setNewReorderLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#18201D]"
                  />
                </div>
              </div>

              {/* Storage & Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#18201D]">Storage Location</label>
                  <input
                    type="text"
                    value={newStorage}
                    onChange={(e) => setNewStorage(e.target.value)}
                    placeholder="e.g. Walk-in Chiller"
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-medium focus:outline-none focus:border-[#18201D]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#18201D]">Unit Cost Est.</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    placeholder="e.g. 2.50"
                    className="w-full px-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] rounded-xl text-xs font-mono focus:outline-none focus:border-[#18201D]"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E3DED5]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#F7F4EE] hover:bg-[#EBE7DF] text-[#18201D] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#13241F] hover:bg-[#1A312B] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add to Stock Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Stock Movement History Drawer / Modal ─── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#18201D]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#E3DED5] shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-[#E3DED5] pb-4 shrink-0">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6F746F]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#287A55]" />
                  <span>Immutable Audit Trail</span>
                </div>
                <h2 className="text-xl font-serif font-bold text-[#18201D]">
                  Stock Movements Ledger
                </h2>
                <p className="text-xs text-[#6F746F]">
                  Real-time log of every purchase, consumption deduction, wastage, and manual count adjustment.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 divide-y divide-[#E3DED5]">
              {movements.length === 0 ? (
                <div className="py-16 text-center text-[#6F746F] space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-[#6F746F]/40" />
                  <p className="text-xs font-bold">No stock movements logged yet.</p>
                  <p className="text-[11px]">Movements are recorded whenever ingredients are received, cooked, or wasted.</p>
                </div>
              ) : (
                movements.map((mvt) => {
                  const isPositive = mvt.quantity > 0 && mvt.type !== 'consumption' && mvt.type !== 'waste';
                  return (
                    <div key={mvt.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#18201D]">{mvt.ingredientName}</span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#F7F4EE] border border-[#E3DED5] text-[#6F746F]">
                            {mvt.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6F746F] italic">
                          {mvt.reason || 'No description provided'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-[#6F746F] pt-0.5">
                          <span>By: <span className="font-semibold text-[#18201D]">{mvt.submittedByName || 'Chef'}</span> ({mvt.performedByRole || 'kitchen'})</span>
                          <span>•</span>
                          <span>{new Date(mvt.timestamp).toLocaleDateString()} {new Date(mvt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold text-sm block ${
                          isPositive ? 'text-[#287A55]' : 'text-[#C7463A]'
                        }`}>
                          {isPositive ? `+${mvt.quantity}` : `${mvt.quantity}`} {mvt.unit || ''}
                        </span>
                        {mvt.previousStock !== undefined && mvt.newStock !== undefined && (
                          <span className="text-[10px] font-mono text-[#6F746F] block">
                            {mvt.previousStock} → {mvt.newStock}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#E3DED5] flex justify-end shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-[#F7F4EE] hover:bg-[#EBE7DF] text-[#18201D] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenInventoryPage;
