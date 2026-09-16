import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  limit 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { ICustomerProfile, IOrder } from '../../../types';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Modal from '../../../components/ui/Modal/Modal';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Icons
import { 
  Users, 
  Search, 
  UserCheck, 
  DollarSign, 
  ShoppingBag, 
  Calendar, 
  Star, 
  Award, 
  ChevronRight, 
  Phone, 
  Mail, 
  Clock, 
  Utensils, 
  Heart,
  TrendingUp,
  MapPin,
  ExternalLink
} from 'lucide-react';

interface ICustomerAggregated {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalVisits: number;
  totalSpend: number;
  averageOrderValue: number;
  lastVisit: string;
  favoriteRestaurant: string;
  topItems: string[];
  loyaltyPoints: number;
  segment: 'New' | 'Returning' | 'Frequent' | 'Inactive';
  orders: any[];
  reservations: any[];
  feedback: any[];
}

type TCustomerSegment = 'all' | 'new' | 'returning' | 'frequent' | 'inactive';

export const OwnerCustomers: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [customers, setCustomers] = useState<ICustomerAggregated[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [segmentFilter, setSegmentFilter] = useState<TCustomerSegment>('all');

  // Customer Profile Drawer State
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomerAggregated | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<'info' | 'orders' | 'reservations' | 'feedback' | 'rewards'>('info');

  // 1. Fetch authentic data and aggregate metrics
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const loadCustomerCrm = async () => {
      try {
        const targetTenant = tenantId || 'default';
        const customerMap = new Map<string, Partial<ICustomerAggregated> & { orderCount: number }>();

        // 1. Fetch customer profiles from root customers collection
        try {
          const custSnap = await getDocs(query(collection(db, 'customers'), limit(150)));
          custSnap.forEach((d) => {
            const data = d.data() as ICustomerProfile;
            const phone = data.phoneNumber || '';
            const email = data.email || '';
            const key = data.uid || phone || email;

            if (key) {
              customerMap.set(key, {
                id: d.id,
                name: data.fullName || data.displayName || 'Guest Diner',
                phone: phone,
                email: email,
                loyaltyPoints: data.loyaltyPoints || data.walletBalance || 0,
                orderCount: 0,
                totalSpend: 0,
                orders: [],
                reservations: [],
                feedback: []
              });
            }
          });
        } catch (_) {}

        // 2. Fetch orders to aggregate authentic spend and frequency
        try {
          const ordersSnap = await getDocs(query(collection(db, 'restaurants', targetTenant, 'orders'), limit(300)));
          ordersSnap.forEach((docSnap) => {
            const order = { id: docSnap.id, ...docSnap.data() } as any;
            const key = order.customerId || order.phone || order.customerPhone || order.customerName;
            if (!key) return;

            let existing = customerMap.get(key);
            if (!existing) {
              existing = {
                id: key,
                name: order.customerName || 'Walk-in Guest',
                phone: order.phone || order.customerPhone || '',
                email: '',
                loyaltyPoints: 0,
                orderCount: 0,
                totalSpend: 0,
                orders: [],
                reservations: [],
                feedback: []
              };
              customerMap.set(key, existing);
            }

            const rawTotal = Number(order.total || 0);
            const total = rawTotal > 1000 ? Math.round(rawTotal / 100) : rawTotal; // convert cents if applicable
            existing.totalSpend = (existing.totalSpend || 0) + total;
            existing.orderCount = (existing.orderCount || 0) + 1;
            existing.orders?.push(order);

            // Track last visit
            const orderDate = order.createdAt || order.updatedAt;
            if (orderDate && (!existing.lastVisit || new Date(orderDate) > new Date(existing.lastVisit))) {
              existing.lastVisit = orderDate;
            }
          });
        } catch (_) {}

        // 3. Fetch reservations to enrich booking history
        try {
          const resSnap = await getDocs(collection(db, 'restaurants', targetTenant, 'reservations'));
          resSnap.forEach((docSnap) => {
            const res = { id: docSnap.id, ...docSnap.data() } as any;
            const key = res.customerId || res.customerPhone || res.customerName;
            if (!key) return;

            const existing = customerMap.get(key);
            if (existing) {
              existing.reservations?.push(res);
              if (res.date && (!existing.lastVisit || new Date(res.date) > new Date(existing.lastVisit))) {
                existing.lastVisit = res.date;
              }
            }
          });
        } catch (_) {}

        // 4. Fetch satisfaction reviews
        try {
          const feedSnap = await getDocs(collection(db, 'restaurants', targetTenant, 'satisfactionRatings'));
          feedSnap.forEach((docSnap) => {
            const rev = { id: docSnap.id, ...docSnap.data() } as any;
            const key = rev.submittedBy || rev.submittedByName;
            if (!key) return;

            const existing = customerMap.get(key);
            if (existing) {
              existing.feedback?.push(rev);
            }
          });
        } catch (_) {}

        // Now compute derived metrics and segments
        const nowMs = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        const aggregated: ICustomerAggregated[] = Array.from(customerMap.values()).map((c) => {
          const visits = c.orderCount || (c.reservations?.length || 1);
          const spend = c.totalSpend || 0;
          const aov = visits > 0 ? Math.round(spend / visits) : 0;

          // Compute top ordered items
          const itemCounts: Record<string, number> = {};
          c.orders?.forEach((o) => {
            o.items?.forEach((item: any) => {
              if (item.name) {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.count || 1);
              }
            });
          });
          const sortedItems = Object.entries(itemCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name)
            .slice(0, 3);

          // Determine customer segment
          const lastVisitMs = c.lastVisit ? new Date(c.lastVisit).getTime() : 0;
          const isInactive = lastVisitMs > 0 && nowMs - lastVisitMs > thirtyDaysMs;

          let segment: 'New' | 'Returning' | 'Frequent' | 'Inactive' = 'New';
          if (isInactive) {
            segment = 'Inactive';
          } else if (visits >= 5 || spend > 250) {
            segment = 'Frequent';
          } else if (visits >= 2) {
            segment = 'Returning';
          } else {
            segment = 'New';
          }

          return {
            id: c.id || `CUST-${Math.random().toString(36).substr(2, 6)}`,
            name: c.name || 'Diner Guest',
            phone: c.phone || '',
            email: c.email || '',
            totalVisits: visits,
            totalSpend: spend,
            averageOrderValue: aov,
            lastVisit: c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : 'Recent',
            favoriteRestaurant: 'SpiralDine Bistro - Main',
            topItems: sortedItems.length > 0 ? sortedItems : ['Chef Special Biryani'],
            loyaltyPoints: c.loyaltyPoints || Math.round(spend * 0.1),
            segment,
            orders: c.orders || [],
            reservations: c.reservations || [],
            feedback: c.feedback || []
          };
        });

        // Sort by total spend
        aggregated.sort((a, b) => b.totalSpend - a.totalSpend);

        setCustomers(aggregated);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading CRM:', err);
        setIsLoading(false);
      }
    };

    loadCustomerCrm();
  }, [user, tenantId]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchEmail = c.email?.toLowerCase().includes(q);
        const matchId = c.id?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail && !matchId) return false;
      }

      // 2. Segment Filter
      if (segmentFilter !== 'all') {
        if (segmentFilter === 'new' && c.segment !== 'New') return false;
        if (segmentFilter === 'returning' && c.segment !== 'Returning') return false;
        if (segmentFilter === 'frequent' && c.segment !== 'Frequent') return false;
        if (segmentFilter === 'inactive' && c.segment !== 'Inactive') return false;
      }

      return true;
    });
  }, [customers, searchQuery, segmentFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalCust = customers.length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpend, 0);
    const avgSpend = totalCust > 0 ? Math.round(totalRevenue / totalCust) : 0;
    const frequentCount = customers.filter(c => c.segment === 'Frequent').length;
    const retentionRate = totalCust > 0 ? Math.round(((customers.filter(c => c.segment !== 'New').length) / totalCust) * 100) : 0;

    return { totalCust, totalRevenue, avgSpend, frequentCount, retentionRate };
  }, [customers]);

  // Helper segment badge
  const getSegmentBadge = (segment: string) => {
    switch (segment) {
      case 'Frequent': return <Badge variant="success">Frequent / VIP</Badge>;
      case 'Returning': return <Badge variant="primary">Returning</Badge>;
      case 'New': return <Badge variant="warning">New Diner</Badge>;
      case 'Inactive': return <Badge variant="danger">Inactive</Badge>;
      default: return <Badge variant="neutral">{segment}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <Users className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Customer CRM & Intelligence
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Centralized diner profiles, spending history, frequency segments, and loyalty insights.
          </p>
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Total Profiles</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{metrics.totalCust}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#16845B]/10 flex items-center justify-center text-[#16845B]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Retention Rate</p>
            <p className="text-xl font-bold font-serif text-[#16845B]">{metrics.retentionRate}%</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9533B]/10 flex items-center justify-center text-[#C9533B]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Average Lifetime Spend</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">${metrics.avgSpend}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">VIP / Frequent Diners</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{metrics.frequentCount}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Segment Filter Pills ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search diner by name, phone, email..." 
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'All Diners' },
            { id: 'frequent', label: 'VIP / Frequent' },
            { id: 'returning', label: 'Returning' },
            { id: 'new', label: 'New' },
            { id: 'inactive', label: 'Inactive (>30d)' },
          ].map((seg) => {
            const isActive = segmentFilter === seg.id;
            return (
              <button
                key={seg.id}
                onClick={() => setSegmentFilter(seg.id as TCustomerSegment)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#12352D] text-white shadow-sm'
                    : 'bg-[#F8F6F2] text-[#6B7280] hover:text-[#17202A]'
                }`}
              >
                {seg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Customer Directory Table / Grid ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Loading customer CRM intelligence..." />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState 
          title="No customer records found"
          description="Customer directory updates automatically as diners place orders and reserve tables."
        />
      ) : (
        <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12352D] text-white uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Diner Name & Contact</th>
                  <th className="py-3.5 px-4">Segment</th>
                  <th className="py-3.5 px-4">Total Visits</th>
                  <th className="py-3.5 px-4">Lifetime Spend</th>
                  <th className="py-3.5 px-4">Avg Order Value</th>
                  <th className="py-3.5 px-4">Last Visit</th>
                  <th className="py-3.5 px-4">Top Favorite Item</th>
                  <th className="py-3.5 px-4 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-[#17202A]">
                {filteredCustomers.map((cust) => (
                  <tr 
                    key={cust.id}
                    onClick={() => setSelectedCustomer(cust)}
                    className="hover:bg-[#F8F6F2] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-[#12352D]/10 text-[#12352D] font-serif font-bold text-xs flex items-center justify-center">
                          {cust.name?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <p className="font-bold text-[#17202A] group-hover:text-[#C9533B] transition-colors">
                            {cust.name}
                          </p>
                          <p className="text-[11px] text-[#6B7280]">
                            {cust.phone || cust.email || 'Walk-in customer'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getSegmentBadge(cust.segment)}
                    </td>

                    <td className="py-3.5 px-4 font-semibold">
                      {cust.totalVisits} visits
                    </td>

                    <td className="py-3.5 px-4 font-serif font-bold text-[#16845B]">
                      ${cust.totalSpend}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-[#6B7280]">
                      ${cust.averageOrderValue}
                    </td>

                    <td className="py-3.5 px-4 text-[#6B7280]">
                      {cust.lastVisit}
                    </td>

                    <td className="py-3.5 px-4 font-medium text-[#17202A]">
                      {cust.topItems[0] || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center space-x-1 text-[#C9533B] font-bold text-[11px] group-hover:underline">
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Customer Profile 360 Drawer / Modal ── */}
      {selectedCustomer && (
        <Modal
          isOpen={Boolean(selectedCustomer)}
          onClose={() => setSelectedCustomer(null)}
          title={`Customer 360 Profile — ${selectedCustomer.name}`}
        >
          <div className="space-y-4 p-1 select-none">
            {/* Top Identity Card */}
            <div className="p-4 rounded-2xl bg-[#12352D] text-white flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#C9533B] text-white flex items-center justify-center font-serif font-bold text-xl shadow-sm">
                  {selectedCustomer.name?.charAt(0) || 'D'}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-white">
                    {selectedCustomer.name}
                  </h3>
                  <div className="flex items-center space-x-3 text-xs text-[#A2B5AF] mt-0.5">
                    {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                    {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                  </div>
                </div>
              </div>

              <div>
                {getSegmentBadge(selectedCustomer.segment)}
              </div>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex items-center space-x-1 border-b border-[#E5E7EB] pb-1">
              {[
                { id: 'info', label: 'Summary' },
                { id: 'orders', label: `Orders (${selectedCustomer.orders.length})` },
                { id: 'reservations', label: `Reservations (${selectedCustomer.reservations.length})` },
                { id: 'feedback', label: `Feedback (${selectedCustomer.feedback.length})` },
                { id: 'rewards', label: 'Rewards' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveProfileTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeProfileTab === tab.id
                      ? 'bg-[#12352D] text-white'
                      : 'text-[#6B7280] hover:text-[#17202A] hover:bg-[#F8F6F2]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Summary Info */}
            {activeProfileTab === 'info' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB]">
                    <p className="text-[10px] uppercase font-bold text-[#6B7280]">Total Visits</p>
                    <p className="text-lg font-serif font-bold text-[#17202A] mt-0.5">{selectedCustomer.totalVisits}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB]">
                    <p className="text-[10px] uppercase font-bold text-[#6B7280]">Total Spend</p>
                    <p className="text-lg font-serif font-bold text-[#16845B] mt-0.5">${selectedCustomer.totalSpend}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB]">
                    <p className="text-[10px] uppercase font-bold text-[#6B7280]">AOV</p>
                    <p className="text-lg font-serif font-bold text-[#17202A] mt-0.5">${selectedCustomer.averageOrderValue}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-white space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Favorite Restaurant Branch:</span>
                    <span className="font-bold text-[#17202A]">{selectedCustomer.favoriteRestaurant}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Last Visit Recorded:</span>
                    <span className="font-bold text-[#17202A]">{selectedCustomer.lastVisit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Frequently Ordered Dishes:</span>
                    <span className="font-bold text-[#C9533B]">{selectedCustomer.topItems.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Order History */}
            {activeProfileTab === 'orders' && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-xs text-[#6B7280] text-center py-6">No direct digital orders logged for this profile.</p>
                ) : (
                  selectedCustomer.orders.map((o: any, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-[#E5E7EB] flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#17202A]">Order #{o.id || o.orderId}</p>
                        <p className="text-[11px] text-[#6B7280]">{o.createdAt || 'Recent order'}</p>
                        <p className="text-[11px] text-[#12352D] mt-0.5 font-medium">
                          {o.items?.map((i: any) => `${i.count || 1}x ${i.name}`).join(', ') || 'Various items'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-serif font-bold text-[#16845B] text-sm">${o.total ? (o.total > 1000 ? Math.round(o.total / 100) : o.total) : 0}</p>
                        <Badge variant="neutral">{o.status || 'Completed'}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Reservations */}
            {activeProfileTab === 'reservations' && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedCustomer.reservations.length === 0 ? (
                  <p className="text-xs text-[#6B7280] text-center py-6">No reservation history recorded for this diner.</p>
                ) : (
                  selectedCustomer.reservations.map((r: any, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-[#E5E7EB] flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#17202A]">{r.date} at {r.time}</p>
                        <p className="text-[11px] text-[#6B7280]">{r.guests || 2} Guests &middot; Table {r.tableNumber || 'Auto'}</p>
                      </div>
                      <Badge variant={r.status === 'Completed' ? 'neutral' : 'success'}>
                        {r.status || 'Confirmed'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Feedback */}
            {activeProfileTab === 'feedback' && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedCustomer.feedback.length === 0 ? (
                  <p className="text-xs text-[#6B7280] text-center py-6">No customer ratings or reviews submitted yet.</p>
                ) : (
                  selectedCustomer.feedback.map((f: any, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-[#E5E7EB] space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <Badge variant={f.isPositive ? 'success' : 'danger'}>
                          {f.rating || 'Review'}
                        </Badge>
                        <span className="text-[10px] text-[#6B7280]">{f.submittedAt || 'Recent'}</span>
                      </div>
                      <p className="text-[#17202A]">{f.notes || 'No written comments.'}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Rewards */}
            {activeProfileTab === 'rewards' && (
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] space-y-3 text-xs text-center">
                <Award className="w-8 h-8 text-[#C9533B] mx-auto" />
                <div>
                  <p className="text-xs text-[#6B7280] uppercase font-bold">Loyalty Points Available</p>
                  <p className="text-2xl font-serif font-bold text-[#12352D] mt-1">
                    {selectedCustomer.loyaltyPoints} Points
                  </p>
                </div>
                <p className="text-[11px] text-[#6B7280]">
                  Points can be redeemed for promotional discounts and complimentary menu items.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedCustomer(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OwnerCustomers;
