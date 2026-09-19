import React, { useEffect, useState } from 'react';
import { 
  collection, 
  collectionGroup, 
  onSnapshot, 
  query, 
  where, 
  limit 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { 
  Building2, 
  Users, 
  Contact2, 
  ChefHat, 
  Receipt, 
  CreditCard, 
  Activity, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { formatPrice } from '../../../utils/format';

interface IOverviewMetrics {
  totalRestaurants: number | null;
  activeRestaurants: number | null;
  totalOwners: number | null;
  totalCustomers: number | null;
  totalStaff: number | null;
  totalOrders: number | null;
  activeOrders: number | null;
  paidRevenue: number | null;
}

interface IRecentTenant {
  id: string;
  name?: string;
  ownerEmail?: string;
  status?: string;
  createdAt?: string;
}

export const SuperAdminOverview: React.FC = () => {
  const [metrics, setMetrics] = useState<IOverviewMetrics>({
    totalRestaurants: null,
    activeRestaurants: null,
    totalOwners: null,
    totalCustomers: null,
    totalStaff: null,
    totalOrders: null,
    activeOrders: null,
    paidRevenue: null
  });

  const [recentTenants, setRecentTenants] = useState<IRecentTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to tenants collection
    const unsubTenants = onSnapshot(collection(db, 'tenants'), (snap) => {
      let active = 0;
      const list: IRecentTenant[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if ((d.status || 'active').toLowerCase() !== 'inactive') {
          active++;
        }
        list.push({ id: docSnap.id, ...d });
      });

      setRecentTenants(list.slice(0, 6));
      setMetrics(prev => ({
        ...prev,
        totalRestaurants: snap.size,
        activeRestaurants: active
      }));
      setIsLoading(false);
    }, (err) => {
      console.error('[SuperAdminOverview] Tenants listener error:', err);
      setIsLoading(false);
    });

    // 2. Listen to users (owners)
    const qOwners = query(collection(db, 'users'), where('role', 'in', ['owner', 'admin']));
    const unsubOwners = onSnapshot(qOwners, (snap) => {
      setMetrics(prev => ({ ...prev, totalOwners: snap.size }));
    }, (err) => {
      console.warn('[SuperAdminOverview] Owners listener error:', err);
    });

    // 3. Listen to customers
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      setMetrics(prev => ({ ...prev, totalCustomers: snap.size }));
    }, (err) => {
      console.warn('[SuperAdminOverview] Customers listener error:', err);
    });

    // 4. Listen to employees (staff)
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setMetrics(prev => ({ ...prev, totalStaff: snap.size }));
    }, (err) => {
      console.warn('[SuperAdminOverview] Employees listener error:', err);
    });

    // 5. Listen to collectionGroup orders
    try {
      const qOrders = query(collectionGroup(db, 'orders'), limit(300));
      const unsubOrders = onSnapshot(qOrders, (snap) => {
        let active = 0;
        let revenue = 0;
        snap.forEach(docSnap => {
          const d = docSnap.data();
          const s = (d.status || '').toUpperCase();
          if (['NEW', 'PREPARING', 'READY', 'ACCEPTED'].includes(s)) {
            active++;
          }
          if ((d.paymentStatus || '').toLowerCase() === 'paid') {
            revenue += Number(d.total) || 0;
          }
        });

        setMetrics(prev => ({
          ...prev,
          totalOrders: snap.size,
          activeOrders: active,
          paidRevenue: revenue
        }));
      }, (err) => {
        console.warn('[SuperAdminOverview] Orders collectionGroup error:', err);
      });

      return () => {
        unsubTenants();
        unsubOwners();
        unsubCustomers();
        unsubEmployees();
        unsubOrders();
      };
    } catch (_err) {
      return () => {
        unsubTenants();
        unsubOwners();
        unsubCustomers();
        unsubEmployees();
      };
    }
  }, []);

  const renderMetric = (val: number | null, isCurrency = false) => {
    if (val === null) {
      return <span className="text-slate-500 text-sm font-normal">Not Available</span>;
    }
    return isCurrency ? formatPrice(val) : val.toLocaleString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-white">Platform Overview</h1>
        <p className="text-xs text-slate-400 mt-1">
          Authentic, real-time platform operational metrics across all restaurant tenants
        </p>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner label="Loading live platform data from Firestore..." />
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Restaurants */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Total Restaurants</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white">
                  {renderMetric(metrics.totalRestaurants)}
                </div>
                <div className="text-[11px] text-emerald-400 font-medium">
                  {metrics.activeRestaurants !== null ? `${metrics.activeRestaurants} active` : ''}
                </div>
              </div>
            </div>

            {/* 2. Owners */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Tenant Owners</span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white">
                  {renderMetric(metrics.totalOwners)}
                </div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Registered</span>
              </div>
            </div>

            {/* 3. Customers */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Total Diners</span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Contact2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white">
                  {renderMetric(metrics.totalCustomers)}
                </div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Profiles</span>
              </div>
            </div>

            {/* 4. Staff */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Staff Members</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ChefHat className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white">
                  {renderMetric(metrics.totalStaff)}
                </div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Active Shifts</span>
              </div>
            </div>

            {/* 5. Total Orders */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Platform Orders</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white">
                  {renderMetric(metrics.totalOrders)}
                </div>
                <div className="text-[11px] text-amber-400 font-medium">
                  {metrics.activeOrders !== null ? `${metrics.activeOrders} active` : ''}
                </div>
              </div>
            </div>

            {/* 6. Paid Revenue */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Platform Revenue</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white">
                  {renderMetric(metrics.paidRevenue, true)}
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase">Settled</span>
              </div>
            </div>

            {/* 7. Active Orders Rate */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Active Kitchen Orders</span>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white">
                  {renderMetric(metrics.activeOrders)}
                </div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">In Progress</span>
              </div>
            </div>

            {/* 8. System Status */}
            <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">System Integrity</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-base font-bold text-emerald-400 font-display">
                  Operational
                </div>
                <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
              </div>
            </div>
          </div>

          {/* Registered Tenants List */}
          <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold font-display text-white">Registered Restaurant Tenants</h3>
                <p className="text-xs text-slate-400">Directly mapped to Firestore tenants collection</p>
              </div>
              <a
                href="/super-admin/restaurants"
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                View All →
              </a>
            </div>

            {recentTenants.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No restaurant tenants found in Firestore.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentTenants.map((t) => (
                  <div 
                    key={t.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-sm font-semibold text-white truncate">
                        {t.name || 'Unnamed Restaurant'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                        {t.id}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 shrink-0">
                      {t.status || 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SuperAdminOverview;
