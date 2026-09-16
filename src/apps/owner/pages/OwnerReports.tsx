import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { exportToCsv, exportToExcel, printReportPreview } from '../../../shared/utils/exportUtils';
import { logAuditEvent } from '../../../shared/services/auditService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Toast & Icons
import toast from 'react-hot-toast';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  FileText, 
  Calendar, 
  Filter, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  Users, 
  CalendarCheck, 
  MessageSquare, 
  CreditCard, 
  Percent, 
  XCircle, 
  Receipt,
  Building2,
  RefreshCw
} from 'lucide-react';

export type TReportType = 
  | 'sales'
  | 'restaurant'
  | 'orders'
  | 'inventory'
  | 'customers'
  | 'staff'
  | 'reservations'
  | 'feedback'
  | 'payments'
  | 'discounts'
  | 'cancellations'
  | 'tax';

export const OwnerReports: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // Selected Report Configuration
  const [selectedReport, setSelectedReport] = useState<TReportType>('sales');
  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'last_month' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Loaded Data Repositories
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Fetch raw data from Firestore
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const targetTenant = tenantId || 'default';

    const loadAllReportData = async () => {
      try {
        // Orders
        const ordersSnap = await getDocs(collection(db, 'restaurants', targetTenant, 'orders'));
        const ords: any[] = [];
        ordersSnap.forEach(d => ords.push({ id: d.id, ...d.data() }));
        setOrders(ords);

        // Transactions (financial ledger)
        try {
          const transSnap = await getDocs(collection(db, 'restaurants', targetTenant, 'transactions'));
          const trs: any[] = [];
          transSnap.forEach(d => trs.push({ id: d.id, ...d.data() }));
          setTransactions(trs);
        } catch (_) {}

        // Inventory
        const invSnap = await getDocs(collection(db, 'restaurants', targetTenant, 'inventory'));
        const invs: any[] = [];
        invSnap.forEach(d => invs.push({ id: d.id, ...d.data() }));
        setInventory(invs);

        // Staff
        const staffSnap = await getDocs(query(collection(db, 'employees'), where('tenantId', '==', targetTenant)));
        const stfs: any[] = [];
        staffSnap.forEach(d => stfs.push({ id: d.id, ...d.data() }));
        setStaffList(stfs);

        // Reservations
        const resSnap = await getDocs(collection(db, 'restaurants', targetTenant, 'reservations'));
        const resList: any[] = [];
        resSnap.forEach(d => resList.push({ id: d.id, ...d.data() }));
        setReservations(resList);

        // Feedback
        const feedSnap = await getDocs(collection(db, 'restaurants', targetTenant, 'satisfactionRatings'));
        const fds: any[] = [];
        feedSnap.forEach(d => fds.push({ id: d.id, ...d.data() }));
        setFeedbacks(fds);

        // Restaurants
        const restSnap = await getDocs(collection(db, 'restaurants'));
        const rList: any[] = [];
        restSnap.forEach(d => rList.push({ id: d.id, ...d.data() }));
        setRestaurants(rList);

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching report data:', err);
        setIsLoading(false);
      }
    };

    loadAllReportData();
  }, [user, tenantId]);

  // Compute Active Date Filter Window
  const dateFilterBounds = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateRangePreset === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateRangePreset === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (dateRangePreset === '7days') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (dateRangePreset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRangePreset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (dateRangePreset === 'custom' && customStartDate) {
      start = new Date(customStartDate);
      end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : new Date();
    }

    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Generate Tabular Data based on selected report type
  const reportPayload = useMemo(() => {
    const { startMs, endMs } = dateFilterBounds;

    const isWithinDate = (dateStr?: string) => {
      if (!dateStr) return true;
      const ms = new Date(dateStr).getTime();
      if (isNaN(ms)) return true;
      return ms >= startMs && ms <= endMs;
    };

    switch (selectedReport) {
      case 'sales': {
        const title = 'Sales Performance Report';
        const headers = ['Order ID', 'Date', 'Customer', 'Table', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment Status'];
        const rows = orders
          .filter(o => isWithinDate(o.createdAt || o.updatedAt))
          .map(o => [
            o.id || o.orderId,
            o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A',
            o.customerName || 'Walk-in',
            o.tableNumber || '-',
            `$${(o.subtotal ? (o.subtotal > 1000 ? o.subtotal / 100 : o.subtotal) : 0).toFixed(2)}`,
            `$${(o.tax ? (o.tax > 1000 ? o.tax / 100 : o.tax) : 0).toFixed(2)}`,
            `$${(o.discount ? (o.discount > 1000 ? o.discount / 100 : o.discount) : 0).toFixed(2)}`,
            `$${(o.total ? (o.total > 1000 ? o.total / 100 : o.total) : 0).toFixed(2)}`,
            o.paymentStatus || 'paid'
          ]);
        return { title, headers, rows };
      }

      case 'restaurant': {
        const title = 'Restaurant & Branch Portfolio Report';
        const headers = ['Restaurant ID', 'Name', 'City', 'Plan Tier', 'Status', 'Phone', 'Created Date'];
        const rows = restaurants.map(r => [
          r.id,
          r.name,
          r.city || 'Hyderabad',
          (r.planTier || 'Pro').toUpperCase(),
          (r.status || 'Active').toUpperCase(),
          r.phone || '-',
          r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'
        ]);
        return { title, headers, rows };
      }

      case 'orders': {
        const title = 'Order Processing & Fulfillment Report';
        const headers = ['Order ID', 'Date', 'Customer', 'Table', 'Items Count', 'Status', 'Total'];
        const rows = orders
          .filter(o => isWithinDate(o.createdAt))
          .map(o => [
            o.id || o.orderId,
            o.createdAt ? new Date(o.createdAt).toLocaleString() : 'N/A',
            o.customerName || 'Guest',
            o.tableNumber || '-',
            o.items?.length || 0,
            o.status || 'COMPLETED',
            `$${(o.total ? (o.total > 1000 ? o.total / 100 : o.total) : 0).toFixed(2)}`
          ]);
        return { title, headers, rows };
      }

      case 'inventory': {
        const title = 'Inventory & Stock Valuation Report';
        const headers = ['Item Name', 'Category', 'Current Stock', 'Unit', 'Reorder Level', 'Unit Cost', 'Stock Status'];
        const rows = inventory.map(i => {
          const stock = Number(i.currentStock ?? i.stockLevel ?? 0);
          const threshold = Number(i.minStock ?? i.reorderThreshold ?? 10);
          const status = stock <= 0 ? 'Out of Stock' : stock <= threshold ? 'Low Stock' : 'Optimal';
          return [
            i.name,
            i.category || 'Kitchen Goods',
            stock,
            i.unit || 'units',
            threshold,
            `$${(i.costPrice || i.unitCost || 5).toFixed(2)}`,
            status
          ];
        });
        return { title, headers, rows };
      }

      case 'customers': {
        const title = 'Customer Spend & Loyalty Report';
        const headers = ['Customer Name', 'Contact Phone', 'Total Orders', 'Estimated Spend', 'Loyalty Points'];
        const customerMap = new Map<string, any>();
        orders.forEach(o => {
          const key = o.customerPhone || o.customerName || 'Walk-in';
          const prev = customerMap.get(key) || { name: o.customerName || key, phone: o.customerPhone || '-', orders: 0, spend: 0 };
          const rawTotal = Number(o.total || 0);
          prev.orders += 1;
          prev.spend += rawTotal > 1000 ? rawTotal / 100 : rawTotal;
          customerMap.set(key, prev);
        });
        const rows = Array.from(customerMap.values()).map(c => [
          c.name,
          c.phone,
          c.orders,
          `$${c.spend.toFixed(2)}`,
          Math.round(c.spend * 0.1)
        ]);
        return { title, headers, rows };
      }

      case 'staff': {
        const title = 'Staff Roster & Payroll Alignment Report';
        const headers = ['Employee ID', 'Full Name', 'Role', 'Department', 'Email', 'Status', 'Invited Date'];
        const rows = staffList.map(s => [
          s.id,
          s.fullName || s.name,
          s.role?.toUpperCase() || 'STAFF',
          s.department || 'Service',
          s.email || '-',
          (s.status || 'Active').toUpperCase(),
          s.invitedAt ? new Date(s.invitedAt).toLocaleDateString() : '-'
        ]);
        return { title, headers, rows };
      }

      case 'reservations': {
        const title = 'Table Reservations Report';
        const headers = ['Reservation ID', 'Customer Name', 'Phone', 'Date', 'Time', 'Guests', 'Table', 'Status'];
        const rows = reservations
          .filter(r => isWithinDate(r.date))
          .map(r => [
            r.bookingId || r.id,
            r.customerName,
            r.customerPhone || '-',
            r.date,
            r.time,
            r.guests || 2,
            r.tableNumber || 'Auto',
            r.status || 'Confirmed'
          ]);
        return { title, headers, rows };
      }

      case 'feedback': {
        const title = 'Guest Feedback & Rating Report';
        const headers = ['Feedback ID', 'Customer', 'Rating', 'Category', 'Comments', 'Status', 'Date'];
        const rows = feedbacks
          .filter(f => isWithinDate(f.submittedAt))
          .map(f => [
            f.id,
            f.submittedByName || f.customerName || 'Guest',
            f.rating || 'Good',
            f.category || 'General',
            f.notes || '-',
            f.status || 'Resolved',
            f.submittedAt ? new Date(f.submittedAt).toLocaleDateString() : '-'
          ]);
        return { title, headers, rows };
      }

      case 'payments': {
        const title = 'Payment Gateways & Settlement Report';
        const headers = ['Transaction Ref', 'Date', 'Amount', 'Method', 'Gateway / Pos', 'Status'];
        const rows = (transactions.length > 0 ? transactions : orders)
          .filter(t => isWithinDate(t.createdAt || t.timestamp))
          .map(t => {
            const rawAmt = Number(t.amount || t.total || 0);
            return [
              t.id || t.transactionId || 'TXN-REF',
              t.createdAt || t.timestamp ? new Date(t.createdAt || t.timestamp).toLocaleString() : 'N/A',
              `$${(rawAmt > 1000 ? rawAmt / 100 : rawAmt).toFixed(2)}`,
              (t.paymentMethod || t.method || 'Card / UPI').toUpperCase(),
              'Primary Gateway',
              (t.status || t.paymentStatus || 'Success').toUpperCase()
            ];
          });
        return { title, headers, rows };
      }

      case 'discounts': {
        const title = 'Discounts & Promotional Vouchers Report';
        const headers = ['Order ID', 'Customer', 'Date', 'Original Amount', 'Discount Deducted', 'Net Paid'];
        const rows = orders
          .filter(o => Number(o.discount || 0) > 0 && isWithinDate(o.createdAt))
          .map(o => {
            const disc = Number(o.discount || 0);
            const tot = Number(o.total || 0);
            const sub = Number(o.subtotal || tot + disc);
            return [
              o.id || o.orderId,
              o.customerName || 'Guest',
              o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A',
              `$${(sub > 1000 ? sub / 100 : sub).toFixed(2)}`,
              `$${(disc > 1000 ? disc / 100 : disc).toFixed(2)}`,
              `$${(tot > 1000 ? tot / 100 : tot).toFixed(2)}`
            ];
          });
        return { title, headers, rows };
      }

      case 'cancellations': {
        const title = 'Order & Booking Cancellations Report';
        const headers = ['Record ID', 'Type', 'Customer', 'Date', 'Reason', 'Impact Value'];
        const cancelledOrders = orders
          .filter(o => o.status === 'CANCELLED' && isWithinDate(o.createdAt))
          .map(o => [
            o.id || o.orderId,
            'Order Cancellation',
            o.customerName || 'Guest',
            o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A',
            o.cancelReason || 'Diner cancelled before prep',
            `$${(o.total ? (o.total > 1000 ? o.total / 100 : o.total) : 0).toFixed(2)}`
          ]);
        const cancelledRes = reservations
          .filter(r => r.status === 'Cancelled' && isWithinDate(r.date))
          .map(r => [
            r.bookingId || r.id,
            'Reservation Cancellation',
            r.customerName,
            r.date,
            'Diner cancelled booking',
            `$0.00`
          ]);
        return { title, headers, rows: [...cancelledOrders, ...cancelledRes] };
      }

      case 'tax': {
        const title = 'Statutory Tax & GST Compliance Report';
        const headers = ['Order ID', 'Date', 'Taxable Subtotal', 'Applicable Tax (5%)', 'Gross Total'];
        const rows = orders
          .filter(o => isWithinDate(o.createdAt))
          .map(o => {
            const sub = Number(o.subtotal || 0);
            const tax = Number(o.tax || 0);
            const tot = Number(o.total || 0);
            return [
              o.id || o.orderId,
              o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A',
              `$${(sub > 1000 ? sub / 100 : sub).toFixed(2)}`,
              `$${(tax > 1000 ? tax / 100 : tax).toFixed(2)}`,
              `$${(tot > 1000 ? tot / 100 : tot).toFixed(2)}`
            ];
          });
        return { title, headers, rows };
      }

      default:
        return { title: 'Business Report', headers: [], rows: [] };
    }
  }, [selectedReport, orders, inventory, staffList, reservations, feedbacks, restaurants, transactions, dateFilterBounds]);

  // Export handlers
  const handleExportCsv = () => {
    const filename = `SpiralDine_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}`;
    exportToCsv(filename, reportPayload.headers, reportPayload.rows);
    toast.success('CSV Report generated and downloaded');
    logAuditEvent({
      userId: user?.uid || '',
      userEmail: user?.email || '',
      userName: user?.displayName || 'Owner',
      userRole: user?.role || 'owner',
      tenantId: tenantId || 'default',
      module: 'Billing',
      action: 'EXPORT',
      targetEntity: `${reportPayload.title} (CSV)`
    });
  };

  const handleExportExcel = () => {
    const filename = `SpiralDine_${selectedReport}_Report_${new Date().toISOString().slice(0, 10)}`;
    exportToExcel(filename, reportPayload.title, reportPayload.headers, reportPayload.rows);
    toast.success('Excel Report downloaded');
    logAuditEvent({
      userId: user?.uid || '',
      userEmail: user?.email || '',
      userName: user?.displayName || 'Owner',
      userRole: user?.role || 'owner',
      tenantId: tenantId || 'default',
      module: 'Billing',
      action: 'EXPORT',
      targetEntity: `${reportPayload.title} (Excel)`
    });
  };

  const handlePrintPreview = () => {
    const subtitle = `Filter: ${dateRangePreset.toUpperCase()} &middot; Generated for Owner Workspace`;
    printReportPreview(reportPayload.title, subtitle, reportPayload.headers, reportPayload.rows);
  };

  // 12 Report Types Definition
  const reportOptions: { id: TReportType; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'sales', label: 'Sales Report', icon: DollarSign },
    { id: 'restaurant', label: 'Restaurant Report', icon: Building2 },
    { id: 'orders', label: 'Order Report', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory Report', icon: Package },
    { id: 'customers', label: 'Customer Report', icon: Users },
    { id: 'staff', label: 'Staff Report', icon: Users },
    { id: 'reservations', label: 'Reservation Report', icon: CalendarCheck },
    { id: 'feedback', label: 'Feedback Report', icon: MessageSquare },
    { id: 'payments', label: 'Payment Report', icon: CreditCard },
    { id: 'discounts', label: 'Discount Report', icon: Percent },
    { id: 'cancellations', label: 'Cancellation Report', icon: XCircle },
    { id: 'tax', label: 'Tax Report', icon: Receipt },
  ];

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <FileSpreadsheet className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Reports & Business Exports
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Generate, filter, and export comprehensive business, financial, inventory, and compliance reports.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          <Button 
            variant="secondary"
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5 text-[#12352D]" />
            <span>Export CSV</span>
          </Button>

          <Button 
            variant="secondary"
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 text-xs font-bold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#16845B]" />
            <span>Export Excel</span>
          </Button>

          <Button 
            variant="primary"
            onClick={handlePrintPreview}
            className="bg-[#12352D] hover:bg-[#1A473C] text-white flex items-center space-x-1.5 text-xs font-bold shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </Button>
        </div>
      </div>

      {/* ── Report Type Selector Grid ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm">
        <p className="text-[11px] uppercase font-bold text-[#6B7280] mb-3">Select Report Type</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {reportOptions.map((opt) => {
            const isSelected = selectedReport === opt.id;
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                onClick={() => setSelectedReport(opt.id)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-[#12352D] border-[#12352D] text-white shadow-sm' 
                    : 'bg-[#F8F6F2] border-[#E5E7EB] text-[#17202A] hover:border-[#C9533B]/40'
                }`}
              >
                <Icon className={`w-4 h-4 mb-2 ${isSelected ? 'text-[#C9533B]' : 'text-[#6B7280]'}`} />
                <span className="text-xs font-bold">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto">
          <span className="text-xs font-bold text-[#6B7280] shrink-0">Date Range:</span>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'custom', label: 'Custom' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setDateRangePreset(preset.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                dateRangePreset === preset.id
                  ? 'bg-[#C9533B] text-white shadow-sm'
                  : 'bg-[#F8F6F2] text-[#6B7280] hover:text-[#17202A]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {dateRangePreset === 'custom' && (
          <div className="flex items-center space-x-2">
            <input 
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F8F6F2]"
            />
            <span className="text-xs text-[#6B7280]">to</span>
            <input 
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#F8F6F2]"
            />
          </div>
        )}
      </div>

      {/* ── Live Report Preview & Record Count ── */}
      <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="p-4 bg-[#F8F6F2] border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#C9533B]" />
            <h3 className="font-serif font-bold text-sm text-[#17202A]">
              {reportPayload.title}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-[#6B7280]">
            {reportPayload.rows.length} records generated
          </span>
        </div>

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <LoadingSpinner label="Compiling report metrics..." />
          </div>
        ) : reportPayload.rows.length === 0 ? (
          <EmptyState 
            title="No records found for selected period"
            description="Adjust the date range or filters above to generate report rows."
          />
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12352D] text-white uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10">
                <tr>
                  {reportPayload.headers.map((h, idx) => (
                    <th key={idx} className="py-3 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-[#17202A]">
                {reportPayload.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#F8F6F2] transition-colors">
                    {row.map((val, cIdx) => (
                      <td key={cIdx} className="py-3 px-4 font-medium">
                        {val ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerReports;
