import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  deleteDoc, 
  query,
  onSnapshot,
  addDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { formatPrice } from '../../../shared/utils/format';
import { inventoryService } from '../../../shared/services/inventoryService';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';
import Table from '../../../components/ui/Table/Table';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import Tabs from '../../../components/ui/Tabs/Tabs';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';

// Lucide Icons
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Package, 
  Settings, 
  AlertTriangle,
  BookOpen,
  TrendingUp,
  Truck,
  AlertOctagon,
  Calendar,
  Trash,
  Sparkles,
  RefreshCcw,
  CheckCircle,
  HelpCircle,
  FileText,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';

import { IStockIngredient, IRecipe, IStockMovement, ISupplier, IPurchaseSuggestion, IWasteLog } from '../../../shared/domain/inventory/types';
import { useCurrency } from '../../../context/CurrencyContext';

export const OwnerInventoryManager: React.FC = () => {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const tenantId = user?.tenantId;

  // Navigation state
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('purchase-orders')) {
      return 'suggestions';
    }
    return 'overview';
  });

  // Real-time Database states
  const [ingredients, setIngredients] = useState<IStockIngredient[]>([]);
  const [recipes, setRecipes] = useState<IRecipe[]>([]);
  const [movements, setMovements] = useState<IStockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [suggestions, setSuggestions] = useState<IPurchaseSuggestion[]>([]);
  const [wasteLogs, setWasteLogs] = useState<IWasteLog[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // CRUD Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IStockIngredient | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ingredient Form Field states
  const [ingName, setIngName] = useState('');
  const [ingCategory, setIngCategory] = useState<'Vegetables' | 'Meat' | 'Dairy' | 'Dry Goods' | 'Beverages' | 'Spices' | 'Bakery' | 'Other'>('Vegetables');
  const [ingUnit, setIngUnit] = useState<'kg' | 'g' | 'liters' | 'ml' | 'pieces' | 'packs'>('kg');
  const [ingCurrentStock, setIngCurrentStock] = useState('0');
  const [ingMinStock, setIngMinStock] = useState('5');
  const [ingMaxStock, setIngMaxStock] = useState('50');
  const [ingReorderLevel, setIngReorderLevel] = useState('10');
  const [ingSupplierId, setIngSupplierId] = useState('');
  const [ingPurchaseCost, setIngPurchaseCost] = useState('0');
  const [ingStorageLocation, setIngStorageLocation] = useState<'Fridge' | 'Freezer' | 'Pantry' | 'Dry Storage' | 'Bar' | 'Kitchen Shelf'>('Pantry');
  const [ingExpiryDate, setIngExpiryDate] = useState('');

  // Recipe Edit Drawer States
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<any | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<any[]>([]);
  const [recipeVersion, setRecipeVersion] = useState('v1.0');
  const [recipeYield, setRecipeYield] = useState('1');
  const [recipeWastePercent, setRecipeWastePercent] = useState('0');
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);

  // Upgraded Recipe module States
  const [recipeName, setRecipeName] = useState('');
  const [recipePortionSize, setRecipePortionSize] = useState('1 Portion');
  const [recipeCookingNotes, setRecipeCookingNotes] = useState('');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState('all');
  const [viewingRecipe, setViewingRecipe] = useState<IRecipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<IRecipe | null>(null);
  const [isRecipeViewModalOpen, setIsRecipeViewModalOpen] = useState(false);

  // Waste Recording Modal States
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [wasteIngId, setWasteIngId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState<'spoilage' | 'expired' | 'damaged' | 'staff_mistake' | 'customer_return'>('spoilage');
  const [wasteNote, setWasteNote] = useState('');

  // Supplier Form Modal States
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ISupplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supDeliveryDays, setSupDeliveryDays] = useState('3');
  const [supRating, setSupRating] = useState('5');

  // Extended Supplier states
  const [supCompanyName, setSupCompanyName] = useState('');
  const [supGstNumber, setSupGstNumber] = useState('');
  const [supPaymentTerms, setSupPaymentTerms] = useState('COD');
  const [supDeliverySchedule, setSupDeliverySchedule] = useState('Weekly');

  // Supplier Delete States
  const [isSupDeleteOpen, setIsSupDeleteOpen] = useState(false);
  const [deletingSupId, setDeletingSupId] = useState<string | null>(null);

  // Movements Log States
  const [movementFilter, setMovementFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [movementCustomStart, setMovementCustomStart] = useState('');
  const [movementCustomEnd, setMovementCustomEnd] = useState('');
  const [selectedMovement, setSelectedMovement] = useState<IStockMovement | null>(null);

  // Categories definition
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'Vegetables', label: 'Vegetables' },
    { value: 'Meat', label: 'Meat & Seafood' },
    { value: 'Dairy', label: 'Dairy' },
    { value: 'Dry Goods', label: 'Dry Goods' },
    { value: 'Beverages', label: 'Beverages' },
    { value: 'Spices', label: 'Spices' },
    { value: 'Bakery', label: 'Bakery' },
    { value: 'Other', label: 'Other Items' }
  ];

  // 1. Subscribe to all inventory collections
  useEffect(() => {
    if (!tenantId) return;

    setIsLoading(true);

    // Ingredients listener
    const unsubIngredients = onSnapshot(collection(db, 'restaurants', tenantId, 'inventory'), (snap) => {
      const list: IStockIngredient[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as IStockIngredient);
      });
      setIngredients(list);
    });

    // Recipes listener
    const unsubRecipes = onSnapshot(collection(db, 'restaurants', tenantId, 'recipes'), (snap) => {
      const list: IRecipe[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as IRecipe);
      });
      setRecipes(list);
    });

    // Movements listener
    const unsubMovements = onSnapshot(collection(db, 'restaurants', tenantId, 'stockMovements'), (snap) => {
      const list: IStockMovement[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as IStockMovement);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setMovements(list);
    });

    // Suppliers listener
    const unsubSuppliers = onSnapshot(collection(db, 'restaurants', tenantId, 'suppliers'), (snap) => {
      const list: ISupplier[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ISupplier);
      });
      setSuppliers(list);
    });

    // Purchase Suggestions listener
    const unsubSuggestions = onSnapshot(collection(db, 'restaurants', tenantId, 'purchaseSuggestions'), (snap) => {
      const list: IPurchaseSuggestion[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as IPurchaseSuggestion);
      });
      setSuggestions(list);
    });

    // Waste Logs listener
    const unsubWaste = onSnapshot(collection(db, 'restaurants', tenantId, 'waste'), (snap) => {
      const list: IWasteLog[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as IWasteLog);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setWasteLogs(list);
    });

    // Menu Items listener (real-time)
    const unsubMenuItems = onSnapshot(collection(db, 'restaurants', tenantId, 'menuItems'), (snap) => {
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMenuItems(list);
    });

    setIsLoading(false);

    return () => {
      unsubIngredients();
      unsubRecipes();
      unsubMovements();
      unsubSuppliers();
      unsubSuggestions();
      unsubWaste();
      unsubMenuItems();
    };
  }, [tenantId]);

  // Derived stock overview metrics
  const stockMetrics = useMemo(() => {
    const total = ingredients.length;
    const low = ingredients.filter(i => {
      const s = Number(i.currentStock ?? 0);
      const m = Number(i.minimumStock ?? 5);
      return inventoryService.calculateStockStatus(s, m, i.reorderLevel) === 'low';
    }).length;
    const critical = ingredients.filter(i => {
      const s = Number(i.currentStock ?? 0);
      const m = Number(i.minimumStock ?? 5);
      return inventoryService.calculateStockStatus(s, m, i.reorderLevel) === 'critical';
    }).length;
    const out = ingredients.filter(i => {
      const s = Number(i.currentStock ?? 0);
      const m = Number(i.minimumStock ?? 5);
      return inventoryService.calculateStockStatus(s, m, i.reorderLevel) === 'out_of_stock' || s <= 0;
    }).length;
    
    // Low portions batch prepared items
    const lowBatch = menuItems.filter(item => 
      item.preparationMethod === 'batch' && 
      (item.availableServings ?? 0) <= (item.lowStockThreshold ?? 10)
    ).length;

    // Out of servings batch items
    const outBatch = menuItems.filter(item => 
      item.preparationMethod === 'batch' && 
      (item.availableServings ?? 0) === 0
    ).length;

    const value = ingredients.reduce((sum, item) => sum + (Number(item.currentStock) * (Number(item.purchaseCost) || 0)), 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 7);
    const soonStr = soonDate.toISOString().split('T')[0];

    const expired = ingredients.filter(i => i.expiryDate && i.expiryDate < todayStr).length;
    const expiringSoon = ingredients.filter(i => i.expiryDate && i.expiryDate >= todayStr && i.expiryDate <= soonStr).length;

    // Total loss to spoilage/waste this week
    const wasteCost = wasteLogs.reduce((sum, item) => sum + (item.valueLost || 0), 0);

    // Advanced Operational Metrics
    const todayConsumptionCount = movements
      .filter(m => m.type === 'consumption' && new Date(m.timestamp).toDateString() === new Date().toDateString())
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

    const todayConsumptionVal = movements
      .filter(m => m.type === 'consumption' && new Date(m.timestamp).toDateString() === new Date().toDateString())
      .reduce((sum, m) => {
        const ing = ingredients.find(i => i.id === m.ingredientId);
        return sum + (Math.abs(m.quantity) * (ing?.purchaseCost || 0));
      }, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const startM = startOfMonth.getTime();
    const monthlyPurchases = movements
      .filter(m => m.type === 'purchase' && new Date(m.timestamp).getTime() >= startM)
      .reduce((sum, m) => {
        const ing = ingredients.find(i => i.id === m.ingredientId);
        const cost = ing ? (ing.purchaseCost || 0) : 0;
        return sum + (Math.abs(m.quantity) * cost);
      }, 0);

    const adjustmentsCount = movements.filter(m => m.type === 'adjustment' || m.type === 'manual_correction').length;
    const inventoryAccuracy = Math.max(70, 100 - (adjustmentsCount * 2));

    const turnoverRatio = value > 0 ? Number(((wasteCost + Math.abs(todayConsumptionVal) * 30) / value).toFixed(2)) : 0.00;

    return { 
      total, 
      low: low + lowBatch, 
      critical, 
      out: out + outBatch, 
      lowBatch, 
      outBatch,
      value, 
      expired, 
      expiringSoon, 
      wasteCost,
      todayConsumptionCount,
      monthlyPurchases,
      inventoryAccuracy,
      turnoverRatio
    };
  }, [ingredients, wasteLogs, menuItems, movements]);

  // Derived stock health alerts list for UI widgets
  const allLowStockAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      name: string;
      subtitle: string;
      amount: string;
      badgeVariant: 'warning' | 'danger' | 'success';
      badgeText: string;
    }> = [];

    // 1. Ingredients low/critical/out of stock alerts
    ingredients.forEach(i => {
      if (i.status === 'low' || i.status === 'critical' || i.status === 'out_of_stock') {
        alerts.push({
          id: i.id,
          name: i.name || 'Unnamed Ingredient',
          subtitle: `Ingredient • ${i.category || 'Other'}`,
          amount: `${i.currentStock ?? 0} ${i.unit || ''}`,
          badgeVariant: i.status === 'out_of_stock' ? 'danger' : 'warning',
          badgeText: i.status.replace('_', ' ').toUpperCase()
        });
      }
    });

    // 2. Batch portions low stock alerts
    menuItems.forEach(item => {
      if (item.preparationMethod === 'batch') {
        const servings = item.availableServings ?? 0;
        const threshold = item.lowStockThreshold ?? 10;
        if (servings === 0) {
          alerts.push({
            id: item.id,
            name: item.name || 'Unnamed Portion',
            subtitle: `Batch Portion • ${item.category || 'Other'}`,
            amount: `${servings} servings`,
            badgeVariant: 'danger',
            badgeText: 'OUT OF STOCK'
          });
        } else if (servings <= threshold) {
          alerts.push({
            id: item.id,
            name: item.name || 'Unnamed Portion',
            subtitle: `Batch Portion • ${item.category || 'Other'}`,
            amount: `${servings} servings`,
            badgeVariant: 'warning',
            badgeText: 'LOW STOCK'
          });
        }
      }
    });

    return alerts;
  }, [ingredients, menuItems]);

  // Search & Filtered ingredients list
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(item => {
      const nameVal = item.name || '';
      const supplierVal = item.supplierName || '';
      const matchesSearch = nameVal.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (supplierVal && supplierVal.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [ingredients, searchQuery, categoryFilter]);

  // Derived filtered movements list based on date filters
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (movementFilter === 'all') return true;
      const mDate = m.timestamp ? new Date(m.timestamp).getTime() : 0;
      if (isNaN(mDate)) return true;
      const now = new Date();
      if (movementFilter === 'today') {
        return new Date(m.timestamp).toDateString() === now.toDateString();
      }
      if (movementFilter === 'week') {
        const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        return mDate >= oneWeekAgo;
      }
      if (movementFilter === 'month') {
        const oneMonthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
        return mDate >= oneMonthAgo;
      }
      if (movementFilter === 'custom') {
        const start = movementCustomStart ? new Date(movementCustomStart).getTime() : 0;
        const end = movementCustomEnd ? new Date(movementCustomEnd).getTime() : Infinity;
        return mDate >= start && mDate <= end;
      }
      return true;
    });
  }, [movements, movementFilter, movementCustomStart, movementCustomEnd]);

  // Add / Edit Ingredient logic
  const handleOpenAddIngredient = () => {
    setEditingIngredient(null);
    setIngName('');
    setIngCategory('Vegetables');
    setIngUnit('kg');
    setIngCurrentStock('10');
    setIngMinStock('5');
    setIngMaxStock('50');
    setIngReorderLevel('10');
    setIngSupplierId('');
    setIngPurchaseCost('1.5');
    setIngStorageLocation('Pantry');
    setIngExpiryDate('');
    setIsFormOpen(true);
  };

  const handleOpenEditIngredient = (item: IStockIngredient) => {
    setEditingIngredient(item);
    setIngName(item.name);
    setIngCategory(item.category);
    setIngUnit(item.unit);
    setIngCurrentStock(String(item.currentStock));
    setIngMinStock(String(item.minimumStock));
    setIngMaxStock(String(item.maximumStock));
    setIngReorderLevel(String(item.reorderLevel));
    setIngSupplierId(item.supplierId || '');
    setIngPurchaseCost(String((item.purchaseCost || 0) / 100)); // convert cents to cost
    setIngStorageLocation(item.storageLocation);
    setIngExpiryDate(item.expiryDate || '');
    setIsFormOpen(true);
  };

  const handleSubmitIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!ingName.trim()) {
      toast.error('Ingredient name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ingId = editingIngredient ? editingIngredient.id : `ING-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const docRef = doc(db, 'restaurants', tenantId, 'inventory', ingId);
      
      const resolvedSupplier = suppliers.find(s => s.id === ingSupplierId);
      const supplierName = resolvedSupplier ? resolvedSupplier.name : 'Direct Purchase';

      const currentStockVal = parseFloat(ingCurrentStock) || 0;
      const minStockVal = parseFloat(ingMinStock) || 0;
      const purchaseCostCents = Math.round(parseFloat(ingPurchaseCost) * 100) || 0;

      // Determine stock status health
      let status: IStockIngredient['status'] = 'healthy';
      if (currentStockVal === 0) status = 'out_of_stock';
      else if (currentStockVal <= minStockVal * 0.5) status = 'critical';
      else if (currentStockVal <= minStockVal) status = 'low';

      const ingredientPayload = {
        id: ingId,
        name: ingName.trim(),
        category: ingCategory,
        unit: ingUnit,
        currentStock: currentStockVal,
        minimumStock: minStockVal,
        maximumStock: parseFloat(ingMaxStock) || 50,
        reorderLevel: parseFloat(ingReorderLevel) || 10,
        supplierId: ingSupplierId,
        supplierName,
        purchaseCost: purchaseCostCents,
        storageLocation: ingStorageLocation,
        expiryDate: ingExpiryDate,
        status,
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, ingredientPayload);

      // Create stock movement if manual level adjustment happened
      if (!editingIngredient || editingIngredient.currentStock !== currentStockVal) {
        const diff = editingIngredient ? currentStockVal - editingIngredient.currentStock : currentStockVal;
        
        const movementId = `MVT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        await setDoc(doc(db, 'restaurants', tenantId, 'stockMovements', movementId), {
          id: movementId,
          ingredientId: ingId,
          ingredientName: ingName.trim(),
          quantity: diff,
          type: editingIngredient ? 'adjustment' : 'purchase',
          reason: editingIngredient ? 'Manual corrections log' : 'Initial shelf setup',
          submittedBy: user?.uid || 'unknown',
          submittedByName: user?.displayName || 'Owner',
          timestamp: new Date().toISOString()
        });
      }

      toast.success(editingIngredient ? 'Ingredient updated!' : 'Ingredient added to Master list!');
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save ingredient details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!tenantId || !deletingId) return;

    try {
      await deleteDoc(doc(db, 'restaurants', tenantId, 'inventory', deletingId));
      toast.success('Ingredient deleted from stock master.');
      setIsDeleteOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Delete failed.');
    }
  };

  // Recipe edit mapping triggers
  const handleOpenCreateRecipe = () => {
    setEditingRecipe(null);
    setSelectedRecipeItem(null);
    setRecipeName('');
    setRecipePortionSize('1 Portion');
    setRecipeYield('1');
    setRecipeWastePercent('0');
    setRecipeCookingNotes('');
    setRecipeIngredients([]);
    setIsRecipeModalOpen(true);
  };

  const handleOpenEditRecipe = (recipe: IRecipe) => {
    setEditingRecipe(recipe);
    const targetItem = menuItems.find(m => m.id === recipe.menuItemId);
    setSelectedRecipeItem(targetItem || { id: recipe.menuItemId, name: recipe.menuItemName });
    setRecipeName(recipe.recipeName || '');
    setRecipePortionSize(recipe.portionSize || '1 Portion');
    setRecipeYield(String(recipe.yieldQuantity || 1));
    setRecipeWastePercent(String(recipe.wastePercentage || 0));
    setRecipeCookingNotes(recipe.cookingNotes || '');
    setRecipeIngredients(recipe.ingredients || []);
    setIsRecipeModalOpen(true);
  };

  const handleOpenViewRecipe = (recipe: IRecipe) => {
    setViewingRecipe(recipe);
    setIsRecipeViewModalOpen(true);
  };

  const handleOpenRecipeMapping = (menuItem: any) => {
    setSelectedRecipeItem(menuItem);
    const existingRecipe = recipes.find(r => r.menuItemId === menuItem.id);
    if (existingRecipe) {
      handleOpenEditRecipe(existingRecipe);
    } else {
      setEditingRecipe(null);
      setRecipeName(`${menuItem.name} Standard Recipe`);
      setRecipePortionSize('1 Portion');
      setRecipeYield('1');
      setRecipeWastePercent('0');
      setRecipeCookingNotes('');
      setRecipeIngredients([]);
      setIsRecipeModalOpen(true);
    }
  };

  const handleAddIngredientRow = () => {
    if (ingredients.length === 0) {
      toast.error('Please create stock ingredients first.');
      return;
    }
    const defaultIng = ingredients[0];
    setRecipeIngredients([...recipeIngredients, {
      ingredientId: defaultIng.id,
      ingredientName: defaultIng.name,
      quantity: 10,
      unit: defaultIng.unit,
      notes: ''
    }]);
  };

  const handleUpdateRecipeRow = (index: number, field: string, value: any) => {
    const rows = [...recipeIngredients];
    if (field === 'ingredientId') {
      const resolved = ingredients.find(i => i.id === value);
      if (resolved) {
        rows[index].ingredientId = resolved.id;
        rows[index].ingredientName = resolved.name;
        rows[index].unit = resolved.unit;
      }
    } else {
      rows[index][field] = value;
    }
    setRecipeIngredients(rows);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = async () => {
    if (!tenantId || !selectedRecipeItem) {
      toast.error('Please select a Menu Item.');
      return;
    }
    if (!recipeName.trim()) {
      toast.error('Recipe Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const recipeRef = doc(db, 'restaurants', tenantId, 'recipes', selectedRecipeItem.id);
      
      const payload: IRecipe = {
        id: selectedRecipeItem.id,
        menuItemId: selectedRecipeItem.id,
        menuItemName: selectedRecipeItem.name,
        version: recipeVersion || 'v1.0',
        yieldQuantity: parseFloat(recipeYield) || 1,
        wastePercentage: parseFloat(recipeWastePercent) || 0,
        recipeName: recipeName.trim(),
        portionSize: recipePortionSize.trim(),
        cookingNotes: recipeCookingNotes.trim(),
        ingredients: recipeIngredients.map(ing => ({
          ingredientId: ing.ingredientId,
          ingredientName: ing.ingredientName,
          quantity: parseFloat(ing.quantity) || 0,
          unit: ing.unit || 'g',
          notes: ing.notes || ''
        })),
        updatedAt: new Date().toISOString()
      };

      await setDoc(recipeRef, payload);
      toast.success(`Recipe for "${recipeName}" saved!`);
      setIsRecipeModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save recipe mapping.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Waste logs submit
  const handleOpenWaste = () => {
    if (ingredients.length === 0) {
      toast.error('No ingredients listed in inventory.');
      return;
    }
    setWasteIngId(ingredients[0].id);
    setWasteQty('');
    setWasteReason('spoilage');
    setWasteNote('');
    setIsWasteModalOpen(true);
  };

  const handleSubmitWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    const ing = ingredients.find(i => i.id === wasteIngId);
    if (!ing) return;

    const qty = parseFloat(wasteQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter valid waste quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const lostValueCents = qty * (ing.purchaseCost || 0);

      const wastePayload = {
        ingredientId: wasteIngId,
        ingredientName: ing.name,
        quantity: qty,
        unit: ing.unit,
        reason: wasteReason,
        valueLost: lostValueCents,
        submittedBy: user?.uid || 'staff',
        submittedByName: user?.displayName || 'Kitchen Chef',
        notes: wasteNote.trim()
      };

      await inventoryService.recordWaste(tenantId, wastePayload);
      toast.success('Waste logged, stock levels adjusted.');
      setIsWasteModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to record waste.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supplier modal handlers
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupDeliveryDays('3');
    setSupRating('5');
    setSupCompanyName('');
    setSupGstNumber('');
    setSupPaymentTerms('COD');
    setSupDeliverySchedule('Weekly');
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier: ISupplier) => {
    setEditingSupplier(supplier);
    setSupName(supplier?.name || '');
    setSupPhone(supplier?.phone || '');
    setSupEmail(supplier?.email || '');
    setSupAddress(supplier?.address || '');
    setSupDeliveryDays(supplier?.deliveryTimeDays !== undefined ? String(supplier.deliveryTimeDays) : '3');
    setSupRating(supplier?.rating !== undefined ? String(supplier.rating) : '5');
    setSupCompanyName(supplier?.companyName || '');
    setSupGstNumber(supplier?.gstNumber || '');
    setSupPaymentTerms(supplier?.paymentTerms || 'COD');
    setSupDeliverySchedule(supplier?.deliverySchedule || 'Weekly');
    setIsSupplierModalOpen(true);
  };

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!supName.trim()) {
      toast.error('Supplier name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supplierId = editingSupplier ? editingSupplier.id : `SUP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const supRef = doc(db, 'restaurants', tenantId, 'suppliers', supplierId);

      const payload: ISupplier = {
        id: supplierId,
        name: supName.trim(),
        phone: supPhone.trim(),
        email: supEmail.trim(),
        address: supAddress.trim(),
        suppliedIngredientIds: editingSupplier ? editingSupplier.suppliedIngredientIds || [] : [],
        deliveryTimeDays: parseInt(supDeliveryDays) || 3,
        rating: parseInt(supRating) || 5,
        updatedAt: new Date().toISOString(),
        companyName: supCompanyName.trim(),
        gstNumber: supGstNumber.trim(),
        paymentTerms: supPaymentTerms,
        deliverySchedule: supDeliverySchedule
      };

      await setDoc(supRef, payload);
      toast.success(editingSupplier ? 'Supplier details updated!' : 'New Supplier registered!');
      setIsSupplierModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Supplier operations failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteSupplier = (id: string) => {
    setDeletingSupId(id);
    setIsSupDeleteOpen(true);
  };

  const handleConfirmDeleteSupplier = async () => {
    if (!tenantId || !deletingSupId) return;

    try {
      await deleteDoc(doc(db, 'restaurants', tenantId, 'suppliers', deletingSupId));
      toast.success('Supplier removed.');
      setIsSupDeleteOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Delete failed.');
    }
  };

  // Recipe copy/duplicate and delete handlers
  const handleDuplicateRecipe = async (sourceRecipe: IRecipe, targetMenuItemId: string) => {
    if (!tenantId) return;
    try {
      const targetItem = menuItems.find(item => item.id === targetMenuItemId);
      if (!targetItem) {
        toast.error('Target Menu Item not found.');
        return;
      }
      const payload: IRecipe = {
        ...sourceRecipe,
        id: targetMenuItemId,
        menuItemId: targetMenuItemId,
        menuItemName: targetItem.name,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'restaurants', tenantId, 'recipes', targetMenuItemId), payload);
      toast.success(`Recipe copied to ${targetItem.name}!`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to duplicate recipe.');
    }
  };

  const handleDeleteRecipe = async (menuItemId: string) => {
    if (!tenantId) return;
    try {
      await deleteDoc(doc(db, 'restaurants', tenantId, 'recipes', menuItemId));
      toast.success('Recipe mapping deleted.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete recipe.');
    }
  };

  // Stock safety PO generator
  const handleCreatePurchaseOrder = async (item: IStockIngredient) => {
    if (!tenantId) return;
    try {
      const recommendedQty = Math.max(10, item.maximumStock - item.currentStock);
      const estCost = recommendedQty * (item.purchaseCost || 0);

      const sugId = `SUG-${item.id}`;
      await setDoc(doc(db, 'restaurants', tenantId, 'purchaseSuggestions', sugId), {
        id: sugId,
        ingredientId: item.id,
        ingredientName: item.name,
        recommendedQuantity: recommendedQty,
        unit: item.unit,
        supplierId: item.supplierId || '',
        supplierName: item.supplierName || 'Direct Purchase',
        estimatedCost: estCost,
        priority: item.status === 'out_of_stock' || item.status === 'critical' ? 'critical' : 'medium',
        createdAt: new Date().toISOString(),
        status: 'pending'
      });

      toast.success(`PO suggestion created for ${item.name}!`);
      setActiveTab('suggestions');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create purchase suggestion.');
    }
  };

  // Export Movements CSV helper
  const handleExportMovementsCSV = () => {
    const headers = ['Timestamp', 'Ingredient', 'Quantity Delta', 'Type', 'Reason', 'Performed By'];
    const rows = filteredMovements.map(m => [
      new Date(m.timestamp).toLocaleString(),
      m.ingredientName,
      `${m.quantity > 0 ? '+' : ''}${m.quantity}`,
      m.type,
      m.reason,
      m.submittedByName
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_movements_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Rule-based deterministic Suggestions generator
  const handleGenerateLocalSuggestions = async () => {
    if (!tenantId) return;
    const toastId = toast.loading("Analyzing safety levels, waste factors, and supplier rates...");
    try {
      const suggestionsCol = collection(db, 'restaurants', tenantId, 'purchaseSuggestions');
      const existingSnap = await getDocs(suggestionsCol);
      const existingIds = new Set(existingSnap.docs.map(d => d.data().ingredientId));

      let createdCount = 0;

      for (const item of ingredients) {
        if (item.currentStock <= item.reorderLevel && !existingIds.has(item.id)) {
          const qty = item.maximumStock - item.currentStock;
          let supplierId = item.supplierId;
          let supplierName = item.supplierName;
          
          const alternativeSuppliers = suppliers.filter(s => 
            s.id !== item.supplierId && 
            s.suppliedIngredientIds?.includes(item.id)
          );
          
          let bestSupplier = suppliers.find(s => s.id === item.supplierId);
          alternativeSuppliers.forEach(alt => {
            if (!bestSupplier || alt.rating > bestSupplier.rating || alt.deliveryTimeDays < bestSupplier.deliveryTimeDays) {
              bestSupplier = alt;
            }
          });

          if (bestSupplier) {
            supplierId = bestSupplier.id;
            supplierName = bestSupplier.name;
          }

          const sugId = `SUG-${item.id}`;
          const priority = item.currentStock === 0 ? 'critical' : (item.currentStock <= item.minimumStock * 0.5 ? 'high' : 'medium');
          
          await setDoc(doc(db, 'restaurants', tenantId, 'purchaseSuggestions', sugId), {
            id: sugId,
            ingredientId: item.id,
            ingredientName: item.name,
            recommendedQuantity: qty,
            unit: item.unit,
            supplierId: supplierId || '',
            supplierName: supplierName || 'Direct Purchase',
            estimatedCost: qty * (item.purchaseCost || 0),
            priority,
            createdAt: new Date().toISOString(),
            status: 'pending'
          });
          createdCount++;
        }
      }

      toast.success(`Optimized ${createdCount} purchase recommendations!`, { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate optimized suggestions.', { id: toastId });
    }
  };

  const handleMarkSuggestionOrdered = async (id: string) => {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, 'restaurants', tenantId, 'purchaseSuggestions', id), {
        status: 'ordered'
      });
      toast.success('Suggested order status changed to Ordered!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompleteSuggestion = async (sug: IPurchaseSuggestion) => {
    if (!tenantId) return;
    try {
      const sugId = sug?.id;
      const ingId = sug?.ingredientId;
      if (!sugId || !ingId) return;

      const qty = sug?.recommendedQuantity !== undefined ? sug.recommendedQuantity : (sug?.requiredQuantity !== undefined ? sug.requiredQuantity : 0);

      // 1. Add Stock back to inventory
      const ingRef = doc(db, 'restaurants', tenantId, 'inventory', ingId);
      const ingSnap = await getDoc(ingRef);
      
      if (ingSnap.exists()) {
        const ingData = ingSnap.data() as IStockIngredient;
        const newQty = (ingData.currentStock || 0) + qty;
        
        await updateDoc(ingRef, {
          currentStock: newQty,
          status: 'healthy',
          updatedAt: new Date().toISOString()
        });

        // 2. Log Stock movement purchase
        const movementId = `MVT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        await setDoc(doc(db, 'restaurants', tenantId, 'stockMovements', movementId), {
          id: movementId,
          ingredientId: ingId,
          ingredientName: sug?.ingredientName || ingData.name || 'Unknown Ingredient',
          quantity: qty,
          type: 'purchase',
          reason: 'Replenishment order completed',
          submittedBy: user?.uid || 'owner',
          submittedByName: user?.displayName || 'Owner',
          timestamp: new Date().toISOString()
        });
      }

      // 3. Remove suggestion document
      await deleteDoc(doc(db, 'restaurants', tenantId, 'purchaseSuggestions', sugId));
      toast.success('Replenishment stock received and inventory levels increased!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to complete suggestion.');
    }
  };

  // Nav tabs config
  const navTabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'ingredients', label: 'Ingredients list', icon: Package },
    { id: 'recipes', label: 'Recipes map', icon: BookOpen },
    { id: 'movements', label: 'Movements Log', icon: FileText },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'lowstock', label: 'Low Stock warnings', icon: AlertOctagon },
    { id: 'expiry', label: 'Expiry monitor', icon: Calendar },
    { id: 'waste', label: 'Waste Logs', icon: Trash },
    { id: 'suggestions', label: 'Suggestions list', icon: Sparkles }
  ];

  return (
    <div className="space-y-6 text-left select-none antialiased">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-textPearl">Inventory Automation</h1>
          <p className="text-xs text-mutedAsh font-semibold">Automatic stock calculations, recipes mappings, waste losses tracking, and replenishment alerts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenWaste} variant="secondary" className="flex items-center gap-1.5 text-xs font-bold py-2 px-3">
            <Trash className="w-3.5 h-3.5" />
            <span>Record Waste</span>
          </Button>
          <Button onClick={handleOpenAddIngredient} className="flex items-center gap-1.5 text-xs font-bold py-2 px-3 bg-[#C9533B] hover:bg-[#A94332] text-white">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock Ingredient</span>
          </Button>
        </div>
      </div>

      <Tabs 
        tabs={navTabs} 
        activeTabId={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5 border-[#E5E0D9] bg-white shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider block">Kitchen Stock Value</span>
                <strong className="text-xl font-mono text-[#17202A] font-extrabold">{formatPrice(stockMetrics.value)}</strong>
              </div>
              <div className="p-3 bg-[#E8F5EF] border border-[#C6E7D8] rounded-2xl text-[#16845B]">
                <TrendingUp className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-5 border-[#E5E0D9] bg-white shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider block">Low Stock Warnings</span>
                <strong className="text-xl font-mono text-[#9A6200] font-extrabold">{stockMetrics.low + stockMetrics.critical}</strong>
              </div>
              <div className="p-3 bg-[#FFF4DC] border border-[#FDE6B0] rounded-2xl text-[#D98B00]">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-5 border-[#E5E0D9] bg-white shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider block">Out of Stock</span>
                <strong className="text-xl font-mono text-[#B92E2E] font-extrabold">{stockMetrics.out}</strong>
              </div>
              <div className="p-3 bg-[#FBEAE5] border border-[#F5CBC4] rounded-2xl text-[#D64545]">
                <AlertOctagon className="w-6 h-6 animate-pulse" />
              </div>
            </Card>

            <Card className="p-5 border-[#E5E0D9] bg-white shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider block">Spoilage & Waste Lost</span>
                <strong className="text-xl font-mono text-[#52606D] font-extrabold">{formatPrice(stockMetrics.wasteCost)}</strong>
              </div>
              <div className="p-3 bg-[#F8F6F2] border border-[#E5E0D9] rounded-2xl text-[#7B8794]">
                <Trash className="w-6 h-6" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 border-slate-850 bg-slate-900/15 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider block">Today's Consumption</span>
                <strong className="text-base font-mono text-textPearl font-bold">{stockMetrics.todayConsumptionCount} units</strong>
              </div>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/15 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-555 font-bold uppercase tracking-wider block">Monthly Purchases</span>
                <strong className="text-base font-mono text-textPearl font-bold">{formatPrice(stockMetrics.monthlyPurchases)}</strong>
              </div>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/15 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-555 font-bold uppercase tracking-wider block">Inventory Accuracy</span>
                <strong className="text-base font-mono text-emerald-500 font-bold">{stockMetrics.inventoryAccuracy}%</strong>
              </div>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/15 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-555 font-bold uppercase tracking-wider block">Turnover Index</span>
                <strong className="text-base font-mono text-textPearl font-bold">{stockMetrics.turnoverRatio}x</strong>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
              <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
                Low Stock warnings
              </h3>
              {allLowStockAlerts.length === 0 ? (
                <p className="text-xs text-slate-500 font-semibold py-4 text-center">All stock levels healthy!</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {allLowStockAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="flex justify-between items-center bg-slate-950/40 p-2.5 border border-slate-855 rounded-xl text-xs">
                      <div>
                        <span className="font-bold text-textPearl block">{alert.name}</span>
                        <span className="text-[9px] text-slate-550 font-bold block uppercase mt-0.5">{alert.subtitle}</span>
                      </div>
                      <div className="text-right space-y-1">
                        <strong className="font-mono text-amber-500 font-extrabold">{alert.amount}</strong>
                        <Badge variant={alert.badgeVariant} className="scale-90 origin-right block">
                          {alert.badgeText}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
              <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
                Recent Stock Movements
              </h3>
              {movements.length === 0 ? (
                <p className="text-xs text-slate-500 font-semibold py-4 text-center">No movements recorded yet.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {movements.slice(0, 5).map(m => (
                    <div key={m.id} className="flex justify-between items-center bg-slate-950/40 p-2.5 border border-slate-855 rounded-xl text-xs">
                      <div>
                        <span className="font-bold text-slate-300 block">{m.ingredientName}</span>
                        <span className="text-[9px] text-slate-550 block font-semibold">{m.reason}</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <strong className={`font-mono font-extrabold ${m.quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </strong>
                        <span className="text-[8.5px] text-slate-600 block uppercase tracking-widest">{m.type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Ingredients list Tab */}
      {activeTab === 'ingredients' && (
        <div className="space-y-6">
          <Card className="p-4 border-slate-850 bg-slate-900/20">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <SearchBar 
                  placeholder="Search ingredient list..." 
                  value={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
              <div className="w-full md:w-56">
                <Select 
                  options={categories}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {ingredients.length === 0 ? (
            <Card className="p-12 text-center border-slate-850 bg-slate-900/10">
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-textPearl">No inventory items yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Add your ingredients to start tracking real-time stock levels, reorder alerts, and recipe costs.
              </p>
              <Button onClick={handleOpenAddIngredient} className="mt-4 mx-auto flex items-center space-x-1.5" size="sm">
                <Plus className="w-4 h-4" />
                <span>Add Ingredient</span>
              </Button>
            </Card>
          ) : filteredIngredients.length === 0 ? (
            <Card className="p-8 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
              <AlertTriangle className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-450">No stock records match filters.</p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden border-slate-850">
              <Table 
                keyExtractor={(row: IStockIngredient) => row.id} 
                data={filteredIngredients}
                columns={[
                  {
                    header: 'Ingredient Details',
                    accessor: (row: IStockIngredient) => (
                      <div>
                        <span className="font-bold text-textPearl text-sm">{row.name}</span>
                        <div className="flex space-x-1.5 mt-0.5">
                          <Badge variant="muted">{row.category}</Badge>
                          <Badge variant="muted" className="bg-slate-900 border-slate-800 text-slate-400">
                            Storage: {row.storageLocation}
                          </Badge>
                        </div>
                      </div>
                    )
                  },
                  {
                    header: 'Current Stock',
                    accessor: (row: IStockIngredient) => (
                      <div>
                        <span className="font-bold text-slate-300">{row.currentStock} {row.unit}</span>
                        <span className="text-[10px] text-slate-550 block font-semibold">Min limit: {row.minimumStock}</span>
                      </div>
                    )
                  },
                  {
                    header: 'Stock Status',
                    accessor: (row: IStockIngredient) => (
                      <Badge variant={
                        row.status === 'healthy' ? 'success' :
                        row.status === 'low' ? 'warning' : 'danger'
                      }>
                        {(row.status || 'healthy').replace('_', ' ')}
                      </Badge>
                    )
                  },
                  {
                    header: 'Preferred Supplier',
                    accessor: (row: IStockIngredient) => (
                      <div>
                        <span className="text-slate-350 font-semibold block">{row.supplierName || 'None'}</span>
                        <span className="text-[9.5px] text-slate-550 font-bold block uppercase">Cost: {formatPrice(row.purchaseCost)}</span>
                      </div>
                    )
                  },
                  {
                    header: 'Expiry Date',
                    accessor: (row: IStockIngredient) => (
                      <span className="text-slate-400 text-xs">
                        {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : 'N/A'}
                      </span>
                    )
                  },
                  {
                    header: 'Actions',
                    accessor: (row: IStockIngredient) => (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditIngredient(row)}
                          className="p-1 text-slate-400 hover:text-primary hover:bg-slate-800/50"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(row.id)}
                          className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )
                  }
                ]}
              />
            </Card>
          )}
        </div>
      )}

      {/* Recipes mapping Tab */}
      {activeTab === 'recipes' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 flex-col md:flex-row gap-3 w-full">
              <div className="flex-1">
                <SearchBar 
                  placeholder="Search recipes by Menu Item or Recipe Name..." 
                  value={recipeSearch}
                  onSearchChange={setRecipeSearch}
                />
              </div>
              <div className="w-full md:w-52">
                <select
                  value={recipeCategoryFilter}
                  onChange={(e) => setRecipeCategoryFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
                >
                  <option value="all">All Categories</option>
                  {['Vegetables', 'Meat', 'Dairy', 'Dry Goods', 'Beverages', 'Spices', 'Bakery', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              onClick={handleOpenCreateRecipe}
              className="w-full md:w-auto bg-gradient-to-r from-primary to-amber-600 hover:from-primary-hover hover:to-amber-700 text-background flex items-center justify-center gap-1.5 text-xs font-bold py-3 px-4"
            >
              <Plus className="w-4 h-4" />
              <span>Create Recipe</span>
            </Button>
          </div>

          {recipes.length === 0 ? (
            <Card className="p-10 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10 space-y-4">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-textPearl">No recipes configured yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Map your menu items to ingredients and quantities to estimate costs, calculate yield limits, and automate stock deductions.
              </p>
              <Button
                onClick={handleOpenCreateRecipe}
                className="mx-auto text-xs font-bold py-2 px-4 bg-gradient-to-r from-primary to-amber-600 text-background"
              >
                Create Recipe
              </Button>
            </Card>
          ) : (
            <>
              {(() => {
                const filteredRecipes = recipes.filter(r => {
                  const matchesSearch = (r.menuItemName || '').toLowerCase().includes(recipeSearch.toLowerCase()) || 
                                        (r.recipeName || '').toLowerCase().includes(recipeSearch.toLowerCase());
                  const item = menuItems.find(m => m.id === r.menuItemId);
                  const cat = item ? item.category : 'Other';
                  const matchesCategory = recipeCategoryFilter === 'all' || cat === recipeCategoryFilter;
                  return matchesSearch && matchesCategory;
                });

                if (filteredRecipes.length === 0) {
                  return (
                    <Card className="p-8 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
                      <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-semibold">No recipes matching your filters.</p>
                    </Card>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredRecipes.map((recipe) => {
                      const estimatedCost = recipe.ingredients.reduce((sum, ri) => {
                        const ing = ingredients.find(i => i.id === ri.ingredientId);
                        const cost = ing ? ing.purchaseCost || 0 : 0;
                        return sum + (ri.quantity * cost);
                      }, 0);

                      return (
                        <Card key={recipe.id} className="p-5 border-slate-850 bg-slate-900/30 flex flex-col justify-between space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-textPearl text-base">{recipe.menuItemName}</h4>
                                <span className="text-[10px] text-primary font-bold uppercase tracking-wider block mt-0.5">
                                  {recipe.recipeName || 'Standard Recipe'}
                                </span>
                              </div>
                              <Badge variant="success" className="scale-90 origin-right">
                                {recipe.portionSize || '1 Portion'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-850/50 text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                              <div>
                                <span className="text-slate-550 block text-[9px] mb-0.5">Ingredients</span>
                                <span className="text-xs text-textPearl font-extrabold">{recipe.ingredients?.length || 0} items</span>
                              </div>
                              <div>
                                <span className="text-slate-550 block text-[9px] mb-0.5">Estimated Cost</span>
                                <span className="text-xs text-emerald-500 font-mono font-extrabold">{formatPrice(estimatedCost)}</span>
                              </div>
                              <div>
                                <span className="text-slate-550 block text-[9px] mb-0.5">Yield Servings</span>
                                <span className="text-xs text-textPearl font-extrabold">{recipe.yieldQuantity || 1} serv</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                              <span>Last Updated: {recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString() : 'N/A'}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-2">
                            <Button 
                              variant="secondary"
                              onClick={() => handleOpenViewRecipe(recipe)}
                              className="flex-1 text-xs py-2 px-2.5 font-bold"
                            >
                              View
                            </Button>
                            <Button 
                              variant="secondary"
                              onClick={() => handleOpenEditRecipe(recipe)}
                              className="flex-1 text-xs py-2 px-2.5 font-bold"
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                const targetId = prompt(`Enter target Menu Item ID to copy recipe mapping to:\nOptions:\n${menuItems.filter(m => m.id !== recipe.menuItemId).map(m => `- ${m.id} (${m.name})`).join('\n')}`);
                                if (targetId) handleDuplicateRecipe(recipe, targetId);
                              }}
                              className="flex-1 text-[10px] border-slate-800 text-slate-300 font-bold py-2 px-2"
                            >
                              Duplicate
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this recipe mapping?')) {
                                  handleDeleteRecipe(recipe.id);
                                }
                              }}
                              className="flex-1 text-[10px] border-slate-800 text-red-400 hover:text-red-500 font-bold py-2 px-2"
                            >
                              Delete
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Movements Log Tab */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <Card className="p-4 border-slate-850 bg-slate-900/20 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={movementFilter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMovementFilter('all')}
                className="text-xs"
              >
                All
              </Button>
              <Button
                variant={movementFilter === 'today' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMovementFilter('today')}
                className="text-xs"
              >
                Today
              </Button>
              <Button
                variant={movementFilter === 'week' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMovementFilter('week')}
                className="text-xs"
              >
                This Week
              </Button>
              <Button
                variant={movementFilter === 'month' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMovementFilter('month')}
                className="text-xs"
              >
                This Month
              </Button>
              <Button
                variant={movementFilter === 'custom' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setMovementFilter('custom')}
                className="text-xs"
              >
                Custom Range
              </Button>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMovementsCSV}
                className="text-xs border-slate-800 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </Button>
            </div>
          </Card>

          {movementFilter === 'custom' && (
            <Card className="p-4 border-slate-850 bg-slate-900/10 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-bold uppercase">Start Date:</span>
                <input
                  type="date"
                  value={movementCustomStart}
                  onChange={(e) => setMovementCustomStart(e.target.value)}
                  className="bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-2 text-xs font-semibold text-textPearl outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-bold uppercase">End Date:</span>
                <input
                  type="date"
                  value={movementCustomEnd}
                  onChange={(e) => setMovementCustomEnd(e.target.value)}
                  className="bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-2 text-xs font-semibold text-textPearl outline-none"
                />
              </div>
            </Card>
          )}

          <Card className="p-0 overflow-hidden border-slate-850">
            <Table
              keyExtractor={(row: IStockMovement) => row.id}
              data={filteredMovements}
              columns={[
                {
                  header: 'Timestamp',
                  accessor: (row: IStockMovement) => (
                    <span className="text-slate-450 font-mono text-[10px]">
                      {new Date(row.timestamp).toLocaleString()}
                    </span>
                  )
                },
                {
                  header: 'Ingredient',
                  accessor: (row: IStockMovement) => <span className="font-bold text-textPearl">{row.ingredientName}</span>
                },
                {
                  header: 'Quantity Delta',
                  accessor: (row: IStockMovement) => (
                    <span className={`font-mono font-bold ${row.quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {row.quantity > 0 ? '+' : ''}{row.quantity}
                    </span>
                  )
                },
                {
                  header: 'Adjustment Type',
                  accessor: (row: IStockMovement) => (
                    <Badge variant={
                      ['purchase', 'refund_restock', 'cancellation_restock'].includes(row.type || '') ? 'success' :
                      row.type === 'consumption' ? 'muted' : 'danger'
                    }>
                      {(row.type || '').replace('_', ' ')}
                    </Badge>
                  )
                },
                {
                  header: 'Audit Reason',
                  accessor: (row: IStockMovement) => <span className="text-slate-400 font-semibold truncate max-w-[120px] block">{row.reason}</span>
                },
                {
                  header: 'Performed By',
                  accessor: (row: IStockMovement) => <span className="text-slate-500 font-semibold">{row.submittedByName}</span>
                },
                {
                  header: 'Actions',
                  accessor: (row: IStockMovement) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMovement(row)}
                      className="p-1 text-xs text-slate-400 hover:text-primary hover:bg-slate-800/50"
                    >
                      View Detail
                    </Button>
                  )
                }
              ]}
            />
          </Card>
        </div>
      )}

      {/* Suppliers tab */}
      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Supplier Matrix</h3>
            <Button onClick={handleOpenAddSupplier} className="text-xs font-bold py-1.5 px-3">
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add Supplier</span>
            </Button>
          </div>

          {suppliers.length === 0 ? (
            <Card className="p-8 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
              <AlertTriangle className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-450">No suppliers logged.</p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden border-slate-850">
              <Table
                 keyExtractor={(row: ISupplier) => row?.id || Math.random().toString()}
                data={suppliers}
                columns={[
                  {
                    header: 'Supplier Details',
                    accessor: (row: ISupplier) => (
                      <div>
                        <span className="font-bold text-textPearl text-sm block">{row?.name || 'Unnamed'}</span>
                        {row?.companyName || row?.gstNumber ? (
                          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                            {row?.companyName && `Co: ${row.companyName}`} {row?.gstNumber && ` • GST: ${row.gstNumber}`}
                          </span>
                        ) : null}
                      </div>
                    )
                  },
                  {
                    header: 'Contact Details',
                    accessor: (row: ISupplier) => (
                      <div className="space-y-0.5">
                        <span className="text-slate-350 font-semibold block">{row?.phone || 'No phone'}</span>
                        <span className="text-[10px] text-slate-550 block font-semibold">{row?.email || 'No email'}</span>
                      </div>
                    )
                  },
                  {
                    header: 'Delivery & Payment',
                    accessor: (row: ISupplier) => (
                      <div className="space-y-0.5">
                        <span className="text-slate-350 font-semibold block">{row?.deliveryTimeDays !== undefined ? `${row.deliveryTimeDays} days` : 'N/A'} ({row?.deliverySchedule || 'Weekly'})</span>
                        <span className="text-[10px] text-slate-500 block font-semibold">Terms: {row?.paymentTerms || 'COD'}</span>
                      </div>
                    )
                  },
                  {
                    header: 'Supplier Rating',
                    accessor: (row: ISupplier) => (
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} className={`w-3.5 h-3.5 ${star <= (row?.rating || 0) ? 'text-amber-500 fill-current' : 'text-slate-700'}`} />
                        ))}
                      </div>
                    )
                  },
                  {
                    header: 'Actions',
                    accessor: (row: ISupplier) => (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditSupplier(row)}
                          className="p-1 text-slate-400 hover:text-primary hover:bg-slate-800/50"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDeleteSupplier(row.id)}
                          className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )
                  }
                ]}
              />
            </Card>
          )}
        </div>
      )}

      {/* Low Stock tab */}
      {activeTab === 'lowstock' && (
        <Card className="p-0 overflow-hidden border-slate-850">
          <Table
            keyExtractor={(row: IStockIngredient) => row.id}
            data={ingredients.filter(i => i.status === 'low' || i.status === 'critical' || i.status === 'out_of_stock')}
            columns={[
              {
                header: 'Ingredient Details',
                accessor: (row: IStockIngredient) => (
                  <div>
                    <span className="font-bold text-textPearl">{row.name}</span>
                    <Badge variant="muted" className="mt-0.5 ml-0">{row.category}</Badge>
                  </div>
                )
              },
              {
                header: 'Current Stock level',
                accessor: (row: IStockIngredient) => (
                  <strong className="font-mono text-amber-500 font-extrabold">{row.currentStock} {row.unit}</strong>
                )
              },
              {
                header: 'Safety Min Limit',
                accessor: (row: IStockIngredient) => <span className="text-slate-400 font-semibold">{row.minimumStock} {row.unit}</span>
              },
              {
                header: 'Stock Warning State',
                accessor: (row: IStockIngredient) => (
                  <Badge variant={row.status === 'out_of_stock' ? 'danger' : 'warning'}>
                    {(row.status || '').replace('_', ' ')}
                  </Badge>
                )
              },
              {
                header: 'Contact Supplier',
                accessor: (row: IStockIngredient) => <span className="text-slate-400 font-semibold">{row.supplierName}</span>
              },
              {
                header: 'Actions',
                accessor: (row: IStockIngredient) => (
                  <Button
                    onClick={() => handleCreatePurchaseOrder(row)}
                    className="text-[10px] font-bold py-1.5 px-2 bg-gradient-to-r from-primary to-amber-600 hover:from-primary-hover hover:to-amber-700 text-background"
                  >
                    Create PO
                  </Button>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* Expiry Tab */}
      {activeTab === 'expiry' && (
        <Card className="p-0 overflow-hidden border-slate-850">
          <Table
            keyExtractor={(row: IStockIngredient) => row.id}
            data={ingredients
              .filter(i => i.expiryDate)
              .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
            }
            columns={[
              {
                header: 'Ingredient Name',
                accessor: (row: IStockIngredient) => <span className="font-bold text-textPearl">{row.name}</span>
              },
              {
                header: 'Expiration Date',
                accessor: (row: IStockIngredient) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const expired = row.expiryDate < todayStr;
                  return (
                    <span className={`font-semibold ${expired ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                      {new Date(row.expiryDate).toLocaleDateString()}
                    </span>
                  );
                }
              },
              {
                header: 'Expirations Health Status',
                accessor: (row: IStockIngredient) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const diffTime = new Date(row.expiryDate).getTime() - new Date(todayStr).getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  let badgeVariant: 'danger' | 'warning' | 'success' = 'success';
                  let label = 'SAFE';

                  if (diffDays < 0) {
                    badgeVariant = 'danger';
                    label = 'EXPIRED';
                  } else if (diffDays === 0) {
                    badgeVariant = 'danger';
                    label = 'EXPIRES TODAY';
                  } else if (diffDays <= 3) {
                    badgeVariant = 'warning';
                    label = `URGENT (${diffDays}d)`;
                  } else if (diffDays <= 7) {
                    badgeVariant = 'warning';
                    label = `WARN (${diffDays}d)`;
                  }

                  return (
                    <Badge variant={badgeVariant}>
                      {label}
                    </Badge>
                  );
                }
              },
              {
                header: 'Storage Area',
                accessor: (row: IStockIngredient) => <span className="text-slate-450 font-semibold">{row.storageLocation}</span>
              }
            ]}
          />
        </Card>
      )}

      {/* Waste Logs Tab */}
      {activeTab === 'waste' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kitchen Waste Loss Log</h3>
            <Button onClick={handleOpenWaste} className="text-xs font-bold py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white">
              <Trash className="w-3.5 h-3.5 mr-1" />
              <span>Record Waste Document</span>
            </Button>
          </div>

          {wasteLogs.length === 0 ? (
            <p className="text-xs text-slate-550 font-bold uppercase text-center py-8">No waste records logged.</p>
          ) : (
            <Card className="p-0 overflow-hidden border-slate-850">
              <Table
                keyExtractor={(row: IWasteLog) => row.id}
                data={wasteLogs}
                columns={[
                  {
                    header: 'Timestamp',
                    accessor: (row: IWasteLog) => (
                      <span className="text-slate-450 font-mono text-[10px]">
                        {new Date(row.timestamp).toLocaleString()}
                      </span>
                    )
                  },
                  {
                    header: 'Wasted item',
                    accessor: (row: IWasteLog) => <span className="font-bold text-textPearl">{row.ingredientName}</span>
                  },
                  {
                    header: 'Quantity Loss',
                    accessor: (row: IWasteLog) => (
                      <span className="text-slate-300 font-semibold">{row.quantity} {row.unit}</span>
                    )
                  },
                  {
                    header: 'Loss Value',
                    accessor: (row: IWasteLog) => (
                      <strong className="text-red-500 font-mono font-extrabold">{formatPrice(row.valueLost)}</strong>
                    )
                  },
                  {
                    header: 'Waste Reason',
                    accessor: (row: IWasteLog) => (
                      <Badge variant="danger" className="scale-90 origin-left">
                        {(row.reason || '').replace('_', ' ')}
                      </Badge>
                    )
                  },
                  {
                    header: 'Wasted By',
                    accessor: (row: IWasteLog) => <span className="text-slate-500 font-semibold">{row.submittedByName}</span>
                  }
                ]}
              />
            </Card>
          )}
        </div>
      )}

      {/* Suggestions tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Replenishment Suggestions</h3>
            <Button
              onClick={handleGenerateLocalSuggestions}
              className="text-xs font-bold py-1.5 px-3 bg-slate-800 border border-slate-750 text-slate-300 hover:text-textPearl flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>Optimize suggestions</span>
            </Button>
          </div>
          {suggestions.length === 0 ? (
            <Card className="p-8 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
              <Sparkles className="w-10 h-10 text-slate-700 mx-auto mb-2 animate-pulse" />
              <p className="text-sm font-semibold text-slate-450 mb-4">No inventory suggestions available.</p>
              <Button
                onClick={handleGenerateLocalSuggestions}
                className="text-xs font-bold py-1.5 px-3 bg-slate-800 border border-slate-750 text-slate-300 hover:text-textPearl"
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-1" />
                <span>Refresh Suggestions</span>
              </Button>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden border-slate-850">
              <Table
                keyExtractor={(row: IPurchaseSuggestion) => row?.id || Math.random().toString()}
                data={suggestions}
                columns={[
                  {
                    header: 'Replenishment Ingredient',
                    accessor: (row: IPurchaseSuggestion) => <span className="font-bold text-textPearl">{row?.ingredientName || 'Unknown Ingredient'}</span>
                  },
                  {
                    header: 'Recommended Order Qty',
                    accessor: (row: IPurchaseSuggestion) => (
                      <strong className="font-mono text-primary font-extrabold">
                        {row?.recommendedQuantity !== undefined ? row.recommendedQuantity : (row?.requiredQuantity !== undefined ? row.requiredQuantity : 0)} {row?.unit || ''}
                      </strong>
                    )
                  },
                  {
                    header: 'Preferred Supplier',
                    accessor: (row: IPurchaseSuggestion) => <span className="text-slate-400 font-semibold">{row?.supplierName || 'N/A'}</span>
                  },
                  {
                    header: 'Est. Replenish Cost',
                    accessor: (row: IPurchaseSuggestion) => (
                      <span className="font-mono text-emerald-500 font-bold">{formatPrice(row?.estimatedCost || 0)}</span>
                    )
                  },
                  {
                    header: 'Purchase Priority',
                    accessor: (row: IPurchaseSuggestion) => {
                      const priority = row?.priority || 'medium';
                      return (
                        <Badge variant={priority === 'critical' || priority === 'high' ? 'danger' : 'warning'}>
                          {priority.toUpperCase()}
                        </Badge>
                      );
                    }
                  },
                  {
                    header: 'Actions',
                    accessor: (row: IPurchaseSuggestion) => (
                      <div className="flex items-center space-x-2">
                        {row?.status === 'pending' ? (
                          <Button
                            size="sm"
                            onClick={() => handleMarkSuggestionOrdered(row?.id)}
                            className="text-[10px] font-bold py-1 px-2.5 bg-slate-800 border border-slate-750 text-slate-300 hover:text-textPearl"
                          >
                            Mark Ordered
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleCompleteSuggestion(row)}
                            className="text-[10px] font-bold py-1 px-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-background"
                          >
                            Receive Stock
                          </Button>
                        )}
                      </div>
                    )
                  }
                ]}
              />
            </Card>
          )}
        </div>
      )}

      {/* FORM MODAL FOR INGREDIENTS */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingIngredient ? 'Edit Master Ingredient' : 'Register Ingredient Master'}
      >
        <form onSubmit={handleSubmitIngredient} className="space-y-4 text-left select-none text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Ingredient Name</label>
              <input
                type="text"
                placeholder="E.g. Boneless Chicken"
                value={ingName}
                onChange={(e) => setIngName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Category</label>
              <select
                value={ingCategory}
                onChange={(e: any) => setIngCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                {categories.filter(c => c.value !== 'all').map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Current stock qty</label>
              <input
                type="number"
                step="0.01"
                placeholder="10"
                value={ingCurrentStock}
                onChange={(e) => setIngCurrentStock(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Safety Min Level</label>
              <input
                type="number"
                step="0.01"
                placeholder="5"
                value={ingMinStock}
                onChange={(e) => setIngMinStock(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Safety Max level</label>
              <input
                type="number"
                step="0.01"
                placeholder="50"
                value={ingMaxStock}
                onChange={(e) => setIngMaxStock(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Reorder Level Threshold</label>
              <input
                type="number"
                step="0.01"
                placeholder="10"
                value={ingReorderLevel}
                onChange={(e) => setIngReorderLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Measurement Unit</label>
              <select
                value={ingUnit}
                onChange={(e: any) => setIngUnit(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                {['kg', 'g', 'liters', 'ml', 'pieces', 'packs'].map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Purchase Cost ({currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                placeholder="1.50"
                value={ingPurchaseCost}
                onChange={(e) => setIngPurchaseCost(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Supplier</label>
              <select
                value={ingSupplierId}
                onChange={(e) => setIngSupplierId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Storage Location</label>
              <select
                value={ingStorageLocation}
                onChange={(e: any) => setIngStorageLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                {['Fridge', 'Freezer', 'Pantry', 'Dry Storage', 'Bar', 'Kitchen Shelf'].map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Expiry Date</label>
              <input
                type="date"
                value={ingExpiryDate}
                onChange={(e) => setIngExpiryDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-slate-800/40 mt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary to-amber-600 hover:from-primary-hover hover:to-amber-700 text-background"
              isLoading={isSubmitting}
            >
              {editingIngredient ? 'Save Changes' : 'Register Ingredient'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* RECIPE CONFIGURATION MODAL */}
      <Modal
        isOpen={isRecipeModalOpen}
        onClose={() => setIsRecipeModalOpen(false)}
        title={editingRecipe ? `Edit Recipe: ${recipeName}` : 'Create New Recipe'}
      >
        <div className="space-y-4 text-left select-none text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-500 uppercase block">Select Menu Item</label>
            {editingRecipe ? (
              <div className="w-full bg-slate-900 border border-slate-850 rounded-xl p-3 text-xs font-semibold text-slate-400">
                {selectedRecipeItem?.name || selectedRecipeItem?.menuItemName}
              </div>
            ) : (
              <select
                value={selectedRecipeItem?.id || ''}
                onChange={(e) => {
                  const item = menuItems.find(m => m.id === e.target.value);
                  setSelectedRecipeItem(item);
                  if (item) {
                    setRecipeName(`${item.name} Standard Recipe`);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                <option value="">Select Menu Item</option>
                {menuItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-500 uppercase block">Recipe Name</label>
            <input
              type="text"
              placeholder="Standard Recipe, Chef Special Recipe, etc."
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Portion Size</label>
              <input
                type="text"
                placeholder="E.g. 250g, 1 plate, Large"
                value={recipePortionSize}
                onChange={(e) => setRecipePortionSize(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Preparation Yield (Servings)</label>
              <input
                type="number"
                value={recipeYield}
                onChange={(e) => setRecipeYield(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-500 uppercase block">Cooking Notes (Optional)</label>
            <textarea
              placeholder="Cooking steps, prep instructions, etc."
              value={recipeCookingNotes}
              onChange={(e) => setRecipeCookingNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              rows={2}
            />
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <span className="font-bold text-slate-400">Ingredient Mapping</span>
            <button
              onClick={handleAddIngredientRow}
              className="text-[10px] text-primary hover:text-primary-hover font-bold uppercase tracking-wider flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Ingredient</span>
            </button>
          </div>

          {recipeIngredients.length === 0 ? (
            <p className="text-center py-6 text-slate-500">No ingredients mapped. Click "Add Ingredient" to start.</p>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {recipeIngredients.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-2.5 bg-slate-900/40 border border-slate-850/50 rounded-xl">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <select
                        value={row.ingredientId}
                        onChange={(e) => handleUpdateRecipeRow(idx, 'ingredientId', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-primary rounded-xl p-2 text-xs font-semibold text-textPearl outline-none"
                      >
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => handleUpdateRecipeRow(idx, 'quantity', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-primary rounded-xl p-2 text-xs font-semibold text-textPearl outline-none font-mono"
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-bold w-12 truncate">{row.unit}</span>
                    <button
                      onClick={() => handleRemoveRecipeRow(idx)}
                      className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional ingredient note (e.g. diced finely)"
                    value={row.notes || ''}
                    onChange={(e) => handleUpdateRecipeRow(idx, 'notes', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-primary rounded-xl p-2 text-[10px] font-semibold text-slate-400 outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {recipeIngredients.length > 0 && (() => {
            const totalCost = recipeIngredients.reduce((sum, ri) => {
              const ing = ingredients.find(i => i.id === ri.ingredientId);
              const cost = ing ? ing.purchaseCost || 0 : 0;
              return sum + (parseFloat(ri.quantity || 0) * cost);
            }, 0);
            const yieldQty = parseFloat(recipeYield) || 1;
            const costPerServing = totalCost / yieldQty;

            return (
              <div className="p-3 bg-slate-900/80 border border-slate-850 rounded-xl space-y-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                <div className="flex justify-between">
                  <span>Number of Ingredients:</span>
                  <span className="text-textPearl">{recipeIngredients.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Ingredients Cost:</span>
                  <span className="text-emerald-500 font-mono">{formatPrice(totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Food Cost / Serving:</span>
                  <span className="text-emerald-500 font-mono">{formatPrice(costPerServing)}</span>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center space-x-3 pt-4 border-t border-slate-850 mt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsRecipeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRecipe}
              className="flex-1 bg-gradient-to-r from-primary to-amber-600 hover:from-primary-hover hover:to-amber-700 text-background"
              isLoading={isSubmitting}
            >
              Save Recipe
            </Button>
          </div>
        </div>
      </Modal>

      {/* VIEW RECIPE MODAL */}
      <Modal
        isOpen={isRecipeViewModalOpen}
        onClose={() => setIsRecipeViewModalOpen(false)}
        title={`Recipe details: ${viewingRecipe?.recipeName}`}
      >
        {viewingRecipe && (() => {
          const totalCost = viewingRecipe.ingredients.reduce((sum, ri) => {
            const ing = ingredients.find(i => i.id === ri.ingredientId);
            const cost = ing ? ing.purchaseCost || 0 : 0;
            return sum + (ri.quantity * cost);
          }, 0);
          const yieldQty = viewingRecipe.yieldQuantity || 1;
          const costPerServing = totalCost / yieldQty;

          return (
            <div className="space-y-4 text-left select-none text-xs">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-805">
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px] mb-0.5">Menu Item</span>
                  <strong className="text-textPearl text-sm">{viewingRecipe.menuItemName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px] mb-0.5">Portion Size</span>
                  <strong className="text-textPearl text-sm">{viewingRecipe.portionSize || '1 Portion'}</strong>
                </div>
              </div>

              {viewingRecipe.cookingNotes && (
                <div>
                  <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px] mb-1">Cooking Notes</span>
                  <p className="p-3 bg-slate-900 border border-slate-850 rounded-xl text-slate-300 font-semibold leading-relaxed">
                    {viewingRecipe.cookingNotes}
                  </p>
                </div>
              )}

              <div>
                <span className="text-slate-500 font-bold block uppercase tracking-wider text-[9px] mb-2.5">Ingredient Proportions & Cost Breakdown</span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {viewingRecipe.ingredients.map((ing, idx) => {
                    const ingMaster = ingredients.find(i => i.id === ing.ingredientId);
                    const cost = ingMaster ? ingMaster.purchaseCost || 0 : 0;
                    const ingTotalCost = ing.quantity * cost;

                    return (
                      <div key={idx} className="p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-textPearl block font-bold">{ing.ingredientName}</strong>
                          <span className="text-[10px] text-slate-500 block font-semibold mt-0.5">
                            {ing.quantity} {ing.unit} {ing.notes ? `• ${ing.notes}` : ''}
                          </span>
                        </div>
                        <span className="font-mono text-emerald-500 font-bold">
                          {formatPrice(ingTotalCost)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <div className="flex justify-between">
                  <span>Ingredients Count:</span>
                  <span className="text-textPearl">{viewingRecipe.ingredients?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span>Total cost of Ingredients:</span>
                  <span className="text-emerald-500 font-mono">{formatPrice(totalCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Cost / Serving (Yield {yieldQty}):</span>
                  <span className="text-emerald-500 font-mono font-extrabold">{formatPrice(costPerServing)}</span>
                </div>
              </div>

              <Button onClick={() => setIsRecipeViewModalOpen(false)} className="w-full py-2.5 font-bold">
                Close Recipe details
              </Button>
            </div>
          );
        })()}
      </Modal>

      {/* WASTE RECORDING MODAL */}
      <Modal
        isOpen={isWasteModalOpen}
        onClose={() => setIsWasteModalOpen(false)}
        title="Record Stock Waste & Spoilage"
      >
        <form onSubmit={handleSubmitWaste} className="space-y-4 text-left select-none text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-500 uppercase block">Select Ingredient</label>
            <select
              value={wasteIngId}
              onChange={(e) => setWasteIngId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
            >
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name} ({ing.currentStock} {ing.unit} available)</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Waste Quantity</label>
              <input
                type="number"
                step="0.01"
                placeholder="2.5"
                value={wasteQty}
                onChange={(e) => setWasteQty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Reason</label>
              <select
                value={wasteReason}
                onChange={(e: any) => setWasteReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                <option value="spoilage">Spoilage</option>
                <option value="expired">Expired Stock</option>
                <option value="damaged">Damaged Stock</option>
                <option value="staff_mistake">Staff Mistake</option>
                <option value="customer_return">Customer Return</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-500 uppercase block">Notes</label>
            <textarea
              placeholder="Provide extra details on root cause..."
              value={wasteNote}
              onChange={(e) => setWasteNote(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-slate-850 mt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsWasteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              isLoading={isSubmitting}
            >
              Log Waste Deduction
            </Button>
          </div>
        </form>
      </Modal>

      {/* SUPPLIER MODAL */}
      <Modal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier Details' : 'Register New Supplier'}
      >
        <form onSubmit={handleSubmitSupplier} className="space-y-4 text-left select-none text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-500 uppercase block">Supplier Name</label>
            <input
              type="text"
              placeholder="E.g. Apex Meat Distribs"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Phone</label>
              <input
                type="text"
                placeholder="+1 555-0199"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Email</label>
              <input
                type="email"
                placeholder="orders@apexmeat.com"
                value={supEmail}
                onChange={(e) => setSupEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-500 uppercase block">Supplier Address</label>
            <input
              type="text"
              placeholder="12 Logistics Way, Suite A"
              value={supAddress}
              onChange={(e) => setSupAddress(e.target.value)}
              className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Delivery Turnaround (Days)</label>
              <input
                type="number"
                value={supDeliveryDays}
                onChange={(e) => setSupDeliveryDays(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Supplier Rating</label>
              <select
                value={supRating}
                onChange={(e) => setSupRating(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                {['1', '2', '3', '4', '5'].map(stars => (
                  <option key={stars} value={stars}>{stars} Stars</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Company Name</label>
              <input
                type="text"
                placeholder="E.g. Apex Foods Private Limited"
                value={supCompanyName}
                onChange={(e) => setSupCompanyName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">GST Registration</label>
              <input
                type="text"
                placeholder="GSTIN99AABBCC11"
                value={supGstNumber}
                onChange={(e) => setSupGstNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Preferred Payment Terms</label>
              <select
                value={supPaymentTerms}
                onChange={(e) => setSupPaymentTerms(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                {['COD', 'Net 15', 'Net 30', 'Net 45', 'Advance'].map(term => (
                  <option key={term} value={term}>{term}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-500 uppercase block">Delivery Schedule</label>
              <select
                value={supDeliverySchedule}
                onChange={(e) => setSupDeliverySchedule(e.target.value)}
                className="w-full bg-slate-900 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
              >
                {['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'On Call'].map(sched => (
                  <option key={sched} value={sched}>{sched}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-slate-850 mt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsSupplierModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary to-amber-600 hover:from-primary-hover hover:to-amber-700 text-background"
              isLoading={isSubmitting}
            >
              {editingSupplier ? 'Save Changes' : 'Register Supplier'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATIONS */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Stock Document"
        message="Are you sure you want to delete this stock item? This will clear its registry levels history."
        confirmLabel="Delete"
        isDangerous={true}
      />

      <Dialog
        isOpen={isSupDeleteOpen}
        onClose={() => setIsSupDeleteOpen(false)}
        onConfirm={handleConfirmDeleteSupplier}
        title="Remove Supplier"
        message="Are you sure you want to delete this supplier listing? Ingredients mapped to this supplier will revert to direct purchases."
        confirmLabel="Delete"
        isDangerous={true}
      />

      {/* MOVEMENT DETAIL MODAL */}
      <Modal
        isOpen={!!selectedMovement}
        onClose={() => setSelectedMovement(null)}
        title="Stock Movement Details"
      >
        {selectedMovement && (
          <div className="space-y-3.5 text-left text-xs font-semibold text-slate-300">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500 font-bold uppercase block">Movement ID</span>
              <span className="font-mono text-textPearl">{selectedMovement.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500 font-bold uppercase block">Ingredient</span>
              <span className="font-bold text-textPearl">{selectedMovement.ingredientName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500 font-bold uppercase block">Quantity Delta</span>
              <span className={`font-bold ${selectedMovement.quantity > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {selectedMovement.quantity > 0 ? '+' : ''}{selectedMovement.quantity}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500 font-bold uppercase block">Adjustment Type</span>
              <span className="capitalize">{selectedMovement.type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500 font-bold uppercase block">Timestamp</span>
              <span>{new Date(selectedMovement.timestamp).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-500 font-bold uppercase block">Performed By</span>
              <span>{selectedMovement.submittedByName}</span>
            </div>
            <div className="space-y-1 mt-2">
              <span className="text-slate-500 font-bold uppercase block">Audit Reason</span>
              <p className="p-3 bg-slate-900 border border-slate-850 rounded-xl text-slate-200 font-semibold">{selectedMovement.reason}</p>
            </div>
            <Button onClick={() => setSelectedMovement(null)} className="w-full mt-4 py-2">
              Close Details
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OwnerInventoryManager;
