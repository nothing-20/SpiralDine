import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { IMenuItem, IMenuCategory } from '../../../../types';
import { formatPrice } from '../../../../utils/format';
import { useCurrency } from '../../../../context/CurrencyContext';

import Card from '../../../../components/ui/Card/Card';
import Badge from '../../../../components/ui/Badge/Badge';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner/LoadingSpinner';

import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Utensils, 
  AlertCircle, 
  BarChart3, 
  Layers 
} from 'lucide-react';

interface MenuAnalyticsTabProps {
  tenantId: string;
  menuItems: IMenuItem[];
  categories: IMenuCategory[];
}

export const MenuAnalyticsTab: React.FC<MenuAnalyticsTabProps> = ({
  tenantId,
  menuItems,
  categories
}) => {
  const { currencySymbol } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stream actual orders from Firestore
  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    const ordersRef = collection(db, 'restaurants', tenantId, 'orders');
    const unsub = onSnapshot(
      query(ordersRef),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('[MenuAnalyticsTab] Orders read error:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [tenantId]);

  // Aggregate item order counts and revenues from real orders
  const itemMetrics = useMemo(() => {
    const stats: Record<string, { itemId: string; name: string; count: number; revenue: number; category: string }> = {};

    // Initialize with known menu items
    menuItems.forEach((m) => {
      stats[m.id] = {
        itemId: m.id,
        name: m.name,
        count: 0,
        revenue: 0,
        category: m.category || categories.find((c) => c.id === m.categoryId)?.name || 'Other'
      };
    });

    // Accumulate from orders
    orders.forEach((order) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((it: any) => {
          const id = it.itemId || it.id;
          const qty = Number(it.count || it.quantity || 1);
          const unitPrice = Number(it.pricePerUnit || it.price || 0);
          const itemRev = qty * unitPrice;

          if (id && stats[id]) {
            stats[id].count += qty;
            stats[id].revenue += itemRev;
          } else if (id) {
            stats[id] = {
              itemId: id,
              name: it.name || 'Unknown Dish',
              count: qty,
              revenue: itemRev,
              category: 'Other'
            };
          }
        });
      }
    });

    return Object.values(stats);
  }, [orders, menuItems, categories]);

  // Rank most ordered & least ordered
  const sortedByOrders = useMemo(() => {
    return [...itemMetrics].sort((a, b) => b.count - a.count);
  }, [itemMetrics]);

  const mostOrdered = useMemo(() => {
    return sortedByOrders.filter((i) => i.count > 0).slice(0, 5);
  }, [sortedByOrders]);

  const leastOrdered = useMemo(() => {
    // Only items that have 0 or lowest orders
    return [...itemMetrics].sort((a, b) => a.count - b.count).slice(0, 5);
  }, [itemMetrics]);

  // Best selling category
  const categoryPerformance = useMemo(() => {
    const catMap: Record<string, { name: string; totalRevenue: number; totalSold: number }> = {};

    itemMetrics.forEach((im) => {
      const cat = im.category || 'Other';
      if (!catMap[cat]) {
        catMap[cat] = { name: cat, totalRevenue: 0, totalSold: 0 };
      }
      catMap[cat].totalRevenue += im.revenue;
      catMap[cat].totalSold += im.count;
    });

    return Object.values(catMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [itemMetrics]);

  // Stock availability stats
  const totalItems = menuItems.length;
  const outOfStockItems = menuItems.filter((m) => m.isAvailable === false || m.available === false);
  const inStockCount = totalItems - outOfStockItems.length;
  const totalCompletedOrders = orders.filter((o) => (o.status || '').toUpperCase() === 'COMPLETED' || (o.paymentStatus || '').toLowerCase() === 'paid').length;
  const totalGrossRevenue = orders.reduce((sum, o) => sum + (Number(o.total || o.totalAmount) || 0), 0);

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner label="Calculating real-time menu analytics from orders..." />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-12 text-center border-slate-850 bg-slate-900/10 space-y-3">
        <BarChart3 className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-textPearl">No Customer Orders Recorded Yet</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Menu analytics are computed strictly from real customer dining transactions. As diners place orders via table QR or staff POS, dish popularity, revenue per item, and category benchmarks will populate automatically.
        </p>
        <div className="pt-2 text-[11px] text-slate-500 font-mono">
          Single Source of Truth: Canonical Firestore Orders Collection · Zero Mock Metrics
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* Top summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-850 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-extrabold text-textPearl mt-1">
            {orders.length}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {totalCompletedOrders} completed
          </span>
        </Card>

        <Card className="p-4 border-slate-850 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-textPearl mt-1">
            {formatPrice(totalGrossRevenue)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Across all menu sales
          </span>
        </Card>

        <Card className="p-4 border-slate-850 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Top Category</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-extrabold text-textPearl mt-1 truncate">
            {categoryPerformance[0]?.name || 'N/A'}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {formatPrice(categoryPerformance[0]?.totalRevenue || 0)} sales
          </span>
        </Card>

        <Card className="p-4 border-slate-850 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">In-Stock Ratio</span>
            <Utensils className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-textPearl mt-1">
            {totalItems > 0 ? `${Math.round((inStockCount / totalItems) * 100)}%` : '0%'}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {outOfStockItems.length} currently sold out
          </span>
        </Card>
      </div>

      {/* Two column: Most Ordered vs Least Ordered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Ordered Items */}
        <Card className="p-5 border-slate-850 bg-slate-900/20 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-textPearl">
              Most Ordered Dishes
            </h4>
          </div>

          {mostOrdered.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No dishes ordered yet.</p>
          ) : (
            <div className="space-y-2">
              {mostOrdered.map((m, idx) => (
                <div key={m.itemId} className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-850 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-textPearl truncate block">{m.name}</span>
                      <span className="text-[10px] text-slate-400">{m.category}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-textPearl block font-mono">
                      {m.count} orders
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {formatPrice(m.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Least Ordered Items */}
        <Card className="p-5 border-slate-850 bg-slate-900/20 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800/60 pb-2.5">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-textPearl">
              Least Ordered Dishes (Review Candidates)
            </h4>
          </div>

          <div className="space-y-2">
            {leastOrdered.map((m) => (
              <div key={m.itemId} className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-850 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-textPearl truncate block">{m.name}</span>
                  <span className="text-[10px] text-slate-400">{m.category}</span>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-300 block font-mono">
                    {m.count} {m.count === 1 ? 'order' : 'orders'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {formatPrice(m.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Category Performance Breakdown */}
      <Card className="p-5 border-slate-850 bg-slate-900/20 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-textPearl border-b border-slate-800/60 pb-2.5">
          Sales & Orders by Category
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categoryPerformance.map((cat) => (
            <div key={cat.name} className="p-3 rounded-xl bg-slate-950/40 border border-slate-850 space-y-1">
              <span className="text-xs font-bold text-textPearl block truncate">{cat.name}</span>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/40">
                <span className="text-slate-400">{cat.totalSold} items sold</span>
                <span className="font-bold text-emerald-400 font-mono">{formatPrice(cat.totalRevenue)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default MenuAnalyticsTab;
