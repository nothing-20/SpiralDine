import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  getDocs, 
  where 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { logAuditEvent } from '../../../shared/services/auditService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Modal from '../../../components/ui/Modal/Modal';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Toast & Icons
import toast from 'react-hot-toast';
import { 
  AlertCircle, 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  ExternalLink, 
  Clock, 
  Search, 
  Filter, 
  DollarSign, 
  Package, 
  Users, 
  Activity, 
  Check, 
  UserCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export type TAlertCategory = 'Critical' | 'Operations' | 'Inventory' | 'Finance' | 'Customers' | 'Staff' | 'System';
export type TAlertSeverity = 'critical' | 'warning' | 'info';

export interface IAlertRecord {
  id: string;
  title?: string;
  message: string;
  category: TAlertCategory;
  severity: TAlertSeverity;
  source: string;
  restaurantId?: string;
  restaurantName?: string;
  read: boolean;
  resolved: boolean;
  assignedTo?: string;
  assignedToName?: string;
  relatedEntity?: {
    type: 'inventory' | 'orders' | 'feedback' | 'tables' | 'staff' | 'billing';
    id?: string;
    path: string;
  };
  createdAt: string;
  resolvedAt?: string;
}

export const OwnerAlerts: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<IAlertRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'resolved' | 'unresolved'>('unresolved');

  // Assign Alert Modal
  const [assignAlertModal, setAssignAlertModal] = useState<IAlertRecord | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // 1. Subscribe to Firestore alerts
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const targetTenant = tenantId || 'default';

    // Fetch staff for assignment
    const fetchStaff = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'employees'), where('tenantId', '==', targetTenant)));
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setEmployees(list);
      } catch (_) {}
    };
    fetchStaff();

    // Listen to alerts collection
    const unsub = onSnapshot(
      collection(db, 'restaurants', targetTenant, 'alerts'),
      (snapshot) => {
        const list: IAlertRecord[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            title: data.title || 'System Notification',
            message: data.message || data.text || 'Alert condition observed',
            category: data.category || (data.severity === 'critical' ? 'Critical' : 'Operations'),
            severity: data.severity || (data.type === 'critical' ? 'critical' : 'warning'),
            source: data.source || 'Operational Watcher',
            restaurantId: targetTenant,
            restaurantName: 'SpiralDine Bistro',
            read: Boolean(data.read),
            resolved: Boolean(data.resolved),
            assignedTo: data.assignedTo || '',
            assignedToName: data.assignedToName || '',
            relatedEntity: data.relatedEntity || (
              data.category === 'Inventory' ? { type: 'inventory', path: '/owner/inventory' } :
              data.category === 'Customers' ? { type: 'feedback', path: '/owner/feedback' } :
              undefined
            ),
            createdAt: data.createdAt || new Date().toISOString()
          });
        });

        // Sort by timestamp descending
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setAlerts(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Alerts stream error:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [user, tenantId]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = a.title?.toLowerCase().includes(q);
        const matchMsg = a.message?.toLowerCase().includes(q);
        const matchSource = a.source?.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg && !matchSource) return false;
      }

      // 2. Status Filter
      if (statusFilter === 'unread' && a.read) return false;
      if (statusFilter === 'resolved' && !a.resolved) return false;
      if (statusFilter === 'unresolved' && a.resolved) return false;

      // 3. Category Filter
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;

      // 4. Severity Filter
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;

      return true;
    });
  }, [alerts, searchQuery, statusFilter, categoryFilter, severityFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = alerts.length;
    const critical = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
    const unread = alerts.filter(a => !a.read).length;
    const resolved = alerts.filter(a => a.resolved).length;

    return { total, critical, unread, resolved };
  }, [alerts]);

  // Mark single alert as Read
  const handleMarkAsRead = async (alertId: string) => {
    const targetTenant = tenantId || 'default';
    try {
      await updateDoc(doc(db, 'restaurants', targetTenant, 'alerts', alertId), {
        read: true,
        updatedAt: new Date().toISOString()
      });
      toast.success('Alert marked as read');
    } catch (_) {}
  };

  // Mark all unread as Read
  const handleMarkAllRead = async () => {
    const targetTenant = tenantId || 'default';
    const unreadList = alerts.filter(a => !a.read);
    try {
      await Promise.all(
        unreadList.map(a => updateDoc(doc(db, 'restaurants', targetTenant, 'alerts', a.id), { read: true }))
      );
      toast.success('All alerts marked as read');
    } catch (_) {}
  };

  // Mark as Resolved
  const handleToggleResolved = async (alert: IAlertRecord) => {
    const targetTenant = alert.restaurantId || tenantId || 'default';
    const newStatus = !alert.resolved;
    try {
      await updateDoc(doc(db, 'restaurants', targetTenant, 'alerts', alert.id), {
        resolved: newStatus,
        read: true,
        resolvedAt: newStatus ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        module: 'Alerts',
        action: 'STATUS_CHANGE',
        targetEntity: `Alert "${alert.title || alert.id}" marked ${newStatus ? 'Resolved' : 'Unresolved'}`
      });

      toast.success(newStatus ? 'Alert resolved' : 'Alert reopened');
    } catch (err) {
      console.error('Resolve alert error:', err);
      toast.error('Failed to update resolution status');
    }
  };

  // Assign alert to staff member
  const handleSaveAssignment = async () => {
    if (!assignAlertModal) return;
    setIsAssigning(true);
    const targetTenant = assignAlertModal.restaurantId || tenantId || 'default';
    const staff = employees.find(e => e.id === selectedStaffId);

    try {
      await updateDoc(doc(db, 'restaurants', targetTenant, 'alerts', assignAlertModal.id), {
        assignedTo: selectedStaffId || null,
        assignedToName: staff ? (staff.fullName || staff.name) : null,
        updatedAt: new Date().toISOString()
      });

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        module: 'Alerts',
        action: 'UPDATE',
        targetEntity: `Alert "${assignAlertModal.title || assignAlertModal.id}" assigned to ${staff ? staff.fullName : 'Unassigned'}`
      });

      toast.success('Alert assigned successfully');
      setAssignAlertModal(null);
    } catch (err) {
      console.error('Assign error:', err);
      toast.error('Failed to assign alert');
    } finally {
      setIsAssigning(false);
    }
  };

  // Helper category icon
  const getCategoryIcon = (category: TAlertCategory) => {
    switch (category) {
      case 'Inventory': return <Package className="w-4 h-4 text-amber-600" />;
      case 'Finance': return <DollarSign className="w-4 h-4 text-[#16845B]" />;
      case 'Customers': return <Users className="w-4 h-4 text-[#C9533B]" />;
      case 'Staff': return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'Critical': return <ShieldAlert className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4 text-[#12352D]" />;
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <Bell className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Owner Alert Center
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Real-time operational alerts, low stock threshold warnings, unresolved customer escalations, and system events.
          </p>
        </div>

        {metrics.unread > 0 && (
          <Button 
            variant="secondary" 
            onClick={handleMarkAllRead}
            className="text-xs font-bold text-[#12352D] border-[#12352D]/20 hover:bg-[#12352D]/5"
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Critical Pending</p>
            <p className="text-xl font-bold font-serif text-red-600">{metrics.critical}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9533B]/10 flex items-center justify-center text-[#C9533B]">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Unread Alerts</p>
            <p className="text-xl font-bold font-serif text-[#C9533B]">{metrics.unread}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Total Logged</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{metrics.total}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#16845B]/10 flex items-center justify-center text-[#16845B]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Resolved</p>
            <p className="text-xl font-bold font-serif text-[#16845B]">{metrics.resolved}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search alerts, messages, source..." 
          />
        </div>

        <div className="flex items-center space-x-2.5 overflow-x-auto w-full md:w-auto">
          {/* Status View */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="unresolved">Pending / Unresolved</option>
            <option value="unread">Unread Only</option>
            <option value="resolved">Resolved</option>
            <option value="all">All Alerts</option>
          </select>

          {/* Category View */}
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Critical">Critical</option>
            <option value="Operations">Operations</option>
            <option value="Inventory">Inventory</option>
            <option value="Finance">Finance</option>
            <option value="Customers">Customers</option>
            <option value="Staff">Staff</option>
            <option value="System">System</option>
          </select>

          {/* Severity View */}
          <select 
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* ── Main Alerts Registry ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Connecting to real-time alert center..." />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <EmptyState 
          title="No alerts matching criteria"
          description={
            statusFilter === 'unresolved'
              ? "All systems operational! There are no unresolved issues or critical warnings at this time."
              : "No alert documents recorded matching your active filters."
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`p-4 rounded-2xl border transition-all shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                !alert.read ? 'bg-white border-[#C9533B]/40' : 'bg-white/80 border-[#E5E7EB]'
              }`}
            >
              {/* Left Column: Icon & Message */}
              <div className="flex items-start space-x-3.5 min-w-[300px]">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  alert.severity === 'critical' ? 'bg-red-500/15 border border-red-500/30' :
                  alert.severity === 'warning' ? 'bg-amber-500/15 border border-amber-500/30' :
                  'bg-[#12352D]/10 border border-[#12352D]/20'
                }`}>
                  {getCategoryIcon(alert.category)}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-[#17202A]">
                      {alert.title}
                    </h3>
                    <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'}>
                      {alert.category}
                    </Badge>
                    {!alert.read && (
                      <span className="w-2 h-2 rounded-full bg-[#C9533B] animate-pulse" title="Unread" />
                    )}
                  </div>

                  <p className="text-xs text-[#17202A] mt-1 leading-relaxed">
                    {alert.message}
                  </p>

                  <div className="flex items-center space-x-3 text-[11px] text-[#6B7280] mt-1.5">
                    <span>Source: <strong className="text-[#12352D]">{alert.source}</strong></span>
                    <span>&middot;</span>
                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Middle Column: Assignment */}
              <div className="flex items-center space-x-4 text-xs text-[#17202A] border-y md:border-y-0 md:border-x border-[#E5E7EB] py-2 md:py-0 md:px-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#6B7280]">Assigned To</p>
                  <p className="font-bold text-[#17202A] mt-0.5 truncate max-w-[130px]">
                    {alert.assignedToName || 'Unassigned'}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-bold text-[#6B7280]">Status</p>
                  <Badge variant={alert.resolved ? 'success' : 'warning'}>
                    {alert.resolved ? 'Resolved' : 'Pending'}
                  </Badge>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center space-x-2 shrink-0 justify-end">
                {/* Jump to related entity if available */}
                {alert.relatedEntity?.path && (
                  <button
                    onClick={() => navigate(alert.relatedEntity!.path)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#12352D] hover:bg-[#F8F6F2] flex items-center space-x-1 border border-[#E5E7EB]"
                    title="Open Affected Entity"
                  >
                    <span>View Entity</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Assign Button */}
                <button
                  onClick={() => {
                    setAssignAlertModal(alert);
                    setSelectedStaffId(alert.assignedTo || '');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#6B7280] hover:text-[#17202A] hover:bg-[#F8F6F2]"
                  title="Assign Alert"
                >
                  Assign
                </button>

                {/* Mark Resolved Toggle */}
                <button
                  onClick={() => handleToggleResolved(alert)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                    alert.resolved
                      ? 'bg-[#E5E7EB] text-[#6B7280] hover:bg-[#D1D5DB]'
                      : 'bg-[#16845B] text-white hover:bg-[#136E4B] shadow-sm'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{alert.resolved ? 'Reopen' : 'Resolve'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Assign Alert Modal ── */}
      {assignAlertModal && (
        <Modal
          isOpen={Boolean(assignAlertModal)}
          onClose={() => setAssignAlertModal(null)}
          title={`Assign Alert Responsibility`}
        >
          <div className="space-y-4 p-1">
            <p className="text-xs text-[#6B7280]">
              Delegate this alert to a manager or staff member for resolution and operational follow-up.
            </p>

            <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB] text-xs">
              <p className="font-bold text-[#17202A]">{assignAlertModal.title}</p>
              <p className="text-[#6B7280] mt-0.5">{assignAlertModal.message}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Select Assignee</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
              >
                <option value="">-- Unassigned --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName || emp.name} ({emp.role || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <Button variant="secondary" onClick={() => setAssignAlertModal(null)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSaveAssignment}
                disabled={isAssigning}
                className="bg-[#12352D] hover:bg-[#1A473C] text-white"
              >
                {isAssigning ? 'Saving...' : 'Confirm Assignment'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OwnerAlerts;
