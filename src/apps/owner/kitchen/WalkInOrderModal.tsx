import React, { useState } from 'react';
import { db } from '../../../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { inferCourseForItem, inferStationForItem } from '../../../shared/services/kitchenService';
import { X, Plus, Minus, Utensils, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface IWalkInOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: any[];
}

export const WalkInOrderModal: React.FC<IWalkInOrderModalProps> = ({
  isOpen,
  onClose,
  menuItems,
}) => {
  const { user } = useAuth();
  const [tableNumber, setTableNumber] = useState('1');
  const [customerName, setCustomerName] = useState('Walk-in Guest');
  const [customerType, setCustomerType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQtyChange = (itemId: string, delta: number) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) {
        delete copy[itemId];
      } else {
        copy[itemId] = next;
      }
      return copy;
    });
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) {
      toast.error('Restaurant context missing.');
      return;
    }

    const itemEntries = Object.entries(selectedItems);
    if (itemEntries.length === 0) {
      toast.error('Please select at least one menu item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const generatedOrderId = `ORD-${Date.now().toString().slice(-8)}`;

      const orderItems = itemEntries.map(([itemId, count], idx) => {
        const menuItem = menuItems.find(m => m.id === itemId);
        const name = menuItem?.name || 'Dish';
        const price = Number(menuItem?.price || 0);
        const course = inferCourseForItem(name, menuItem?.category);
        const station = inferStationForItem(name, menuItem?.category);
        const itemUniqueId = `${generatedOrderId}-item-${idx}`;

        return {
          id: itemUniqueId,
          orderItemId: itemUniqueId,
          itemId,
          name,
          count,
          price,
          status: 'NOT_STARTED',
          prepStatus: 'NOT_STARTED',
          course,
          station,
          prepTimeMinutes: menuItem?.prepTimeMinutes || 12,
          isVeg: menuItem?.isVeg ?? menuItem?.veg ?? true,
        };
      });

      const totalAmount = orderItems.reduce((acc, item) => acc + (item.price * item.count), 0);

      const orderDoc = {
        id: generatedOrderId,
        orderId: generatedOrderId,
        tenantId: user.tenantId,
        branchId: 'main',
        tableNumber: tableNumber.trim() || 'Walk-in',
        tableId: `TBL-${tableNumber.trim() || 'Walk-in'}`,
        customerName: customerName.trim() || 'Walk-in Guest',
        customerType,
        status: 'PLACED',
        priority: 'normal',
        items: orderItems,
        totalAmount,
        notes: notes.trim(),
        orderSource: 'kds_walk_in',
        waiterName: user.displayName || 'Counter Staff',
        createdAt: nowIso,
        updatedAt: nowIso,
        timeline: [
          {
            type: 'PLACED',
            title: 'Order Placed (KDS Walk-in)',
            performedBy: user.displayName || 'Kitchen Chef',
            timestamp: nowIso,
          }
        ],
      };

      await setDoc(doc(db, 'restaurants', user.tenantId, 'orders', generatedOrderId), orderDoc);

      toast.success(`Order #${generatedOrderId} placed successfully for Table ${tableNumber}!`);
      setSelectedItems({});
      setNotes('');
      onClose();
    } catch (err: any) {
      console.error('Failed to create walk-in order:', err);
      toast.error('Failed to create order. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#E3DED5] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 px-5 border-b border-[#E3DED5] flex items-center justify-between bg-[#FBF9F5]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#183B2B] text-white flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#18201D] leading-tight">
                New Walk-In Order
              </h2>
              <p className="text-xs text-[#71717A]">
                Dispatch order directly to kitchen stations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleCreateOrder} className="p-5 overflow-y-auto space-y-4 flex-1 text-left">
          {/* Table & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#18201D] mb-1">
                Table Number *
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                placeholder="e.g. 2, 5, Patio 1"
                required
                className="w-full px-3 py-2 text-xs border border-[#E3DED5] rounded-xl outline-none focus:border-[#183B2B] bg-[#FAF8F5]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#18201D] mb-1">
                Order Type
              </label>
              <select
                value={customerType}
                onChange={e => setCustomerType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-[#E3DED5] rounded-xl outline-none focus:border-[#183B2B] bg-[#FAF8F5]"
              >
                <option value="dine-in">Dine-In</option>
                <option value="takeaway">Takeaway</option>
              </select>
            </div>
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-bold text-[#18201D] mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Guest Name"
              className="w-full px-3 py-2 text-xs border border-[#E3DED5] rounded-xl outline-none focus:border-[#183B2B] bg-[#FAF8F5]"
            />
          </div>

          {/* Menu Items Selector */}
          <div>
            <label className="block text-xs font-bold text-[#18201D] mb-1.5">
              Select Dishes ({Object.keys(selectedItems).length} selected)
            </label>
            <div className="border border-[#E3DED5] rounded-xl max-h-56 overflow-y-auto divide-y divide-[#F0ECE1]">
              {menuItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-500">
                  No active menu items found.
                </div>
              ) : (
                menuItems.map(item => {
                  const qty = selectedItems[item.id] || 0;
                  return (
                    <div key={item.id} className="p-2.5 px-3 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs text-[#18201D] truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-[#71717A]">
                          ₹{Number(item.price || 0).toFixed(2)} · {item.category || 'General'}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {qty > 0 && (
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.id, -1)}
                            className="w-6 h-6 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                        {qty > 0 && (
                          <span className="w-5 text-center font-bold text-xs text-[#18201D]">
                            {qty}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, 1)}
                          className="w-6 h-6 rounded-md bg-[#183B2B] hover:bg-[#132E22] text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-xs font-bold text-[#18201D] mb-1">
              Kitchen Instructions / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Less spicy, extra sauce, allergy info..."
              className="w-full px-3 py-2 text-xs border border-[#E3DED5] rounded-xl outline-none focus:border-[#183B2B] bg-[#FAF8F5]"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 border border-[#E3DED5] rounded-xl hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Object.keys(selectedItems).length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-[#183B2B] hover:bg-[#132E22] disabled:opacity-50 rounded-xl transition-all flex items-center space-x-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating Order...' : 'Dispatch to Kitchen'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalkInOrderModal;

