import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Flame, 
  BarChart2,
  ArrowUpRight
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import { isTodayInTimezone, isWithinDaysInTimezone } from '../../../../shared/utils/format';
import MobileCard from '../components/MobileCard';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';

export const MobileAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, formatPrice } = useCurrency();
  const tenantId = user?.tenantId;

  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d'>('7d');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ordersCol = collection(db, 'restaurants', tenantId, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.warn('[MobileAnalytics] Snapshot error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // Filter orders by selected date range using Asia/Kolkata timezone
  const rangeOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'CANCELLED' || o.status === 'REJECTED') return false;
      const created = o.createdAt;
      if (!created) return false;

      if (dateRange === 'today') {
        return isTodayInTimezone(created, 'Asia/Kolkata');
      } else if (dateRange === '7d') {
        return isWithinDaysInTimezone(created, 7, 'Asia/Kolkata');
      } else {
        return isWithinDaysInTimezone(created, 30, 'Asia/Kolkata');
      }
    });
  }, [orders, dateRange]);

  // Aggregated Metrics
  const metrics = useMemo(() => {
    let revenue = 0;
    const itemSalesMap = new Map<string, { count: number; revenue: number }>();

    rangeOrders.forEach((o) => {
      const total = Number(o.total || o.totalAmount || 0);
      revenue += total;

      if (Array.isArray(o.items)) {
        o.items.forEach((it: any) => {
          const name = it.name || 'Dish';
          const qty = Number(it.count || it.quantity || 1);
          const price = Number(it.pricePerUnit || it.price || 0) * qty;

          const existing = itemSalesMap.get(name) || { count: 0, revenue: 0 };
          itemSalesMap.set(name, {
            count: existing.count + qty,
            revenue: existing.revenue + price,
          });
        });
      }
    });

    const orderCount = rangeOrders.length;
    const aov = orderCount > 0 ? revenue / orderCount : 0;

    // Top selling items
    const topItems = Array.from(itemSalesMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      revenue,
      orderCount,
      aov,
      topItems,
    };
  }, [rangeOrders]);

  // Group revenue by day for visual bar chart
  const dailyTrends = useMemo(() => {
    const daysMap = new Map<string, number>();
    const count = dateRange === 'today' ? 6 : dateRange === '7d' ? 7 : 14;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      if (dateRange === 'today') {
        d.setHours(d.getHours() - i * 4);
        const label = `${d.getHours()}:00`;
        daysMap.set(label, 0);
      } else {
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        daysMap.set(label, 0);
      }
    }

    // Populate from orders
    rangeOrders.forEach((o) => {
      if (!o.createdAt) return;
      const d = new Date(o.createdAt);
      const label = dateRange === 'today' 
        ? `${Math.floor(d.getHours() / 4) * 4}:00` 
        : d.toLocaleDateString('en-US', { weekday: 'short' });
      
      if (daysMap.has(label)) {
        daysMap.set(label, (daysMap.get(label) || 0) + Number(o.total || 0));
      }
    });

    const entries = Array.from(daysMap.entries()).map(([label, value]) => ({ label, value }));
    const maxVal = Math.max(...entries.map(e => e.value), 100);

    return { entries, maxVal };
  }, [rangeOrders, dateRange]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/business')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <h1 className="font-extrabold text-sm text-[#202124]">Sales & Analytics</h1>

        <div className="w-9" />
      </header>

      <div className="p-4 space-y-4">
        {/* Date Range Selector Pills */}
        <div className="flex items-center gap-2 p-1 bg-white rounded-2xl border border-[#EBEBEB]">
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id as any)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all select-none ${
                dateRange === tab.id
                  ? 'bg-[#FF7518] text-white shadow-sm'
                  : 'text-[#707070] hover:text-[#202124]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3 Metric Cards */}
        {loading ? (
          <MobileLoadingSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <MobileCard className="p-3 text-center">
              <div className="text-[10px] text-[#707070] font-bold truncate">Total Sales</div>
              <div className="text-sm font-black text-[#FF7518] mt-1 truncate">
                {formatPrice(metrics.revenue)}
              </div>
            </MobileCard>

            <MobileCard className="p-3 text-center">
              <div className="text-[10px] text-[#707070] font-bold truncate">Orders</div>
              <div className="text-sm font-black text-[#202124] mt-1">
                {metrics.orderCount}
              </div>
            </MobileCard>

            <MobileCard className="p-3 text-center">
              <div className="text-[10px] text-[#707070] font-bold truncate">Avg Order</div>
              <div className="text-sm font-black text-[#16A34A] mt-1 truncate">
                {formatPrice(metrics.aov)}
              </div>
            </MobileCard>
          </div>
        )}

        {/* Visual Bar Chart */}
        <MobileCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-[#202124]">Revenue Trend</h3>
              <p className="text-[10px] text-[#707070]">
                {dateRange === 'today' ? 'Hourly performance' : 'Daily sales totals'}
              </p>
            </div>
            <BarChart2 className="w-4 h-4 text-[#FF7518]" />
          </div>

          <div className="h-36 flex items-end justify-between gap-1.5 pt-4 border-b border-[#F0F0F0] pb-2">
            {dailyTrends.entries.map((entry, idx) => {
              const heightPct = Math.max(10, Math.round((entry.value / dailyTrends.maxVal) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[20px] bg-gradient-to-t from-[#FF7518] to-[#FFA05C] rounded-t-md transition-all group-hover:brightness-110"
                    title={`${entry.label}: ${formatPrice(entry.value)}`}
                  />
                  <span className="text-[9px] font-semibold text-[#9E9E9E]">{entry.label}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#707070] pt-1">
            <span>Peak: {formatPrice(dailyTrends.maxVal)}</span>
            <span className="text-[#16A34A] font-bold">Real-time sync</span>
          </div>
        </MobileCard>

        {/* Top Selling Items */}
        <MobileCard className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#F5F5F5] pb-2">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#FF7518]" />
              <h3 className="font-bold text-xs text-[#202124]">Top Selling Dishes</h3>
            </div>
            <span className="text-[10px] text-[#9E9E9E]">By quantity</span>
          </div>

          {metrics.topItems.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#9E9E9E]">
              No sales data for this period.
            </div>
          ) : (
            <div className="divide-y divide-[#F5F5F5]">
              {metrics.topItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-[#FFF4EE] text-[#FF7518] text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[#202124] truncate">{item.name}</div>
                      <div className="text-[10px] text-[#707070]">{item.count} orders placed</div>
                    </div>
                  </div>
                  <span className="font-black text-xs text-[#202124] flex-shrink-0">
                    {formatPrice(item.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </MobileCard>
      </div>
    </div>
  );
};

export default MobileAnalytics;
