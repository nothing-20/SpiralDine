import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Clock, 
  Receipt, 
  Utensils, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  QrCode, 
  Printer, 
  Download, 
  Edit2, 
  Trash2, 
  CreditCard,
  UserCheck,
  Calendar,
  Layers
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import Button from '../../../../components/ui/Button/Button';
import Badge from '../../../../components/ui/Badge/Badge';
import { ITableItem } from '../../pages/OwnerTablesManager';
import { formatPrice } from '../../../../utils/format';
import { tableService } from '../../../../shared/services/tableService';
import toast from 'react-hot-toast';

interface TableDetailsDrawerProps {
  isOpen: boolean;
  table: ITableItem | null;
  tenantId: string;
  onClose: () => void;
  onEditTable: (table: ITableItem) => void;
  onShowQrModal: (table: ITableItem) => void;
  onPrintQr: (table: ITableItem) => void;
  onDownloadQr: (table: ITableItem) => void;
  onRefreshTable?: () => void;
}

export const TableDetailsDrawer: React.FC<TableDetailsDrawerProps> = ({
  isOpen,
  table,
  tenantId,
  onClose,
  onEditTable,
  onShowQrModal,
  onPrintQr,
  onDownloadQr,
  onRefreshTable
}) => {
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Quick Walk-in Seating Modal state
  const [isSeatModalOpen, setIsSeatModalOpen] = useState(false);
  const [guestCount, setGuestCount] = useState<number>(table?.capacity || 2);
  const [guestName, setGuestName] = useState<string>('');

  // Fetch active order details when an occupied table is selected
  useEffect(() => {
    if (!isOpen || !table || !tenantId) {
      setActiveOrder(null);
      return;
    }

    const orderId = (table as any).activeOrderId || (table as any).currentOrderId;
    if (orderId) {
      setIsLoadingOrder(true);
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
      getDoc(orderRef).then(snap => {
        if (snap.exists()) {
          setActiveOrder({ id: snap.id, ...snap.data() });
        } else {
          setActiveOrder(null);
        }
      }).catch(err => {
        console.warn('[TableDetailsDrawer] Order fetch note:', err);
        setActiveOrder(null);
      }).finally(() => {
        setIsLoadingOrder(false);
      });
    } else {
      setActiveOrder(null);
    }
  }, [isOpen, table, tenantId]);

  if (!isOpen || !table) return null;

  // Status Color & Label helper
  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'occupied' || s === 'dining' || s === 'bill requested' || s === 'ordering' || s === 'preparing') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FBEAE5] text-[#C9533B] border border-[#F5CBC4]">
          Occupied
        </span>
      );
    }
    if (s === 'reserved') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FFF4DC] text-[#9A6200] border border-[#FDE6B0]">
          Reserved
        </span>
      );
    }
    if (s === 'cleaning' || s === 'sanitizing') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#EAF2FB] text-[#1D5D9B] border border-[#CBE0F7]">
          Cleaning
        </span>
      );
    }
    if (s === 'disabled' || s === 'maintenance') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#F0F2F0] text-[#5F675F] border border-[#D8DDD6]">
          Disabled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#E8F5EF] text-[#16845B] border border-[#C6E7D8]">
        Available
      </span>
    );
  };

  // Status Handlers
  const handleSetCleaning = async () => {
    if (!tenantId || !table) return;
    setIsUpdatingStatus(true);
    try {
      await tableService.setTableCleaning(tenantId, table.id);
      toast.success(`Table #${table.tableNumber} marked for cleaning.`);
      if (onRefreshTable) onRefreshTable();
      onClose();
    } catch (err) {
      toast.error('Failed to update table status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSetAvailable = async () => {
    if (!tenantId || !table) return;
    setIsUpdatingStatus(true);
    try {
      await tableService.setTableAvailable(tenantId, table.id);
      toast.success(`Table #${table.tableNumber} is now Available.`);
      if (onRefreshTable) onRefreshTable();
      onClose();
    } catch (err) {
      toast.error('Failed to reset table.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSeatWalkIn = async () => {
    if (!tenantId || !table) return;
    setIsUpdatingStatus(true);
    try {
      await tableService.updateTableStatusDirect(tenantId, table.id, 'Occupied', {
        guestsCount: Number(guestCount) || 2,
        customerName: guestName.trim() || 'Walk-in Guest',
        seatingTime: new Date().toISOString()
      });
      toast.success(`Table #${table.tableNumber} seated with ${guestCount} guests.`);
      setIsSeatModalOpen(false);
      if (onRefreshTable) onRefreshTable();
      onClose();
    } catch (err) {
      toast.error('Failed to seat table.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!tenantId || !table) return;
    setIsUpdatingStatus(true);
    const nextStatus = table.status === 'Disabled' ? 'Available' : 'Disabled';
    try {
      await tableService.updateTableStatusDirect(tenantId, table.id, nextStatus, {
        isActive: nextStatus !== 'Disabled'
      });
      toast.success(`Table #${table.tableNumber} set to ${nextStatus}.`);
      if (onRefreshTable) onRefreshTable();
      onClose();
    } catch (err) {
      toast.error('Failed to toggle status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Seating duration elapsed
  const seatedTimeStr = (table as any).seatingTime || (table as any).seatedAt || (table as any).occupiedAt;
  const elapsedMinutes = seatedTimeStr 
    ? Math.max(0, Math.floor((Date.now() - new Date(seatedTimeStr).getTime()) / 60000))
    : 0;

  return (
    <>
      {/* ── Mobile/Tablet Backdrop Overlay (allows tapping outside to dismiss) ── */}
      <div 
        className="fixed inset-0 top-16 bg-black/25 backdrop-blur-[2px] z-30 lg:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-label="Close table details drawer"
      />

      <div className="fixed top-16 bottom-0 right-0 z-40 w-full sm:w-[420px] bg-white border-l border-[#D8DDD6] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 select-none text-left">
        {/* ── Drawer Header ── */}
        <div className="p-4 sm:p-5 border-b border-[#D8DDD6] bg-[#FAF8F4] flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-[#12352D] text-white text-xs font-bold font-mono">
                #{table.tableNumber}
              </span>
              <h2 className="text-lg font-serif font-bold text-[#202820]">
                {table.tableName || `Table ${table.tableNumber}`}
              </h2>
            </div>
            <p className="text-xs text-[#5F675F] mt-1">
              {table.floor} &middot; {table.section} &middot; {table.capacity} Person Seating
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {getStatusBadge(table.status)}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#5F675F] hover:text-[#202820] hover:bg-white border border-transparent hover:border-[#D8DDD6] transition-colors cursor-pointer"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

      {/* ── Drawer Content Body ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Seating & Dining Metric Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[#FAF8F4] border border-[#D8DDD6] space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F] flex items-center space-x-1">
              <Users className="w-3 h-3 text-[#167647]" />
              <span>Diners</span>
            </span>
            <p className="font-extrabold text-[#202820] text-sm">
              {(table as any).guestsCount || (table.status === 'Occupied' ? table.capacity : 0)} / {table.capacity}
            </p>
            <p className="text-[10px] text-[#5F675F] truncate">
              {(table as any).customerName || 'No guest assigned'}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF8F4] border border-[#D8DDD6] space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F] flex items-center space-x-1">
              <Clock className="w-3 h-3 text-[#D94F2B]" />
              <span>Elapsed</span>
            </span>
            <p className="font-extrabold text-[#202820] text-sm">
              {table.status === 'Occupied' && elapsedMinutes > 0 ? `${elapsedMinutes} mins` : '—'}
            </p>
            <p className="text-[10px] text-[#5F675F]">
              {table.status === 'Occupied' ? 'Dining in progress' : 'Idle / Available'}
            </p>
          </div>
        </div>

        {/* ── Active Order & Bill Inspector ── */}
        {table.status === 'Occupied' && (
          <div className="p-4 rounded-2xl bg-[#FAF8F4] border border-[#D8DDD6] space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#D8DDD6] pb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F] flex items-center space-x-1.5">
                <Receipt className="w-3.5 h-3.5 text-[#167647]" />
                <span>Active Table Order</span>
              </span>
              {activeOrder && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#167647] border border-[#A6E1C4]">
                  {activeOrder.status || 'PLACED'}
                </span>
              )}
            </div>

            {isLoadingOrder ? (
              <p className="text-xs text-[#5F675F] py-2 italic text-center">Loading live order...</p>
            ) : activeOrder ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[#5F675F] font-bold">
                    #{activeOrder.orderId?.slice(-6) || activeOrder.id?.slice(-6)}
                  </span>
                  <span className="font-extrabold text-sm text-[#202820]">
                    {formatPrice(activeOrder.total || activeOrder.orderTotal || 0)}
                  </span>
                </div>
                <p className="text-[11px] text-[#5F675F]">
                  {activeOrder.items?.length || 1} items ordered &middot; Placed {new Date(activeOrder.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>

                {/* Items preview */}
                {activeOrder.items && activeOrder.items.length > 0 && (
                  <div className="pt-2 border-t border-[#D8DDD6] space-y-1 max-h-36 overflow-y-auto">
                    {activeOrder.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px] text-[#202820]">
                        <span className="font-medium truncate max-w-[200px]">{item.count || item.quantity || 1}× {item.name}</span>
                        <span className="font-mono font-bold">{formatPrice((item.pricePerUnit || item.price || 0) * (item.count || item.quantity || 1))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-2 text-center text-[#5F675F]">
                <p className="text-xs font-semibold">Table seated via digital QR</p>
                <p className="text-[10px] opacity-75">Customer is browsing the menu or order is being drafted.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Contextual State Actions ── */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F] block">
            Table Operational Actions
          </span>

          {table.status === 'Occupied' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSetCleaning}
                disabled={isUpdatingStatus}
                className="w-full text-xs font-bold text-[#075985] bg-[#E0F2FE] hover:bg-[#BAE6FD] border-[#7DD3FC]"
              >
                Mark Cleaning
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSetAvailable}
                disabled={isUpdatingStatus}
                className="w-full text-xs font-bold text-[#166534] bg-[#DCFCE7] hover:bg-[#BBF7D0] border-[#86EFAC]"
              >
                Free Table
              </Button>
            </div>
          )}

          {table.status === 'Available' && (
            <div className="space-y-2">
              <Button
                size="sm"
                onClick={() => setIsSeatModalOpen(true)}
                disabled={isUpdatingStatus}
                className="w-full bg-[#167647] hover:bg-[#125B36] text-white font-extrabold text-xs shadow-xs"
              >
                Seat Walk-in Guests
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => tableService.updateTableStatusDirect(tenantId, table.id, 'Reserved').then(() => {
                    toast.success('Table marked Reserved');
                    onClose();
                  })}
                  className="text-xs font-bold text-[#92400E] bg-[#FEF3C7] hover:bg-[#FDE68A] border-[#FCD34D]"
                >
                  Mark Reserved
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleToggleDisabled}
                  className="text-xs font-bold text-[#475569] hover:bg-[#F1F5F9] border-[#CBD5E1]"
                >
                  Take Offline
                </Button>
              </div>
            </div>
          )}

          {table.status === 'Cleaning' && (
            <Button
              size="sm"
              onClick={handleSetAvailable}
              disabled={isUpdatingStatus}
              className="w-full bg-[#167647] hover:bg-[#125B36] text-white font-extrabold text-xs shadow-xs"
            >
              Mark Sanitized & Ready
            </Button>
          )}

          {table.status === 'Reserved' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                onClick={() => setIsSeatModalOpen(true)}
                className="w-full bg-[#167647] hover:bg-[#125B36] text-white font-extrabold text-xs"
              >
                Check In & Seat
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSetAvailable}
                className="w-full text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
              >
                Cancel Reservation
              </Button>
            </div>
          )}
        </div>

        {/* ── Table QR Ordering Actions ── */}
        <div className="p-3.5 rounded-2xl bg-[#FAF8F4] border border-[#D8DDD6] space-y-2.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F] block">
            Digital QR Ordering Code
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { onShowQrModal(table); onClose(); }}
              className="flex items-center justify-center space-x-1 text-xs font-bold border-[#D8DDD6] bg-white hover:bg-[#FAF8F4]"
            >
              <QrCode className="w-3.5 h-3.5 text-[#D94F2B]" />
              <span>View QR</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPrintQr(table)}
              className="flex items-center justify-center space-x-1 text-xs font-bold border-[#D8DDD6] bg-white hover:bg-[#FAF8F4]"
            >
              <Printer className="w-3.5 h-3.5 text-[#5F675F]" />
              <span>Print</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDownloadQr(table)}
              className="flex items-center justify-center space-x-1 text-xs font-bold border-[#D8DDD6] bg-white hover:bg-[#FAF8F4]"
            >
              <Download className="w-3.5 h-3.5 text-[#5F675F]" />
              <span>Download</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Drawer Footer ── */}
      <div className="p-4 border-t border-[#D8DDD6] bg-[#FAF8F4] flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { onEditTable(table); onClose(); }}
          className="text-xs font-extrabold flex items-center space-x-1.5 border-[#D8DDD6] bg-white hover:bg-[#FAF8F4]"
        >
          <Edit2 className="w-3.5 h-3.5 text-[#5F675F]" />
          <span>Edit Details</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="text-xs font-extrabold bg-white border-[#D8DDD6] hover:bg-[#FAF8F4]"
        >
          Close Panel
        </Button>
      </div>

      {/* ── Walk-In Seating Modal ── */}
      {isSeatModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-[#D8DDD6] shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-[#D8DDD6]">
              <h3 className="text-base font-serif font-bold text-[#202820]">
                Seat Walk-in at Table #{table.tableNumber}
              </h3>
              <button
                type="button"
                onClick={() => setIsSeatModalOpen(false)}
                className="p-1 text-[#5F675F] hover:text-[#202820]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#202820] mb-1">Number of Guests</label>
                <input
                  type="number"
                  min={1}
                  max={table.capacity * 2}
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#D8DDD6] text-xs font-bold text-[#202820] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202820] mb-1">Guest Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D8DDD6] text-xs font-medium text-[#202820] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsSeatModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSeatWalkIn}
                disabled={isUpdatingStatus}
                className="bg-[#167647] hover:bg-[#125B36] text-white font-extrabold text-xs"
              >
                Confirm Seating
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default TableDetailsDrawer;
