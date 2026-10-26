import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  FolderTree, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  Check, 
  Layers,
  ShoppingBag,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import MobileEmptyState from '../components/MobileEmptyState';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';

const FALLBACK_CATEGORY_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60';

export const MobileMenuCategories: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states for Add/Edit
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryImageUrl, setCategoryImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete modal state
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);
  const [referencedCount, setReferencedCount] = useState(0);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Categories listener
    const catCol = collection(db, 'restaurants', tenantId, 'menu', 'default', 'categories');
    const unsubCat = onSnapshot(catCol, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (Number(a.order ?? a.displayOrder ?? a.sortOrder ?? 99) - Number(b.order ?? b.displayOrder ?? b.sortOrder ?? 99)));
      setCategories(list);
      setLoading(false);
    }, (err) => {
      console.warn('[MobileMenuCategories] Categories listener warning:', err);
      setLoading(false);
    });

    // 2. Items listener to calculate item count per category
    const itemsCol = collection(db, 'restaurants', tenantId, 'menu', 'default', 'items');
    const unsubItems = onSnapshot(itemsCol, (snap) => {
      const itemList: any[] = [];
      snap.forEach((d) => itemList.push({ id: d.id, ...d.data() }));
      setItems(itemList);
    });

    return () => {
      unsubCat();
      unsubItems();
    };
  }, [tenantId]);

  const getItemCountForCategory = (cat: any) => {
    const catId = cat.id;
    const catName = cat.name || '';
    return items.filter((it) => 
      it.categoryId === catId || (it.category || 'General').toLowerCase() === catName.toLowerCase()
    ).length;
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setCategoryImageUrl('');
    setImageFile(null);
    setImagePreview('');
    setSortOrder(String(categories.length + 1));
    setIsActive(true);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cat: any) => {
    setEditingCategory(cat);
    setCategoryName(cat.name || '');
    setCategoryDescription(cat.description || '');
    setCategoryImageUrl(cat.image || cat.imageUrl || '');
    setImageFile(null);
    setImagePreview(cat.image || cat.imageUrl || '');
    setSortOrder(String(cat.order ?? cat.displayOrder ?? cat.sortOrder ?? 1));
    setIsActive(cat.isActive !== false);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleToggleActive = async (cat: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tenantId || !cat.id) return;
    try {
      const nextActive = cat.isActive === false ? true : false;
      const docRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'categories', cat.id);
      await updateDoc(docRef, {
        isActive: nextActive,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[MobileMenuCategories] Toggle active error:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setErrorMsg('Unauthorized: Tenant missing.');
      return;
    }

    if (!categoryName.trim()) {
      setErrorMsg('Category name is required.');
      return;
    }

    // Duplicate check
    const isDuplicate = categories.some(
      (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase() && c.id !== editingCategory?.id
    );
    if (isDuplicate) {
      setErrorMsg('A category with this name already exists.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const colRef = collection(db, 'restaurants', tenantId, 'menu', 'default', 'categories');
      const catId = editingCategory ? editingCategory.id : `CAT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const docRef = doc(colRef, catId);

      let finalImageUrl = categoryImageUrl.trim();

      // Handle file upload if provided
      if (imageFile && storage) {
        try {
          const storageRef = ref(storage, `restaurants/${tenantId}/categories/${catId}`);
          const uploadResult = await uploadBytes(storageRef, imageFile);
          finalImageUrl = await getDownloadURL(uploadResult.ref);
        } catch (uploadErr) {
          console.warn('[MobileMenuCategories] Storage upload warning:', uploadErr);
          if (!finalImageUrl) {
            finalImageUrl = FALLBACK_CATEGORY_IMAGE;
          }
        }
      }

      const payload = {
        name: categoryName.trim(),
        description: categoryDescription.trim(),
        image: finalImageUrl,
        order: Number(sortOrder) || 1,
        displayOrder: Number(sortOrder) || 1,
        isActive,
        tenantId,
        updatedAt: new Date().toISOString(),
        ...(!editingCategory ? { createdAt: new Date().toISOString() } : {}),
      };

      await setDoc(docRef, payload, { merge: true });
      setShowModal(false);
    } catch (err: any) {
      console.error('[MobileMenuCategories] Save error:', err);
      setErrorMsg(err.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleInitiateDelete = (cat: any) => {
    const count = getItemCountForCategory(cat);
    setReferencedCount(count);
    setCategoryToDelete(cat);
  };

  const handleConfirmDelete = async () => {
    if (!tenantId || !categoryToDelete) return;
    try {
      const docRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'categories', categoryToDelete.id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('[MobileMenuCategories] Delete error:', err);
    } finally {
      setCategoryToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/menu')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
          aria-label="Back to Menu"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="font-extrabold text-sm text-[#202124]">Menu Categories</h1>
          <p className="text-[11px] text-[#707070]">{categories.length} categories configured</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-9 h-9 rounded-full bg-[#FF7518] text-white flex items-center justify-center shadow-sm shadow-[#FF7518]/25"
          aria-label="Add Category"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <MobileLoadingSkeleton count={3} />
        ) : categories.length === 0 ? (
          <MobileEmptyState
            icon={FolderTree}
            title="No Categories Yet"
            description="Organize your dishes into sections like Starters, Mains, and Drinks."
            actionLabel="Add Category"
            onAction={handleOpenAdd}
          />
        ) : (
          categories.map((cat, idx) => {
            const count = getItemCountForCategory(cat);
            const isCatActive = cat.isActive !== false;
            return (
              <div
                key={cat.id}
                className={`bg-white rounded-2xl border p-4 flex items-center justify-between shadow-sm transition-all ${
                  isCatActive ? 'border-[#EBEBEB]' : 'border-dashed border-[#D1D5DB] bg-[#FAFAFA]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Category Image or Number Icon */}
                  {cat.image || cat.imageUrl ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#FAF4F0] border border-[#EBEBEB] flex-shrink-0">
                      <img src={cat.image || cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#FFF4EE] text-[#FF7518] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {idx + 1}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs text-[#202124] truncate">{cat.name}</h3>
                      {!isCatActive && (
                        <span className="text-[9px] font-bold text-[#DC2626] bg-[#FEE2E2] px-1.5 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-[11px] text-[#707070] line-clamp-1 mt-0.5">{cat.description}</p>
                    )}
                    <span className="text-[10px] text-[#9E9E9E]">
                      {count} {count === 1 ? 'item' : 'items'} • Sort #{cat.order ?? cat.displayOrder ?? idx + 1}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {/* Active Toggle */}
                  <button
                    onClick={(e) => handleToggleActive(cat, e)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      isCatActive 
                        ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]' 
                        : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
                    }`}
                  >
                    {isCatActive ? 'Active' : 'Hidden'}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1.5 rounded-xl text-[#707070] hover:bg-[#F7F7F7] transition-colors"
                    aria-label="Edit category"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleInitiateDelete(cat)}
                    className="p-1.5 rounded-xl text-[#DC2626] hover:bg-[#FEE2E2]/50 transition-colors"
                    aria-label="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#202124]">
              {editingCategory ? 'Edit Category' : 'New Category'}
            </h3>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FEE2E2] text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Starters, Appetizers"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  placeholder="Introduce this category to diners..."
                  className="w-full p-3 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Custom Image URL</label>
                <input
                  type="url"
                  value={categoryImageUrl}
                  onChange={(e) => {
                    setCategoryImageUrl(e.target.value);
                    if (!imageFile) setImagePreview(e.target.value);
                  }}
                  placeholder="https://example.com/category.jpg"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
                />
              </div>

              {/* Photo Upload & Preview */}
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Or Upload Photo</label>
                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 bg-[#F7F7F7] border border-[#EBEBEB] text-[#202124] rounded-xl text-xs font-bold hover:border-[#FF7518] cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#FF7518]" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  {imagePreview && (
                    <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#EBEBEB] bg-[#F7F7F7]">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Display Sort Order</label>
                  <input
                    type="number"
                    min="1"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    placeholder="1"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="block text-xs font-bold text-[#202124] mb-2">Category Status</label>
                  <label className="flex items-center gap-2 cursor-pointer h-11">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF7518] accent-[#FF7518]"
                    />
                    <span className="text-xs font-bold text-[#202124]">{isActive ? 'Active' : 'Inactive'}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[#F5F5F5]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF7518] text-white text-xs font-bold shadow-sm shadow-[#FF7518]/25"
                >
                  {saving ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 space-y-3 shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-sm text-[#202124]">Delete "{categoryToDelete.name}"?</h3>
              {referencedCount > 0 ? (
                <p className="text-xs text-[#DC2626] mt-1 font-medium">
                  Warning: {referencedCount} menu items belong to this category. Deleting it will reassign them to "General".
                </p>
              ) : (
                <p className="text-xs text-[#707070] mt-1">
                  Are you sure you want to remove this category?
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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

export default MobileMenuCategories;
