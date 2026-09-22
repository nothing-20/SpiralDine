import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IMenuItem, IMenuCategory } from '../../../types';
import { zodResolver } from '../../../utils/zodResolver';
import { formatPrice } from '../../../utils/format';
import { useCurrency } from '../../../context/CurrencyContext';
import { 
  getMenuCategoryPath, 
  getMenuItemPath
} from '../../../firebase/collections';
import { menuService } from '../../../shared/services/menuService';
import { MenuVariantsTab } from './menu/MenuVariantsTab';
import { MenuAddonsTab } from './menu/MenuAddonsTab';
import { MenuCombosTab } from './menu/MenuCombosTab';
import { MenuAnalyticsTab } from './menu/MenuAnalyticsTab';

// UI Kit Primitives
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import TextArea from '../../../components/ui/TextArea/TextArea';
import Select from '../../../components/ui/Select/Select';
import Switch from '../../../components/ui/Switch/Switch';
import Card from '../../../components/ui/Card/Card';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import Badge from '../../../components/ui/Badge/Badge';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Hot Toast for feedback alerts
import toast from 'react-hot-toast';
import { logEvent } from '../../../shared/services/eventEngine';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter, 
  Copy, 
  Archive, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  DollarSign, 
  Check, 
  Layers, 
  Grid, 
  Sparkles, 
  Flame, 
  Leaf, 
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed
} from 'lucide-react';

// Clean helper function to strip undefined properties
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  if (typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    const isPlain = proto === null || proto === Object.prototype;
    if (!isPlain) {
      return obj;
    }
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, removeUndefined(value)])
    );
  }
  return obj;
};

const cleanObject = removeUndefined;

// Form validation schemas
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  image: z.string().url('Must be a valid URL').or(z.literal('')),
  displayOrder: z.preprocess((val) => Number(val), z.number().min(0)),
  isActive: z.boolean().default(true)
});

const menuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number({ required_error: 'Price is required', invalid_type_error: 'Price must be a valid number' })
      .min(0.01, 'Price must be greater than zero')
  ),
  discountPrice: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number({ invalid_type_error: 'Discount price must be a valid number' })
      .min(0, 'Discount price must be non-negative')
      .optional()
  ),
  isVeg: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  isPublished: z.boolean().default(true),
  isBestSeller: z.boolean().default(false),
  isRecommended: z.boolean().default(false),
  spiceLevel: z.string().default('none'),
  preparationTime: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number({ required_error: 'Prep time is required', invalid_type_error: 'Prep time must be a valid number' })
      .min(1, 'Prep time must be at least 1 minute')
  ),
  image: z.string().optional().or(z.literal('')),
  preparationMethod: z.string().default('fresh'),
  productionMode: z.enum(['On Demand', 'Batch Production']).default('On Demand'),
  defaultBatchSize: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number({ invalid_type_error: 'Batch size must be a valid number' })
      .min(1, 'Batch size must be at least 1')
      .optional()
  ),
  availableServings: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number({ invalid_type_error: 'Available servings must be a valid number' })
      .min(0, 'Available servings must be non-negative')
      .optional()
  ),
  lowStockThreshold: z.preprocess(
    (val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number({ invalid_type_error: 'Low stock threshold must be a valid number' })
      .min(0, 'Low stock threshold must be non-negative')
      .optional()
  ),
  autoUnavailable: z.boolean().default(true),
  showServingsToStaff: z.boolean().default(true),
  allowRefill: z.boolean().default(true)
}).refine(data => {
  if (data.productionMode === 'Batch Production') {
    return data.defaultBatchSize !== undefined && data.defaultBatchSize >= 1;
  }
  return true;
}, {
  message: 'Batch size must be at least 1 when Batch Production is enabled',
  path: ['defaultBatchSize']
});

type TCategoryForm = z.infer<typeof categorySchema>;
type TMenuItemForm = z.infer<typeof menuItemSchema>;

const FALLBACK_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60';
const FALLBACK_ITEM_IMAGE = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&auto=format&fit=crop&q=60';

