import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { useWaiterData } from './useWaiterData';
import { IOrder, ITable } from '../../../types';
import { IBill } from '../../../shared/domain/billing/types';
import { billingService } from '../../../shared/services/billingService';
import CanonicalBillModal from '../../../shared/ui/billing/CanonicalBillModal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import { 
  Receipt, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  QrCode, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Users, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export const WaiterBillingPage: React.FC = () => {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { tables, orders, isLoading: isDataLoading } = useWaiterData();

  const [bills, setBills] = useState<IBill[]>([]);
  const [isBillsLoading, setIsBillsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [selectedBill, setSelectedBill] = useState<IBill | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  
  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'pending' | 'settled'>('pending');
  const [tableFilter, setTableFilter] = useState<'all' | 'assigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tenantId = user?.tenantId || '';

  // 1. Subscribe to Tenant Bills stream in real-time
  useEffect(() => {
    if (!tenantId) return;

    setIsBillsLoading(true);
    const unsub = billingService.subscribeToTenantBills(tenantId, (loadedBills) => {
      setBills(loadedBills);
      setIsBillsLoading(false);
    });

    return () => unsub();
  }, [tenantId]);

  // 2. Pending Billing Items
  // Unified view combining orders needing billing and existing pending bills
  const pendingBillItems = useMemo(() => {
    // Map of orderId -> canonical bill
    const billMap = new Map<string, IBill>();
    bills.forEach(b => {
      if (b.orderId) billMap.set(b.orderId, b);
    });

    // Orders requiring bill payment:
    // a) Table status is bill_requested
    // b) Order status is DINING_COMPLETED or BILL_REQUESTED with payment pending
    // c) Order status is SERVED with payment pending
    const list: Array<{
      order: IOrder;
      bill?: IBill;
      tableObj?: ITable;
      tableNumber: string;
      customerName: string;
      total: number;
      isBillRequested: boolean;
      isDiningCompleted: boolean;
      createdAt: string;
    }> = [];

    orders.forEach(order => {
      if (order.status === 'ARCHIVED' || order.status === 'CANCELLED') return;
      
      const bill = billMap.get(order.orderId);
      const isPaid = (bill?.paymentStatus || order.paymentStatus || '').toLowerCase() === 'paid';
      if (isPaid) return;

      const tableObj = tables.find(t => 
        String(t.number) === String(order.tableNumber) || 
        t.activeOrderId === order.orderId
      );

      const isBillRequested = order.status === 'BILL_REQUESTED' || tableObj?.status === 'bill_requested';
      const isDiningCompleted = (order.status || '').toUpperCase() === 'DINING_COMPLETED' || isBillRequested || (order.status || '').toUpperCase() === 'SERVED';

      // If either bill requested, dining completed, or an existing pending bill exists
      if (isBillRequested || (order.status || '').toUpperCase() === 'DINING_COMPLETED' || bill) {
        list.push({
          order,
          bill,
          tableObj,
          tableNumber: String(order.tableNumber || tableObj?.number || 'Walk-in'),
          customerName: order.customerName || 'Guest Diner',
          total: bill?.total || order.total || 0,
          isBillRequested,
          isDiningCompleted,
          createdAt: bill?.createdAt || order.createdAt
        });
      }
    });

    return list;
  }, [orders, bills, tables]);

  // 3. Settled Bills Today
  const settledBillsToday = useMemo(() => {
    return bills.filter(b => (b.paymentStatus || '').toLowerCase() === 'paid');
  }, [bills]);

  // 4. Filtered List by Search and Table Assignment
  const displayedItems = useMemo(() => {
    let base = activeTab === 'pending' ? pendingBillItems : settledBillsToday.map(b => ({
      bill: b,
      order: {
        orderId: b.orderId,
        tableNumber: b.tableNumber,
        customerName: b.customerName || 'Guest Diner',
        items: b.items,
        subtotal: b.subtotal,
        tax: b.tax,
        total: b.total,
        createdAt: b.createdAt
      } as any,
      tableObj: tables.find(tbl => String(tbl.number) === String(b.tableNumber)),
      tableNumber: b.tableNumber,
      customerName: b.customerName || 'Guest Diner',
      total: b.total,
      isBillRequested: false,
      isDiningCompleted: true,
      createdAt: b.createdAt
    }));

    // Assigned Table Filter
    if (tableFilter === 'assigned' && user?.uid) {
      base = base.filter(item => {
        const t = item.tableObj || tables.find(tbl => String(tbl.number) === String(item.tableNumber));
        return t?.assignedWaiterId === user.uid;
      });
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      base = base.filter(item => 
        item.tableNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.order.orderId.toLowerCase().includes(q) ||
        (item.bill?.invoiceNumber || '').toLowerCase().includes(q)
      );
    }

    return base;
  }, [activeTab, pendingBillItems, settledBillsToday, tableFilter, user?.uid, tables, searchQuery]);

  // 5. Open Authoritative Canonical Bill Handler
  const handleOpenBill = async (order: IOrder, existingBill?: IBill) => {
    if (!tenantId) return;

    try {
      let targetBill = existingBill;
      if (!targetBill) {
        // Idempotently create or retrieve canonical bill
        targetBill = await billingService.getOrCreateCanonicalBill(tenantId, order, {
          uid: user?.uid || '',
          displayName: user?.displayName || 'Waiter',
          email: user?.email || '',
          role: 'waiter'
        });
      }

      setSelectedOrder(order);
      setSelectedBill(targetBill);
      setIsBillModalOpen(true);
    } catch (err: any) {
      console.error(err);
      toast.error('Unable to open canonical bill.');
    }
  };

  const totalPendingSum = useMemo(() => {
    return pendingBillItems.reduce((sum, it) => sum + it.total, 0);
  }, [pendingBillItems]);

  const totalSettledSum = useMemo(() => {
    return settledBillsToday.reduce((sum, b) => sum + b.total, 0);
  }, [settledBillsToday]);

  if (isDataLoading && isBillsLoading && orders.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <LoadingSpinner label="Loading billing workspace..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none pb-16">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#C85A3F] bg-[#F3E8DF] px-2.5 py-0.5 rounded-full">
              Point of Sale & Settle
            </span>
            <span className="text-xs text-[#756B64] font-medium">• Live Table Bills</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#202124] tracking-tight mt-1">
            Waiter Billing Desk
          </h1>
        </div>

        {/* Quick Tabs: Pending vs Settled */}
        <div className="flex items-center bg-white border border-[#E5DCD5] rounded-2xl p-1 shadow-2xs">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-[#C85A3F] text-white shadow-xs'
                : 'text-[#756B64] hover:text-[#202124]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Bills ({pendingBillItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('settled')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settled'
                ? 'bg-[#2E8B57] text-white shadow-xs'
                : 'text-[#756B64] hover:text-[#202124]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settled Today ({settledBillsToday.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#756B64] block">
              Pending Bills Total
            </span>
            <strong className="text-2xl font-extrabold text-[#C85A3F] font-mono block">
              {formatPrice(totalPendingSum)}
            </strong>
            <span className="text-[11px] text-[#756B64]">
              {pendingBillItems.length} active table{pendingBillItems.length === 1 ? '' : 's'} awaiting payment
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F3E8DF] border border-[#E5DCD5] text-[#C85A3F] flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#756B64] block">
              Settled Collections Today
            </span>
            <strong className="text-2xl font-extrabold text-[#2E8B57] font-mono block">
              {formatPrice(totalSettledSum)}
            </strong>
            <span className="text-[11px] text-[#756B64]">
              {settledBillsToday.length} successful transaction{settledBillsToday.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#2E8B57] flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#756B64] block">
              Payment Methods Supported
            </span>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="px-2 py-0.5 bg-[#FCFAF7] border border-[#E5DCD5] rounded-lg text-[10px] font-bold text-[#202124]">UPI QR</span>
              <span className="px-2 py-0.5 bg-[#FCFAF7] border border-[#E5DCD5] rounded-lg text-[10px] font-bold text-[#202124]">Cash</span>
              <span className="px-2 py-0.5 bg-[#FCFAF7] border border-[#E5DCD5] rounded-lg text-[10px] font-bold text-[#202124]">Card POS</span>
            </div>
            <span className="text-[11px] text-[#756B64] block pt-1">
              Canonical ledger synchronization
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FCFAF7] border border-[#E5DCD5] text-[#202124] flex items-center justify-center shrink-0">
            <QrCode className="w-6 h-6 text-[#C85A3F]" />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-[#E5DCD5] rounded-2xl p-3 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#756B64]" />
          <input
            type="text"
            placeholder="Search by table #, customer name, order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FCFAF7] border border-[#E5DCD5] rounded-xl text-xs text-[#202124] focus:outline-none focus:border-[#C85A3F] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setTableFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              tableFilter === 'all'
                ? 'bg-[#202124] text-white'
                : 'bg-[#FCFAF7] text-[#756B64] hover:bg-[#E5DCD5]'
            }`}
          >
            All Restaurant Tables
          </button>
          <button
            onClick={() => setTableFilter('assigned')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              tableFilter === 'assigned'
                ? 'bg-[#202124] text-white'
                : 'bg-[#FCFAF7] text-[#756B64] hover:bg-[#E5DCD5]'
            }`}
          >
            My Assigned Tables
          </button>
        </div>
      </div>

      {/* 4. Bills Grid / List */}
      {displayedItems.length === 0 ? (
        <div className="py-16 text-center bg-white border border-[#E5DCD5] rounded-3xl space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#F3E8DF] border border-[#E5DCD5] text-[#C85A3F] flex items-center justify-center mx-auto shadow-2xs">
            <Receipt className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-[#202124]">
            {activeTab === 'pending' ? 'No pending bills right now' : 'No settled bills found'}
          </h3>
          <p className="text-xs text-[#756B64] max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'Tables requesting bill checkout or dining completed will automatically appear here.'
              : 'Completed transactions for your shift will display here in real time.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedItems.map((item) => {
            const isSettled = activeTab === 'settled';
            const tableNumStr = item.tableNumber.toLowerCase().includes('walk') ? 'Walk-in' : `Table ${item.tableNumber}`;

            return (
              <div
                key={item.order.orderId}
                className={`bg-white border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                  isSettled
                    ? 'border-[#E5DCD5] hover:border-emerald-300'
                    : item.isBillRequested
                    ? 'border-purple-200 bg-purple-50/20'
                    : 'border-[#E5DCD5] hover:border-[#C85A3F]/50'
                }`}
              >
                {/* Top: Table badge & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-sm font-black text-[#202124] block">
                      {tableNumStr}
                    </span>
                    <p className="text-xs text-[#756B64] font-medium truncate max-w-[160px]">
                      Diner: <strong className="text-[#202124]">{item.customerName}</strong>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {isSettled ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-[#2E8B57] border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>PAID</span>
                      </span>
                    ) : item.isBillRequested ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
                        Bill Requested
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                        Payment Pending
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[#756B64]">
                      #{item.order.orderId}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="py-2.5 px-3 bg-[#FCFAF7] border border-[#E5DCD5] rounded-xl text-xs space-y-1">
                  <div className="flex justify-between text-[#756B64] font-medium">
                    <span>Items Count:</span>
                    <span className="font-bold text-[#202124]">{item.order.items?.length || 0} dishes</span>
                  </div>
                  {item.order.items && item.order.items.length > 0 && (
                    <p className="text-[11px] text-[#756B64] truncate">
                      {item.order.items.map((it: any) => `${it.name} (×${it.count || it.quantity || 1})`).join(', ')}
                    </p>
                  )}
                </div>

                {/* Footer: Price & CTA */}
                <div className="pt-2 border-t border-[#E5DCD5] flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] text-[#756B64] uppercase font-extrabold block">Total Bill</span>
                    <strong className="text-lg font-black text-[#202124] font-mono">
                      {formatPrice(item.total)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenBill(item.order, item.bill)}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
                      isSettled
                        ? 'bg-[#FCFAF7] border border-[#E5DCD5] hover:border-[#202124] text-[#202124]'
                        : 'bg-[#C85A3F] hover:bg-[#A94332] text-white shadow-md shadow-[#C85A3F]/20'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>{isSettled ? 'View Receipt' : 'OPEN BILL'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Authoritative Canonical Bill Modal */}
      {selectedOrder && (
        <CanonicalBillModal
          isOpen={isBillModalOpen}
          onClose={() => {
            setIsBillModalOpen(false);
            setSelectedOrder(null);
            setSelectedBill(null);
          }}
          tenantId={tenantId}
          orderId={selectedOrder.orderId}
          initialBill={selectedBill}
          mode="waiter"
          restaurantName={(selectedOrder as any).restaurantName || 'Restaurant'}
          onPaymentSettled={(settledBill) => {
            setSelectedBill(settledBill);
          }}
        />
      )}
    </div>
  );
};

export default WaiterBillingPage;
