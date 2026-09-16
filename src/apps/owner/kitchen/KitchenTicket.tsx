import React, { useEffect, useState } from 'react';
import { IKdsOrder, TPriority } from '../../../features/kitchen-dashboard/types';
import {
  getElapsedSeconds,
  formatElapsedSeconds,
} from '../../../features/kitchen-dashboard/utils/kitchenMetrics';
import { isKitchenStaffRole, filterKitchenStaff } from '../../../shared/services/kitchenService';
import OrderTimeline from './OrderTimeline';
import { 
  Check, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Clock, 
  MapPin, 
  Truck, 
  UtensilsCrossed, 
  AlertTriangle,
  Flame,
  Pause,
  RotateCcw
} from 'lucide-react';

// ─── Status Configuration (Restrained Semantic System) ─────────────────────────

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

/**
 * Smart Order Lifecycle — Primary operational actions
 */
export const NEXT_STATUS: Record<string, { label: string; next: string; bg: string; hover: string; text: string } | null> = {
  NEW:           { label: 'Accept Order',   next: 'ACCEPTED',  bg: 'bg-[#13241F]', hover: 'hover:bg-[#1A312B]', text: 'text-white' },
  PLACED:        { label: 'Accept Order',   next: 'ACCEPTED',  bg: 'bg-[#13241F]', hover: 'hover:bg-[#1A312B]', text: 'text-white' },
  ACCEPTED:      { label: '▶ Start Cooking',  next: 'PREPARING', bg: 'bg-[#C84A38]', hover: 'hover:bg-[#B23F2F]', text: 'text-white' },
  CHEF_ASSIGNED: { label: '▶ Start Cooking',  next: 'PREPARING', bg: 'bg-[#C84A38]', hover: 'hover:bg-[#B23F2F]', text: 'text-white' },
  PREPARING:     { label: '✓ Mark Ready',   next: 'READY',     bg: 'bg-[#D79A24]', hover: 'hover:bg-[#BF881F]', text: 'text-white' },
  READY:         null, // Kitchen preparation ends at READY. Food serving is handled by Waiter.
  PICKED_UP:     null,
  SERVED:        null,
  DELIVERED:     null,
  PAUSED:        null,
  COMPLETED:     null,
  ARCHIVED:      null,
  CANCELLED:     null,
};

const CUSTOMER_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  'dine-in':  { label: 'Dine-In',  icon: <UtensilsCrossed className="w-2.5 h-2.5" /> },
  'takeaway': { label: 'Takeaway', icon: <MapPin className="w-2.5 h-2.5" /> },
  'delivery': { label: 'Delivery', icon: <Truck className="w-2.5 h-2.5" /> },
};

// ─── Calm Operational Timer ───────────────────────────────────────────────────

