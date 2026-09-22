import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { IMenuItem, IMenuCombo, IMenuComboItem } from '../../../../types';
import { menuService } from '../../../../shared/services/menuService';
import { getMenuComboPath } from '../../../../firebase/collections';
import { formatPrice } from '../../../../utils/format';
import { useCurrency } from '../../../../context/CurrencyContext';

import Button from '../../../../components/ui/Button/Button';
import Card from '../../../../components/ui/Card/Card';
import Badge from '../../../../components/ui/Badge/Badge';
import Switch from '../../../../components/ui/Switch/Switch';
import Input from '../../../../components/ui/Input/Input';
import TextArea from '../../../../components/ui/TextArea/TextArea';
import Modal from '../../../../components/ui/Modal/Modal';
import Dialog from '../../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner/LoadingSpinner';

import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, ShoppingBag, Eye, EyeOff, Minus, Layers } from 'lucide-react';

interface MenuCombosTabProps {
  tenantId: string;
  menuItems: IMenuItem[];
}

export const MenuCombosTab: React.FC<MenuCombosTabProps> = ({ tenantId, menuItems }) => {
  const { currencySymbol } = useCurrency();
  const [combos, setCombos] = useState<IMenuCombo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal & form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<IMenuCombo | null>(null);
  const [targetComboId, setTargetComboId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form inputs
  const [comboName, setComboName] = useState('');
  const [comboDescription, setComboDescription] = useState('');
  const [comboPrice, setComboPrice] = useState<number | ''>('');
  const [comboImage, setComboImage] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [comboItems, setComboItems] = useState<IMenuComboItem[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    const colRef = collection(db, getMenuComboPath(tenantId));
    const unsub = onSnapshot(
      query(colRef),
      (snap) => {
        const list: IMenuCombo[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as IMenuCombo);
        });
        setCombos(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('[MenuCombosTab] Read error:', err);
        toast.error('Failed to load combos.');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [tenantId]);

  const openAddModal = () => {
    setEditingCombo(null);
    setComboName('');
    setComboDescription('');
    setComboPrice('');
    setComboImage('');
    setIsAvailable(true);
    setIsPublished(true);
    setComboItems([]);
    setIsModalOpen(true);
  };

  const openEditModal = (c: IMenuCombo) => {
    setEditingCombo(c);
    setComboName(c.name);
    setComboDescription(c.description || '');
    setComboPrice(c.price);
    setComboImage(c.image || c.imageUrl || '');
    setIsAvailable(c.isAvailable !== false && c.available !== false);
    setIsPublished(c.isPublished !== false && c.published !== false);
    setComboItems(c.items || []);
    setIsModalOpen(true);
  };

  const addItemToCombo = (itemId: string) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (!item) return;

    setComboItems((prev) => {
      const existing = prev.find((ci) => ci.itemId === itemId);
      if (existing) {
        return prev.map((ci) => (ci.itemId === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci));
      }
      return [...prev, { itemId, itemName: item.name, quantity: 1 }];
    });
  };

  const removeItemFromCombo = (itemId: string) => {
    setComboItems((prev) => {
      const existing = prev.find((ci) => ci.itemId === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((ci) => (ci.itemId === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci));
      }
      return prev.filter((ci) => ci.itemId !== itemId);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!comboName.trim()) {
      toast.error('Combo meal name is required.');
      return;
    }
    if (comboPrice === '' || Number(comboPrice) <= 0) {
      toast.error('Valid combo price is required.');
      return;
    }
    if (comboItems.length === 0) {
      toast.error('Please add at least one menu item to the combo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Omit<IMenuCombo, 'id'> = {
        name: comboName.trim(),
        description: comboDescription.trim(),
        price: Number(comboPrice),
        image: comboImage.trim() || undefined,
        items: comboItems,
        isAvailable,
        available: isAvailable,
        isPublished,
        published: isPublished,
        updatedAt: new Date().toISOString()
      };

      if (editingCombo) {
        await menuService.updateCombo(editingCombo.id, payload, tenantId);
        toast.success(`Updated combo: ${comboName}`);
      } else {
        const newId = `COMBO-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        await menuService.createCombo({ id: newId, ...payload, createdAt: new Date().toISOString() }, tenantId);
        toast.success(`Created combo meal: ${comboName}`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save combo: ${err.message || 'Error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAvailability = async (c: IMenuCombo) => {
    if (!tenantId) return;
    try {
      const nextStatus = !(c.isAvailable !== false && c.available !== false);
      await menuService.updateCombo(c.id, { isAvailable: nextStatus, available: nextStatus }, tenantId);
      toast.success(`${c.name} availability updated.`);
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const togglePublished = async (c: IMenuCombo) => {
    if (!tenantId) return;
    try {
      const nextStatus = !(c.isPublished !== false && c.published !== false);
      await menuService.updateCombo(c.id, { isPublished: nextStatus, published: nextStatus }, tenantId);
      toast.success(`${c.name} is now ${nextStatus ? 'Published' : 'Hidden from diners'}.`);
    } catch (err) {
      toast.error('Failed to update publishing status.');
    }
  };

  const confirmDelete = async () => {
    if (!tenantId || !targetComboId) return;
    try {
      await menuService.deleteCombo(targetComboId, tenantId);
      toast.success('Combo meal deleted.');
    } catch (err) {
      toast.error('Failed to delete combo.');
    } finally {
      setIsDeleteOpen(false);
      setTargetComboId(null);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-textPearl">Meal Combos & Bundles</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Create package deals, family bundles, and combo meals combining multiple individual dishes at bundled pricing.
          </p>
        </div>

        <Button onClick={openAddModal} className="flex items-center space-x-1.5 shrink-0" size="sm">
          <Plus className="w-4 h-4" />
          <span>Create Combo</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <LoadingSpinner label="Streaming meal combos..." />
        </div>
      ) : combos.length === 0 ? (
        <Card className="p-12 text-center border-slate-850 bg-slate-900/10">
          <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-textPearl">No combo meals created</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Combos allow you to group popular dishes together as bundled meals (e.g. Burger + Fries + Shake).
          </p>
          <Button onClick={openAddModal} className="mt-4 inline-flex items-center space-x-1.5" size="sm">
            <Plus className="w-4 h-4" />
            <span>Create First Combo</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {combos.map((c) => {
            const isAvail = c.isAvailable !== false && c.available !== false;
            const isPub = c.isPublished !== false && c.published !== false;

            return (
              <Card
                key={c.id}
                className={`p-4 border flex flex-col justify-between ${
                  !isPub 
                    ? 'bg-slate-900/10 border-dashed border-slate-800 opacity-80' 
                    : isAvail 
                      ? 'bg-slate-900/20 border-slate-850' 
                      : 'bg-rose-950/15 border-rose-900/40'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-textPearl">{c.name}</h4>
                      <span className="text-sm font-extrabold text-primary font-mono block mt-0.5">
                        {formatPrice(c.price)}
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isPub ? (
                        <Badge variant="success" className="text-[9px] px-1.5 py-0.5">Published</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5">Hidden</Badge>
                      )}
                      {isAvail ? (
                        <span className="text-[9px] font-bold text-emerald-400">In Stock</span>
                      ) : (
                        <span className="text-[9px] font-bold text-rose-400">Sold Out</span>
                      )}
                    </div>
                  </div>

                  {c.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>
                  )}

                  {/* Included items breakdown */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Includes:</span>
                    <div className="space-y-0.5">
                      {c.items?.map((it, idx) => (
                        <div key={idx} className="text-xs text-slate-300 flex justify-between">
                          <span>{it.itemName || menuItems.find((m) => m.id === it.itemId)?.name || 'Dish'}</span>
                          <span className="font-mono text-slate-500 font-bold">×{it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-850/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isAvail}
                      onChange={() => toggleAvailability(c)}
                      label="Available"
                    />
                    <button
                      type="button"
                      onClick={() => togglePublished(c)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title={isPub ? 'Hide from diners' : 'Publish to diner menu'}
                    >
                      {isPub ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetComboId(c.id);
                        setIsDeleteOpen(true);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Combo Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCombo ? 'Edit Combo Meal' : 'Create Combo Meal'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Combo Name *"
            placeholder="e.g. Burger Bonanza, Dinner for Two"
            value={comboName}
            onChange={(e) => setComboName(e.target.value)}
            disabled={isSubmitting}
            autoFocus
          />

          <TextArea
            label="Description"
            placeholder="Describe what is included in this bundle..."
            value={comboDescription}
            onChange={(e) => setComboDescription(e.target.value)}
            rows={2}
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Combo Price (${currencySymbol}) *`}
              type="number"
              step="0.01"
              placeholder="e.g. 24.99"
              value={comboPrice}
              onChange={(e) => setComboPrice(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={isSubmitting}
            />

            <Input
              label="Image URL"
              placeholder="https://..."
              value={comboImage}
              onChange={(e) => setComboImage(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Included dishes selector */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-textPearl block">
              Items Included in Bundle ({comboItems.reduce((acc, curr) => acc + curr.quantity, 0)} total):
            </span>

            {comboItems.length > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 space-y-1.5">
                {comboItems.map((ci) => (
                  <div key={ci.itemId} className="flex items-center justify-between text-xs text-textPearl">
                    <span>{ci.itemName}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeItemFromCombo(ci.itemId)}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold w-4 text-center">{ci.quantity}</span>
                      <button
                        type="button"
                        onClick={() => addItemToCombo(ci.itemId)}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 block">Click to add dishes:</span>
              <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-slate-950/40 rounded-xl border border-slate-800">
                {menuItems.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addItemToCombo(m.id)}
                    className="w-full text-left p-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 flex justify-between items-center transition-colors"
                  >
                    <span>{m.name}</span>
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <Switch
              checked={isAvailable}
              onChange={setIsAvailable}
              label="Currently In Stock"
            />
            <Switch
              checked={isPublished}
              onChange={setIsPublished}
              label="Published to Diners"
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
              {isSubmitting ? 'Saving...' : editingCombo ? 'Update Combo' : 'Create Combo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Combo Meal"
        message="Are you sure you want to delete this combo meal bundle? It will be removed from the diner menu."
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default MenuCombosTab;
