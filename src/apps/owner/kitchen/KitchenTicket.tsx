import React, { useState, useEffect, useMemo } from 'react';
import { IKdsOrder, TPriority } from '../../../features/kitchen-dashboard/types';
import { TItemPreparationStatus, IOrderItem } from '../../../shared/domain/orders/types';
import { getElapsedSeconds, formatElapsedSeconds } from '../../../features/kitchen-dashboard/utils/kitchenMetrics';
import { inferCourseForItem, inferStationForItem } from '../../../shared/services/kitchenService';
import { kotPrintService } from '../../../shared/services/kotPrintService';
import { useAuth } from '../../../context/AuthContext';
import OrderTimeline from './OrderTimeline';
import toast from 'react-hot-toast';
import { 
  Utensils, 
  Clock, 
  Check, 
  Play, 
  Pause, 
  MoreHorizontal, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  User, 
  AlertCircle,
  XCircle,
  Sparkles
} from 'lucide-react';

export const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; topBorder: string }> = {
  NEW:           { label: 'NORMAL',    dot: 'bg-[#287A55]', text: 'text-[#287A55]', bg: 'bg-[#E8F3ED]', topBorder: 'border-t-[3px] border-t-[#287A55]' },
  PLACED:        { label: 'NORMAL',    dot: 'bg-[#287A55]', text: 'text-[#287A55]', bg: 'bg-[#E8F3ED]', topBorder: 'border-t-[3px] border-t-[#287A55]' },
  ACCEPTED:      { label: 'ACCEPTED',  dot: 'bg-[#D79A24]', text: 'text-[#D79A24]', bg: 'bg-[#F8EED8]', topBorder: 'border-t-[3px] border-t-[#D79A24]' },
  CHEF_ASSIGNED: { label: 'ASSIGNED',  dot: 'bg-[#D79A24]', text: 'text-[#D79A24]', bg: 'bg-[#F8EED8]', topBorder: 'border-t-[3px] border-t-[#D79A24]' },
  PREPARING:     { label: 'PREPARING', dot: 'bg-[#D79A24] animate-pulse', text: 'text-[#D79A24]', bg: 'bg-[#F8EED8]', topBorder: 'border-t-[3px] border-t-[#D79A24]' },
  PAUSED:        { label: 'PAUSED',    dot: 'bg-[#D79A24]', text: 'text-[#D79A24]', bg: 'bg-[#F8EED8]', topBorder: 'border-t-[3px] border-t-[#D79A24]' },
  READY:         { label: 'READY',     dot: 'bg-[#287A55]', text: 'text-[#287A55]', bg: 'bg-[#E8F3ED]', topBorder: 'border-t-[3px] border-t-[#287A55]' },
  PICKED_UP:     { label: 'ON WAY',    dot: 'bg-[#18201D]', text: 'text-[#18201D]', bg: 'bg-[#F7F4EE]', topBorder: 'border-t-[3px] border-t-[#18201D]' },
  DELIVERED:     { label: 'SERVED',    dot: 'bg-[#287A55]', text: 'text-[#287A55]', bg: 'bg-[#E8F3ED]', topBorder: 'border-t-[3px] border-t-[#287A55]' },
  SERVED:        { label: 'SERVED',    dot: 'bg-[#287A55]', text: 'text-[#287A55]', bg: 'bg-[#E8F3ED]', topBorder: 'border-t-[3px] border-t-[#287A55]' },
  COMPLETED:     { label: 'COMPLETED', dot: 'bg-[#5F6762]', text: 'text-[#5F6762]', bg: 'bg-[#F7F4EE]', topBorder: 'border-t-[3px] border-t-[#5F6762]' },
  ARCHIVED:      { label: 'ARCHIVED',  dot: 'bg-[#5F6762]', text: 'text-[#5F6762]', bg: 'bg-[#F7F4EE]', topBorder: 'border-t-[3px] border-t-[#5F6762]' },
  CANCELLED:     { label: 'CANCELLED', dot: 'bg-[#C7463A]', text: 'text-[#C7463A]', bg: 'bg-[#F9E8E4]', topBorder: 'border-t-[3px] border-t-[#C7463A]' },
};