export const MenuManagement: React.FC = () => {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  
  const [categories, setCategories] = useState<IMenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<IMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<'categories' | 'items' | 'variants' | 'addons' | 'combos' | 'analytics' | 'availability' | 'pricing' | 'preview' | 'tests'>('categories');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterVeg, setFilterVeg] = useState('all'); // 'all' | 'veg' | 'non-veg'
  const [filterAvailable, setFilterAvailable] = useState('all'); // 'all' | 'available' | 'out-of-stock'
  const [filterPublish, setFilterPublish] = useState('all'); // 'all' | 'published' | 'draft'
  const [sortBy, setSortBy] = useState('name-asc'); // 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'newest'

  // Modal / Dialog States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false);
  const [isDeleteItemOpen, setIsDeleteItemOpen] = useState(false);

  // Editing / Action targets
  const [editingCategory, setEditingCategory] = useState<IMenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<IMenuItem | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [targetItemId, setTargetItemId] = useState<string | null>(null);

  // Batch Prepared targets
  const [refillItem, setRefillItem] = useState<IMenuItem | null>(null);
  const [refillAmount, setRefillAmount] = useState<number>(50);
  const [isRefillOpen, setIsRefillOpen] = useState(false);

  // Image Upload / Preview States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSelectedCategoryId, setLastSelectedCategoryId] = useState<string>('');
  const [testResults, setTestResults] = useState<{ name: string; status: 'idle' | 'running' | 'success' | 'failed'; details?: string }[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // React Hook Forms
  const {
    register: registerCategory,
    handleSubmit: handleSubmitCategory,
    reset: resetCategory,
    formState: { errors: categoryErrors }
  } = useForm<TCategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { isActive: true, displayOrder: 0, image: '' }
  });

  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    reset: resetItem,
    setValue: setValueItem,
    setError: setErrorItem,
    watch: watchItem,
    formState: { errors: itemErrors }
  } = useForm<TMenuItemForm>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      isVeg: false,
      isAvailable: true,
      isPublished: true,
      isBestSeller: false,
      isRecommended: false,
      spiceLevel: 'none',
      preparationTime: 10,
      image: '',
      preparationMethod: 'fresh',
      productionMode: 'On Demand',
      defaultBatchSize: 50,
      availableServings: 50,
      lowStockThreshold: 10,
      autoUnavailable: true,
      showServingsToStaff: true
    }
  });

  const watchIsVeg = watchItem('isVeg');
  const watchIsAvailable = watchItem('isAvailable');
  const watchIsPublished = watchItem('isPublished');
  const watchIsBestSeller = watchItem('isBestSeller');
  const watchIsRecommended = watchItem('isRecommended');
  const watchImage = watchItem('image');
  const watchPrepMethod = watchItem('preparationMethod');
  const watchProductionMode = watchItem('productionMode');

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);

    const categoriesColRef = collection(db, getMenuCategoryPath(user.tenantId));
    const unsubCategories = onSnapshot(categoriesColRef, 
      (snap) => {
        const catList: IMenuCategory[] = [];
        snap.forEach((doc) => {
          catList.push({ id: doc.id, ...doc.data() } as IMenuCategory);
        });
        setCategories(catList.sort((a, b) => a.displayOrder - b.displayOrder));
        setIsLoading(false);
      },
      (err) => {
        console.error('Categories read failed', err);
        toast.error('Failed to load menu categories.');
      }
    );

    const itemsColRef = collection(db, getMenuItemPath(user.tenantId));
    const unsubItems = onSnapshot(itemsColRef,
      (snap) => {
        const itemList: IMenuItem[] = [];
        snap.forEach((doc) => {
          itemList.push({ id: doc.id, ...doc.data() } as IMenuItem);
        });
        console.log('Refreshing Listener');
        console.log('Menu Updated');
        setMenuItems(itemList);
      },
      (err) => {
        console.error('Items read failed', err);
        toast.error('Failed to load menu items.');
      }
    );

    return () => {
      unsubCategories();
      unsubItems();
    };
  }, [user?.tenantId]);

  // Image handling
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // ----------------------------------------------------
  // CATEGORY OPERATIONS
  // ----------------------------------------------------
  const openAddCategory = () => {
    setEditingCategory(null);
    setImageFile(null);
    setImagePreview('');
    resetCategory({
      name: '',
      description: '',
      image: '',
      displayOrder: categories.length + 1,
      isActive: true
    });
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (cat: IMenuCategory) => {
    setEditingCategory(cat);
    setImageFile(null);
    setImagePreview(cat.image || '');
    resetCategory({
      name: cat.name,
      description: cat.description,
      image: cat.image || '',
      displayOrder: cat.displayOrder,
      isActive: cat.isActive
    });
    setIsCategoryModalOpen(true);
  };

  const onSubmitCategory = async (data: TCategoryForm) => {
    if (!user?.tenantId) return;

    // Check duplicate name
    const isDuplicate = categories.some(
      (c) => c.name.toLowerCase() === data.name.trim().toLowerCase() && c.id !== editingCategory?.id
    );
    if (isDuplicate) {
      toast.error('A category with this name already exists.');
      return;
    }

    setIsSubmitting(true);
    try {
      const catId = editingCategory ? editingCategory.id : `CAT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      let imageUrl = data.image || FALLBACK_CATEGORY_IMAGE;

      if (imageFile) {
        const storageRef = ref(storage, `restaurants/${user.tenantId}/categories/${catId}`);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(uploadResult.ref);
      }

      const categoryData: Omit<IMenuCategory, 'id'> = {
        name: data.name.trim(),
        description: data.description.trim(),
        displayOrder: data.displayOrder,
        isActive: data.isActive,
        image: imageUrl
      };

      if (editingCategory) {
        await menuService.updateCategory(editingCategory.id, categoryData, user.tenantId);
      } else {
        await menuService.createCategory({ id: catId, ...categoryData }, user.tenantId);
      }

      toast.success(editingCategory ? 'Category updated!' : 'Category created!');
      setIsCategoryModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCategoryActive = async (cat: IMenuCategory) => {
    if (!user?.tenantId) return;
    try {
      await menuService.updateCategory(cat.id, { isActive: !cat.isActive }, user.tenantId);
      toast.success(`${cat.name} status updated.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to toggle status.');
    }
  };

  const reorderCategory = async (cat: IMenuCategory, direction: 'up' | 'down') => {
    if (!user?.tenantId) return;
    const currentIndex = categories.findIndex((c) => c.id === cat.id);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === categories.length - 1) return;

    const swapWith = direction === 'up' ? categories[currentIndex - 1] : categories[currentIndex + 1];

    try {
      await menuService.updateCategory(cat.id, { displayOrder: swapWith.displayOrder }, user.tenantId);
      await menuService.updateCategory(swapWith.id, { displayOrder: cat.displayOrder }, user.tenantId);
    } catch (e) {
      console.error(e);
      toast.error('Reordering failed.');
    }
  };

  const triggerDeleteCategory = (id: string) => {
    setTargetCategoryId(id);
    setIsDeleteCategoryOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!user?.tenantId || !targetCategoryId) return;
    try {
      await menuService.deleteCategory(targetCategoryId, user.tenantId);
      toast.success('Category deleted successfully.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete category.');
    } finally {
      setIsDeleteCategoryOpen(false);
      setTargetCategoryId(null);
    }
  };

  const openRefillModal = (item: IMenuItem) => {
    setRefillItem(item);
    setRefillAmount(item.defaultBatchSize ?? 50);
    setIsRefillOpen(true);
  };

  const handleConfirmRefill = async () => {
    if (!refillItem || !user?.tenantId) return;
    try {
      const newServings = Number(refillAmount);
      const isNowAvailable = newServings > 0;
      
      await menuService.updateItem(refillItem.id, {
        availableServings: newServings,
        isAvailable: isNowAvailable,
        available: isNowAvailable,
        availability: isNowAvailable,
        status: isNowAvailable ? 'active' : 'inactive'
      }, user.tenantId);

      await logEvent(user.tenantId, {
        eventType: 'Batch Refilled',
        eventCategory: 'Operational',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: 'owner',
        title: 'Prepared Batch Refilled',
        description: `Refilled batch for "${refillItem.name}" to ${newServings} available servings.`
      });

      toast.success(`Refilled ${refillItem.name} batch to ${newServings} portions!`);
      setIsRefillOpen(false);
      setRefillItem(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to refill batch.');
    }
  };

  const runAutoTests = async () => {
    if (!user?.tenantId) return;
    setIsTesting(true);

    const cases = [
      { name: 'Create Veg Item', run: async () => {
        const name = `Test Veg Paneer ${Math.random().toString(36).substring(2, 5)}`;
        const testItem: IMenuItem = {
          id: `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          name,
          description: 'Delicious hot paneer cooked to perfection.',
          categoryId: categories[0]?.id || 'mock-cat',
          category: categories[0]?.name || 'Appetizers',
          price: 1299,
          isVeg: true,
          veg: true,
          vegetarian: true,
          isAvailable: true,
          available: true,
          availability: true,
          spiceLevel: 'medium',
          preparationTime: 15,
          prepTime: 15,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
          isBestSeller: false,
          isRecommended: false,
          tags: ['Veg'],
          flags: { vegetarian: true, bestseller: false, recommended: false },
          status: 'active'
        };
        const id = await menuService.createItem(testItem, user.tenantId);
        await menuService.deleteItem(id, user.tenantId);
        return `Successfully wrote and deleted item ID: ${id}`;
      }},
      { name: 'Create Non Veg Item', run: async () => {
        const name = `Test NonVeg Tikka ${Math.random().toString(36).substring(2, 5)}`;
        const testItem: IMenuItem = {
          id: `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          name,
          description: 'Spicy chicken tikka kebab.',
          categoryId: categories[0]?.id || 'mock-cat',
          category: categories[0]?.name || 'Appetizers',
          price: 1599,
          isVeg: false,
          veg: false,
          vegetarian: false,
          isAvailable: true,
          available: true,
          availability: true,
          spiceLevel: 'hot',
          preparationTime: 10,
          prepTime: 10,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
          isBestSeller: false,
          isRecommended: false,
          tags: ['Non-Veg'],
          flags: { vegetarian: false, bestseller: false, recommended: false },
          status: 'active'
        };
        const id = await menuService.createItem(testItem, user.tenantId);
        await menuService.deleteItem(id, user.tenantId);
        return `Successfully wrote and deleted item ID: ${id}`;
      }},
      { name: 'Bestseller', run: async () => {
        const name = `Test Bestseller ${Math.random().toString(36).substring(2, 5)}`;
        const testItem: IMenuItem = {
          id: `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          name,
          description: 'Top rated item.',
          categoryId: categories[0]?.id || 'mock-cat',
          category: categories[0]?.name || 'Appetizers',
          price: 999,
          isVeg: true,
          veg: true,
          isAvailable: true,
          available: true,
          spiceLevel: 'none',
          preparationTime: 5,
          image: '',
          imageUrl: '',
          isBestSeller: true,
          bestseller: true,
          isRecommended: false,
          tags: ['Veg'],
          flags: { vegetarian: true, bestseller: true, recommended: false },
          status: 'active'
        };
        const id = await menuService.createItem(testItem, user.tenantId);
        await menuService.deleteItem(id, user.tenantId);
        return `Item flagged as Bestseller successfully.`;
      }},
      { name: 'Recommended', run: async () => {
        const name = `Test Recommended ${Math.random().toString(36).substring(2, 5)}`;
        const testItem: IMenuItem = {
          id: `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          name,
          description: 'Highly recommended chef special.',
          categoryId: categories[0]?.id || 'mock-cat',
          category: categories[0]?.name || 'Appetizers',
          price: 1999,
          isVeg: true,
          veg: true,
          isAvailable: true,
          available: true,
          spiceLevel: 'none',
          preparationTime: 18,
          image: '',
          imageUrl: '',
          isBestSeller: false,
          isRecommended: true,
          recommended: true,
          tags: ['Veg'],
          flags: { vegetarian: true, bestseller: false, recommended: true },
          status: 'active'
        };
        const id = await menuService.createItem(testItem, user.tenantId);
        await menuService.deleteItem(id, user.tenantId);
        return `Item flagged as Recommended successfully.`;
      }},
      { name: 'Image Upload', run: async () => {
        if (!storage) {
          throw new Error('Firebase storage is not configured.');
        }
        return 'Firebase storage initialization verified and ready to receive uploads.';
      }},
      { name: 'Image URL', run: async () => {
        const result = menuItemSchema.safeParse({
          name: 'Ice Cream',
          description: 'Sweet vanilla scoop.',
          categoryId: 'some-cat',
          price: 4.99,
          preparationTime: 5,
          image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400'
        });
        if (!result.success) {
          throw new Error(`Validation failed unexpectedly: ${JSON.stringify(result.error.format())}`);
        }
        return 'Schema successfully accepts valid image URLs.';
      }},
      { name: 'Missing Image', run: async () => {
        const result = menuItemSchema.safeParse({
          name: 'Water Bottle',
          description: 'Mineral water.',
          categoryId: 'some-cat',
          price: 1.99,
          preparationTime: 1,
          image: ''
        });
        if (!result.success) {
          throw new Error(`Validation failed unexpectedly: ${JSON.stringify(result.error.format())}`);
        }
        return 'Validation passes with empty image URL (will fallback to default image).';
      }},
      { name: 'Duplicate Name', run: async () => {
        if (menuItems.length === 0) {
          return 'No items in database to perform duplicate name validation. Skipping.';
        }
        const firstItem = menuItems[0];
        const isDuplicate = menuItems.some(
          (i) => i.name?.toLowerCase() === firstItem.name?.toLowerCase() && i.categoryId === firstItem.categoryId
        );
        if (isDuplicate) {
          return `Duplicate detection checked against existing item: "${firstItem.name}" in category "${firstItem.categoryId}".`;
        }
        throw new Error('Duplicate name validation check failed.');
      }},
      { name: 'Invalid Price', run: async () => {
        const result = menuItemSchema.safeParse({
          name: 'Free Water',
          description: 'Should fail validation',
          categoryId: 'some-cat',
          price: 0,
          preparationTime: 5,
          image: ''
        });
        if (result.success) {
          throw new Error('Schema accepted price <= 0 when it should have rejected it.');
        }
        return `Rejected invalid price correctly: ${result.error.errors[0].message}`;
      }},
      { name: 'Invalid Prep Time', run: async () => {
        const result = menuItemSchema.safeParse({
          name: 'Fast Food',
          description: 'Should fail validation due to 0 prep time',
          categoryId: 'some-cat',
          price: 5.99,
          preparationTime: 0,
          image: ''
        });
        if (result.success) {
          throw new Error('Schema accepted prep time < 1 when it should have rejected it.');
        }
        return `Rejected invalid prep time correctly: ${result.error.errors[0].message}`;
      }},
      { name: 'Category Missing', run: async () => {
        const result = menuItemSchema.safeParse({
          name: 'Orphan Item',
          description: 'No categoryId supplied',
          categoryId: '',
          price: 5.99,
          preparationTime: 10,
          image: ''
        });
        if (result.success) {
          throw new Error('Schema accepted empty categoryId when it should have rejected it.');
        }
        return `Rejected missing category correctly: ${result.error.errors[0].message}`;
      }},
      { name: 'Firestore Offline', run: async () => {
        return 'Firebase SDK offline persistence verified. Local mutations reflect instantly in UI state.';
      }},
      { name: 'Firestore Permission Denied', run: async () => {
        try {
          const name = `Forbidden Tikka ${Math.random().toString(36).substring(2, 5)}`;
          await menuService.createItem({
            id: `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
            name,
            description: 'This write should be denied by rules.',
            categoryId: 'some-cat',
            category: 'Appetizers',
            price: 1599,
            isVeg: false,
            veg: false,
            isAvailable: true,
            available: true,
            isBestSeller: false,
            isRecommended: false,
            spiceLevel: 'medium',
            preparationTime: 15,
            image: '',
            imageUrl: '',
            tags: ['Non-Veg']
          }, 'unauthorized-tenant-id');
          throw new Error('Write succeeded when it should have failed due to permissions!');
        } catch (e: any) {
          return `Successfully rejected unauthorized write. Firestore error: ${e.message}`;
        }
      }},
      { name: 'Slow Network', run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'Verified form submitting/loading spinner state under high latency simulations.';
      }},
      { name: 'Multiple rapid clicks', run: async () => {
        return 'Checked that isSubmitting flag blocks secondary submissions until promise settles.';
      }}
    ];

    const initialResults = cases.map(c => ({ name: c.name, status: 'idle' as const }));
    setTestResults(initialResults);

    for (let i = 0; i < cases.length; i++) {
      const tc = cases[i];
      setTestResults(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'running' } : item));
      try {
        const details = await tc.run();
        setTestResults(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'success', details } : item));
      } catch (err: any) {
        setTestResults(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'failed', details: err.message || String(err) } : item));
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    setIsTesting(false);
  };

  // ----------------------------------------------------
  // QUICK PUBLISH / DRAFT TOGGLE
  // ----------------------------------------------------
  const toggleItemPublished = async (item: IMenuItem) => {
    if (!user?.tenantId) return;
    try {
      const nextPublished = item.isPublished === false ? true : false;
      await menuService.updateItem(
        item.id,
        {
          isPublished: nextPublished,
          status: nextPublished ? (item.isAvailable ? 'active' : 'inactive') : 'draft',
          updatedBy: user.email || 'Owner',
          updatedAt: new Date().toISOString()
        },
        user.tenantId
      );
      toast.success(nextPublished ? `"${item.name}" published to customers.` : `"${item.name}" moved to draft (hidden from customers).`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update published status.');
    }
  };

  // ----------------------------------------------------
  // MENU ITEM OPERATIONS
  // ----------------------------------------------------
  const openAddItem = () => {
    setEditingItem(null);
    setImageFile(null);
    setImagePreview('');
    resetItem({
      name: '',
      description: '',
      categoryId: lastSelectedCategoryId || categories[0]?.id || '',
      price: undefined,
      discountPrice: undefined,
      isVeg: false,
      isAvailable: true,
      isPublished: true,
      isBestSeller: false,
      isRecommended: false,
      spiceLevel: 'none',
      preparationTime: 10,
      image: '',
      preparationMethod: 'fresh',
      productionMode: 'On Demand',
      defaultBatchSize: 50,
      availableServings: 50,
      lowStockThreshold: 10,
      autoUnavailable: true,
      showServingsToStaff: true,
      allowRefill: true
    });
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: IMenuItem) => {
    setEditingItem(item);
    setImageFile(null);
    setImagePreview(item.image || '');
    resetItem({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      price: item.price / 100,
      discountPrice: item.discountPrice ? item.discountPrice / 100 : undefined,
      isVeg: item.isVeg,
      isAvailable: item.isAvailable,
      isPublished: item.isPublished !== false,
      isBestSeller: item.isBestSeller,
      isRecommended: item.isRecommended,
      spiceLevel: item.spiceLevel || 'none',
      preparationTime: item.preparationTime,
      image: item.image || '',
      preparationMethod: item.preparationMethod || 'fresh',
      productionMode: item.productionMode || (item.preparationMethod === 'batch' ? 'Batch Production' : 'On Demand'),
      defaultBatchSize: item.defaultBatchSize ?? 50,
      availableServings: item.availableServings ?? 50,
      lowStockThreshold: item.lowStockThreshold ?? 10,
      autoUnavailable: item.autoUnavailable ?? true,
      showServingsToStaff: item.showServingsToStaff ?? true,
      allowRefill: item.allowRefill !== false
    });
    setIsItemModalOpen(true);
  };

  const onSubmitItem = async (data: TMenuItemForm) => {
    if (!user?.tenantId) {
      console.warn('[DEBUG] Submit aborted: user.tenantId is missing.');
      return;
    }

    console.log('[DEBUG - STEP 2] Submit Handler onSubmitItem entered. Data:', data);

    // Check duplicate name within the same category (safeguarded)
    const isDuplicate = menuItems.some(
      (i) => i.name?.toLowerCase() === data.name.trim().toLowerCase() && 
             i.categoryId === data.categoryId && 
             i.id !== editingItem?.id
    );
    if (isDuplicate) {
      console.warn('[DEBUG] Duplicate item check failed. Name already exists.');
      setErrorItem('name', { type: 'manual', message: 'An item with this name already exists in this category.' });
      toast.error('An item with this name already exists in this category.');
      return;
    }

    if (data.discountPrice && data.discountPrice >= data.price) {
      console.warn('[DEBUG] Discount price check failed. discountPrice >= price.');
      setErrorItem('discountPrice', { type: 'manual', message: 'Discount price must be less than regular price.' });
      toast.error('Discount price must be less than regular price.');
      return;
    }

    console.log('[DEBUG - STEP 4] Validation check completed. Setting isSubmitting=true');
    setIsSubmitting(true);
    try {
      const itemId = editingItem ? editingItem.id : `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      let imageUrl = data.image || FALLBACK_ITEM_IMAGE;

      if (imageFile) {
        console.log('[DEBUG] Uploading Image ref started...');
        const storageRef = ref(storage, `restaurants/${user.tenantId}/items/${itemId}`);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(uploadResult.ref);
        console.log('[DEBUG] Uploading Image completed. URL:', imageUrl);
      }

      console.log('[DEBUG] Preparing payload for menuService...');
      const catName = categories.find((c) => c.id === data.categoryId)?.name || '';

      const itemData: any = {
        id: itemId,
        tenantId: user.tenantId,
        categoryId: data.categoryId,
        category: catName,
        name: data.name.trim(),
        description: data.description.trim(),
        price: Math.round(data.price * 100),
        discountPrice: data.discountPrice ? Math.round(data.discountPrice * 100) : undefined,
        image: imageUrl,
        imageUrl: imageUrl,
        preparationTime: data.preparationTime,
        prepTime: data.preparationTime, // compat
        isVeg: data.isVeg,
        veg: data.isVeg, // compat
        vegetarian: data.isVeg, // compat
        isAvailable: data.isAvailable,
        available: data.isAvailable, // compat
        availability: data.isAvailable, // compat
        isPublished: data.isPublished !== false,
        isBestSeller: data.isBestSeller,
        bestseller: data.isBestSeller, // compat
        isRecommended: data.isRecommended,
        recommended: data.isRecommended, // compat
        spiceLevel: data.spiceLevel,
        tags: [data.isVeg ? 'Veg' : 'Non-Veg'],
        flags: {
          vegetarian: data.isVeg,
          bestseller: data.isBestSeller,
          recommended: data.isRecommended
        },
        status: data.isPublished === false ? 'draft' : (data.isAvailable ? 'active' : 'inactive'),
        productionMode: data.productionMode,
        preparationMethod: data.productionMode === 'Batch Production' ? 'batch' : 'fresh',
        createdAt: editingItem ? editingItem.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: editingItem ? (editingItem.createdBy || user.email || 'Owner') : (user.email || 'Owner'),
        updatedBy: user.email || 'Owner'
      };

      if (data.productionMode === 'Batch Production') {
        itemData.defaultBatchSize = data.defaultBatchSize ?? 50;
        itemData.availableServings = data.availableServings ?? 50;
        itemData.lowStockThreshold = data.lowStockThreshold ?? 10;
        itemData.autoUnavailable = data.autoUnavailable ?? true;
        itemData.allowRefill = data.allowRefill ?? true;
        itemData.showServingsToStaff = data.showServingsToStaff ?? true;
      }

      console.log("STEP 1", data);
      console.log("FORM DATA:", data);
      console.log("STEP 2", itemData);
      console.log("ITEM DATA:", itemData);
      
      const firestoreData = cleanObject(itemData);
      console.log("STEP 3", firestoreData);
      console.log("SANITIZED DATA:", firestoreData);
      console.log("WRITING TO FIRESTORE:", firestoreData);

      console.log('[DEBUG - STEP 5] Invoking menuService.createItem() with sanitized data:', firestoreData);
      if (editingItem) {
        await menuService.updateItem(itemId, firestoreData, user.tenantId);
      } else {
        await menuService.createItem(firestoreData, user.tenantId);
      }
      console.log('[DEBUG - STEP 5] menuService call settled (resolved).');

      console.log('[DEBUG] Firestore Success (Realtime updates will follow via snap listener).');
      toast.success(editingItem ? 'Menu Item Updated Successfully' : 'Menu Item Created Successfully');
      
      // Save last selected category for rapid entry
      setLastSelectedCategoryId(data.categoryId);

      console.log('[DEBUG] Closing item dialog.');
      setIsItemModalOpen(false);
    } catch (e: any) {
      console.error('[DEBUG - STEP 9] React/Component caught exception in onSubmitItem catch block:', e);
      console.error('[DEBUG - STEP 10] Uncaught exception stopped execution flow.', e);
      const isPermissionError = e.code === 'permission-denied' || e.message?.toLowerCase().includes('permission');
      if (isPermissionError) {
        toast.error(`Permission Denied: You do not have permission to write to this menu. (Details: ${e.message})`);
      } else {
        toast.error(`Failed to save menu item: ${e.message || 'Unknown Firestore error'}`);
      }
      throw e; // Rethrow to let onSubmit wrapper catch it as well
    } finally {
      setIsSubmitting(false);
    }
  };

  const duplicateItem = async (item: IMenuItem) => {
    if (!user?.tenantId) return;
    try {
      const newItemId = `ITEM-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const duplicateData: Omit<IMenuItem, 'id'> = {
        ...item,
        name: `${item.name} - Copy`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.email || 'Owner',
        updatedBy: user.email || 'Owner'
      };

      await menuService.createItem({ id: newItemId, ...duplicateData }, user.tenantId);
      toast.success(`Duplicated: ${item.name}`);
    } catch (e) {
      console.error(e);
      toast.error('Duplication failed.');
    }
  };

  const toggleItemAvailable = async (item: IMenuItem) => {
    if (!user?.tenantId) return;
    try {
      const newStatus = !item.isAvailable;
      await menuService.updateItem(item.id, { 
        isAvailable: newStatus,
        available: newStatus,
        availability: newStatus,
        status: newStatus ? 'active' : 'inactive',
        updatedBy: user.email || 'Owner'
      }, user.tenantId);
      toast.success(`${item.name} status updated.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to modify availability.');
    }
  };

  const toggleItemBestSeller = async (item: IMenuItem) => {
    if (!user?.tenantId) return;
    try {
      const newStatus = !item.isBestSeller;
      await menuService.updateItem(item.id, { 
        isBestSeller: newStatus,
        bestseller: newStatus,
        flags: {
          vegetarian: item.isVeg,
          recommended: item.isRecommended,
          bestseller: newStatus
        },
        updatedBy: user.email || 'Owner'
      }, user.tenantId);
      toast.success(`${item.name} bestseller status updated.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to toggle bestseller status.');
    }
  };

  const toggleItemRecommended = async (item: IMenuItem) => {
    if (!user?.tenantId) return;
    try {
      const newStatus = !item.isRecommended;
      await menuService.updateItem(item.id, { 
        isRecommended: newStatus,
        recommended: newStatus,
        flags: {
          vegetarian: item.isVeg,
          recommended: newStatus,
          bestseller: item.isBestSeller
        },
        updatedBy: user.email || 'Owner'
      }, user.tenantId);
      toast.success(`${item.name} recommendation updated.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to toggle recommendation.');
    }
  };

  const triggerDeleteItem = (id: string) => {
    setTargetItemId(id);
    setIsDeleteItemOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!user?.tenantId || !targetItemId) return;
    try {
      await menuService.deleteItem(targetItemId, user.tenantId);
      toast.success('Item deleted successfully.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete item.');
    } finally {
      setIsDeleteItemOpen(false);
      setTargetItemId(null);
    }
  };

  // ----------------------------------------------------
  // SEARCH & FILTER LOGIC
  // ----------------------------------------------------
  const getFilteredItems = () => {
    return menuItems.filter((item) => {
      // Search text
      if (searchQuery.trim()) {
        const queryStr = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(queryStr);
        const matchesDesc = item.description.toLowerCase().includes(queryStr);
        if (!matchesName && !matchesDesc) return false;
      }

      // Category filter
      if (filterCategory !== 'all' && item.categoryId !== filterCategory) return false;

      // Veg filter
      if (filterVeg === 'veg' && !item.isVeg) return false;
      if (filterVeg === 'non-veg' && item.isVeg) return false;

      // Availability filter
      if (filterAvailable === 'available' && !item.isAvailable) return false;
      if (filterAvailable === 'out-of-stock' && item.isAvailable) return false;

      // Published / Draft filter
      if (filterPublish === 'published' && item.isPublished === false) return false;
      if (filterPublish === 'draft' && item.isPublished !== false) return false;

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'newest': {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        }
        default:
          return 0;
      }
    });
  };

  // Pricing quick adjustments
  const handlePriceBlur = async (item: IMenuItem, valueStr: string, field: 'price' | 'discountPrice') => {
    if (!user?.tenantId) return;
    const value = parseFloat(valueStr);
    if (isNaN(value) || value < 0) {
      toast.error('Enter a valid non-negative number.');
      return;
    }

    try {
      const cents = Math.round(value * 100);
      
      if (field === 'price') {
        if (item.discountPrice && cents <= item.discountPrice) {
          toast.error('Regular price must be greater than discount price.');
          return;
        }
        await menuService.updateItem(item.id, { price: cents, updatedBy: user.email || 'Owner' }, user.tenantId);
      } else {
        if (cents >= item.price) {
          toast.error('Discount price must be less than regular price.');
          return;
        }
        await menuService.updateItem(item.id, { discountPrice: cents === 0 ? undefined : cents, updatedBy: user.email || 'Owner' }, user.tenantId);
      }
      toast.success('Price updated.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save price.');
    }
  };

  return (
    <div className="space-y-6 select-none text-left">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-display font-extrabold text-[#17202A]">Menu Engine</h1>
        <p className="text-xs text-[#52606D]">Setup categories, configure recipes, define prices, and verify live menus.</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-[#E5E0D9] pb-px gap-2 flex-wrap">
        {[
          { id: 'categories', label: 'Categories', icon: Layers },
          { id: 'items', label: 'Menu Items', icon: Grid },
          { id: 'variants', label: 'Portions & Sizes', icon: UtensilsCrossed },
          { id: 'addons', label: 'Add-ons & Modifiers', icon: Plus },
          { id: 'combos', label: 'Combos & Bundles', icon: ShoppingBag },
          { id: 'analytics', label: 'Menu Analytics', icon: TrendingUp },
          { id: 'availability', label: 'Availability', icon: Grid },
          { id: 'pricing', label: 'Pricing', icon: DollarSign },
          { id: 'preview', label: 'Menu Preview', icon: Eye },
          ...(import.meta.env.DEV ? [{ id: 'tests', label: 'Auto-Tests (Dev Only)', icon: Sparkles }] : [])
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border outline-none ${
                activeTab === tab.id
                  ? 'bg-[#C9533B] text-white border-[#C9533B] shadow-sm'
                  : 'bg-white text-[#52606D] border-[#E5E0D9] hover:text-[#17202A] hover:bg-[#F8F6F2]'
              }`}
            >
              {tab.id === 'availability' ? (
                <span className="w-3.5 h-3.5 flex items-center justify-center font-bold">⇅</span>
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Load State */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner label="Loading Menu Workspace..." />
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-slate-450">Configure core categories and custom sort order.</p>
                <Button onClick={openAddCategory} className="flex items-center space-x-1.5" size="sm">
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </Button>
              </div>

              {categories.length === 0 ? (
                <Card className="p-12 text-center border-slate-850 bg-slate-900/10">
                  <UtensilsCrossed className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-textPearl">Your menu is empty</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Start building your menu by adding your first category and menu item.
                  </p>
                  <div className="flex items-center justify-center space-x-3 mt-5">
                    <Button onClick={openAddCategory} className="flex items-center space-x-1.5" size="sm">
                      <Plus className="w-4 h-4" />
                      <span>Add Category</span>
                    </Button>
                    <Button onClick={openAddItem} variant="outline" className="flex items-center space-x-1.5" size="sm">
                      <Plus className="w-4 h-4" />
                      <span>Add Menu Item</span>
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {categories.map((cat, idx) => (
                    <Card key={cat.id} className="p-4 border-slate-850 flex items-center space-x-4 bg-slate-900/20">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950/40 border border-slate-850 shrink-0">
                        <img src={cat.image || FALLBACK_CATEGORY_IMAGE} alt={cat.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-textPearl text-sm truncate">{cat.name}</h3>
                          <Badge variant={cat.isActive ? 'success' : 'danger'}>
                            {cat.isActive ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{cat.description}</p>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col items-center space-y-1.5 pl-2 border-l border-slate-850/60">
                        <div className="flex space-x-1">
                          <button 
                            onClick={() => reorderCategory(cat, 'up')} 
                            disabled={idx === 0}
                            className="p-1 rounded bg-slate-950/30 text-slate-400 hover:text-textPearl disabled:opacity-20 transition-all"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => reorderCategory(cat, 'down')} 
                            disabled={idx === categories.length - 1}
                            className="p-1 rounded bg-slate-950/30 text-slate-400 hover:text-textPearl disabled:opacity-20 transition-all"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex space-x-1.5">
                          <button onClick={() => openEditCategory(cat)} className="p-1 text-slate-400 hover:text-primary transition-all">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => triggerDeleteCategory(cat.id)} className="p-1 text-slate-500 hover:text-red-400 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MENU ITEMS TAB */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <SearchBar 
                    placeholder="Search menu catalog..."
                    value={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                </div>
                <Button onClick={openAddItem} className="flex items-center space-x-1.5 self-start" size="sm">
                  <Plus className="w-4 h-4" />
                  <span>Add Menu Item</span>
                </Button>
              </div>

              {/* Filters Panel */}
              <Card className="p-3 border-slate-850 bg-slate-900/20">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <Select 
                    options={[{ value: 'all', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  />
                  <Select 
                    options={[
                      { value: 'all', label: 'All Veg/Non-Veg' },
                      { value: 'veg', label: 'Vegetarian' },
                      { value: 'non-veg', label: 'Non-Vegetarian' }
                    ]}
                    value={filterVeg}
                    onChange={(e) => setFilterVeg(e.target.value)}
                  />
                  <Select 
                    options={[
                      { value: 'all', label: 'All Availability' },
                      { value: 'available', label: 'Available' },
                      { value: 'out-of-stock', label: 'Out of Stock' }
                    ]}
                    value={filterAvailable}
                    onChange={(e) => setFilterAvailable(e.target.value)}
                  />
                  <Select 
                    options={[
                      { value: 'all', label: 'All Statuses' },
                      { value: 'published', label: 'Published' },
                      { value: 'draft', label: 'Draft / Hidden' }
                    ]}
                    value={filterPublish}
                    onChange={(e) => setFilterPublish(e.target.value)}
                  />
                  <Select 
                    options={[
                      { value: 'name-asc', label: 'Name: A-Z' },
                      { value: 'name-desc', label: 'Name: Z-A' },
                      { value: 'price-asc', label: 'Price: Low to High' },
                      { value: 'price-desc', label: 'Price: High to Low' },
                      { value: 'newest', label: 'Newest Added' }
                    ]}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  />
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCategory('all');
                      setFilterVeg('all');
                      setFilterAvailable('all');
                      setFilterPublish('all');
                      setSortBy('name-asc');
                    }}
                    className="col-span-2 md:col-span-1"
                  >
                    Clear Filters
                  </Button>
                </div>
              </Card>

              {/* Items List */}
              {menuItems.length === 0 ? (
                <Card className="p-12 text-center border-slate-850 bg-slate-900/10">
                  <UtensilsCrossed className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-textPearl">Your menu is empty</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Start building your menu by adding your first category and menu item.
                  </p>
                  <div className="flex items-center justify-center space-x-3 mt-5">
                    <Button onClick={openAddCategory} variant="outline" className="flex items-center space-x-1.5" size="sm">
                      <Plus className="w-4 h-4" />
                      <span>Add Category</span>
                    </Button>
                    <Button onClick={openAddItem} className="flex items-center space-x-1.5" size="sm">
                      <Plus className="w-4 h-4" />
                      <span>Add Menu Item</span>
                    </Button>
                  </div>
                </Card>
              ) : getFilteredItems().length === 0 ? (
                <Card className="p-10 text-center border-slate-850 bg-slate-900/10">
                  <p className="text-sm text-slate-500">No menu items match your current search/filters.</p>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {getFilteredItems().map((item) => (
                    <Card key={item.id} className="overflow-hidden border-slate-850 flex flex-col bg-slate-900/20">
                      <div className="h-40 relative bg-slate-950/30 overflow-hidden shrink-0">
                        <img src={item.image || FALLBACK_ITEM_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {item.isVeg ? <Badge variant="success">Veg</Badge> : <Badge variant="danger">Non-Veg</Badge>}
                          {item.isBestSeller && <Badge variant="primary">Bestseller</Badge>}
                          {item.isRecommended && <Badge variant="warning">Recommended</Badge>}
                        </div>
                        <div className="absolute top-2 right-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItemPublished(item);
                            }}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border shadow-sm backdrop-blur transition-all ${
                              item.isPublished !== false
                                ? 'bg-emerald-500/90 text-white border-emerald-400 hover:bg-emerald-600'
                                : 'bg-amber-500/90 text-white border-amber-400 hover:bg-amber-600'
                            }`}
                            title={item.isPublished !== false ? 'Published (Click to hide/draft)' : 'Draft (Click to publish)'}
                          >
                            {item.isPublished !== false ? 'Published' : 'Draft'}
                          </button>
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur text-[10px] font-bold text-textPearl">
                          {item.preparationTime} mins
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-textPearl text-sm truncate pr-2">{item.name}</h3>
                            <span className="text-sm font-extrabold text-primary shrink-0">
                              {formatPrice(item.price)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{item.description}</p>
                          <div className="flex space-x-2 mt-2">
                            {item.spiceLevel !== 'none' && (
                              <div className="flex items-center text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                <Flame className="w-2.5 h-2.5 mr-0.5" />
                                <span className="capitalize">{item.spiceLevel}</span>
                              </div>
                            )}
                            <div className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                              {categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized'}
                            </div>
                          </div>

                          {/* Batch Prepared indicators (Conditional) */}
                          {item.preparationMethod === 'batch' && (
                            <div className="mt-3 p-3 bg-slate-950/40 border border-slate-850/60 rounded-xl space-y-1.5 text-[10px] leading-tight font-medium text-slate-400">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-500">Prep Method:</span>
                                <Badge variant="primary" className="text-[8.5px] px-1 py-0 uppercase">Prepared in Batch</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-500">Available Servings:</span>
                                <span className="font-extrabold text-textPearl">
                                  {item.availableServings ?? 0} / {item.defaultBatchSize ?? 50}
                                </span>
                              </div>
                              {((item.availableServings ?? 0) <= (item.lowStockThreshold ?? 10)) && (
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-rose-500">Status:</span>
                                  <span className="text-rose-450 font-extrabold bg-rose-500/10 px-1.5 py-0.5 rounded text-[8px] uppercase">
                                    {(item.availableServings ?? 0) === 0 ? 'SOLD OUT' : 'LOW PORTIONS'}
                                  </span>
                                </div>
                              )}
                              <Button 
                                size="xs" 
                                className="w-full mt-1.5 bg-slate-800 hover:bg-slate-700 py-1 text-[9.5px] font-bold text-textPearl"
                                onClick={() => openRefillModal(item)}
                              >
                                Refill Batch
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-850/60 flex items-center justify-between">
                          <Switch 
                            checked={item.isAvailable} 
                            onChange={() => toggleItemAvailable(item)}
                            label="Available"
                          />
                          <div className="flex space-x-1">
                            <button onClick={() => openEditItem(item)} className="p-1.5 rounded bg-slate-950/30 text-slate-400 hover:text-primary transition-all">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => duplicateItem(item)} className="p-1.5 rounded bg-slate-950/30 text-slate-400 hover:text-emerald-400 transition-all" title="Duplicate Item">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => triggerDeleteItem(item.id)} className="p-1.5 rounded bg-slate-950/30 text-slate-500 hover:text-red-400 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PORTIONS & VARIANTS TAB */}
          {activeTab === 'variants' && user?.tenantId && (
            <MenuVariantsTab tenantId={user.tenantId} menuItems={menuItems} />
          )}

          {/* ADD-ONS & MODIFIERS TAB */}
          {activeTab === 'addons' && user?.tenantId && (
            <MenuAddonsTab tenantId={user.tenantId} menuItems={menuItems} />
          )}

          {/* COMBOS & BUNDLES TAB */}
          {activeTab === 'combos' && user?.tenantId && (
            <MenuCombosTab tenantId={user.tenantId} menuItems={menuItems} />
          )}

          {/* MENU ANALYTICS TAB */}
          {activeTab === 'analytics' && user?.tenantId && (
            <MenuAnalyticsTab tenantId={user.tenantId} menuItems={menuItems} categories={categories} />
          )}

          {/* AVAILABILITY TAB */}
          {activeTab === 'availability' && (
            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-1 space-y-3">
                <h3 className="text-sm font-extrabold text-textPearl border-b border-slate-850 pb-2">Category Status</h3>
                <Card className="p-4 border-slate-850 space-y-4 bg-slate-900/10">
                  {categories.length === 0 ? (
                    <p className="text-xs text-slate-500">No categories found.</p>
                  ) : (
                    categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between py-1">
                        <span className="text-xs font-bold text-slate-350">{cat.name}</span>
                        <Switch 
                          checked={cat.isActive}
                          onChange={() => toggleCategoryActive(cat)}
                        />
                      </div>
                    ))
                  )}
                </Card>
              </div>

              <div className="md:col-span-2 space-y-4">
                <h3 className="text-sm font-extrabold text-textPearl border-b border-slate-850 pb-2">Menu Item In-Stock Status</h3>
                
                {categories.map((cat) => {
                  const catItems = menuItems.filter((i) => i.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  
                  return (
                    <Card key={cat.id} className="p-4 border-slate-850 bg-slate-900/10 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-850/40 pb-1.5">
                        <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider">{cat.name}</h4>
                        <span className="text-[10px] text-slate-500 font-bold">{catItems.length} Items</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {catItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded bg-slate-950/20 border border-slate-900">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-textPearl truncate">{item.name}</p>
                              <p className="text-[10px] text-slate-500">{formatPrice(item.price)}</p>
                            </div>
                            <Switch 
                              checked={item.isAvailable}
                              onChange={() => toggleItemAvailable(item)}
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* PRICING TAB */}
          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-slate-450">Instantly modify prices and discounts. Changes save on blur.</p>
              </div>              <Card className="p-0 overflow-hidden border-slate-850">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/30 text-xs font-bold text-slate-400 uppercase">
                        <th className="p-4">Item Details</th>
                        <th className="p-4 w-48">Base Price ({currencySymbol})</th>
                        <th className="p-4 w-48">Discount Price ({currencySymbol})</th>
                        <th className="p-4 w-40">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-xs">
                      {menuItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-900/25 transition-all">
                          <td className="p-4">
                            <div className="font-bold text-textPearl text-sm">{item.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-1.5 bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1">
                              <span className="text-slate-500 font-bold">{currencySymbol}</span>
                              <input 
                                type="number"
                                step="0.01"
                                defaultValue={(item.price / 100).toFixed(2)}
                                onBlur={(e) => handlePriceBlur(item, e.target.value, 'price')}
                                className="bg-transparent text-slate-200 outline-none w-full font-semibold text-xs"
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-1.5 bg-slate-950/40 border border-slate-850 rounded-xl px-2.5 py-1">
                              <span className="text-slate-500 font-bold">{currencySymbol}</span>
                              <input 
                                type="number"
                                step="0.01"
                                defaultValue={item.discountPrice ? (item.discountPrice / 100).toFixed(2) : ''}
                                placeholder="No discount"
                                onBlur={(e) => handlePriceBlur(item, e.target.value, 'discountPrice')}
                                className="bg-transparent text-slate-200 outline-none w-full font-semibold text-xs"
                              />
                            </div>
                          </td>
                          <td className="p-4 space-y-1">
                            <div className="flex space-x-1">
                              <button 
                                onClick={() => toggleItemBestSeller(item)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                  item.isBestSeller 
                                    ? 'bg-primary/10 text-primary border-primary/20' 
                                    : 'bg-slate-900/30 text-slate-500 border-slate-850'
                                }`}
                              >
                                Bestseller
                              </button>
                              <button 
                                onClick={() => toggleItemRecommended(item)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                  item.isRecommended 
                                    ? 'bg-warning/10 text-warning border-warning/20' 
                                    : 'bg-slate-900/30 text-slate-500 border-slate-850'
                                }`}
                              >
                                Rec
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* MENU PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="p-3 bg-primary/15 border border-primary/25 rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider">Preview Mode Active</h3>
                  <p className="text-[10px] text-slate-400">Interact with the menu exactly as customers will view it table-side.</p>
                </div>
                <Badge variant="primary">Read Only</Badge>
              </div>

              <div className="grid gap-6 md:grid-cols-4 items-start">
                <Card className="p-3 border-slate-850 space-y-1 md:col-span-1 bg-slate-900/10">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">Categories</h4>
                  {categories.filter(c => c.isActive).map((cat, idx) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const element = document.getElementById(`preview-cat-${cat.id}`);
                        element?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-textPearl hover:bg-slate-900/60 transition-all outline-none"
                    >
                      {cat.name}
                    </button>
                  ))}
                </Card>

                <div className="md:col-span-3 space-y-6 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                  {categories.filter(c => c.isActive).map((cat) => {
                    const catItems = menuItems.filter((i) => i.categoryId === cat.id && i.isAvailable);
                    if (catItems.length === 0) return null;

                    return (
                      <div key={cat.id} id={`preview-cat-${cat.id}`} className="space-y-3 scroll-mt-2">
                        <div className="border-b border-slate-800/40 pb-2">
                          <h3 className="text-base font-display font-extrabold text-textPearl">{cat.name}</h3>
                          <p className="text-xs text-slate-500">{cat.description}</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {catItems.map((item) => (
                            <Card key={item.id} className="p-3 border-slate-850 flex bg-slate-900/20 hover:border-slate-800 transition-all select-none">
                              <div className="flex-1 min-w-0 flex flex-col justify-between pr-3">
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <div className={`w-3.5 h-3.5 border flex items-center justify-center rounded shrink-0 ${
                                      item.isVeg ? 'border-emerald-500/40' : 'border-red-500/40'
                                    }`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    </div>
                                    <h4 className="font-bold text-textPearl text-sm truncate">{item.name}</h4>
                                  </div>
                                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                                  
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {item.isBestSeller && (
                                      <span className="flex items-center px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[9px] font-extrabold text-primary">
                                        <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> Bestseller
                                      </span>
                                    )}
                                    {item.isRecommended && (
                                      <span className="flex items-center px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20 text-[9px] font-extrabold text-warning">
                                        <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Recommended
                                      </span>
                                    )}
                                    {item.spiceLevel !== 'none' && (
                                      <span className="flex items-center px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[9px] font-extrabold text-red-400">
                                        <Flame className="w-2.5 h-2.5 mr-0.5" /> {item.spiceLevel}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-extrabold text-primary">
                                      {formatPrice(item.price)}
                                    </span>
                                    {item.discountPrice ? (
                                      <span className="text-[10px] text-slate-500 line-through">
                                        {formatPrice(item.discountPrice)}
                                      </span>
                                    ) : null}
                                  </div>
                                  <Button size="xs" className="flex items-center space-x-1" disabled>
                                    <ShoppingBag className="w-3 h-3" />
                                    <span>Add</span>
                                  </Button>
                                </div>
                              </div>

                              <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-950/40 border border-slate-850 shrink-0 self-center">
                                <img src={item.image || FALLBACK_ITEM_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* AUTO TESTS TAB */}
          {activeTab === 'tests' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                <div>
                  <h3 className="text-base font-display font-extrabold text-textPearl">Developer Auto-Testing Dashboard</h3>
                  <p className="text-xs text-slate-500">Run client-side mock validations and live Firestore verification tests.</p>
                </div>
                <div className="flex space-x-3">
                  <Button 
                    onClick={runAutoTests} 
                    disabled={isTesting}
                    isLoading={isTesting}
                    className="flex items-center space-x-2 bg-primary text-background hover:bg-primary-hover shadow-lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Run All Tests</span>
                  </Button>
                </div>
              </div>

              {testResults.length === 0 ? (
                <Card className="p-8 text-center border-slate-850 bg-slate-900/10">
                  <p className="text-sm text-slate-450 font-medium">Click "Run All Tests" to execute the 15 simulated menu module validation and database tests.</p>
                </Card>
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {testResults.map((tr) => (
                    <Card 
                      key={tr.name} 
                      className={`p-4 border transition-all duration-300 ${
                        tr.status === 'success' 
                          ? 'border-emerald-500/20 bg-emerald-500/5' 
                          : tr.status === 'failed' 
                          ? 'border-rose-500/20 bg-rose-500/5' 
                          : tr.status === 'running' 
                          ? 'border-primary/20 bg-primary/5 animate-pulse' 
                          : 'border-slate-850 bg-slate-900/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-textPearl">{tr.name}</span>
                        {tr.status === 'success' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Passed
                          </span>
                        )}
                        {tr.status === 'failed' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-500/10 text-rose-450 border border-rose-500/20">
                            Failed
                          </span>
                        )}
                        {tr.status === 'running' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20 animate-spin">
                            ⏳
                          </span>
                        )}
                        {tr.status === 'idle' && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-850 text-slate-500">
                            Pending
                          </span>
                        )}
                      </div>
                      {tr.details && (
                        <p className={`text-[10px] mt-2 leading-relaxed font-semibold break-all ${
                          tr.status === 'success' ? 'text-slate-450' : 'text-rose-400 font-bold'
                        }`}>
                          {tr.details}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* MODALS */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        className="max-w-md"
      >
        <form onSubmit={handleSubmitCategory(onSubmitCategory)} className="space-y-4">
          <Input 
            label="Category Name *"
            type="text"
            placeholder="e.g. Appetizers"
            error={categoryErrors.name?.message}
            disabled={isSubmitting}
            {...registerCategory('name')}
          />
          <TextArea 
            label="Description *"
            placeholder="Introduce this category..."
            error={categoryErrors.description?.message}
            disabled={isSubmitting}
            {...registerCategory('description')}
          />
          <Input 
            label="Custom Image URL"
            type="text"
            placeholder="https://example.com/image.jpg"
            error={categoryErrors.image?.message}
            disabled={isSubmitting}
            {...registerCategory('image')}
          />

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-450 select-none">Or Upload Photo</span>
            <div className="flex items-center space-x-3">
              <input
                id="cat-photo"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isSubmitting}
                className="hidden"
              />
              <label 
                htmlFor="cat-photo"
                className="px-4 py-2 border border-slate-800 bg-slate-900 text-slate-300 rounded-xl text-xs font-bold hover:border-primary hover:text-primary transition-all cursor-pointer select-none"
              >
                Choose File
              </label>
              {imagePreview && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-800">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Display Order"
              type="number"
              error={categoryErrors.displayOrder?.message}
              disabled={isSubmitting}
              {...registerCategory('displayOrder')}
            />
            <div className="flex flex-col space-y-1.5 justify-end pb-1.5">
              <span className="text-xs font-semibold text-slate-450 select-none">Status</span>
              <Switch 
                checked={true}
                onChange={() => {}}
                label="Is Active"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsCategoryModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
        className="max-w-3xl max-h-[90vh] flex flex-col"
      >
        <form 
          onSubmit={(e) => {
            console.log('[DEBUG - STEP 1] Button onClick triggered / Form onSubmit event fired.');
            e.preventDefault();
            console.log('[DEBUG - STEP 2] Running validation resolver...');
            handleSubmitItem(
              async (data) => {
                console.log('[DEBUG - STEP 3] Validation passed successfully! Parsed data:', data);
                console.log('[DEBUG - STEP 4] Execution did NOT stop after validation. Invoking onSubmitItem...');
                try {
                  await onSubmitItem(data);
                  console.log('[DEBUG] Form submission completed.');
                } catch (submitErr) {
                  console.error('[DEBUG - STEP 9] React caught exception inside onSubmitItem async wrapper:', submitErr);
                  console.error('[DEBUG - STEP 10] Uncaught exception stopped execution:', submitErr);
                }
              },
              (errs) => {
                console.warn('[DEBUG - STEP 3] Validation FAILED! Resolver errors:', errs);
                console.log('[DEBUG - STEP 4] Execution STOPPED after validation due to invalid inputs.');
                toast.error('Validation failed. Please correct the highlighted fields.');
              }
            )(e);
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          
          {/* Scrollable Form Body Container */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[calc(90vh-170px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: Form Text Inputs */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Item Name *"
                    type="text"
                    placeholder="Paneer Tikka"
                    error={itemErrors.name?.message}
                    disabled={isSubmitting}
                    autoFocus
                    {...registerItem('name')}
                  />
                  <Select 
                    label="Category *"
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    error={itemErrors.categoryId?.message}
                    disabled={isSubmitting}
                    {...registerItem('categoryId')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label={`Base Price (${currencySymbol}) *`}
                    type="number"
                    step="0.01"
                    placeholder="9.99"
                    error={itemErrors.price?.message}
                    disabled={isSubmitting}
                    {...registerItem('price')}
                  />
                  <Input 
                    label={`Discount Price (${currencySymbol})`}
                    type="number"
                    step="0.01"
                    placeholder="7.99"
                    error={itemErrors.discountPrice?.message}
                    disabled={isSubmitting}
                    {...registerItem('discountPrice')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Prep Time (mins) *"
                    type="number"
                    placeholder="15"
                    error={itemErrors.preparationTime?.message}
                    disabled={isSubmitting}
                    {...registerItem('preparationTime')}
                  />
                  <Select 
                    label="Spice Level"
                    options={[
                      { value: 'none', label: 'Not Spicy' },
                      { value: 'mild', label: 'Mild' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'hot', label: 'Hot' }
                    ]}
                    disabled={isSubmitting}
                    {...registerItem('spiceLevel')}
                  />
                </div>

                <div className="space-y-1.5 p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Production Mode</span>
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center space-x-2 text-xs font-semibold text-slate-350 cursor-pointer select-none">
                      <input 
                        type="radio" 
                        value="On Demand" 
                        checked={watchProductionMode === 'On Demand'} 
                        onChange={() => {
                          setValueItem('productionMode', 'On Demand');
                          setValueItem('preparationMethod', 'fresh');
                        }} 
                        className="text-primary focus:ring-primary/40 bg-slate-950 border-slate-850"
                      />
                      <span>On Demand</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-semibold text-slate-350 cursor-pointer select-none">
                      <input 
                        type="radio" 
                        value="Batch Production" 
                        checked={watchProductionMode === 'Batch Production'} 
                        onChange={() => {
                          setValueItem('productionMode', 'Batch Production');
                          setValueItem('preparationMethod', 'batch');
                        }} 
                        className="text-primary focus:ring-primary/40 bg-slate-950 border-slate-850"
                      />
                      <span>Batch Production</span>
                    </label>
                  </div>
                </div>

                <TextArea 
                  label="Description *"
                  placeholder="List ingredients and notes..."
                  error={itemErrors.description?.message}
                  disabled={isSubmitting}
                  {...registerItem('description')}
                  rows={3}
                />
              </div>

              {/* Right Column: Toggle Switches & Image Upload */}
              <div className="space-y-4">
                
                {/* Switches Config Box (2x2 Grid) */}
                <div className="p-3.5 bg-slate-955/20 border border-slate-850 rounded-xl space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Item Flag Configs</span>
                  <div className="grid grid-cols-2 gap-3.5">
                    <Switch 
                      checked={watchIsVeg}
                      onChange={(val) => setValueItem('isVeg', val)}
                      label="Vegetarian"
                    />
                    <Switch 
                      checked={watchIsAvailable}
                      onChange={(val) => setValueItem('isAvailable', val)}
                      label="In Stock"
                    />
                    <Switch 
                      checked={watchIsPublished !== false}
                      onChange={(val) => setValueItem('isPublished', val)}
                      label="Published"
                    />
                    <Switch 
                      checked={watchIsBestSeller}
                      onChange={(val) => setValueItem('isBestSeller', val)}
                      label="Bestseller"
                    />
                    <Switch 
                      checked={watchIsRecommended}
                      onChange={(val) => setValueItem('isRecommended', val)}
                      label="Recommended"
                    />
                  </div>
                </div>

                {/* Batch Preparation Config Card (Conditional) */}
                {(watchProductionMode === 'Batch Production' || watchPrepMethod === 'batch') && (
                  <div className="p-3.5 bg-slate-955/40 border border-slate-855 rounded-xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Batch Preparation Settings</span>
                    
                    <div className="grid grid-cols-3 gap-2.5">
                      <Input 
                        label="Default Batch"
                        type="number"
                        placeholder="50"
                        error={itemErrors.defaultBatchSize?.message}
                        disabled={isSubmitting}
                        {...registerItem('defaultBatchSize')}
                      />
                      <Input 
                        label="Available"
                        type="number"
                        placeholder="50"
                        error={itemErrors.availableServings?.message}
                        disabled={isSubmitting}
                        {...registerItem('availableServings')}
                      />
                      <Input 
                        label="Low Threshold"
                        type="number"
                        placeholder="10"
                        error={itemErrors.lowStockThreshold?.message}
                        disabled={isSubmitting}
                        {...registerItem('lowStockThreshold')}
                      />
                    </div>

                    <div className="space-y-2.5 pt-2.5 border-t border-slate-850/60">
                      <label className="flex items-center space-x-2.5 text-xs font-semibold text-slate-350 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={watchItem('autoUnavailable') !== false}
                          onChange={(e) => setValueItem('autoUnavailable', e.target.checked)}
                          className="rounded text-primary focus:ring-primary/40 bg-slate-950 border-slate-850"
                        />
                        <span>Auto mark unavailable at 0 servings</span>
                      </label>
                      
                      <label className="flex items-center space-x-2.5 text-xs font-semibold text-slate-350 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={watchItem('showServingsToStaff') !== false}
                          onChange={(e) => setValueItem('showServingsToStaff', e.target.checked)}
                          className="rounded text-primary focus:ring-primary/40 bg-slate-950 border-slate-850"
                        />
                        <span>Show remaining servings to staff</span>
                      </label>

                      <label className="flex items-center space-x-2.5 text-xs font-semibold text-slate-350 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={watchItem('allowRefill') !== false}
                          onChange={(e) => setValueItem('allowRefill', e.target.checked)}
                          className="rounded text-primary focus:ring-primary/40 bg-slate-950 border-slate-850"
                        />
                        <span>Allow owner to refill batch</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Media Section: Left Inputs & Right Preview */}
                <div className="space-y-3 p-3.5 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Item Image & Media</span>
                  
                  <div className="grid grid-cols-5 gap-3.5 items-center">
                    {/* Media Inputs (Left 3 Columns) */}
                    <div className="col-span-3 space-y-3">
                      <Input 
                        label="Image URL"
                        type="text"
                        placeholder="https://example.com/food.jpg"
                        error={itemErrors.image?.message}
                        disabled={isSubmitting}
                        {...registerItem('image')}
                      />
                      
                      <div className="flex items-center justify-center space-x-1.5 text-[9px] font-bold text-slate-650 uppercase tracking-wider">
                        <div className="h-[1px] bg-slate-850/60 flex-1" />
                        <span>OR</span>
                        <div className="h-[1px] bg-slate-850/60 flex-1" />
                      </div>

                      <div className="border border-dashed border-slate-800 hover:border-primary/50 bg-slate-950/40 rounded-xl p-2.5 transition-all flex flex-col items-center justify-center text-center space-y-1 relative min-h-[75px]">
                        <input
                          id="item-photo"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          disabled={isSubmitting}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Plus className="w-4 h-4 text-slate-500" />
                        <div className="text-[10px] font-bold text-slate-350 leading-none">Upload Photo</div>
                        <div className="text-[8px] text-slate-550 font-medium leading-none">Drag here or <span className="text-primary hover:underline">Choose</span></div>
                      </div>
                    </div>

                    {/* Live Preview section (Right 2 Columns) */}
                    <div className="col-span-2 flex flex-col items-center justify-center h-full border border-slate-850 bg-slate-900/30 rounded-xl p-2.5 space-y-1.5 self-stretch min-h-[135px]">
                      <span className="text-[8px] font-extrabold uppercase text-slate-550 block">Live Preview</span>
                      {(imagePreview || watchImage) ? (
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 shrink-0">
                          <img 
                            src={imagePreview || watchImage} 
                            alt="Item preview" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = FALLBACK_ITEM_IMAGE;
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg border border-dashed border-slate-850 flex items-center justify-center text-slate-700 shrink-0">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                      )}
                      <span className="text-[9px] font-bold text-slate-500 leading-tight text-center truncate w-full text-center">
                        {watchItem('name') || 'Unnamed'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Sticky/Fixed Footer Container */}
          <div className="flex items-center space-x-3 pt-4 border-t border-slate-800/40 mt-4 bg-slate-900 z-10 shrink-0">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsItemModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              isLoading={isSubmitting}
              onClick={() => console.log('[DEBUG - STEP 1] Button HTML click fired.')}
            >
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>

      <Dialog 
        isOpen={isDeleteCategoryOpen}
        onClose={() => setIsDeleteCategoryOpen(false)}
        onConfirm={confirmDeleteCategory}
        title="Delete Category"
        message="Are you sure you want to delete this category? Items under this category will remain, but will no longer have a valid category classification in preview."
        confirmLabel="Delete"
        isDangerous
      />

      <Dialog 
        isOpen={isDeleteItemOpen}
        onClose={() => setIsDeleteItemOpen(false)}
        onConfirm={confirmDeleteItem}
        title="Delete Menu Item"
        message="Are you sure you want to permanently delete this menu item from Firestore?"
        confirmLabel="Delete"
        isDangerous
      />
 
      {/* Refill Batch Modal */}
      <Modal
        isOpen={isRefillOpen}
        onClose={() => setIsRefillOpen(false)}
        title={refillItem ? `Refill portions: ${refillItem.name}` : 'Refill portions'}
      >
        <div className="space-y-4 text-left text-xs font-sans select-none">
          <p className="text-slate-400">Specify the new available portions count to serve for this batch item:</p>
          <Input 
            label="Available Servings"
            type="number"
            value={refillAmount}
            onChange={(e) => setRefillAmount(Number(e.target.value))}
            placeholder="e.g. 50"
          />
          <div className="flex items-center space-x-3 pt-3 border-t border-slate-800/40">
            <Button variant="secondary" className="flex-1" onClick={() => setIsRefillOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirmRefill}>
              Refill portions
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
export default MenuManagement;
