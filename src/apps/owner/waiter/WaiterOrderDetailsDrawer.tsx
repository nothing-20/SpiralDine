import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IOrder, ITable } from '../../../types';
import { IOrderItem, TItemPreparationStatus } from '../../../shared/domain/orders/types';
import { formatPrice } from '../../../utils/format';
import { db } from '../../../config/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { calculateDerivedOrderStatus } from '../../../shared/services/kitchenService';
import { logEvent } from '../../../services/eventEngine';
import toast from 'react-hot-toast';
import {
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  Utensils,
  Check,
  AlertCircle,
  FileText,
  User,
  Phone,
  DollarSign,
  Info,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface IWaiterOrderDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  table: ITable;
  orders: IOrder[]; // active orders for this table (e.g. Round 1 + Add-ons)
  initialSelectedOrderId?: string;
  initialSelectReadyItems?: boolean;
  onSettleBill?: (order: IOrder) => void;
}

export const WaiterOrderDetailsDrawer: React.FC<IWaiterOrderDetailsDrawerProps> = ({
  isOpen,
  onClose,
  table,
  orders,
  initialSelectedOrderId,
  initialSelectReadyItems = false,
  onSettleBill,
}) => {
  const { user } = useAuth();

  // Active round/order selection if multiple rounds exist
  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    if (initialSelectedOrderId) return initialSelectedOrderId;
    return orders[0]?.orderId || orders[0]?.id || '';
  });

  // Current active order in drawer
  const currentOrder = useMemo(() => {
    return orders.find(o => (o.orderId === selectedOrderId || o.id === selectedOrderId)) || orders[0];
  }, [orders, selectedOrderId]);

  // Drawer tabs: 'items' | 'details' | 'notes'
  const [drawerTab, setDrawerTab] = useState<'items' | 'details' | 'notes'>('items');

  // Multi-selection checkboxes for ready items (maps item index in currentOrder.items)
  const [selectedItemIndices, setSelectedItemIndices] = useState<Set<number>>(new Set());

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    itemIndices: number[];
    isServingAll: boolean;
  }>({
    isOpen: false,
    itemIndices: [],
    isServingAll: false,
  });

  const [isServing, setIsServing] = useState(false);

  // Focus and keyboard management refs
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Manage focus and keyboard Escape when confirmation dialog is open
  useEffect(() => {
    if (!confirmDialog.isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isServing) {
          setConfirmDialog({ isOpen: false, itemIndices: [], isServingAll: false });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [confirmDialog.isOpen, isServing]);

  // Sync selected order if orders array updates
  useEffect(() => {
    if (orders.length > 0) {
      if (!orders.some(o => o.orderId === selectedOrderId || o.id === selectedOrderId)) {
        setSelectedOrderId(orders[0]?.orderId || orders[0]?.id || '');
      }
    }
  }, [orders, selectedOrderId]);

  // Items with resolved statuses
  const itemsWithMeta = useMemo(() => {
    if (!currentOrder || !currentOrder.items) return [];

    return currentOrder.items.map((item, idx) => {
      // Kitchen status resolution
      let kitchenStatus: TItemPreparationStatus = (item as any).status || (item as any).prepStatus;
      if (!kitchenStatus) {
        if (currentOrder.status === 'READY') kitchenStatus = 'READY';
        else if (currentOrder.status === 'PREPARING') kitchenStatus = 'PREPARING';
        else if (['DELIVERED', 'SERVED', 'COMPLETED'].includes(currentOrder.status)) kitchenStatus = 'SERVED';
        else kitchenStatus = 'NOT_STARTED';
      }

      // Serving status resolution
      const isAlreadyServed = (item as any).servingStatus === 'SERVED' || item.status === 'SERVED' || currentOrder.status === 'SERVED' || currentOrder.status === 'DELIVERED';
      const isEligibleToServe = (kitchenStatus === 'READY' || (item as any).prepStatus === 'READY') && !isAlreadyServed;

      let servingStatusText = 'WAITING';
      if (isAlreadyServed) {
        servingStatusText = 'SERVED';
      } else if (isEligibleToServe) {
        servingStatusText = 'READY TO SERVE';
      }

      return {
        ...item,
        originalIndex: idx,
        kitchenStatus,
        isAlreadyServed,
        isEligibleToServe,
        servingStatusText,
        course: item.course || (item as any).category || 'Main',
      };
    });
  }, [currentOrder]);

  // Auto-preselect ready items if requested via prop
  useEffect(() => {
    if (initialSelectReadyItems && itemsWithMeta.length > 0) {
      const readyIndices = new Set<number>();
      itemsWithMeta.forEach(i => {
        if (i.isEligibleToServe) readyIndices.add(i.originalIndex);
      });
      setSelectedItemIndices(readyIndices);
    } else {
      setSelectedItemIndices(new Set());
    }
  }, [initialSelectReadyItems, currentOrder?.orderId, itemsWithMeta]);

  // Summary counts for current order
  const { readyCount, servedCount, preparingCount, pendingCount } = useMemo(() => {
    let ready = 0;
    let served = 0;
    let preparing = 0;
    let pending = 0;

    itemsWithMeta.forEach(item => {
      const count = Number(item.count || 1);
      if (item.isAlreadyServed) {
        served += count;
      } else if (item.isEligibleToServe) {
        ready += count;
      } else if (item.kitchenStatus === 'PREPARING') {
        preparing += count;
      } else {
        pending += count;
      }
    });

    return {
      readyCount: ready,
      servedCount: served,
      preparingCount: preparing,
      pendingCount: pending,
    };
  }, [itemsWithMeta]);

  // Toggle item selection
  const toggleItemCheckbox = (index: number) => {
    setSelectedItemIndices(prev => {
      const copy = new Set(prev);
      if (copy.has(index)) copy.delete(index);
      else copy.add(index);
      return copy;
    });
  };

  // Select all ready items
  const handleToggleSelectAllReady = () => {
    const readyIndices = itemsWithMeta.filter(i => i.isEligibleToServe).map(i => i.originalIndex);
    if (selectedItemIndices.size === readyIndices.length) {
      setSelectedItemIndices(new Set());
    } else {
      setSelectedItemIndices(new Set(readyIndices));
    }
  };

  // Serve confirmed action
  const handleExecuteServe = async () => {
    if (!user?.tenantId || !currentOrder || isServing) return;
    const rawIndices = confirmDialog.itemIndices;
    if (rawIndices.length === 0) return;

    // Re-validate that selected items are still eligible (not already served)
    const eligibleIndicesToServe = rawIndices.filter(idx => {
      const item = currentOrder.items[idx];
      if (!item) return false;
      const isAlreadyServed = (item as any).servingStatus === 'SERVED' || item.status === 'SERVED';
      return !isAlreadyServed;
    });

    if (eligibleIndicesToServe.length === 0) {
      toast.error('The selected item(s) are already marked as served.');
      setConfirmDialog({ isOpen: false, itemIndices: [], isServingAll: false });
      return;
    }

    setIsServing(true);
    try {
      const updatedItems = [...currentOrder.items];
      const timestamp = new Date().toISOString();
      const waiterName = user.displayName || 'Floor Waiter';
      const servedDishNames: string[] = [];

      eligibleIndicesToServe.forEach(idx => {
        const item = { ...updatedItems[idx] };
        item.servingStatus = 'SERVED';
        item.status = 'SERVED';
        item.servedAt = timestamp;
        item.servedBy = waiterName;
        item.servedByUid = user.uid;
        updatedItems[idx] = item;
        servedDishNames.push(item.name);
      });

      // Recalculate derived overall order status
      const newOrderStatus = calculateDerivedOrderStatus(updatedItems, currentOrder.status);

      const orderDocId = currentOrder.orderId || currentOrder.id;
      if (!orderDocId) {
        toast.error('Invalid order identifier.');
        return;
      }

      const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderDocId);
      const timelineEvent = {
        type: 'SERVED' as const,
        title: `Served ${eligibleIndicesToServe.length} item(s) to Table ${table.number}`,
        description: `Dishes served: ${servedDishNames.join(', ')}`,
        performedBy: waiterName,
        timestamp,
      };

      const updateFields: any = {
        items: updatedItems,
        status: newOrderStatus,
        updatedAt: timestamp,
        timeline: arrayUnion(timelineEvent),
      };

      if (newOrderStatus === 'SERVED' && !currentOrder.deliveredAt) {
        updateFields.deliveredAt = timestamp;
      }

      await updateDoc(docRef, updateFields);

      // Log activity event
      await logEvent(user.tenantId, {
        eventType: 'Order Served',
        eventCategory: 'Waiter',
        performedBy: waiterName,
        performedByRole: 'waiter',
        orderId: currentOrder.orderId,
        title: `Food Served to Table ${table.number}`,
        description: `Waiter ${waiterName} marked ${eligibleIndicesToServe.length} dish(es) as SERVED: ${servedDishNames.join(', ')}.`,
      });

      toast.success(
        eligibleIndicesToServe.length === 1
          ? `✓ Served "${servedDishNames[0]}" to Table ${table.number}!`
          : `✓ Served ${eligibleIndicesToServe.length} items to Table ${table.number}!`
      );

      // Clear selection and close confirmation
      setSelectedItemIndices(new Set());
      setConfirmDialog({ isOpen: false, itemIndices: [], isServingAll: false });
    } catch (err: any) {
      console.error('Failed to serve items:', err);
      toast.error('Failed to update serving status. Please retry.');
    } finally {
      setIsServing(false);
    }
  };

  if (!isOpen) return null;

  if (!currentOrder) {
    const emptyContent = (
      <>
        <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 transition-opacity cursor-pointer" />
        <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] lg:w-[540px] bg-white border-l border-[#E3DED5] shadow-2xl flex flex-col p-6 animate-in slide-in-from-right duration-200 pointer-events-auto">
          <div className="flex justify-between items-center pb-4 border-b border-[#F0ECE1]">
            <h3 className="font-extrabold text-base text-[#18201D]">Table {table?.number}</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-100 transition-colors cursor-pointer">
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-stone-500">
            <Utensils className="w-12 h-12 text-stone-300 mb-3" />
            <div className="font-bold text-sm text-[#18201D]">No Active Orders</div>
            <div className="text-xs text-[#71717A] mt-1">This table has no active food orders in progress.</div>
          </div>
        </aside>
      </>
    );
    return typeof document !== 'undefined' ? createPortal(emptyContent, document.body) : emptyContent;
  }

  // Derive order relative timestamp
  const orderTimeStr = (() => {
    try {
      const d = new Date(currentOrder.createdAt);
      if (isNaN(d.getTime())) return 'Recently placed';
      const diffMins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
      const timeOnly = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${timeOnly} (${diffMins}m ago)`;
    } catch {
      return 'Recently';
    }
  })();

  const totalBill = Number(currentOrder.total || currentOrder.totalAmount || 0);

  const drawerContent = (
    <>
      {/* Backdrop (visible on all screens to click outside and focus on drawer, z-40) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 transition-opacity cursor-pointer"
      />

      {/* Drawer Container (Right-side slide-over, z-50) */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] lg:w-[540px] bg-white border-l border-[#E3DED5] shadow-2xl flex flex-col text-left font-sans animate-in slide-in-from-right duration-200 pointer-events-auto"
      >
        {/* ── 1. Drawer Header ────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-[#F0ECE1] bg-[#FAF8F5] flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-[#183B2B] text-white flex items-center justify-center font-bold text-xs">
                  T{table.number}
                </span>
                <h2 className="font-bold text-base text-[#18201D] truncate leading-tight">
                  Table {table.number} — Order #{currentOrder.orderId.slice(-6)}
                </h2>
              </div>
              <p className="text-xs text-[#71717A] mt-1 font-medium">
                Ordered: {orderTimeStr} · <span className="font-bold text-[#18201D]">{itemsWithMeta.length} Items</span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 flex items-center justify-center transition-colors cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status & Bill Summary Line */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#E8E3DA]">
            <div className="flex items-center space-x-2">
              <span className={`text-[10.5px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                currentOrder.status === 'PARTIALLY_READY' ? 'bg-[#F5F0FD] text-[#7C3AED] border-[#E4D4FA]' :
                currentOrder.status === 'READY' ? 'bg-[#EAF6ED] text-[#16A34A] border-[#CDE9D5]' :
                currentOrder.status === 'PREPARING' ? 'bg-[#EAF3FD] text-[#2563EB] border-[#D0E2FB]' :
                currentOrder.status === 'SERVED' ? 'bg-stone-100 text-stone-700 border-stone-200' :
                'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {currentOrder.status === 'PARTIALLY_READY' ? '● PARTIALLY READY' : currentOrder.status}
              </span>

              {orders.length > 1 && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-md">
                  Round {orders.findIndex(o => o.orderId === currentOrder.orderId) + 1} of {orders.length}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs text-[#71717A] mr-1.5 font-medium">Bill Total:</span>
              <span className="font-extrabold text-sm text-[#18201D]">
                {formatPrice(totalBill)}
              </span>
            </div>
          </div>

          {/* Multi-round Switcher tabs (if table has add-on orders) */}
          {orders.length > 1 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto pt-1">
              {orders.map((ord, idx) => (
                <button
                  key={ord.orderId || ord.id || idx}
                  onClick={() => setSelectedOrderId(ord.orderId || ord.id || '')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    ord.orderId === currentOrder.orderId
                      ? 'bg-[#183B2B] text-white'
                      : 'bg-white text-stone-600 border border-[#E3DED5] hover:bg-stone-100'
                  }`}
                >
                  Round {idx + 1} (#{ord.orderId.slice(-4)})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 2. Top Summary KPI Cards ────────────────────────────── */}
        <div className="p-4 bg-white border-b border-[#F0ECE1] grid grid-cols-3 gap-2.5">
          {/* Card 1: Ready to Serve */}
          <div className="bg-[#EAF6ED] border border-[#CDE9D5] rounded-xl p-2.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-[#16A34A] tracking-wider">Ready to Serve</span>
              <ChefHat className="w-3.5 h-3.5 text-[#16A34A]" />
            </div>
            <div className="text-xl font-black text-[#16A34A] mt-1 leading-tight">
              {readyCount}
            </div>
            <div className="text-[9.5px] font-semibold text-[#16A34A]/80 mt-0.5">
              {readyCount > 0 ? 'Pick up & serve' : 'None waiting'}
            </div>
          </div>

          {/* Card 2: Served */}
          <div className="bg-[#FAF8F5] border border-[#E3DED5] rounded-xl p-2.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-[#71717A] tracking-wider">Served</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-stone-500" />
            </div>
            <div className="text-xl font-black text-[#18201D] mt-1 leading-tight">
              {servedCount}
            </div>
            <div className="text-[9.5px] font-semibold text-[#71717A] mt-0.5">
              At the table
            </div>
          </div>

          {/* Card 3: Cooking / Pending */}
          <div className="bg-[#FEF7EC] border border-[#FDE6B8] rounded-xl p-2.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-[#D97706] tracking-wider">Preparing</span>
              <Clock className="w-3.5 h-3.5 text-[#D97706]" />
            </div>
            <div className="text-xl font-black text-[#D97706] mt-1 leading-tight">
              {preparingCount + pendingCount}
            </div>
            <div className="text-[9.5px] font-semibold text-[#D97706]/80 mt-0.5">
              In kitchen
            </div>
          </div>
        </div>

        {/* ── 3. Drawer Navigation Tabs ────────────────────────────── */}
        <div className="px-4 pt-3 bg-white border-b border-[#F0ECE1] flex items-center space-x-2">
          {([
            { id: 'items',   label: `Order Items (${itemsWithMeta.length})`, Icon: Utensils },
            { id: 'details', label: 'Order Details',                        Icon: Info },
            { id: 'notes',   label: 'Notes & Timeline',                     Icon: FileText },
          ] as const).map(({ id, label, Icon }) => {
            const isActive = drawerTab === id;
            return (
              <button
                key={id}
                onClick={() => setDrawerTab(id)}
                className={`pb-2.5 px-2 font-bold text-xs flex items-center space-x-1.5 transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-[#183B2B] text-[#183B2B]'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 4. Tab Content Body ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F5]">
          {/* TAB 1: ORDER ITEMS */}
          {drawerTab === 'items' && (
            <div className="space-y-2.5">
              {/* Select All Ready Bar */}
              {readyCount > 0 && (
                <div className="bg-white border border-[#CDE9D5] rounded-xl p-2.5 px-3 flex items-center justify-between shadow-2xs">
                  <label className="flex items-center space-x-2 text-xs font-bold text-[#18201D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedItemIndices.size > 0 &&
                        selectedItemIndices.size === itemsWithMeta.filter(i => i.isEligibleToServe).length
                      }
                      onChange={handleToggleSelectAllReady}
                      className="w-4 h-4 rounded text-[#183B2B] focus:ring-[#183B2B] border-[#D1C9BC] cursor-pointer"
                    />
                    <span>Select All Ready Items ({readyCount})</span>
                  </label>

                  <span className="text-[11px] font-semibold text-[#16A34A]">
                    {selectedItemIndices.size} selected
                  </span>
                </div>
              )}

              {/* Individual Item Rows */}
              {itemsWithMeta.map((item) => {
                const isChecked = selectedItemIndices.has(item.originalIndex);

                return (
                  <div
                    key={item.originalIndex}
                    className={`p-3 rounded-2xl border transition-all ${
                      item.isAlreadyServed
                        ? 'bg-white/80 border-[#E8E3DA] opacity-85'
                        : item.isEligibleToServe
                        ? isChecked
                          ? 'bg-[#EAF6ED] border-[#16A34A] shadow-xs'
                          : 'bg-white border-[#CDE9D5] shadow-xs hover:border-[#16A34A]'
                        : 'bg-white border-[#E3DED5]'
                    }`}
                  >
                    {/* Line 1: Checkbox + Qty + Name */}
                    <div className="flex items-start space-x-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItemCheckbox(item.originalIndex)}
                        disabled={!item.isEligibleToServe}
                        className="mt-0.5 w-4 h-4 rounded text-[#183B2B] focus:ring-[#183B2B] border-[#D1C9BC] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        title={
                          item.isAlreadyServed
                            ? 'Item has already been served'
                            : !item.isEligibleToServe
                            ? 'Item is not ready yet in kitchen'
                            : 'Select to serve'
                        }
                      />

                      <span className="w-5 h-5 rounded-md bg-[#FAF8F5] border border-[#E3DED5] flex items-center justify-center text-xs font-bold text-[#18201D] shrink-0 mt-0.5">
                        {item.count}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            title={item.name}
                            className={`font-bold text-xs break-words ${
                              item.isAlreadyServed ? 'line-through text-stone-400' : 'text-[#18201D]'
                            }`}
                          >
                            {item.name}
                          </span>

                          <span className="text-xs font-semibold text-[#71717A] shrink-0 font-mono">
                            {formatPrice(Number(item.pricePerUnit || item.price || 0) * (item.count || 1))}
                          </span>
                        </div>

                        {item.notes && (
                          <p className="text-[10px] text-amber-700 italic mt-0.5">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Line 2: Course + Kitchen Status + Serving Status + Action */}
                    <div className="flex items-center justify-between gap-1.5 mt-2.5 pl-6 sm:pl-7 pt-2 border-t border-[#F0ECE1]">
                      {/* Left: Course & Kitchen Status */}
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="text-[10px] font-semibold text-stone-600 bg-[#FAF8F5] border border-[#E3DED5] px-1.5 py-0.2 rounded">
                          {item.course}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.kitchenStatus === 'READY' ? 'bg-[#EAF6ED] text-[#16A34A]' :
                          item.kitchenStatus === 'PREPARING' ? 'bg-[#EAF3FD] text-[#2563EB]' :
                          'bg-stone-100 text-stone-600'
                        }`}>
                          Kitchen: {item.kitchenStatus}
                        </span>
                      </div>

                      {/* Right: Serving Status & Serve Button */}
                      <div className="shrink-0 flex items-center space-x-1.5">
                        {item.isAlreadyServed ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>SERVED</span>
                          </span>
                        ) : item.isEligibleToServe ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                itemIndices: [item.originalIndex],
                                isServingAll: false,
                              });
                            }}
                            className="px-3 py-1 bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white font-bold text-[11px] rounded-lg shadow-xs flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <Utensils className="w-3 h-3" />
                            <span>Serve</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-semibold text-stone-400 italic">
                            Waiting for Kitchen
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: ORDER DETAILS */}
          {drawerTab === 'details' && (
            <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 space-y-3.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-[#F0ECE1]">
                <span className="font-bold text-stone-600">Order ID:</span>
                <span className="font-mono font-bold text-[#18201D]">#{currentOrder.orderId}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F0ECE1]">
                <span className="font-bold text-stone-600">Table:</span>
                <span className="font-bold text-[#18201D]">Table {table.number} ({table.section || 'Floor'})</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F0ECE1]">
                <span className="font-bold text-stone-600">Order Type:</span>
                <span className="font-bold text-[#18201D] capitalize">{currentOrder.orderType || 'Dine-In'}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F0ECE1]">
                <span className="font-bold text-stone-600">Customer:</span>
                <span className="font-bold text-[#18201D]">{currentOrder.customerName || table.customerName || 'Guest Diner'}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F0ECE1]">
                <span className="font-bold text-stone-600">Placed At:</span>
                <span className="font-medium text-[#18201D]">{orderTimeStr}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#F0ECE1]">
                <span className="font-bold text-stone-600">Assigned Server:</span>
                <span className="font-bold text-[#18201D]">{table.assignedWaiterName || currentOrder.waiterName || 'Unassigned'}</span>
              </div>

              <div className="flex justify-between items-center pt-1 text-sm font-bold">
                <span className="text-[#18201D]">Total Amount:</span>
                <span className="text-[#183B2B] text-base">{formatPrice(totalBill)}</span>
              </div>
            </div>
          )}

          {/* TAB 3: NOTES & TIMELINE */}
          {drawerTab === 'notes' && (
            <div className="space-y-3">
              {/* Customer Notes */}
              <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 text-xs space-y-1.5">
                <h4 className="font-bold text-[#18201D] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Customer Notes / Allergies</span>
                </h4>
                <p className="text-[#71717A] italic">
                  {currentOrder.notes || currentOrder.customerNotes || 'No special guest instructions.'}
                </p>
              </div>

              {/* Kitchen Notes */}
              <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 text-xs space-y-1.5">
                <h4 className="font-bold text-[#18201D] flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5 text-stone-600" />
                  <span>Internal Kitchen Notes</span>
                </h4>
                <p className="text-[#71717A] italic">
                  {currentOrder.kitchenNotes || 'No internal kitchen notes.'}
                </p>
              </div>

              {/* Timeline Events */}
              <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 text-xs space-y-2">
                <h4 className="font-bold text-[#18201D] flex items-center gap-1.5 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-stone-600" />
                  <span>Service Timeline Events</span>
                </h4>
                {currentOrder.timeline && currentOrder.timeline.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {currentOrder.timeline.map((event, idx) => (
                      <div key={idx} className="flex items-start space-x-2 text-[11px] pb-1.5 border-b border-[#F0ECE1] last:border-0">
                        <span className="w-2 h-2 rounded-full bg-[#183B2B] mt-1 shrink-0" />
                        <div>
                          <p className="font-bold text-[#18201D]">{event.title}</p>
                          {event.description && <p className="text-[#71717A] text-[10px]">{event.description}</p>}
                          <p className="text-[9.5px] text-stone-400 mt-0.5">
                            {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            {event.performedBy && ` · ${event.performedBy}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 italic">No timeline entries yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 5. Drawer Action Footer ─────────────────────────────── */}
        <div className="p-4 bg-white border-t border-[#E3DED5] flex flex-col gap-2">
          {readyCount > 0 ? (
            <div className="flex items-center space-x-2">
              {/* Serve Selected Items */}
              <button
                type="button"
                disabled={selectedItemIndices.size === 0 || isServing}
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    itemIndices: Array.from(selectedItemIndices),
                    isServingAll: false,
                  });
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#183B2B] hover:bg-[#122C20] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Serve Selected ({selectedItemIndices.size})</span>
              </button>

              {/* Serve All Ready Items */}
              <button
                type="button"
                disabled={isServing}
                onClick={() => {
                  const allReadyIndices = itemsWithMeta.filter(i => i.isEligibleToServe).map(i => i.originalIndex);
                  setConfirmDialog({
                    isOpen: true,
                    itemIndices: allReadyIndices,
                    isServingAll: true,
                  });
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Serve All Ready ({readyCount})</span>
              </button>
            </div>
          ) : servedCount === itemsWithMeta.length && itemsWithMeta.length > 0 ? (
            <div className="flex items-center space-x-2">
              <div className="flex-1 py-2 px-3 rounded-xl bg-[#EAF6ED] border border-[#CDE9D5] text-[#16A34A] font-bold text-xs flex items-center justify-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>All {itemsWithMeta.length} Dishes Served</span>
              </div>

              {onSettleBill && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSettleBill(currentOrder);
                  }}
                  className="py-2 px-4 rounded-xl bg-[#183B2B] hover:bg-[#122C20] text-white font-bold text-xs flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Settle Bill</span>
                </button>
              )}
            </div>
          ) : (
            <div className="py-2 px-3 rounded-xl bg-stone-100 text-stone-600 font-semibold text-xs text-center">
              Waiting for kitchen to complete remaining dishes ({preparingCount + pendingCount} cooking/pending)
            </div>
          )}
        </div>
      </aside>

      {/* ── Confirmation Modal Before Serving (z-[100] above drawer z-50) ──────────────────────── */}
      {confirmDialog.isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          {/* Modal Backdrop: z-[90] */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[90] transition-opacity cursor-pointer"
            onClick={() => {
              if (!isServing) {
                setConfirmDialog({ isOpen: false, itemIndices: [], isServingAll: false });
              }
            }}
          />

          {/* Modal Dialog Card: z-[100] with stopPropagation to prevent accidental closing */}
          <div
            className="relative z-[100] bg-white border border-[#E3DED5] rounded-2xl w-full max-w-sm sm:max-w-md shadow-2xl p-5 sm:p-6 text-left space-y-4 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#EAF6ED] text-[#16A34A] flex items-center justify-center shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => !isServing && setConfirmDialog({ isOpen: false, itemIndices: [], isServingAll: false })}
                className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 id="confirm-modal-title" className="font-bold text-base text-[#18201D] leading-tight">
                Confirm Food Serving
              </h3>
              <p className="text-xs text-[#71717A] mt-1">
                Are you sure you want to mark {confirmDialog.itemIndices.length} item(s) from Table {table.number} as served?
              </p>
            </div>

            {/* List of items being served */}
            <div className="bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
              {confirmDialog.itemIndices.map(idx => {
                const item = currentOrder.items[idx];
                return (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold text-[#18201D]">
                    <span className="truncate pr-2">{item?.name}</span>
                    <span className="text-[#71717A] text-[11px] font-mono shrink-0">×{item?.count || 1}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                ref={cancelButtonRef}
                onClick={() => !isServing && setConfirmDialog({ isOpen: false, itemIndices: [], isServingAll: false })}
                disabled={isServing}
                className="flex-1 py-2.5 rounded-xl border border-[#E3DED5] bg-white hover:bg-stone-50 disabled:opacity-40 font-bold text-xs text-[#71717A] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                ref={confirmButtonRef}
                onClick={() => !isServing && handleExecuteServe()}
                disabled={isServing}
                className="flex-1 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] active:scale-98 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                {isServing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>{isServing ? 'Serving...' : 'Confirm & Serve'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(drawerContent, document.body) : drawerContent;
};

export default WaiterOrderDetailsDrawer;
