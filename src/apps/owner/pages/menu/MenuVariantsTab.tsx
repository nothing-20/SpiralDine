import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { IMenuItem, IMenuVariant } from '../../../../types';
import { menuService } from '../../../../shared/services/menuService';
import { getMenuVariantPath } from '../../../../firebase/collections';
import { formatPrice } from '../../../../utils/format';
import { useCurrency } from '../../../../context/CurrencyContext';

import Button from '../../../../components/ui/Button/Button';
import Card from '../../../../components/ui/Card/Card';
import Badge from '../../../../components/ui/Badge/Badge';
import Switch from '../../../../components/ui/Switch/Switch';
import Input from '../../../../components/ui/Input/Input';
import Select from '../../../../components/ui/Select/Select';
import Modal from '../../../../components/ui/Modal/Modal';
import Dialog from '../../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner/LoadingSpinner';

import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Sparkles, AlertCircle, Layers } from 'lucide-react';

interface MenuVariantsTabProps {
  tenantId: string;
  menuItems: IMenuItem[];
}

export const MenuVariantsTab: React.FC<MenuVariantsTabProps> = ({ tenantId, menuItems }) => {
  const { currencySymbol } = useCurrency();
  const [variants, setVariants] = useState<IMenuVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<IMenuVariant | null>(null);
  const [targetVariantId, setTargetVariantId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState<number | ''>('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Realtime subscription to variants subcollection
  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    const colRef = collection(db, getMenuVariantPath(tenantId));
    const unsub = onSnapshot(
      query(colRef),
      (snap) => {
        const list: IMenuVariant[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as IMenuVariant);
        });
        setVariants(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('[MenuVariantsTab] Read error:', err);
        toast.error('Failed to load variants.');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [tenantId]);

  const openAddModal = () => {
    setEditingVariant(null);
    setSelectedItemId(menuItems[0]?.id || '');
    setVariantName('');
    setVariantPrice('');
    setIsAvailable(true);
    setIsModalOpen(true);
  };

  const openEditModal = (v: IMenuVariant) => {
    setEditingVariant(v);
    setSelectedItemId(v.itemId);
    setVariantName(v.name);
    setVariantPrice(v.price);
    setIsAvailable(v.isAvailable !== false && v.available !== false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!selectedItemId) {
      toast.error('Please select a parent menu item.');
      return;
    }
    if (!variantName.trim()) {
      toast.error('Variant name is required (e.g. Small, Regular, Large).');
      return;
    }
    if (variantPrice === '' || Number(variantPrice) < 0) {
      toast.error('Valid variant price is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Omit<IMenuVariant, 'id'> = {
        itemId: selectedItemId,
        name: variantName.trim(),
        price: Number(variantPrice),
        isAvailable,
        available: isAvailable,
        updatedAt: new Date().toISOString()
      };

      if (editingVariant) {
        await menuService.updateVariant(editingVariant.id, payload, tenantId);
        toast.success(`Updated variant: ${variantName}`);
      } else {
        const newId = `VAR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        await menuService.createVariant({ id: newId, ...payload, createdAt: new Date().toISOString() }, tenantId);
        toast.success(`Created variant: ${variantName}`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save variant: ${err.message || 'Error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAvailability = async (v: IMenuVariant) => {
    if (!tenantId) return;
    try {
      const nextStatus = !(v.isAvailable !== false && v.available !== false);
      await menuService.updateVariant(v.id, { isAvailable: nextStatus, available: nextStatus }, tenantId);
      toast.success(`${v.name} status updated.`);
    } catch (err) {
      toast.error('Failed to update availability.');
    }
  };

  const confirmDelete = async () => {
    if (!tenantId || !targetVariantId) return;
    try {
      await menuService.deleteVariant(targetVariantId, tenantId);
      toast.success('Variant deleted.');
    } catch (err) {
      toast.error('Failed to delete variant.');
    } finally {
      setIsDeleteOpen(false);
      setTargetVariantId(null);
    }
  };

  // Group variants by parent item
  const variantsByItem = menuItems.map((item) => {
    return {
      item,
      itemVariants: variants.filter((v) => v.itemId === item.id)
    };
  }).filter((group) => group.itemVariants.length > 0);

  const unlinkedVariants = variants.filter((v) => !menuItems.some((m) => m.id === v.itemId));

  return (
    <div className="space-y-6 text-left">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-textPearl">Portion Sizes & Item Variants</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure portion sizes (Small, Medium, Large, Half, Full) and custom variants with specific pricing and independent availability.
          </p>
        </div>

        <Button onClick={openAddModal} className="flex items-center space-x-1.5 shrink-0" size="sm">
          <Plus className="w-4 h-4" />
          <span>Add Variant</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <LoadingSpinner label="Streaming menu variants..." />
        </div>
      ) : variants.length === 0 ? (
        <Card className="p-12 text-center border-slate-850 bg-slate-900/10">
          <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-textPearl">No item variants configured</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Variants allow you to offer portion sizes like Half, Full, Small, or Large with different prices.
          </p>
          <Button onClick={openAddModal} className="mt-4 inline-flex items-center space-x-1.5" size="sm">
            <Plus className="w-4 h-4" />
            <span>Create First Variant</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {variantsByItem.map(({ item, itemVariants }) => (
            <Card key={item.id} className="p-5 border-slate-850 bg-slate-900/20 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-textPearl">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                    Base: {formatPrice(item.price)}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {itemVariants.length} {itemVariants.length === 1 ? 'variant' : 'variants'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {itemVariants.map((v) => {
                  const isAvail = v.isAvailable !== false && v.available !== false;
                  return (
                    <div
                      key={v.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isAvail ? 'bg-slate-950/40 border-slate-800' : 'bg-rose-950/20 border-rose-900/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-textPearl truncate">{v.name}</span>
                          {isAvail ? (
                            <Badge variant="success" className="text-[9px] px-1 py-0">Available</Badge>
                          ) : (
                            <Badge variant="danger" className="text-[9px] px-1 py-0">Out of Stock</Badge>
                          )}
                        </div>
                        <span className="text-xs font-bold text-primary font-mono mt-0.5 block">
                          {formatPrice(v.price)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={isAvail}
                          onChange={() => toggleAvailability(v)}
                        />
                        <button
                          type="button"
                          onClick={() => openEditModal(v)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetVariantId(v.id);
                            setIsDeleteOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          {unlinkedVariants.length > 0 && (
            <Card className="p-4 border-slate-850 bg-slate-900/10 space-y-2">
              <span className="text-xs font-bold text-amber-400">Unlinked Variants</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unlinkedVariants.map((v) => (
                  <div key={v.id} className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 flex justify-between items-center text-xs">
                    <span>{v.name} ({formatPrice(v.price)})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetVariantId(v.id);
                        setIsDeleteOpen(true);
                      }}
                      className="text-rose-400 hover:underline text-[10px]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Add / Edit Variant Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVariant ? 'Edit Variant' : 'Create Item Variant'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Parent Dish *"
            options={menuItems.map((m) => ({ value: m.id, label: m.name }))}
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={isSubmitting}
          />

          <Input
            label="Variant / Size Name *"
            placeholder="e.g. Regular, Large, Half, Full"
            value={variantName}
            onChange={(e) => setVariantName(e.target.value)}
            disabled={isSubmitting}
            autoFocus
          />

          <Input
            label={`Variant Price (${currencySymbol}) *`}
            type="number"
            step="0.01"
            placeholder="e.g. 14.99"
            value={variantPrice}
            onChange={(e) => setVariantPrice(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={isSubmitting}
          />

          <div className="pt-2">
            <Switch
              checked={isAvailable}
              onChange={setIsAvailable}
              label="Currently Available for Ordering"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingVariant ? 'Update Variant' : 'Create Variant'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Variant"
        message="Are you sure you want to delete this portion variant? Diners will no longer be able to select it."
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default MenuVariantsTab;
