import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query,
  limit,
  doc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { ITenant } from '../../../types';
import { formatPrice } from '../../../utils/format';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';
import Tabs from '../../../components/ui/Tabs/Tabs';
import Switch from '../../../components/ui/Switch/Switch';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { 
  LayoutDashboard, 
  LifeBuoy, 
  Flag, 
  ShieldAlert, 
  Sliders, 
  CheckCircle} from 'lucide-react';

interface ISupportTicket {
  id: string;
  subject: string;
  restaurantName: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
  assignedTo: string;
  createdAt: string;
}

interface IFeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
}

interface IAuditLog {
  id: string;
  action: string;
  target: string;
  userEmail: string;
  timestamp: string;
}

export const SuperAdminOverview: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Database lists
  const [tenants, setTenants] = useState<ITenant[]>([]);
  const [tickets, setTickets] = useState<ISupportTicket[]>([]);
  const [flags, setFlags] = useState<IFeatureFlag[]>([]);
  const [auditLogs, setAuditLogs] = useState<IAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // System settings state
  const [brandingTitle, setBrandingTitle] = useState('Spiral Dine');
  const [globalTaxRate, setGlobalTaxRate] = useState<number>(8);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [seedingTenantId, setSeedingTenantId] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedData = async () => {
    if (!import.meta.env.DEV) {
      toast.error('Database seeding is strictly disabled in production.');
      return;
    }
    if (!seedingTenantId.trim()) {
      toast.error('Please enter a target Tenant ID to seed.');
      return;
    }
    setIsSeeding(true);
    try {
      const { seedDatabase } = await import('../../../firebase/seed');
      await seedDatabase(seedingTenantId.trim());
      toast.success(`Successfully seeded sample data into workspace: ${seedingTenantId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Seeding operation failed.');
    } finally {
      setIsSeeding(false);
    }
  };

  // Subscribe to Platform collections
  useEffect(() => {
    setIsLoading(true);

    // 1. Subscribe to Tenants (bounded to 30)
    const qTenants = query(collection(db, 'tenants'), limit(30));
    const unsubTenants = onSnapshot(qTenants, (snap) => {
      const list: ITenant[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ITenant));
      setTenants(list);
      setIsLoading(false);
    });

    // 2. Subscribe to Support tickets (bounded to 30)
    const qTickets = query(collection(db, 'supportTickets'), limit(30));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      const list: ISupportTicket[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as ISupportTicket));
      setTickets(list);
    });

    // 3. Subscribe to Feature flags
    const unsubFlags = onSnapshot(collection(db, 'featureFlags'), (snap) => {
      const list: IFeatureFlag[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as IFeatureFlag));
      
      // Seed default flags if collection is empty
      if (snap.empty) {
        const defaults: IFeatureFlag[] = [
          { id: 'inventory', name: 'Inventory Management', enabled: true },
          { id: 'analytics', name: 'Sales Analytics Suite', enabled: true },
          { id: 'employees', name: 'Employee Module', enabled: true },
          { id: 'reports', name: 'Reports Generation', enabled: true },
          { id: 'qr_order', name: 'Diner QR Ordering', enabled: true }
        ];
        defaults.forEach(async (flg) => {
          await setDoc(doc(db, 'featureFlags', flg.id), flg);
        });
      }
      setFlags(list);
    });

    // 4. Subscribe to Audit Logs (bounded to 30)
    const qAudit = query(collection(db, 'auditLogs'), limit(30));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      const list: IAuditLog[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as IAuditLog));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(list);
    });

    return () => {
      unsubTenants();
      unsubTickets();
      unsubFlags();
      unsubAudit();
    };
  }, []);

  // Compute Platform MRR/ARR
  const getSubscriptionPrice = (tier: string) => {
    if (tier === 'enterprise') return 24900; // in cents
    if (tier === 'pro') return 9900;
    return 4900;
  };

  const activeTenants = tenants.filter(t => t.status === 'active' || t.status === 'trial');
  const mrr = activeTenants.reduce((sum, t) => sum + getSubscriptionPrice(t.planTier), 0);
  const arr = mrr * 12;

  // Actions Support Tickets
  const handleResolveTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), { status: 'resolved' });
      toast.success('Ticket marked as resolved!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update ticket.');
    }
  };

  // Toggle Feature Flag
  const handleToggleFlag = async (flagId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'featureFlags', flagId), { enabled: !currentStatus });
      toast.success('Feature flag state updated.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to change flag state.');
    }
  };

  // Save Branding Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'systemSettings', 'globalConfig'), {
        brandingTitle,
        globalTaxRate,
        defaultCurrency,
        updatedAt: new Date().toISOString()
      });
      toast.success('Global settings updated successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const tabItems = [
    { id: 'overview', label: 'Platform Stats', icon: LayoutDashboard },
    { id: 'tickets', label: 'Support Queue', icon: LifeBuoy },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
    { id: 'audit', label: 'Audit Trails', icon: ShieldAlert },
    { id: 'settings', label: 'Platform Config', icon: Sliders }
  ];

  return (
    <div className="space-y-6 text-left select-none">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-display font-extrabold text-textPearl">Super Admin Panel</h1>
        <p className="text-xs text-mutedAsh font-semibold">Global SaaS monitoring, subscriptions aggregated ARR, and feature flags.</p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabItems} activeTabId={activeTab} onTabChange={setActiveTab} />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner label="Compiling aggregate platform metrics..." />
        </div>
      ) : activeTab === 'overview' ? (
        /* OVERVIEW TAB CONTENT */
        <div className="space-y-6">
          {/* Platform KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-5 border-slate-850 bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-450">Active Workspaces</span>
              <h2 className="text-2xl font-display font-extrabold text-textPearl mt-1">
                {tenants.filter(t => t.status === 'active').length} / {tenants.length}
              </h2>
              <span className="text-[10px] text-slate-500 block mt-1.5">Registered workspaces</span>
            </Card>

            <Card className="p-5 border-slate-850 bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-450">Platform MRR</span>
              <h2 className="text-2xl font-display font-extrabold text-textPearl mt-1">
                {formatPrice(mrr)}
              </h2>
              <span className="text-[10px] text-emerald-500 font-semibold block mt-1.5">Monthly Recurring Revenue</span>
            </Card>
 
            <Card className="p-5 border-slate-850 bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-450">Projected ARR</span>
              <h2 className="text-2xl font-display font-extrabold text-textPearl mt-1">
                {formatPrice(arr)}
              </h2>
              <span className="text-[10px] text-sky-500 font-semibold block mt-1.5">Annual Projected Run Rate</span>
            </Card>

            <Card className="p-5 border-slate-850 bg-slate-900/40">
              <span className="text-xs font-semibold text-slate-450">Trial Accounts</span>
              <h2 className="text-2xl font-display font-extrabold text-textPearl mt-1">
                {tenants.filter(t => t.status === 'trial').length} trials
              </h2>
              <span className="text-[10px] text-slate-500 block mt-1.5">Awaiting conversion</span>
            </Card>
          </div>

          {/* Seeding utility */}
          {import.meta.env.DEV && (
            <Card className="p-5 border-slate-850 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-bold text-sm text-textPearl text-left">Workspace Database Seeding</h3>
                <p className="text-[10px] text-slate-500 text-left">Insert 20 menu items, 8 tables, 5 employees, active orders, and safety inventory levels.</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
                <input 
                  type="text" 
                  placeholder="E.g. test-restaurant" 
                  value={seedingTenantId} 
                  onChange={(e) => setSeedingTenantId(e.target.value)} 
                  className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-textPearl placeholder-slate-650 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-44" 
                />
                <Button 
                  size="sm" 
                  isLoading={isSeeding} 
                  onClick={handleSeedData} 
                  className="text-xs px-4"
                >
                  Seed Tenant
                </Button>
              </div>
            </Card>
          )}

          {/* Aggregate health details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-5 border-slate-850 bg-slate-900/40 space-y-4">
              <div>
                <h3 className="font-display font-bold text-sm text-textPearl">Firebase Cloud Usage</h3>
                <span className="text-[10px] text-slate-500">API throughput metrics</span>
              </div>
              <div className="space-y-3.5 text-xs text-slate-400 font-semibold">
                <div className="flex justify-between">
                  <span>Firestore Read Operations</span>
                  <span className="text-textPearl">12.5k / day (2.5%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Firestore Write Operations</span>
                  <span className="text-textPearl">1.8k / day (0.9%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Firebase Storage Usage</span>
                  <span className="text-textPearl">2.4 GB / 10 GB (24%)</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-4">
              <div>
                <h3 className="font-display font-bold text-sm text-textPearl">Status Summary</h3>
                <span className="text-[10px] text-slate-500">Workspace status matrix</span>
              </div>
              <div className="space-y-2 text-xs font-medium text-slate-400">
                <div className="flex justify-between">
                  <span>Active Merchants</span>
                  <span className="text-emerald-500 font-bold">{tenants.filter(t => t.status === 'active').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Suspended Workspaces</span>
                  <span className="text-red-400 font-bold">{tenants.filter(t => t.status === 'suspended').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Starter Tier</span>
                  <span className="text-textPearl">{tenants.filter(t => t.planTier === 'starter').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Enterprise Tier</span>
                  <span className="text-primary font-bold">{tenants.filter(t => t.planTier === 'enterprise').length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : activeTab === 'tickets' ? (
        /* SUPPORT TICKETS QUEUE */
        <div className="space-y-4">
          <h2 className="text-sm font-display font-bold text-textPearl">Support Ticket Inbox</h2>
          
          {tickets.length === 0 ? (
            <Card className="p-8 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
              <CheckCircle className="w-10 h-10 text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-450">No support tickets pending. Inbox clean!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map((t) => (
                <Card 
                  key={t.id} 
                  className={`p-4 border-slate-850 bg-slate-900/40 flex flex-col justify-between space-y-3.5 ${
                    t.status === 'resolved' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase block">{t.restaurantName}</span>
                      <h4 className="font-semibold text-textPearl text-sm mt-0.5">{t.subject}</h4>
                    </div>
                    <Badge variant={t.priority === 'high' ? 'danger' : 'warning'}>
                      {t.priority}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-850/60">
                    <span className="text-[10px] text-slate-500 font-medium">Assigned: {t.assignedTo}</span>
                    
                    {t.status === 'open' ? (
                      <Button
                        size="sm"
                        onClick={() => handleResolveTicket(t.id)}
                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-bold rounded-lg"
                      >
                        Resolve
                      </Button>
                    ) : (
                      <Badge variant="success">Resolved</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'flags' ? (
        /* FEATURE FLAGS TAB */
        <Card className="p-5 border-slate-850 bg-slate-900/40 max-w-xl">
          <h2 className="text-sm font-display font-bold text-textPearl uppercase tracking-wide border-b border-slate-850 pb-2 mb-4">
            Global Feature Access Controls
          </h2>
          <p className="text-xs text-mutedAsh mb-6">
            Enable or disable specific features dynamically across all merchant tenant workspaces.
          </p>

          <div className="space-y-4">
            {flags.map((flg) => (
              <div key={flg.id} className="flex justify-between items-center p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                <div>
                  <span className="font-semibold text-textPearl text-xs block">{flg.name}</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">Code identifier: {flg.id}</span>
                </div>
                <Switch 
                  checked={flg.enabled} 
                  onChange={() => handleToggleFlag(flg.id, flg.enabled)} 
                />
              </div>
            ))}
          </div>
        </Card>
      ) : activeTab === 'audit' ? (
        /* AUDIT TRAILS TAB */
        <div className="space-y-4">
          <h2 className="text-sm font-display font-bold text-textPearl">Security Logs & Audits</h2>
          <p className="text-xs text-mutedAsh">Immutable logs tracking system adjustments and restaurant plan shifts.</p>

          <Card className="p-0 overflow-hidden border-slate-850">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-850/60 text-slate-500 font-semibold bg-slate-900/10">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target Instance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 text-slate-350">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-555 italic">No security logs recorded.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/15">
                        <td className="p-3 font-semibold text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-3 font-semibold text-textPearl">{log.userEmail}</td>
                        <td className="p-3">
                          <span className="font-bold text-primary">{log.action}</span>
                        </td>
                        <td className="p-3 font-medium">{log.target}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* SYSTEM BRANDING SETTINGS */
        <Card className="p-6 border-slate-850 bg-slate-900/40 max-w-xl">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <h2 className="text-sm font-display font-bold text-textPearl uppercase tracking-wide border-b border-slate-850 pb-2 mb-4">
              SaaS Branding & Configs
            </h2>

            <Input 
              label="SaaS Platform Branding Title"
              type="text"
              value={brandingTitle}
              onChange={(e) => setBrandingTitle(e.target.value)}
              disabled={isSavingSettings}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Default Platform Tax rate (%)"
                type="number"
                value={globalTaxRate}
                onChange={(e) => setGlobalTaxRate(Number(e.target.value))}
                disabled={isSavingSettings}
                required
              />
              <Select 
                label="Base Currency Symbol"
                options={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'GBP', label: 'GBP (£)' },
                  { value: 'EUR', label: 'EUR (€)' }
                ]}
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                disabled={isSavingSettings}
              />
            </div>

            <div className="pt-4 border-t border-slate-850 text-right">
              <Button
                type="submit"
                isLoading={isSavingSettings}
                className="px-6"
              >
                Save platform configs
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};
export default SuperAdminOverview;
