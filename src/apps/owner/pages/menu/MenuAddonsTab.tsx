import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { IMenuItem, IMenuAddon } from '../../../../types';
import { menuService } from '../../../../shared/services/menuService';
import { getMenuAddonPath } from '../../../../firebase/collections';
import { formatPrice } from '../../../../utils/format';
import { useCurrency } from '../../../../context/CurrencyContext';

import Button from '../../../../components/ui/Button/Button';
import Card from '../../../../components/ui/Card/Card';
import Badge from '../../../../components/ui/Badge/Badge';
import Switch from '../../../../components/ui/Switch/Switch';
import Input from '../../../../components/ui/Input/Input';
import Modal from '../../../../components/ui/Modal/Modal';
import Dialog from '../../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner/LoadingSpinner';

import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, PlusCircle, Check } from 'lucide-react';

interface MenuAddonsTabProps {
  tenantId: string;
  menuItems: IMenuItem[];
}

export const MenuAddonsTab: React.FC<MenuAddonsTabProps> = ({ tenantId, menuItems }) => {
  const { currencySymbol } = useCurrency();
  const [addons, setAddonsList] = useState<IMenuAddon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal & form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<IMenuAddon | null>(null);
  const [targetAddonId, setTargetAddonId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form inputs
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState<number | ''>('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isGlobal, setIsGlobal] = useState(true);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    const colRef = collection(db, getMenuAddonPath(tenantId));
    const unsub = onSnapshot(
      query(colRef),
      (snap) => {
        const list: IMenuAddon[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as IMenuAddon);
        });
        setAddonsList(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('[MenuAddonsTab] Read error:', err);
        toast.error('Failed to load add-ons.');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [tenantId]);

  const openAddModal = () => {
    setEditingAddon(null);
    setAddonName('');
    setAddonPrice('');
    setIsAvailable(true);
    setIsGlobal(true);
    setSelectedItemIds([]);
    setIsModalOpen(true);
  };

  const openEditModal = (a: IMenuAddon) => {
    setEditingAddon(a);
    setAddonName(a.name);
    setAddonPrice(a.price);
    setIsAvailable(a.isAvailable !== false && a.available !== false);
    setIsGlobal(a.isGlobal !== false);
    setSelectedItemIds(a.applicableItems || []);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!addonName.trim()) {
      toast.error('Add-on name is required (e.g. Extra Cheese, Truffle Dip).');
      return;
    }
    if (addonPrice === '' || Number(addonPrice) < 0) {
      toast.error('Valid add-on price is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Omit<IMenuAddon, 'id'> = {
        name: addonName.trim(),
        price: Number(addonPrice),
        isAvailable,
        available: isAvailable,
        isGlobal,
        applicableItems: isGlobal ? [] : selectedItemIds,
        updatedAt: new Date().toISOString()
      };

      if (editingAddon) {
        await menuService.updateAddon(editingAddon.id, payload, tenantId);
        toast.success(`Updated add-on: ${addonName}`);
      } else {
        const newId = `ADDON-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        await menuService.createAddon({ id: newId, ...payload, createdAt: new Date().toISOString() }, tenantId);
        toast.success(`Created add-on: ${addonName}`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save add-on: ${err.message || 'Error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAvailability = async (a: IMenuAddon) => {
    if (!tenantId) return;
    try {
      const nextStatus = !(a.isAvailable !== false && a.available !== false);
      await menuService.updateAddon(a.id, { isAvailable: nextStatus, available: nextStatus }, tenantId);
      toast.success(`${a.name} status updated.`);
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const confirmDelete = async () => {
    if (!tenantId || !targetAddonId) return;
    try {
      await menuService.deleteAddon(targetAddonId, tenantId);
      toast.success('Add-on deleted.');
    } catch (err) {
      toast.error('Failed to delete add-on.');
    } finally {
      setIsDeleteOpen(false);
      setTargetAddonId(null);
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-textPearl">Item Add-ons & Modifiers</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure optional upgrades, sides, dressings, extra proteins, and condiments that diners can add to dishes.
          </p>
        </div>

        <Button onClick={openAddModal} className="flex items-center space-x-1.5 shrink-0" size="sm">
          <Plus className="w-4 h-4" />
          <span>Add Add-on</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <LoadingSpinner label="Streaming menu add-ons..." />
        </div>
      ) : addons.length === 0 ? (
        <Card className="p-12 text-center border-slate-850 bg-slate-900/10">
          <PlusCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-textPearl">No menu add-ons configured</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Add-ons allow diners to customize their orders with toppings, extra cheese, sauces, or sides.
          </p>
          <Button onClick={openAddModal} className="mt-4 inline-flex items-center space-x-1.5" size="sm">
            <Plus className="w-4 h-4" />
            <span>Create First Add-on</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {addons.map((a) => {
            const isAvail = a.isAvailable !== false && a.available !== false;
            return (
              <Card
                key={a.id}
                className={`p-4 border flex flex-col justify-between ${
                  isAvail ? 'bg-slate-900/20 border-slate-850' : 'bg-rose-950/15 border-rose-900/40'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-textPearl">{a.name}</h4>
                      <span className="text-xs font-bold text-primary font-mono block mt-0.5">
                        +{formatPrice(a.price)}
                      </span>
                    </div>

                    {isAvail ? (
                      <Badge variant="success" className="text-[9px] px-1.5 py-0.5">Available</Badge>
                    ) : (
                      <Badge variant="danger" className="text-[9px] px-1.5 py-0.5">Sold Out</Badge>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    {a.isGlobal ? (
                      <span className="text-emerald-400 font-semibold">Available for all dishes</span>
                    ) : (
                      <span>Applicable to {a.applicableItems?.length || 0} specific dishes</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-850/60 flex items-center justify-between">
                  <Switch
                    checked={isAvail}
                    onChange={() => toggleAvailability(a)}
                    label="In Stock"
                  />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(a)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetAddonId(a.id);
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

      {/* Add / Edit Add-on Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddon ? 'Edit Add-on' : 'Create Menu Add-on'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Add-on Name *"
            placeholder="e.g. Extra Cheese, Truffle Dip, Bacon Bits"
            value={addonName}
            onChange={(e) => setAddonName(e.target.value)}
            disabled={isSubmitting}
            autoFocus
          />

          <Input
            label={`Add-on Price (${currencySymbol}) *`}
            type="number"
            step="0.01"
            placeholder="e.g. 2.50"
            value={addonPrice}
            onChange={(e) => setAddonPrice(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={isSubmitting}
          />

          <div className="space-y-3 pt-2">
            <Switch
              checked={isAvailable}
              onChange={setIsAvailable}
              label="Currently In Stock"
            />

            <Switch
              checked={isGlobal}
              onChange={setIsGlobal}
              label="Global Add-on (Available on any dish)"
            />
          </div>

          {!isGlobal && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 block">
                Select Applicable Dishes ({selectedItemIds.length} selected):
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                {menuItems.map((m) => {
                  const isSelected = selectedItemIds.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleItemSelection(m.id)}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary font-bold' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>{m.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
              {isSubmitting ? 'Saving...' : editingAddon ? 'Update Add-on' : 'Create Add-on'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Add-on"
        message="Are you sure you want to delete this add-on modifier? It will be removed from customer customization options."
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default MenuAddonsTab;
