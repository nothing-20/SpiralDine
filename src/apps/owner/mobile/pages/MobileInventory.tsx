import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Boxes, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Truck, 
  TrendingDown, 
  Search, 
  Filter, 
  Download, 
  Edit2, 
  Layers, 
  AlertOctagon, 
  Sparkles, 
  X, 
  Check, 
  RefreshCw,
  ArrowLeftRight 
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';

export const MobileInventory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();
  const tenantId = user?.tenantId;

  // Real-time collections
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [wasteLogs, setWasteLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active section tab:
  // 'overview' | 'ingredients' | 'recipes' | 'movements' | 'suppliers' | 'lowstock' | 'expiry' | 'waste' | 'suggestions'
  const [activeTab, setActiveTab] = useState<string>('ingredients');

  // Search & Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Add/Edit Ingredient Modal
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any | null>(null);
  const [ingName, setIngName] = useState('');
  const [ingCategory, setIngCategory] = useState('Vegetables');
  const [ingCurrentStock, setIngCurrentStock] = useState('0');
  const [ingMinStock, setIngMinStock] = useState('5');
  const [ingMaxStock, setIngMaxStock] = useState('50');
  const [ingReorderLevel, setIngReorderLevel] = useState('10');
  const [ingUnit, setIngUnit] = useState('kg');
  const [ingCost, setIngCost] = useState('0');
  const [ingSupplier, setIngSupplier] = useState('');
  const [ingStorage, setIngStorage] = useState('Pantry');
  const [ingExpiry, setIngExpiry] = useState('');
  const [savingIng, setSavingIng] = useState(false);

  // Record Waste Modal
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteIngId, setWasteIngId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('spoilage');
  const [wasteNotes, setWasteNotes] = useState('');
  const [savingWaste, setSavingWaste] = useState(false);

  // Register Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supCategory, setSupCategory] = useState('Produce');
  const [savingSup, setSavingSup] = useState(false);

  // Delete Ingredient Confirmation
  const [ingToDelete, setIngToDelete] = useState<any | null>(null);

  // Listen to Firestore
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const invCol = collection(db, 'restaurants', tenantId, 'inventory');
    const unsubInv = onSnapshot(invCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      setIngredients(list);
      setLoading(false);
    }, (err) => {
      console.warn('[MobileInventory] Inv warning:', err);
      setLoading(false);
    });

    const supCol = collection(db, 'restaurants', tenantId, 'suppliers');
    const unsubSup = onSnapshot(supCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSuppliers(list);
    });

    const recCol = collection(db, 'restaurants', tenantId, 'recipes');
    const unsubRec = onSnapshot(recCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setRecipes(list);
    });

    const movCol = collection(db, 'restaurants', tenantId, 'stockMovements');
    const qMov = query(movCol, orderBy('timestamp', 'desc'), limit(50));
    const unsubMov = onSnapshot(qMov, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setMovements(list);
    });

    const wasteCol = collection(db, 'restaurants', tenantId, 'wasteLogs');
    const qWaste = query(wasteCol, orderBy('timestamp', 'desc'), limit(50));
    const unsubWaste = onSnapshot(qWaste, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setWasteLogs(list);
    });

    return () => {
      unsubInv();
      unsubSup();
      unsubRec();
      unsubMov();
      unsubWaste();
    };
  }, [tenantId]);

  // Inventory Overview KPIs
  const metrics = useMemo(() => {
    let stockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    ingredients.forEach((ing) => {
      const stock = Number(ing.currentStock || ing.stock || 0);
      const minStock = Number(ing.minStock || 5);
      const cost = Number(ing.purchaseCost || ing.cost || 0);

      stockValue += stock * cost;
      if (stock === 0) outOfStockCount++;
      else if (stock <= minStock) lowStockCount++;
    });

    let totalWasteLoss = 0;
    wasteLogs.forEach((w) => {
      totalWasteLoss += Number(w.cost || 0);
    });

    return {
      stockValue,
      lowStockCount,
      outOfStockCount,
      totalWasteLoss,
      totalIngredients: ingredients.length,
    };
  }, [ingredients, wasteLogs]);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (selectedCategory !== 'all' && ing.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = String(ing.name || ing.itemName || '').toLowerCase().includes(q);
        const matchCat = String(ing.category || '').toLowerCase().includes(q);
        const matchSup = String(ing.supplier || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchSup) return false;
      }
      return true;
    });
  }, [ingredients, selectedCategory, searchQuery]);

  // Low stock list
  const lowStockItems = useMemo(() => {
    return ingredients.filter((ing) => {
      const stock = Number(ing.currentStock || ing.stock || 0);
      const min = Number(ing.minStock || 5);
      return stock <= min;
    });
  }, [ingredients]);

  // Open Add Ingredient
  const openAddIngredient = () => {
    setEditingIngredient(null);
    setIngName('');
    setIngCategory('Vegetables');
    setIngCurrentStock('0');
    setIngMinStock('5');
    setIngMaxStock('50');
    setIngReorderLevel('10');
    setIngUnit('kg');
    setIngCost('0');
    setIngSupplier(suppliers[0]?.name || '');
    setIngStorage('Pantry');
    setIngExpiry('');
    setShowIngredientModal(true);
  };

  // Open Edit Ingredient
  const openEditIngredient = (ing: any) => {
    setEditingIngredient(ing);
    setIngName(ing.name || ing.itemName || '');
    setIngCategory(ing.category || 'Vegetables');
    setIngCurrentStock(String(ing.currentStock || ing.stock || 0));
    setIngMinStock(String(ing.minStock || 5));
    setIngMaxStock(String(ing.maxStock || 50));
    setIngReorderLevel(String(ing.reorderLevel || 10));
    setIngUnit(ing.unit || 'kg');
    setIngCost(String(ing.purchaseCost || 0));
    setIngSupplier(ing.supplier || '');
    setIngStorage(ing.storageLocation || 'Pantry');
    setIngExpiry(ing.expiryDate || '');
    setShowIngredientModal(true);
  };

  // Save Ingredient
  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !ingName.trim()) return;

    setSavingIng(true);
    try {
      const docId = editingIngredient ? editingIngredient.id : `ing-${Date.now()}`;
      const docRef = doc(db, 'restaurants', tenantId, 'inventory', docId);

      const payload = {
        name: ingName.trim(),
        itemName: ingName.trim(),
        category: ingCategory,
        currentStock: Number(ingCurrentStock) || 0,
        minStock: Number(ingMinStock) || 5,
        maxStock: Number(ingMaxStock) || 50,
        reorderLevel: Number(ingReorderLevel) || 10,
        unit: ingUnit,
        purchaseCost: Number(ingCost) || 0,
        supplier: ingSupplier,
        storageLocation: ingStorage,
        expiryDate: ingExpiry,
        tenantId,
        updatedAt: new Date().toISOString(),
      };

      if (!editingIngredient) {
        (payload as any).createdAt = new Date().toISOString();
      }

      await setDoc(docRef, payload, { merge: true });
      setShowIngredientModal(false);
    } catch (err) {
      console.error('[MobileInventory] Save error:', err);
    } finally {
      setSavingIng(false);
    }
  };

  // Delete Ingredient
  const handleDeleteIngredient = async () => {
    if (!tenantId || !ingToDelete) return;
    try {
      await deleteDoc(doc(db, 'restaurants', tenantId, 'inventory', ingToDelete.id));
      setIngToDelete(null);
    } catch (err) {
      console.error('[MobileInventory] Delete error:', err);
    }
  };

  // Record Waste (Atomically deducts stock from ingredient!)
  const handleRecordWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !wasteIngId || !wasteQty) return;

    setSavingWaste(true);
    try {
      const targetIng = ingredients.find((i) => i.id === wasteIngId);
      const qtyNum = Number(wasteQty) || 0;
      const current = Number(targetIng?.currentStock || 0);
      const nextStock = Math.max(0, current - qtyNum);
      const costPerUnit = Number(targetIng?.purchaseCost || 0);

      const wasteId = `waste-${Date.now()}`;

      // 1. Write waste record
      await setDoc(doc(db, 'restaurants', tenantId, 'wasteLogs', wasteId), {
        id: wasteId,
        ingredientId: wasteIngId,
        ingredientName: targetIng?.name || 'Ingredient',
        quantity: qtyNum,
        unit: targetIng?.unit || 'units',
        cost: qtyNum * costPerUnit,
        reason: wasteReason,
        notes: wasteNotes.trim(),
        recordedBy: user?.email || 'Owner',
        timestamp: new Date().toISOString(),
        tenantId,
      });

      // 2. Deduct inventory stock
      await updateDoc(doc(db, 'restaurants', tenantId, 'inventory', wasteIngId), {
        currentStock: nextStock,
        updatedAt: new Date().toISOString(),
      });

      // 3. Write stock movement audit
      const movId = `mov-${Date.now()}`;
      await setDoc(doc(db, 'restaurants', tenantId, 'stockMovements', movId), {
        id: movId,
        ingredientId: wasteIngId,
        ingredientName: targetIng?.name || 'Ingredient',
        quantityChange: -qtyNum,
        type: 'waste',
        reason: wasteReason,
        user: user?.email || 'Owner',
        timestamp: new Date().toISOString(),
        tenantId,
      });

      setShowWasteModal(false);
      setWasteQty('');
      setWasteNotes('');
    } catch (err) {
      console.error('[MobileInventory] Waste error:', err);
    } finally {
      setSavingWaste(false);
    }
  };

  // Register Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !supName.trim()) return;

    setSavingSup(true);
    try {
      const supId = `sup-${Date.now()}`;
      await setDoc(doc(db, 'restaurants', tenantId, 'suppliers', supId), {
        id: supId,
        name: supName.trim(),
        phone: supPhone.trim(),
        email: supEmail.trim(),
        category: supCategory,
        createdAt: new Date().toISOString(),
        tenantId,
      });
      setShowSupplierModal(false);
      setSupName('');
      setSupPhone('');
      setSupEmail('');
    } catch (err) {
      console.error('[MobileInventory] Supplier error:', err);
    } finally {
      setSavingSup(false);
    }
  };

  // CSV Export for Stock Movements
  const handleExportMovementsCSV = () => {
    if (movements.length === 0) {
      alert('No movement records to export.');
      return;
    }

    const headers = 'Timestamp,Ingredient,Quantity Change,Type,Reason,User\n';
    const rows = movements.map((m) => 
      `"${m.timestamp}","${m.ingredientName}",${m.quantityChange},"${m.type}","${m.reason}","${m.user}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Stock_Movements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/business')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="font-extrabold text-sm text-[#202124]">Kitchen Inventory</h1>
          <p className="text-[11px] text-[#707070]">{ingredients.length} items logged</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate('/owner/branch-transfers')}
            className="w-8 h-8 rounded-full bg-[#FAF8F4] text-[#D94F2B] border border-[#D8DDD6] flex items-center justify-center hover:bg-[#F3E8DF]"
            title="Inter-Branch Stock Transfers"
            aria-label="Branch Transfers"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (ingredients.length > 0) {
                setWasteIngId(ingredients[0].id);
                setShowWasteModal(true);
              } else {
                alert('Add ingredients first before recording waste.');
              }
            }}
            className="w-8 h-8 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center"
            title="Record Kitchen Waste"
          >
            <TrendingDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openAddIngredient}
            className="w-9 h-9 rounded-full bg-[#FF7518] text-white flex items-center justify-center shadow-sm shadow-[#FF7518]/25"
            aria-label="Add Ingredient"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* KPI Overview Bar */}
      <div className="bg-white border-b border-[#EBEBEB] p-4">
        <div className="grid grid-cols-2 gap-2">
          {/* Total Stock Value */}
          <div className="p-3 rounded-2xl bg-[#FFF4EE] border border-[#FFE0CE]">
            <span className="text-[10px] font-extrabold text-[#FF7518] uppercase">Stock Value</span>
            <div className="font-black text-base text-[#202124] mt-1">
              {formatCurrency(metrics.stockValue)}
            </div>
            <span className="text-[10px] text-[#707070]">{metrics.totalIngredients} items</span>
          </div>

          {/* Low Stock Alerts */}
          <div className="p-3 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A]">
            <span className="text-[10px] font-extrabold text-[#D97706] uppercase">Low Stock Alerts</span>
            <div className="font-black text-base text-[#DC2626] mt-1">
              {metrics.lowStockCount} items
            </div>
            <span className="text-[10px] text-[#707070]">{metrics.outOfStockCount} out of stock</span>
          </div>
        </div>
      </div>

      {/* Navigation Sections Bar */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-[#EBEBEB] overflow-x-auto no-scrollbar flex items-center gap-2">
        <button
          onClick={() => setActiveTab('ingredients')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'ingredients'
              ? 'bg-[#202124] text-white'
              : 'bg-[#F7F7F7] text-[#707070] hover:bg-[#EBEBEB]'
          }`}
        >
          Ingredients ({ingredients.length})
        </button>
        <button
          onClick={() => setActiveTab('lowstock')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'lowstock'
              ? 'bg-[#DC2626] text-white'
              : 'bg-[#FEE2E2] text-[#DC2626]'
          }`}
        >
          Low Stock ({lowStockItems.length})
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'movements'
              ? 'bg-[#2563EB] text-white'
              : 'bg-[#EFF6FF] text-[#2563EB]'
          }`}
        >
          Movements Log
        </button>
        <button
          onClick={() => setActiveTab('waste')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'waste'
              ? 'bg-[#D97706] text-white'
              : 'bg-[#FEF3C7] text-[#D97706]'
          }`}
        >
          Waste Logs ({wasteLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-[#16A34A] text-white'
              : 'bg-[#DCFCE7] text-[#16A34A]'
          }`}
        >
          Suppliers ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'suggestions'
              ? 'bg-[#7C3AED] text-white'
              : 'bg-[#FAF5FF] text-[#7C3AED]'
          }`}
        >
          Replenishment
        </button>
        <button
          onClick={() => navigate('/owner/branch-transfers')}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-[#FAF8F4] text-[#D94F2B] border border-[#D8DDD6] flex items-center gap-1.5"
        >
          <ArrowLeftRight className="w-3 h-3" />
          <span>Branch Transfers</span>
        </button>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {activeTab === 'ingredients' && (
          <div className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ingredient by name or category..."
                className="w-full h-9 pl-8 pr-3 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] focus:outline-none focus:border-[#FF7518]"
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-8 px-2.5 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] font-medium"
            >
              <option value="all">All Categories</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Meat">Meat & Poultry</option>
              <option value="Dairy">Dairy & Cheese</option>
              <option value="Dry Goods">Dry Goods & Grains</option>
              <option value="Beverages">Beverages</option>
              <option value="Spices">Spices & Seasoning</option>
              <option value="Bakery">Bakery</option>
            </select>
          </div>
        )}

        {loading ? (
          <MobileLoadingSkeleton count={3} />
        ) : activeTab === 'lowstock' ? (
          /* Low Stock Warnings */
          lowStockItems.length === 0 ? (
            <MobileEmptyState
              icon={CheckCircle2}
              title="All Ingredients Adequately Stocked"
              description="No ingredients currently fall below their configured minimum reorder threshold."
            />
          ) : (
            lowStockItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#FEE2E2] p-4 shadow-sm flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-xs text-[#202124]">{item.name}</h4>
                  <div className="text-[11px] text-[#DC2626] font-medium mt-0.5">
                    Stock: {item.currentStock || 0} {item.unit} (Min: {item.minStock || 5})
                  </div>
                  <div className="text-[10px] text-[#707070] mt-0.5">
                    Supplier: {item.supplier || 'Unassigned'}
                  </div>
                </div>

                <button
                  onClick={() => openEditIngredient(item)}
                  className="px-3 py-1.5 bg-[#FFF4EE] text-[#FF7518] text-xs font-bold rounded-xl"
                >
                  Restock
                </button>
              </div>
            ))
          )
        ) : activeTab === 'movements' ? (
          /* Movements Log */
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-[#707070] font-medium">Audit Movements</span>
              <button
                onClick={handleExportMovementsCSV}
                className="px-2.5 py-1 bg-white border border-[#EBEBEB] text-[#202124] rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
            </div>

            {movements.length === 0 ? (
              <MobileEmptyState
                icon={Boxes}
                title="No Movements Recorded"
                description="Stock adjustments, deliveries, and waste write-offs will be tracked here."
              />
            ) : (
              movements.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-[#EBEBEB] p-3 shadow-sm flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[#202124]">{m.ingredientName}</span>
                    <div className="text-[10px] text-[#707070] mt-0.5">
                      {m.type} • {m.reason} • by {m.user}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-black ${m.quantityChange > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </span>
                    <div className="text-[9px] text-[#9E9E9E]">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'waste' ? (
          /* Waste Logs */
          wasteLogs.length === 0 ? (
            <MobileEmptyState
              icon={TrendingDown}
              title="No Waste Logged"
              description="Spoiled batches, prep mistakes, and returned items recorded as waste appear here."
            />
          ) : (
            wasteLogs.map((w) => (
              <div
                key={w.id}
                className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-xs text-[#202124]">{w.ingredientName}</h4>
                  <div className="text-[11px] text-[#707070] mt-0.5">
                    Reason: {w.reason} {w.notes ? `(${w.notes})` : ''}
                  </div>
                  <div className="text-[10px] text-[#9E9E9E] mt-0.5">
                    {new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-xs text-[#DC2626]">
                    -{w.quantity} {w.unit}
                  </span>
                  <div className="text-[10px] text-[#707070]">
                    Loss: {formatCurrency(Number(w.cost || 0))}
                  </div>
                </div>
              </div>
            ))
          )
        ) : activeTab === 'suppliers' ? (
          /* Suppliers Directory */
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-[#707070] font-medium">Verified Vendors</span>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="px-2.5 py-1 bg-[#FF7518] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>Add Supplier</span>
              </button>
            </div>

            {suppliers.length === 0 ? (
              <MobileEmptyState
                icon={Truck}
                title="No Suppliers Configured"
                description="Register fresh produce, beverage, and dairy vendors to manage procurement."
                actionLabel="Add Supplier"
                onAction={() => setShowSupplierModal(true)}
              />
            ) : (
              suppliers.map((s) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-xs text-[#202124]">{s.name}</h4>
                    <span className="text-[10px] font-bold text-[#FF7518] bg-[#FFF4EE] px-2 py-0.5 rounded-full mt-1 inline-block">
                      {s.category || 'Produce'}
                    </span>
                    <div className="text-[11px] text-[#707070] mt-1">
                      {s.phone || s.email || 'No contact specified'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'suggestions' ? (
          /* Replenishment Suggestions */
          lowStockItems.length === 0 ? (
            <MobileEmptyState
              icon={Sparkles}
              title="No Restock Actions Needed"
              description="Inventory levels are optimal based on minimum stock policies."
            />
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-[#FAF5FF] border border-[#E9D5FF] rounded-2xl text-xs text-[#7C3AED]">
                <strong className="block font-bold">Smart Purchase Recommendations</strong>
                <span>Items requiring procurement based on current threshold deficits.</span>
              </div>

              {lowStockItems.map((item) => {
                const current = Number(item.currentStock || 0);
                const max = Number(item.maxStock || 50);
                const suggestedQty = Math.max(1, max - current);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-[#202124]">{item.name}</h4>
                      <span className="text-[10px] font-bold text-[#7C3AED] bg-[#FAF5FF] px-2 py-0.5 rounded-full">
                        Order +{suggestedQty} {item.unit}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-[#707070]">
                      <span>Current: {current} {item.unit}</span>
                      <span>Target: {max} {item.unit}</span>
                    </div>

                    <div className="pt-2 border-t border-[#F5F5F5] flex justify-between items-center text-xs">
                      <span className="text-[11px] text-[#707070]">Vendor: {item.supplier || 'Produce Supplier'}</span>
                      <button
                        onClick={() => openEditIngredient(item)}
                        className="px-3 py-1 bg-[#202124] text-white font-bold rounded-lg text-[10px]"
                      >
                        Adjust Stock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Ingredients List */
          filteredIngredients.length === 0 ? (
            <MobileEmptyState
              icon={Boxes}
              title={searchQuery ? 'No Ingredients Match' : 'No Ingredients Logged'}
              description={
                searchQuery
                  ? 'Try modifying your search term or category filter.'
                  : 'Register vegetables, meat, dairy, and spices to manage kitchen prep inventory.'
              }
              actionLabel={searchQuery ? 'Clear Filter' : 'Register Ingredient'}
              onAction={() => {
                if (searchQuery) {
                  setSearchQuery('');
                  setSelectedCategory('all');
                } else {
                  openAddIngredient();
                }
              }}
            />
          ) : (
            filteredIngredients.map((item) => {
              const stock = Number(item.currentStock || item.stock || 0);
              const minStock = Number(item.minStock || 5);
              const isLow = stock <= minStock;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-[#202124]">{item.name || item.itemName}</h4>
                        <span className="text-[10px] text-[#707070] bg-[#F7F7F7] px-2 py-0.5 rounded-full font-medium">
                          {item.category || 'Pantry'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#707070] mt-1">
                        Location: {item.storageLocation || 'Pantry'} • Cost: {formatCurrency(Number(item.purchaseCost || 0))}/{item.unit || 'unit'}
                      </div>
                      {item.expiryDate && (
                        <div className="text-[10px] text-[#9E9E9E] mt-0.5">
                          Expires: {item.expiryDate}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className={`font-black text-sm ${isLow ? 'text-[#DC2626]' : 'text-[#202124]'}`}>
                        {stock} {item.unit || 'kg'}
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 ${
                        isLow ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#16A34A]'
                      }`}>
                        {isLow ? 'Low Stock' : 'Adequate'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between gap-2">
                    <button
                      onClick={() => openEditIngredient(item)}
                      className="flex-1 py-1.5 px-2 bg-[#F7F7F7] hover:bg-[#EBEBEB] text-[#202124] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>

                    <button
                      onClick={() => setIngToDelete(item)}
                      className="p-2 bg-[#FEE2E2] text-[#DC2626] rounded-xl hover:bg-[#FECACA]"
                      title="Delete Ingredient"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Add / Edit Ingredient Modal */}
      {showIngredientModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#202124]">
              {editingIngredient ? 'Edit Ingredient' : 'Register Ingredient'}
            </h3>

            <form onSubmit={handleSaveIngredient} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Ingredient Name *</label>
                <input
                  type="text"
                  required
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                  placeholder="e.g. Tomatoes, Cheddar Cheese"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Category</label>
                  <select
                    value={ingCategory}
                    onChange={(e) => setIngCategory(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none font-medium"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Meat">Meat & Poultry</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Dry Goods">Dry Goods</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Spices">Spices</option>
                    <option value="Bakery">Bakery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Unit</label>
                  <select
                    value={ingUnit}
                    onChange={(e) => setIngUnit(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none font-medium"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="liters">liters</option>
                    <option value="ml">ml</option>
                    <option value="pieces">pieces</option>
                    <option value="packs">packs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ingCurrentStock}
                    onChange={(e) => setIngCurrentStock(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Min Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ingMinStock}
                    onChange={(e) => setIngMinStock(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Cost ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingCost}
                    onChange={(e) => setIngCost(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Storage</label>
                  <select
                    value={ingStorage}
                    onChange={(e) => setIngStorage(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none font-medium"
                  >
                    <option value="Fridge">Fridge</option>
                    <option value="Freezer">Freezer</option>
                    <option value="Pantry">Pantry</option>
                    <option value="Dry Storage">Dry Storage</option>
                    <option value="Bar">Bar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Supplier</label>
                <input
                  type="text"
                  value={ingSupplier}
                  onChange={(e) => setIngSupplier(e.target.value)}
                  placeholder="e.g. Metro Produce"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={ingExpiry}
                  onChange={(e) => setIngExpiry(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIngredientModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingIng}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF7518] text-white text-xs font-bold shadow-sm"
                >
                  {savingIng ? 'Saving...' : editingIngredient ? 'Update' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Waste Modal */}
      {showWasteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-[#202124]">Record Kitchen Waste</h3>

            <form onSubmit={handleRecordWaste} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Ingredient</label>
                <select
                  value={wasteIngId}
                  onChange={(e) => setWasteIngId(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none font-medium"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.currentStock} {ing.unit} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Wasted Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  placeholder="e.g. 1.5"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#DC2626] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Reason</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none font-medium"
                >
                  <option value="spoilage">Spoilage</option>
                  <option value="expired">Expired Date</option>
                  <option value="damaged">Damaged in Transit / Storage</option>
                  <option value="staff_mistake">Prep / Cooking Mistake</option>
                  <option value="customer_return">Customer Return</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Notes</label>
                <input
                  type="text"
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  placeholder="e.g. Refrigerator temperature failure"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWaste}
                  className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold shadow-sm"
                >
                  {savingWaste ? 'Writing off...' : 'Write Off Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-[#202124]">Register Supplier</h3>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Vendor / Company Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Organic Farms Co"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Email</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="orders@organicfarms.com"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSup}
                  className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-xs font-bold shadow-sm"
                >
                  {savingSup ? 'Saving...' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {ingToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-[#202124]">Delete {ingToDelete.name}?</h3>
            <p className="text-xs text-[#707070]">
              This will remove the ingredient from kitchen inventory and recipes.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIngToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteIngredient}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileInventory;
