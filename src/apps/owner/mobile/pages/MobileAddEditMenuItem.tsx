import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Upload, 
  Check, 
  AlertCircle,
  Clock,
  DollarSign,
  Utensils,
  Sparkles,
  TrendingUp,
  Flame,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';

const FALLBACK_ITEM_IMAGE = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&auto=format&fit=crop&q=60';

export const MobileAddEditMenuItem: React.FC = () => {
  const { itemId } = useParams<{ itemId?: string }>();
  const isEditMode = Boolean(itemId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const tenantId = user?.tenantId;

  // Real categories
  const [categories, setCategories] = useState<any[]>([]);

  // Basic Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('Mains');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [foodType, setFoodType] = useState<'veg' | 'non-veg' | 'vegan'>('veg');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('15');
  const [spiceLevel, setSpiceLevel] = useState<'none' | 'mild' | 'medium' | 'hot' | 'extra_hot'>('none');
  const [productionMode, setProductionMode] = useState<'On Demand' | 'Batch Production'>('On Demand');
  const [defaultBatchSize, setDefaultBatchSize] = useState('50');
  const [availableServings, setAvailableServings] = useState('50');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [autoUnavailable, setAutoUnavailable] = useState(true);
  const [showServingsToStaff, setShowServingsToStaff] = useState(true);
  const [allowRefill, setAllowRefill] = useState(true);

  // Media
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  // Item Flags
  const [available, setAvailable] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [isRecommended, setIsRecommended] = useState(false);

  // Status & State
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load real categories
  useEffect(() => {
    if (!tenantId) return;
    const catCol = collection(db, 'restaurants', tenantId, 'menu', 'default', 'categories');
    const unsub = onSnapshot(catCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => Number(a.order ?? a.displayOrder ?? 99) - Number(b.order ?? b.displayOrder ?? 99));
      setCategories(list);
      if (list.length > 0 && !categoryId && !isEditMode) {
        setCategoryId(list[0].id);
        setCategoryName(list[0].name);
      }
    });
    return () => unsub();
  }, [tenantId, isEditMode, categoryId]);

  // Load existing item if in edit mode
  useEffect(() => {
    if (!isEditMode || !tenantId || !itemId) return;

    const fetchItem = async () => {
      setLoading(true);
      try {
        const itemRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', itemId);
        const snap = await getDoc(itemRef);
        if (snap.exists()) {
          const d = snap.data();
          setName(d.name || '');
          setDescription(d.description || '');
          setCategoryId(d.categoryId || '');
          setCategoryName(d.category || 'Mains');
          // Currency minor unit conversion: Firestore paise -> Rupees input
          setPrice(d.price != null ? String(d.price / 100) : '');
          setDiscountPrice(d.discountPrice != null ? String(d.discountPrice / 100) : '');
          setFoodType(d.type || (d.isVegetarian ? 'veg' : 'non-veg'));
          setPrepTimeMinutes(String(d.prepTime || d.preparationTime || 15));
          setSpiceLevel(d.spiceLevel || 'none');
          setProductionMode(d.productionMode || 'On Demand');
          setDefaultBatchSize(String(d.defaultBatchSize ?? 50));
          setAvailableServings(String(d.availableServings ?? 50));
          setLowStockThreshold(String(d.lowStockThreshold ?? 10));
          setAutoUnavailable(d.autoUnavailable !== false);
          setShowServingsToStaff(d.showServingsToStaff !== false);
          setAllowRefill(d.allowRefill !== false);
          setImageUrl(d.image || d.imageUrl || '');
          setImagePreview(d.image || d.imageUrl || '');
          setAvailable(d.available !== false && d.isAvailable !== false);
          setIsPublished(d.isPublished !== false);
          setIsBestSeller(d.isBestSeller === true || d.bestseller === true);
          setIsRecommended(d.isRecommended === true || d.recommended === true);
        } else {
          setErrorMessage('Menu item not found.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load item.');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [isEditMode, tenantId, itemId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCategorySelect = (selectedId: string) => {
    setCategoryId(selectedId);
    const found = categories.find((c) => c.id === selectedId);
    if (found) {
      setCategoryName(found.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setErrorMessage('Tenant identifier missing.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Item name is required.');
      return;
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMessage('Please enter a valid base price greater than zero.');
      return;
    }

    let numDiscount: number | null = null;
    if (discountPrice.trim()) {
      numDiscount = Number(discountPrice);
      if (isNaN(numDiscount) || numDiscount < 0) {
        setErrorMessage('Discount price must be a valid non-negative number.');
        return;
      }
      if (numDiscount >= numPrice) {
        setErrorMessage('Discount price must be less than base price.');
        return;
      }
    }

    const numPrepTime = Number(prepTimeMinutes);
    if (isNaN(numPrepTime) || numPrepTime < 1) {
      setErrorMessage('Preparation time must be at least 1 minute.');
      return;
    }

    if (productionMode === 'Batch Production') {
      const bSize = Number(defaultBatchSize);
      if (isNaN(bSize) || bSize < 1) {
        setErrorMessage('Batch size must be at least 1 when Batch Production is enabled.');
        return;
      }
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const colRef = collection(db, 'restaurants', tenantId, 'menu', 'default', 'items');
      const targetDocRef = isEditMode && itemId ? doc(colRef, itemId) : doc(colRef);
      const targetId = targetDocRef.id;

      let finalImageUrl = imageUrl.trim();

      // Handle photo upload if file selected
      if (imageFile && storage) {
        try {
          const storageRef = ref(storage, `restaurants/${tenantId}/items/${targetId}`);
          const uploadResult = await uploadBytes(storageRef, imageFile);
          finalImageUrl = await getDownloadURL(uploadResult.ref);
        } catch (uploadErr) {
          console.warn('[MobileAddEditMenuItem] Photo upload warning:', uploadErr);
          if (!finalImageUrl) finalImageUrl = FALLBACK_ITEM_IMAGE;
        }
      }

      // Canonical storage: Prices stored in paise (minor units, e.g. 26900 = ₹269.00)
      const payload: Record<string, any> = {
        name: name.trim(),
        description: description.trim(),
        categoryId: categoryId || 'general',
        category: categoryName.trim() || 'General',
        price: Math.round(numPrice * 100),
        ...(numDiscount !== null ? { discountPrice: Math.round(numDiscount * 100) } : { discountPrice: null }),
        type: foodType,
        isVegetarian: foodType === 'veg' || foodType === 'vegan',
        veg: foodType === 'veg' || foodType === 'vegan',
        prepTime: numPrepTime,
        preparationTime: numPrepTime,
        spiceLevel,
        preparationMethod: productionMode === 'Batch Production' ? 'batch' : 'fresh',
        productionMode,
        defaultBatchSize: Math.max(1, Number(defaultBatchSize) || 50),
        availableServings: Math.max(0, Number(availableServings) || 0),
        lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 10),
        autoUnavailable,
        showServingsToStaff,
        allowRefill,
        image: finalImageUrl,
        imageUrl: finalImageUrl,
        available,
        isAvailable: available,
        isPublished,
        isBestSeller,
        bestseller: isBestSeller,
        isRecommended,
        recommended: isRecommended,
        status: available ? 'active' : 'inactive',
        tenantId,
        updatedAt: new Date().toISOString(),
        ...(!isEditMode ? { createdAt: new Date().toISOString() } : {}),
      };

      await setDoc(targetDocRef, payload, { merge: true });
      navigate('/owner/menu', { replace: true });
    } catch (err: any) {
      console.error('[MobileAddEditMenuItem] Save error:', err);
      setErrorMessage(err.message || 'Failed to save menu item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tenantId || !itemId) return;
    setDeleting(true);
    try {
      const itemRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', itemId);
      await deleteDoc(itemRef);
      navigate('/owner/menu', { replace: true });
    } catch (err: any) {
      console.error('[MobileAddEditMenuItem] Delete error:', err);
      setErrorMessage(err.message || 'Failed to delete item.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-3 border-[#FF7518] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-[#707070] font-medium">Loading dish details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/menu')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <h1 className="font-extrabold text-sm text-[#202124]">
          {isEditMode ? 'Edit Menu Item' : 'New Menu Item'}
        </h1>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-3.5 py-1.5 rounded-xl bg-[#FF7518] text-white text-xs font-bold shadow-sm shadow-[#FF7518]/25 flex items-center gap-1 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
      </header>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] flex items-center gap-2.5 text-xs text-[#DC2626]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* 1. Basic Information Card */}
        <div className="bg-white rounded-3xl border border-[#EBEBEB] p-4 shadow-sm space-y-3.5">
          <h2 className="text-xs font-extrabold text-[#202124] uppercase tracking-wider">
            General Information
          </h2>

          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1">Dish Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Butter Chicken Masala, Truffle Fries"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all placeholder:text-[#9E9E9E]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe flavors, ingredients, and allergen notices..."
              className="w-full p-3 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all placeholder:text-[#9E9E9E]"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1">Menu Category *</label>
            {categories.length > 0 ? (
              <select
                value={categoryId}
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g. Mains"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
              />
            )}
          </div>
        </div>

        {/* 2. Pricing & Preparation Card */}
        <div className="bg-white rounded-3xl border border-[#EBEBEB] p-4 shadow-sm space-y-3.5">
          <h2 className="text-xs font-extrabold text-[#202124] uppercase tracking-wider">
            Pricing & Preparation
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#202124] mb-1">
                Base Price ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="249.00"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#202124] mb-1">
                Discount Price ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value)}
                placeholder="e.g. 219.00"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#202124] mb-1">Prep Time (Minutes)</label>
              <input
                type="number"
                min="1"
                value={prepTimeMinutes}
                onChange={(e) => setPrepTimeMinutes(e.target.value)}
                placeholder="15"
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#202124] mb-1">Spice Level</label>
              <select
                value={spiceLevel}
                onChange={(e) => setSpiceLevel(e.target.value as any)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
              >
                <option value="none">None (Mildest)</option>
                <option value="mild">Mild 🌶️</option>
                <option value="medium">Medium 🌶️🌶️</option>
                <option value="hot">Hot 🌶️🌶️🌶️</option>
                <option value="extra_hot">Extra Hot 🔥</option>
              </select>
            </div>
          </div>

          {/* Production Mode Segmented Control */}
          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1.5">Production Mode</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F7F7] rounded-xl border border-[#EBEBEB]">
              <button
                type="button"
                onClick={() => setProductionMode('On Demand')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  productionMode === 'On Demand'
                    ? 'bg-white text-[#202124] shadow-xs'
                    : 'text-[#707070]'
                }`}
              >
                On Demand
              </button>
              <button
                type="button"
                onClick={() => setProductionMode('Batch Production')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  productionMode === 'Batch Production'
                    ? 'bg-white text-[#202124] shadow-xs'
                    : 'text-[#707070]'
                }`}
              >
                Batch Production
              </button>
            </div>

            {/* Batch Preparation Settings Card */}
            {productionMode === 'Batch Production' && (
              <div className="mt-3 p-3.5 rounded-2xl bg-[#FFF8F3] border border-[#FFD8BF] space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FF7518]" />
                  <h3 className="text-xs font-bold text-[#202124]">Batch Preparation Settings</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#707070] mb-1">Batch Size</label>
                    <input
                      type="number"
                      min="1"
                      value={defaultBatchSize}
                      onChange={(e) => setDefaultBatchSize(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl bg-white border border-[#FFD8BF] text-xs text-[#202124] font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#707070] mb-1">Available Servings</label>
                    <input
                      type="number"
                      min="0"
                      value={availableServings}
                      onChange={(e) => setAvailableServings(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl bg-white border border-[#FFD8BF] text-xs text-[#202124] font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#707070] mb-1">Low Stock Alert</label>
                    <input
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-xl bg-white border border-[#FFD8BF] text-xs text-[#202124] font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-[#FFD8BF]/60">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px] text-[#202124] font-medium">Auto mark unavailable when empty (0)</span>
                    <input
                      type="checkbox"
                      checked={autoUnavailable}
                      onChange={(e) => setAutoUnavailable(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px] text-[#202124] font-medium">Show live servings to service staff</span>
                    <input
                      type="checkbox"
                      checked={showServingsToStaff}
                      onChange={(e) => setShowServingsToStaff(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[11px] text-[#202124] font-medium">Allow rapid kitchen refills</span>
                    <input
                      type="checkbox"
                      checked={allowRefill}
                      onChange={(e) => setAllowRefill(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Dietary & Badges Card */}
        <div className="bg-white rounded-3xl border border-[#EBEBEB] p-4 shadow-sm space-y-3.5">
          <h2 className="text-xs font-extrabold text-[#202124] uppercase tracking-wider">
            Dietary & Merchandising Flags
          </h2>

          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1.5">Dietary Classification</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFoodType('veg')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  foodType === 'veg'
                    ? 'border-[#16A34A] bg-[#DCFCE7] text-[#16A34A]'
                    : 'border-[#EBEBEB] bg-[#F7F7F7] text-[#707070]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                <span>Vegetarian</span>
              </button>

              <button
                type="button"
                onClick={() => setFoodType('non-veg')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  foodType === 'non-veg'
                    ? 'border-[#DC2626] bg-[#FEE2E2] text-[#DC2626]'
                    : 'border-[#EBEBEB] bg-[#F7F7F7] text-[#707070]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                <span>Non-Veg</span>
              </button>

              <button
                type="button"
                onClick={() => setFoodType('vegan')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  foodType === 'vegan'
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                    : 'border-[#EBEBEB] bg-[#F7F7F7] text-[#707070]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <span>Vegan</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* In Stock */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F7F7]">
              <div>
                <span className="text-xs font-bold text-[#202124]">Available In-Stock</span>
                <p className="text-[10px] text-[#707070]">Permit diners to order this item</p>
              </div>
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
              />
            </div>

            {/* Published */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F7F7]">
              <div>
                <span className="text-xs font-bold text-[#202124]">Published on Digital Menu</span>
                <p className="text-[10px] text-[#707070]">Visible to table-side QR customers</p>
              </div>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
              />
            </div>

            {/* Bestseller */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F7F7]">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#FF7518]" />
                <div>
                  <span className="text-xs font-bold text-[#202124]">Bestseller Badge</span>
                  <p className="text-[10px] text-[#707070]">Highlight prominently in category view</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isBestSeller}
                onChange={(e) => setIsBestSeller(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
              />
            </div>

            {/* Recommended */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F7F7]">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                <div>
                  <span className="text-xs font-bold text-[#202124]">Chef's Recommended</span>
                  <p className="text-[10px] text-[#707070]">Recommend to first-time diners</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isRecommended}
                onChange={(e) => setIsRecommended(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
              />
            </div>
          </div>
        </div>

        {/* 4. Photo & Media Card */}
        <div className="bg-white rounded-3xl border border-[#EBEBEB] p-4 shadow-sm space-y-3.5">
          <h2 className="text-xs font-extrabold text-[#202124] uppercase tracking-wider">
            Photo & Media
          </h2>

          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                if (!imageFile) setImagePreview(e.target.value);
              }}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#202124] mb-1">Or Upload Dish Photo</label>
            <div className="flex items-center gap-3">
              <label className="px-3.5 py-2.5 bg-[#F7F7F7] border border-[#EBEBEB] text-[#202124] rounded-xl text-xs font-bold hover:border-[#FF7518] cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#FF7518]" />
                <span>Choose Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>

              {imagePreview ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#EBEBEB] bg-[#F7F7F7]">
                  <img src={imagePreview} alt="Dish Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-[#D1D5DB] flex items-center justify-center text-[#9E9E9E]">
                  <ImageIcon className="w-5 h-5" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-[#FF7518] text-white text-xs font-bold shadow-md shadow-[#FF7518]/25 flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : isEditMode ? 'Update Dish' : 'Create Menu Item'}</span>
          </button>

          {isEditMode && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="w-full py-3 rounded-2xl bg-[#FEE2E2] text-[#DC2626] text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Menu Item</span>
            </button>
          )}
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 space-y-3 shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-sm text-[#202124]">Delete "{name}"?</h3>
              <p className="text-xs text-[#707070] mt-1">
                Are you sure you want to remove this item from the restaurant catalog?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAddEditMenuItem;