export const NEXT_STATUS: Record<string, { label: string; next: string; bg: string; hover: string; text: string } | null> = {
  NEW:           { label: 'Accept Order',   next: 'ACCEPTED',  bg: 'bg-[#13241F]', hover: 'hover:bg-[#1A312B]', text: 'text-white' },
  PLACED:        { label: 'Accept Order',   next: 'ACCEPTED',  bg: 'bg-[#13241F]', hover: 'hover:bg-[#1A312B]', text: 'text-white' },
  ACCEPTED:      { label: '▶ Start Cooking',  next: 'PREPARING', bg: 'bg-[#C84A38]', hover: 'hover:bg-[#B23F2F]', text: 'text-white' },
  CHEF_ASSIGNED: { label: '▶ Start Cooking',  next: 'PREPARING', bg: 'bg-[#C84A38]', hover: 'hover:bg-[#B23F2F]', text: 'text-white' },
  PREPARING:     { label: '✓ Mark Ready',   next: 'READY',     bg: 'bg-[#D79A24]', hover: 'hover:bg-[#BF881F]', text: 'text-white' },
  READY:         null,
  PICKED_UP:     null,
  SERVED:        null,
  DELIVERED:     null,
  PAUSED:        null,
  COMPLETED:     null,
  ARCHIVED:      null,
  CANCELLED:     null,
};

interface IKitchenTicketProps {
  order: IKdsOrder;
  isSelected?: boolean;
  onToggleSelect?: (orderId: string) => void;
  onItemStatusUpdate: (orderId: string, itemIndex: number, nextStatus: TItemPreparationStatus) => void;
  onBulkItemStatusUpdate: (orderId: string, itemIndices: number[], nextStatus: TItemPreparationStatus) => void;
  onStatusUpdate: (orderId: string, nextStatus: string) => void;
  employees: any[];
  onAssignChef: (orderId: string, chefId: string, chefName: string) => void;
  onUnassignChef: (orderId: string) => void;
  onPauseOrder: (orderId: string, reason: string) => void;
  onResumeOrder: (orderId: string) => void;
  onRecallOrder: (orderId: string, reason: string) => void;
  onUpdateNotes: (orderId: string, noteType: 'kitchen' | 'chef', noteValue: string) => void;
  onUpdatePriority: (orderId: string, priority: TPriority) => void;
  menuItems?: any[];
}