const OperationalTimer: React.FC<{ createdAt: string; estimatedMinutes: number }> = ({ createdAt, estimatedMinutes }) => {
  const [seconds, setSeconds] = useState(getElapsedSeconds(createdAt));

  useEffect(() => {
    const interval = setInterval(() => setSeconds(getElapsedSeconds(createdAt)), 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const elapsedMinutes = seconds / 60;
  const remainingSeconds = Math.max(0, (estimatedMinutes * 60) - seconds);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const isOverdue = elapsedMinutes > estimatedMinutes;

  return (
    <div className="flex flex-col items-end text-right">
      <span className="font-mono font-bold text-sm text-[#18201D] tracking-tight tabular-nums">
        {formatElapsedSeconds(seconds)}
      </span>
      {remainingSeconds > 0 ? (
        <span className="text-[11px] text-[#6F746F] font-medium">
          {remainingMinutes} min left
        </span>
      ) : (
        <span className="text-[11px] text-[#C7463A] font-bold flex items-center space-x-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Delayed</span>
        </span>
      )}
    </div>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface IKitchenTicketProps {
  order: IKdsOrder;
  isSelected: boolean;
  onToggleSelect: (orderId: string) => void;
  onStatusUpdate: (orderId: string, nextStatus: string) => void;
  showBulkSelect: boolean;
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

// ─── Component ────────────────────────────────────────────────────────────────

export const KitchenTicket: React.FC<IKitchenTicketProps> = React.memo(({
  order,
  isSelected,
  onToggleSelect,
  onStatusUpdate,
  showBulkSelect,
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
  const [timelineOpen, setTimelineOpen] = useState(false);

  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG['NEW'];
  const nextConf = NEXT_STATUS[order.status];
  const priority = order.priority || 'normal';
  const estimatedPrep = order.estimatedPrepTime || order.items.length * 5;
  const hasTimeline = (order.timeline?.length ?? 0) > 0;
  const rawType = (order as any).customerType || (order as any).orderType || 'dine-in';
  const customerType = rawType === 'dine_in' ? 'dine-in' : rawType;
  const customerTypeConf = CUSTOMER_TYPE_CONFIG[customerType] || CUSTOMER_TYPE_CONFIG['dine-in'];

  // Needs chef assignment before cooking
  const needsChefAssignment = (order.status === 'ACCEPTED' || order.status === 'CHEF_ASSIGNED') && !order.assignedChefName;

  // Kitchen-eligible staff members (role filtered)
  const kitchenStaff = React.useMemo(
    () => filterKitchenStaff(employees),
    [employees]
  );

  // Safe validation check for existing historical assignments
  const assignedStaffMember = React.useMemo(() => {
    if (!order.assignedChefId) return null;
    return employees.find(e => e.id === order.assignedChefId);
  }, [order.assignedChefId, employees]);

  const isAssignedValidKitchenStaff = React.useMemo(() => {
    if (!order.assignedChefId || !assignedStaffMember) return true;
    return isKitchenStaffRole(assignedStaffMember.role);
  }, [order.assignedChefId, assignedStaffMember]);

  return (
    <div
      className={`bg-white border border-[#E3DED5] rounded-xl shadow-[0_2px_10px_rgba(30,30,20,0.06)] overflow-hidden flex flex-col justify-between transition-all text-left font-sans hover:border-[#D1C9BC] ${
        statusConf.topBorder
      } ${isSelected ? 'ring-2 ring-[#C84A38]' : ''}`}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="p-4 pb-3 border-b border-[#E3DED5] bg-white">
        <div className="flex items-start justify-between gap-2">
          
          <div className="flex items-start space-x-2.5 min-w-0">
            {showBulkSelect && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect(order.orderId); }}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                  isSelected
                    ? 'bg-[#13241F] border-[#13241F] text-white'
                    : 'bg-white border-[#D1C9BC] hover:border-[#13241F]'
                }`}
                title="Select Ticket"
              >
                {isSelected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
              </button>
            )}

            <div className="min-w-0">
              {/* Table Number & Order Type */}
              <div className="flex flex-wrap items-center gap-1.5 leading-none">
                <span className="font-serif font-bold text-base text-[#18201D] tracking-tight">
                  Table {order.tableNumber || (order.tableId ? order.tableId.replace(/^TBL-/i, '') : 'Walk-in')}
                </span>
                
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#F7F4EE] border border-[#E3DED5] text-[10px] font-semibold text-[#6F746F]">
                  {customerTypeConf.icon}
                  <span>{customerTypeConf.label}</span>
                </span>

                {((order as any).isAdditionalOrder || ((order as any).orderSequence && (order as any).orderSequence > 1)) && (
                  <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-[#FEF7EC] border border-[#D79A24]/30 text-[#D79A24] text-[9px] font-bold uppercase tracking-wider">
                    <span>⚡ Add-on #{((order as any).orderSequence) || 2}</span>
                  </span>
                )}
              </div>

              {/* Order ID */}
              <div className="text-[11px] font-mono text-[#6F746F] mt-1 truncate">
                # {order.orderId}
              </div>
            </div>
          </div>

          {/* Time & Duration */}
          <OperationalTimer createdAt={order.createdAt} estimatedMinutes={estimatedPrep} />
        </div>

        {/* Status Line + Priority + Waiter */}
        <div className="flex items-center justify-between flex-wrap gap-2 mt-3 pt-2.5 border-t border-[#F7F4EE]">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${statusConf.dot}`} />
            <span className={`text-[11px] font-bold tracking-wider uppercase ${statusConf.text}`}>
              {statusConf.label}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px]">
            {order.waiterName && (
              <span className="text-[#6F746F] font-medium truncate max-w-[90px]" title={`Waiter: ${order.waiterName}`}>
                🤵 {order.waiterName}
              </span>
            )}

            {/* Priority Selector */}
            <select
              value={priority}
              onChange={(e) => {
                e.stopPropagation();
                onUpdatePriority(order.orderId, e.target.value as TPriority);
              }}
              className="text-[10px] font-semibold text-[#18201D] bg-[#F7F4EE] border border-[#E3DED5] rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-[#D1C9BC]"
            >
              <option value="critical">💥 Critical</option>
              <option value="high">🔴 High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Assigned Chef Indicator / Selector */}
        <div className="mt-2 text-[11px]">
          {order.assignedChefName ? (
            <div className={`flex items-center justify-between px-2 py-1 rounded-md border ${
              isAssignedValidKitchenStaff
                ? 'bg-[#F7F4EE] border-[#E3DED5]'
                : 'bg-[#FEF5E7] border-[#D79A24]/50'
            }`}>
              <div className="flex items-center space-x-1 text-[#18201D] font-medium truncate">
                <User className={`w-3 h-3 ${isAssignedValidKitchenStaff ? 'text-[#6F746F]' : 'text-[#D79A24]'}`} />
                <span>Chef {order.assignedChefName}</span>
                {!isAssignedValidKitchenStaff && (
                  <span className="ml-1 text-[9px] font-bold text-[#D79A24] bg-[#FEF7EC] px-1 py-0.5 rounded border border-[#D79A24]/30" title="Assigned staff member is not configured as kitchen staff">
                    Reassign (Non-Kitchen)
                  </span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUnassignChef(order.orderId); }}
                className="text-[10px] text-[#C7463A] hover:underline font-bold uppercase"
              >
                Change
              </button>
            </div>
          ) : (
            <select
              value=""
              onChange={(e) => {
                const chef = kitchenStaff.find(emp => emp.id === e.target.value);
                if (chef) onAssignChef(order.orderId, chef.id, chef.fullName);
              }}
              className="w-full text-[11px] bg-[#F7F4EE] border border-[#E3DED5] rounded px-2 py-1 text-[#6F746F] outline-none cursor-pointer"
            >
              <option value="" disabled>Assign Chef...</option>
              {kitchenStaff.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Items List ────────────────────────────────────────────────── */}
      <div className="p-4 flex-1 space-y-2">
        {order.items.map((item, idx) => {
          const menuItem = menuItems?.find(mi => mi.id === item.itemId);
          const isBatch = menuItem?.preparationMethod === 'batch' || menuItem?.productionMode === 'Batch Production';
          const available = menuItem?.availableServings ?? 0;

          return (
            <div key={idx} className="flex flex-col space-y-0.5">
              <div className="flex items-start text-xs text-[#18201D]">
                {/* Quantity: Small light warm box */}
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#FBF9F5] border border-[#E3DED5] font-bold text-xs text-[#18201D] shrink-0 mr-2.5 mt-0.5 shadow-none">
                  {item.count}
                </span>

                {/* Name & details */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[#18201D] text-[13px] leading-tight">
                    {item.name}
                  </span>
                  
                  {isBatch && (
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-[#F8EED8] text-[#D79A24] border border-[#D79A24]/30 font-bold uppercase tracking-wider">
                      Batch ({available} left)
                    </span>
                  )}

                  {item.notes && (
                    <p className="text-xs text-[#D79A24] italic mt-0.5">
                      "{item.notes}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Subtle Information Section (Notes & Timeline) ────────────── */}
        <div className="mt-3 pt-2.5 border-t border-[#E3DED5] text-[11px] space-y-1">
          {order.notes && (
            <div className="text-[#D79A24] italic">
              <span className="text-[#5F6762] font-medium">Customer Note:</span> {order.notes}
            </div>
          )}

          {/* Kitchen Note */}
          <div className="flex items-baseline justify-between group/note">
            <span className="truncate pr-2">
              <span className="text-[#5F6762] font-semibold">Kitchen Note — </span>
              <span className="text-[#39423D]">{order.kitchenNotes || '—'}</span>
            </span>
            <button
              onClick={() => {
                const note = prompt('Enter Internal Kitchen Note:', order.kitchenNotes || '');
                if (note !== null) onUpdateNotes(order.orderId, 'kitchen', note);
              }}
              className="text-[10px] text-[#C84A38] opacity-0 group-hover/note:opacity-100 font-bold hover:underline shrink-0"
            >
              Edit
            </button>
          </div>

          {/* Chef Note */}
          <div className="flex items-baseline justify-between group/chefnote">
            <span className="truncate pr-2">
              <span className="text-[#5F6762] font-semibold">Chef Note — </span>
              <span className="text-[#39423D]">{order.chefNotes || '—'}</span>
            </span>
            <button
              onClick={() => {
                const note = prompt('Enter Internal Chef Note:', order.chefNotes || '');
                if (note !== null) onUpdateNotes(order.orderId, 'chef', note);
              }}
              className="text-[10px] text-[#C84A38] opacity-0 group-hover/chefnote:opacity-100 font-bold hover:underline shrink-0"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* ── Timeline Toggle ───────────────────────────────────────────── */}
      <div className="px-4">
        <button
          onClick={() => setTimelineOpen(o => !o)}
          className="w-full flex items-center justify-between py-2 text-[11px] font-medium text-[#5F6762] hover:text-[#18201D] transition-colors border-t border-[#E3DED5]"
        >
          <span>
            {hasTimeline
              ? `${order.timeline!.length} events in timeline`
              : 'Timeline (no events yet)'}
          </span>
          {timelineOpen ? <ChevronUp className="w-3 h-3 text-[#5F6762]" /> : <ChevronDown className="w-3 h-3 text-[#5F6762]" />}
        </button>

        {timelineOpen && (
          <div className="pb-3 pt-1 border-t border-[#F7F4EE]">
            <OrderTimeline timeline={order.timeline || []} compact />
          </div>
        )}
      </div>

      {/* ── Operational Action Buttons ─────────────────────────────────── */}
      <div className="p-4 pt-2 bg-[#F7F4EE]/50 border-t border-[#E3DED5]">
        {order.status === 'PAUSED' ? (
          <div className="flex flex-col gap-2">
            <div className="bg-[#FEF7EC] border border-[#D79A24]/30 text-[#D79A24] rounded-lg p-2 text-xs italic">
              ⏸️ PAUSED: {order.pauseReason || 'No reason specified'}
            </div>
            <button
              onClick={() => onResumeOrder(order.orderId)}
              className="w-full h-10 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#287A55] hover:bg-[#206345] text-white transition-all flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <span>▶ Resume Cooking</span>
            </button>
          </div>

        ) : needsChefAssignment ? (
          <div className="flex flex-col gap-2">
            <select
              value=""
              onChange={(e) => {
                const chef = kitchenStaff.find(emp => emp.id === e.target.value);
                if (chef) onAssignChef(order.orderId, chef.id, chef.fullName);
              }}
              className="w-full h-10 rounded-lg text-xs font-bold bg-[#FEF7EC] border border-[#D79A24]/40 text-[#D79A24] px-3 outline-none cursor-pointer"
            >
              <option value="" disabled>Select Chef to Assign...</option>
              {kitchenStaff.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
            <button
              onClick={() => onStatusUpdate(order.orderId, 'PREPARING')}
              className="w-full py-1.5 rounded-lg text-[11px] font-semibold text-[#6F746F] hover:text-[#18201D] bg-white border border-[#E3DED5] transition-all"
            >
              Skip Assignment → Start Cooking
            </button>
          </div>

        ) : nextConf ? (
          <div className="flex flex-col gap-2">
            {/* Primary Action Button */}
            <button
              onClick={() => onStatusUpdate(order.orderId, nextConf.next)}
              className={`w-full h-10 rounded-lg text-xs font-bold uppercase tracking-wider ${nextConf.bg} ${nextConf.hover} ${nextConf.text} transition-all flex items-center justify-center space-x-1.5 shadow-sm active:scale-[0.99]`}
            >
              <Check className="w-4 h-4" strokeWidth={2.5} />
              <span>{nextConf.label}</span>
            </button>

            {/* Secondary Actions */}
            {order.status === 'PREPARING' && (
              <button
                onClick={() => {
                  const reason = prompt('Enter reason to Pause cooking this order:', 'Waiting for ingredients');
                  if (reason !== null) onPauseOrder(order.orderId, reason || 'General Pause');
                }}
                className="w-full py-2 rounded-lg text-[11px] font-semibold text-[#18201D] bg-white hover:bg-[#F7F4EE] border border-[#E3DED5] transition-all cursor-pointer"
              >
                Ⅱ Pause Cooking
              </button>
            )}
          </div>
        ) : order.status === 'READY' ? (
          <div className="flex flex-col gap-2">
            <div className="w-full py-2.5 bg-[#E8F3ED] border border-[#287A55]/30 rounded-lg text-center text-xs font-bold text-[#287A55] flex items-center justify-center space-x-1.5 select-none">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
              <span>Ready · Awaiting Waiter Service</span>
            </div>
            <button
              onClick={() => {
                const reason = prompt('Enter return reason to recall order:', 'Needs Garnish');
                if (reason !== null) onRecallOrder(order.orderId, reason || 'Needs Attention');
              }}
              className="w-full py-2 rounded-lg text-[11px] font-bold text-[#C7463A] bg-[#F9E8E4] hover:bg-[#F2D7D2] border border-[#E3DED5] transition-all tracking-wider flex items-center justify-center space-x-1 cursor-pointer"
            >
              <span>⚠ Recall to Preparing</span>
            </button>
          </div>

        ) : (
          <button
            disabled
            className="w-full h-10 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#F7F4EE] text-[#6F746F] border border-[#E3DED5] cursor-not-allowed flex items-center justify-center space-x-1.5"
          >
            <span>Completed</span>
          </button>
        )}
      </div>
    </div>
  );
});

KitchenTicket.displayName = 'KitchenTicket';

export default KitchenTicket;