export const KitchenTicket: React.FC<IKitchenTicketProps> = React.memo(({
  order,
  isSelected = false,
  onToggleSelect,
  onItemStatusUpdate,
  onBulkItemStatusUpdate,
  onStatusUpdate,
  employees,
  onAssignChef,
  onUnassignChef,
  onPauseOrder,
  onResumeOrder,
  onRecallOrder,
  onUpdateNotes,
  onUpdatePriority,
  menuItems = [],
}) => {
  const { user } = useAuth();
  const [selectedItemIndices, setSelectedItemIndices] = useState<Set<number>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Live seconds elapsed from creation
  const [elapsedSecs, setElapsedSecs] = useState(() => getElapsedSeconds(order.createdAt));
  useEffect(() => {
    const timer = setInterval(() => setElapsedSecs(getElapsedSeconds(order.createdAt)), 1000);
    return () => clearInterval(timer);
  }, [order.createdAt]);

  const elapsedMins = Math.floor(elapsedSecs / 60);

  // Derive status for each item (ensuring backward compatibility with legacy orders)
  const itemsWithMeta = useMemo(() => {
    return (order.items || []).map((item, idx) => {
      let rawStatus: TItemPreparationStatus = (item as any).status || (item as any).prepStatus;
      if (!rawStatus) {
        if (order.status === 'READY') rawStatus = 'READY';
        else if (order.status === 'PREPARING') rawStatus = 'PREPARING';
        else if (['DELIVERED', 'SERVED', 'COMPLETED'].includes(order.status)) rawStatus = 'SERVED';
        else rawStatus = 'NOT_STARTED';
      }

      const course = (item as any).course || inferCourseForItem(item.name, (item as any).category);
      const station = (item as any).station || inferStationForItem(item.name, (item as any).category);
      const prepTarget = (item as any).prepTimeMinutes || 12;

      // Calculate elapsed minutes for this specific item if preparing
      let itemElapsedMins = elapsedMins;
      if ((item as any).preparationStartedAt) {
        const itemSecs = getElapsedSeconds((item as any).preparationStartedAt);
        itemElapsedMins = Math.floor(itemSecs / 60);
      }

      return {
        ...item,
        resolvedStatus: rawStatus,
        course,
        station,
        prepTarget,
        itemElapsedMins,
        originalIndex: idx,
      };
    });
  }, [order.items, order.status, elapsedMins]);

  // Group items by course for the header pills
  const courseCounts = useMemo(() => {
    const map: Record<string, number> = {};
    itemsWithMeta.forEach(i => {
      map[i.course] = (map[i.course] || 0) + Number(i.count || 1);
    });
    return map;
  }, [itemsWithMeta]);

  // Check if order is critical / delayed
  const isDelayed = elapsedMins > (order.estimatedPrepTime || 15);
  const isPriority = order.priority === 'critical' || order.priority === 'high' || isDelayed;

  // Toggle selection for an individual item
  const toggleItemCheckbox = (index: number) => {
    setSelectedItemIndices(prev => {
      const copy = new Set(prev);
      if (copy.has(index)) copy.delete(index);
      else copy.add(index);
      return copy;
    });
  };

  // Determine context-sensitive footer action
  const selectedList = useMemo(() => {
    return itemsWithMeta.filter(i => selectedItemIndices.has(i.originalIndex));
  }, [itemsWithMeta, selectedItemIndices]);

  const activeNonServedItems = useMemo(() => {
    return itemsWithMeta.filter(i => i.resolvedStatus !== 'SERVED' && i.resolvedStatus !== 'CANCELLED');
  }, [itemsWithMeta]);

  const allActiveReady = activeNonServedItems.length > 0 && activeNonServedItems.every(i => i.resolvedStatus === 'READY');
  const preparingItems = itemsWithMeta.filter(i => i.resolvedStatus === 'PREPARING');
  const notStartedItems = itemsWithMeta.filter(i => i.resolvedStatus === 'NOT_STARTED');

  // Primary action button calculation
  const primaryButtonConfig = useMemo(() => {
    if (selectedList.length > 0) {
      const anyPreparing = selectedList.some(i => i.resolvedStatus === 'PREPARING');
      if (anyPreparing) {
        return {
          label: '✓ Mark Selected Ready',
          action: () => {
            const indicesToReady = selectedList
              .filter(i => i.resolvedStatus === 'PREPARING')
              .map(i => i.originalIndex);
            onBulkItemStatusUpdate(order.orderId, indicesToReady, 'READY');
            setSelectedItemIndices(new Set());
          },
        };
      }
      return {
        label: '▶ Start Selected Items',
        action: () => {
          const indicesToStart = selectedList
            .filter(i => i.resolvedStatus === 'NOT_STARTED' || i.resolvedStatus === 'ON_HOLD')
            .map(i => i.originalIndex);
          onBulkItemStatusUpdate(order.orderId, indicesToStart, 'PREPARING');
          setSelectedItemIndices(new Set());
        },
      };
    }

    if (allActiveReady) {
      return {
        label: '✓ Mark Order Served',
        action: () => {
          onStatusUpdate(order.orderId, 'SERVED');
        },
      };
    }

    if (preparingItems.length > 0) {
      return {
        label: '✓ Mark Selected Ready',
        action: () => {
          const indices = preparingItems.map(i => i.originalIndex);
          onBulkItemStatusUpdate(order.orderId, indices, 'READY');
        },
      };
    }

    if (notStartedItems.length > 0) {
      return {
        label: '▶ Start Next Item',
        action: () => {
          const firstPending = notStartedItems[0];
          onItemStatusUpdate(order.orderId, firstPending.originalIndex, 'PREPARING');
        },
      };
    }

    return {
      label: '✓ Mark Order Served',
      action: () => onStatusUpdate(order.orderId, 'SERVED'),
    };
  }, [selectedList, allActiveReady, preparingItems, notStartedItems, onBulkItemStatusUpdate, onItemStatusUpdate, onStatusUpdate, order.orderId]);

  // Thermal Print Handler
  const handlePrintKot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const effectiveTenant = order.tenantId || user?.tenantId;
    if (!effectiveTenant) {
      toast.error('Unable to resolve restaurant context.');
      return;
    }

    setIsPrinting(true);
    try {
      const ticketToPrint = {
        id: (order as any).kotId || `KOT-${order.orderId}`,
        ticketNumber: (order as any).ticketNumber || `KOT #${order.orderId.slice(-6)}`,
        tenantId: effectiveTenant,
        branchId: order.branchId || 'main',
        orderId: order.orderId,
        tableId: order.tableId,
        tableNumber: order.tableNumber || 'Walk-in',
        tableName: order.tableName,
        round: (order as any).kotRound || 1,
        isSupplementary: Boolean((order as any).isAdditionalOrder),
        items: order.items.map(i => ({
          itemId: i.itemId,
          name: i.name,
          count: i.count,
          notes: i.notes,
          station: (i as any).station || 'Main Kitchen',
          isVeg: i.isVeg,
        })),
        specialInstructions: order.notes || '',
        station: 'Main Kitchen',
        status: order.status as any,
        source: (order.orderSource as any) || 'customer_app',
        customerName: order.customerName,
        waiterName: order.waiterName,
        createdAt: order.createdAt,
        printStatus: (order as any).kotPrintStatus || 'unprinted',
        printCount: (order as any).kotPrintCount || 0,
      };

      const isReprint = Boolean((order as any).kotPrintCount && (order as any).kotPrintCount > 0);
      const res = await kotPrintService.printTicket(
        effectiveTenant,
        ticketToPrint as any,
        (order as any).restaurantName || 'SpiralDine Kitchen',
        { uid: user?.uid, displayName: user?.displayName || 'Chef' },
        isReprint
      );

      if (res.success) {
        toast.success(isReprint ? 'KOT Reprint triggered!' : 'KOT printed successfully!');
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err: any) {
      console.error('Print trigger failed:', err);
      toast.error('Failed to trigger KOT print.');
    } finally {
      setIsPrinting(false);
      setShowMoreMenu(false);
    }
  };

  // Header icon & background styling based on priority / table
  const headerIconTheme = useMemo(() => {
    if (isPriority) {
      return {
        bg: 'bg-[#FEECEC]',
        border: 'border-[#FCA5A5]',
        text: 'text-[#DC2626]',
      };
    }
    if (allActiveReady) {
      return {
        bg: 'bg-[#EAF7EE]',
        border: 'border-[#BBF7D0]',
        text: 'text-[#16A34A]',
      };
    }
    return {
      bg: 'bg-[#FEF5E7]',
      border: 'border-[#FDE68A]',
      text: 'text-[#D97706]',
    };
  }, [isPriority, allActiveReady]);

  return (
    <div className={`bg-white border rounded-2xl shadow-xs transition-all flex flex-col justify-between text-left relative overflow-hidden group hover:border-[#D1C9BC] ${
      isPriority ? 'border-red-200 ring-1 ring-red-100' : 'border-[#E3DED5]'
    }`}>
      {/* ── Card Header ────────────────────────────────────────── */}
      <div className="p-4 pb-3 border-b border-[#F0ECE1]">
        <div className="flex items-start justify-between gap-2">
          {/* Table Number & Order ID */}
          <div className="flex items-start space-x-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${headerIconTheme.bg} ${headerIconTheme.border} ${headerIconTheme.text}`}>
              <Utensils className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-[#18201D] truncate leading-tight">
                  Table {order.tableNumber || (order.tableId ? order.tableId.replace(/^TBL-/i, '') : 'Walk-in')}
                </h3>
                {((order as any).isAdditionalOrder || ((order as any).orderSequence && (order as any).orderSequence > 1)) && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md">
                    Add-on
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-[#71717A] truncate mt-0.5">
                # {order.orderId}
              </p>
            </div>
          </div>

          {/* Timer & Priority */}
          <div className="flex flex-col items-end shrink-0 space-y-1">
            <div className={`flex items-center space-x-1 text-xs font-semibold ${
              isDelayed ? 'text-red-600' : elapsedMins >= 10 ? 'text-amber-600' : 'text-emerald-700'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{elapsedMins} min</span>
            </div>

            {isPriority && (
              <span className="bg-[#DE3B3B] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider">
                Priority
              </span>
            )}
          </div>
        </div>

        {/* Course Group Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {Object.entries(courseCounts).map(([courseName, count]) => {
            let pillClass = 'bg-[#F4F4F5] text-[#52525B]';
            if (courseName.toLowerCase().includes('starter')) pillClass = 'bg-[#FEECEC] text-[#DC2626] border border-red-200';
            else if (courseName.toLowerCase().includes('main')) pillClass = 'bg-[#FEF5E7] text-[#D97706] border border-amber-200';
            else if (courseName.toLowerCase().includes('beverage') || courseName.toLowerCase().includes('drink')) pillClass = 'bg-[#EFF6FF] text-[#2563EB] border border-blue-200';
            else if (courseName.toLowerCase().includes('dessert')) pillClass = 'bg-[#FAF5FF] text-[#9333EA] border border-purple-200';

            return (
              <span
                key={courseName}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${pillClass}`}
              >
                {courseName} ({count})
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Items List ─────────────────────────────────────────── */}
      <div className="p-4 space-y-2 flex-1 overflow-y-auto max-h-[360px]">
        {itemsWithMeta.map((item) => {
          const isItemChecked = selectedItemIndices.has(item.originalIndex);
          const isItemReady = item.resolvedStatus === 'READY';
          const isItemPreparing = item.resolvedStatus === 'PREPARING';
          const isItemOnHold = item.resolvedStatus === 'ON_HOLD';
          const isItemServed = item.resolvedStatus === 'SERVED';
          const isItemCancelled = item.resolvedStatus === 'CANCELLED';

          return (
            <div
              key={item.originalIndex}
              className={`flex items-center justify-between gap-2 p-1.5 rounded-xl transition-colors ${
                isItemChecked ? 'bg-amber-50/50' : 'hover:bg-[#FAF8F5]'
              }`}
            >
              {/* Left: Checkbox + Qty + Name + Course/Notes */}
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={isItemChecked}
                  onChange={() => toggleItemCheckbox(item.originalIndex)}
                  disabled={isItemServed || isItemCancelled}
                  className="w-4 h-4 rounded text-[#183B2B] focus:ring-[#183B2B] border-[#D1C9BC] cursor-pointer"
                />

                <span className="w-5 h-5 rounded-md bg-[#FAF8F5] border border-[#E3DED5] flex items-center justify-center text-xs font-bold text-[#18201D] shrink-0">
                  {item.count}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-xs font-semibold truncate ${
                      isItemServed ? 'line-through text-stone-400' : 'text-[#18201D]'
                    }`}>
                      {item.name}
                    </span>

                    {/* Show course badge if mixed or main */}
                    {item.course && item.course !== 'Starters' && (
                      <span className="text-[9px] font-medium text-stone-500 bg-stone-100 px-1 rounded">
                        {item.course === 'Main Course' ? 'Main' : item.course}
                      </span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-[10px] text-amber-700 italic truncate">
                      "{item.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Item Status Pill & Quick Action Popover */}
              <div className="shrink-0">
                {isItemPreparing ? (
                  <button
                    onClick={() => onItemStatusUpdate(order.orderId, item.originalIndex, 'READY')}
                    title="Click to mark this item Ready"
                    className="bg-[#EAF3FD] hover:bg-[#DCEBFC] text-[#2563EB] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Preparing</span>
                    <Clock className="w-3 h-3 text-[#2563EB]" />
                    <span>{item.itemElapsedMins} min</span>
                  </button>
                ) : isItemReady ? (
                  <button
                    onClick={() => onItemStatusUpdate(order.orderId, item.originalIndex, 'PREPARING')}
                    title="Click to recall item to Preparing"
                    className="bg-[#EAF7EE] hover:bg-[#D5F2DD] text-[#16A34A] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span>Ready</span>
                  </button>
                ) : isItemOnHold ? (
                  <button
                    onClick={() => onItemStatusUpdate(order.orderId, item.originalIndex, 'PREPARING')}
                    title="Click to release and start preparing"
                    className="bg-[#FEF5E7] hover:bg-[#FDECC8] text-[#D97706] text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Pause className="w-3 h-3" />
                    <span>On Hold</span>
                  </button>
                ) : isItemServed ? (
                  <span className="bg-stone-100 text-stone-500 text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Served</span>
                  </span>
                ) : isItemCancelled ? (
                  <span className="bg-red-50 text-red-600 text-[11px] font-medium px-2.5 py-1 rounded-full">
                    Cancelled
                  </span>
                ) : (
                  <button
                    onClick={() => onItemStatusUpdate(order.orderId, item.originalIndex, 'PREPARING')}
                    title="Click to start preparing this item"
                    className="bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#71717A] text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Not Started</span>
                    <Clock className="w-3 h-3" />
                    <span>{item.prepTarget} min</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Customer & Kitchen Notes */}
        {(order.notes || order.kitchenNotes) && (
          <div className="pt-2 border-t border-[#F0ECE1] text-[11px] space-y-1">
            {order.notes && (
              <p className="text-amber-800 bg-amber-50/60 p-1.5 rounded-lg border border-amber-200/50">
                <span className="font-bold">Guest Note:</span> {order.notes}
              </p>
            )}
            {order.kitchenNotes && (
              <p className="text-[#5F6762] italic">
                <span className="font-semibold">Kitchen Note:</span> {order.kitchenNotes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Timeline Drawer (Collapsible) ──────────────────────── */}
      {showTimeline && (
        <div className="p-3 bg-[#FAF8F5] border-t border-[#E3DED5] max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">
              Order Timeline
            </span>
            <button
              onClick={() => setShowTimeline(false)}
              className="text-[10px] text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <OrderTimeline timeline={order.timeline || []} compact />
        </div>
      )}

      {/* ── Card Footer ────────────────────────────────────────── */}
      <div className="p-3 bg-[#FAF8F5] border-t border-[#E3DED5] flex items-center space-x-2">
        {/* Context-Sensitive Primary Button */}
        <button
          onClick={primaryButtonConfig.action}
          className="flex-1 bg-[#183B2B] hover:bg-[#132E22] active:scale-[0.99] text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          <span>{primaryButtonConfig.label}</span>
        </button>

        {/* More Actions Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(m => !m)}
            className="w-10 h-10 rounded-xl border border-[#E3DED5] bg-white hover:bg-stone-50 text-[#71717A] hover:text-[#18201D] flex items-center justify-center transition-colors cursor-pointer"
            title="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* More Actions Dropdown */}
          {showMoreMenu && (
            <div className="absolute right-0 bottom-full mb-1 w-48 bg-white border border-[#E3DED5] rounded-xl shadow-lg p-1.5 z-30 space-y-0.5 text-xs">
              <button
                type="button"
                onClick={handlePrintKot}
                disabled={isPrinting}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] flex items-center space-x-2 text-[#18201D] font-medium"
              >
                <Printer className="w-3.5 h-3.5 text-stone-600" />
                <span>{isPrinting ? 'Printing...' : 'Print KOT Ticket'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowTimeline(t => !t);
                  setShowMoreMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] flex items-center space-x-2 text-[#18201D] font-medium"
              >
                <Clock className="w-3.5 h-3.5 text-stone-600" />
                <span>View Timeline ({order.timeline?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const note = prompt('Add kitchen internal note:', order.kitchenNotes || '');
                  if (note !== null) onUpdateNotes(order.orderId, 'kitchen', note);
                  setShowMoreMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] flex items-center space-x-2 text-[#18201D] font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 text-stone-600" />
                <span>Add Kitchen Note</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextPrio = order.priority === 'critical' ? 'normal' : 'critical';
                  onUpdatePriority(order.orderId, nextPrio);
                  setShowMoreMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5] flex items-center space-x-2 text-[#18201D] font-medium"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span>Toggle Priority</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Cancel this entire order?')) {
                    onStatusUpdate(order.orderId, 'CANCELLED');
                  }
                  setShowMoreMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 flex items-center space-x-2 text-red-600 font-medium"
              >
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span>Cancel Order</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

KitchenTicket.displayName = 'KitchenTicket';

export default KitchenTicket;
