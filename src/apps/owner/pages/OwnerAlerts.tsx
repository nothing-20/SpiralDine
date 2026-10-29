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
import { alertService, TAlertPurgeFilter } from '../../../shared/services/alertService';

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
  Sparkles,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  RefreshCw,
  X,
  AlertOctagon
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

  // Multi-Selection state
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());

  // Assign Alert Modal
  const [assignAlertModal, setAssignAlertModal] = useState<IAlertRecord | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Single Delete Confirmation Modal
  const [deleteTargetAlert, setDeleteTargetAlert] = useState<IAlertRecord | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState<boolean>(false);

  // Bulk Delete Confirmation Modal
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);

  // Maintenance & Purge Modal
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [purgingLabel, setPurgingLabel] = useState<string>('');

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
    const expiryCount = alerts.filter(a => {
      const src = String(a.source || '').toLowerCase();
      const title = String(a.title || '').toLowerCase();
      const msg = String(a.message || '').toLowerCase();
      return src.includes('expiry') || title.includes('expired') || msg.includes('expired');
    }).length;

    return { total, critical, unread, resolved, expiryCount };
  }, [alerts]);

  // Multi-Selection helpers
  const allFilteredSelected = useMemo(() => {
    if (filteredAlerts.length === 0) return false;
    return filteredAlerts.every(a => selectedAlertIds.has(a.id));
  }, [filteredAlerts, selectedAlertIds]);

  const toggleSelectAlert = (alertId: string) => {
    setSelectedAlertIds(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      // Unselect all currently filtered
      setSelectedAlertIds(prev => {
        const next = new Set(prev);
        filteredAlerts.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      // Select all currently filtered
      setSelectedAlertIds(prev => {
        const next = new Set(prev);
        filteredAlerts.forEach(a => next.add(a.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedAlertIds(new Set());
  };

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
    const unreadIds = alerts.filter(a => !a.read).map(a => a.id);
    if (!unreadIds.length) return;
    try {
      const res = await alertService.markAlertsAsReadBatch(targetTenant, unreadIds);
      if (res.success) {
        toast.success(`Marked ${res.count} alerts as read`);
      }
    } catch (_) {
      toast.error('Failed to mark all as read');
    }
  };

  // Mark selected as Read
  const handleMarkSelectedRead = async () => {
    const targetTenant = tenantId || 'default';
    const ids = Array.from(selectedAlertIds);
    if (!ids.length) return;
    setIsBulkProcessing(true);
    try {
      const res = await alertService.markAlertsAsReadBatch(targetTenant, ids);
      if (res.success) {
        toast.success(`Marked ${res.count} selected alerts as read`);
        clearSelection();
      }
    } catch (_) {
      toast.error('Failed to mark selected alerts as read');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Resolve selected
  const handleResolveSelected = async () => {
    const targetTenant = tenantId || 'default';
    const ids = Array.from(selectedAlertIds);
    if (!ids.length) return;
    setIsBulkProcessing(true);
    try {
      const res = await alertService.resolveAlertsBatch(targetTenant, ids);
      if (res.success) {
        await logAuditEvent({
          userId: user?.uid || '',
          userEmail: user?.email || '',
          userName: user?.displayName || 'Owner',
          userRole: user?.role || 'owner',
          tenantId: targetTenant,
          module: 'Alerts',
          action: 'STATUS_CHANGE',
          targetEntity: `Batch resolved ${res.count} alerts`
        });
        toast.success(`Resolved ${res.count} selected alerts`);
        clearSelection();
      }
    } catch (_) {
      toast.error('Failed to resolve selected alerts');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Mark single as Resolved / Unresolved
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

  // Delete single alert
  const handleConfirmDeleteSingle = async () => {
    if (!deleteTargetAlert) return;
    const targetTenant = deleteTargetAlert.restaurantId || tenantId || 'default';
    setIsDeletingSingle(true);

    try {
      const res = await alertService.deleteAlert(targetTenant, deleteTargetAlert.id);
      if (res.success) {
        await logAuditEvent({
          userId: user?.uid || '',
          userEmail: user?.email || '',
          userName: user?.displayName || 'Owner',
          userRole: user?.role || 'owner',
          tenantId: targetTenant,
          module: 'Alerts',
          action: 'DELETE',
          targetEntity: `Deleted alert: "${deleteTargetAlert.title || deleteTargetAlert.id}"`
        });

        toast.success('Alert deleted from Firestore');
        setSelectedAlertIds(prev => {
          const next = new Set(prev);
          next.delete(deleteTargetAlert.id);
          return next;
        });
        setDeleteTargetAlert(null);
      } else {
        toast.error(res.error || 'Failed to delete alert');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Delete operation failed');
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Delete selected alerts in bulk
  const handleConfirmDeleteSelected = async () => {
    const targetTenant = tenantId || 'default';
    const ids = Array.from(selectedAlertIds);
    if (!ids.length) return;
    setIsBulkProcessing(true);

    try {
      const res = await alertService.deleteAlertsBatch(targetTenant, ids);
      if (res.success) {
        await logAuditEvent({
          userId: user?.uid || '',
          userEmail: user?.email || '',
          userName: user?.displayName || 'Owner',
          userRole: user?.role || 'owner',
          tenantId: targetTenant,
          module: 'Alerts',
          action: 'DELETE',
          targetEntity: `Batch deleted ${res.deletedCount} selected alerts`
        });

        toast.success(`Successfully deleted ${res.deletedCount} alert${res.deletedCount !== 1 ? 's' : ''}`);
        clearSelection();
        setIsBulkDeleteModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to delete selected alerts');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Batch delete failed');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Purge alerts with criteria
  const handleExecutePurge = async (filterType: TAlertPurgeFilter, label: string) => {
    const targetTenant = tenantId || 'default';
    setIsPurging(true);
    setPurgingLabel(label);

    try {
      const res = await alertService.purgeAlerts(targetTenant, filterType);
      if (res.success) {
        await logAuditEvent({
          userId: user?.uid || '',
          userEmail: user?.email || '',
          userName: user?.displayName || 'Owner',
          userRole: user?.role || 'owner',
          tenantId: targetTenant,
          module: 'Alerts',
          action: 'DELETE',
          targetEntity: `Purged ${res.deletedCount} alerts with filter "${filterType}"`
        });

        toast.success(`Purge completed: removed ${res.deletedCount} alert${res.deletedCount !== 1 ? 's' : ''}`);
        clearSelection();
        setIsPurgeModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to purge alerts');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Purge failed');
    } finally {
      setIsPurging(false);
      setPurgingLabel('');
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
    <div className="space-y-6 pb-16 select-none">
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Purge & Maintenance Dialog Button */}
          {metrics.total > 0 && (
            <Button 
              variant="secondary"
              onClick={() => setIsPurgeModalOpen(true)}
              className="text-xs font-bold text-red-700 border-red-200 bg-red-50/70 hover:bg-red-100 flex items-center space-x-1.5 shadow-2xs transition-colors"
              title="Open alert purge and maintenance workspace"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Purge & Clean Alerts</span>
            </Button>
          )}

          {metrics.unread > 0 && (
            <Button 
              variant="secondary" 
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-[#12352D] border-[#12352D]/20 hover:bg-[#12352D]/5 flex items-center space-x-1.5 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5 text-[#12352D]" />
              <span>Mark All as Read</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Critical Pending</p>
            <p className="text-xl font-bold font-serif text-red-600">{metrics.critical}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9533B]/10 flex items-center justify-center text-[#C9533B] shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Unread Alerts</p>
            <p className="text-xl font-bold font-serif text-[#C9533B]">{metrics.unread}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D] shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Total Logged</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{metrics.total}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#16845B]/10 flex items-center justify-center text-[#16845B] shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase">Resolved</p>
            <p className="text-xl font-bold font-serif text-[#16845B]">{metrics.resolved}</p>
          </div>
        </div>
      </div>

      {/* ── Sticky Multi-Select Action Banner ── */}
      {selectedAlertIds.size > 0 && (
        <div className="p-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#12352D] to-[#1A473C] text-white shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-3">
            <span className="p-1.5 rounded-lg bg-white/10 text-white font-mono text-xs font-bold">
              {selectedAlertIds.size}
            </span>
            <span className="text-xs font-semibold">
              {selectedAlertIds.size === 1 ? '1 alert selected' : `${selectedAlertIds.size} alerts selected`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkSelectedRead}
              disabled={isBulkProcessing}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white border-white/20 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark Read</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleResolveSelected}
              disabled={isBulkProcessing}
              className="text-xs font-bold bg-[#16845B] hover:bg-[#136E4B] text-white border-transparent flex items-center space-x-1.5 px-3 py-1.5 rounded-xl"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Resolve Selected</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={isBulkProcessing}
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white border-transparent flex items-center space-x-1.5 px-3 py-1.5 rounded-xl shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedAlertIds.size})</span>
            </Button>

            <button
              onClick={clearSelection}
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Deselect all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-lg">
          {/* Select all filtered checkbox */}
          {filteredAlerts.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="flex items-center space-x-2 text-xs font-bold text-[#17202A] px-2.5 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F8F6F2] transition-colors shrink-0"
              title={allFilteredSelected ? 'Deselect all in view' : 'Select all in view'}
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-[#C9533B]" />
              ) : selectedAlertIds.size > 0 ? (
                <MinusSquare className="w-4 h-4 text-[#C9533B]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">
                {allFilteredSelected ? 'Deselect' : 'Select All'} ({filteredAlerts.length})
              </span>
            </button>
          )}

          <div className="w-full">
            <SearchBar 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search alerts, messages, source..." 
            />
          </div>
        </div>

        <div className="flex items-center space-x-2.5 overflow-x-auto w-full md:w-auto">
          {/* Status View */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none cursor-pointer"
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
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none cursor-pointer"
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
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none cursor-pointer"
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
          {filteredAlerts.map((alert) => {
            const isSelected = selectedAlertIds.has(alert.id);

            return (
              <div 
                key={alert.id} 
                className={`p-4 rounded-2xl border transition-all shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                  isSelected 
                    ? 'bg-[#FFF8F2] border-[#C9533B] ring-1 ring-[#C9533B]/40' 
                    : !alert.read 
                    ? 'bg-white border-[#C9533B]/40' 
                    : 'bg-white/90 border-[#E5E7EB]'
                }`}
              >
                {/* Left Column: Checkbox, Icon & Message */}
                <div className="flex items-start space-x-3 min-w-[280px] flex-1">
                  {/* Select Checkbox */}
                  <div className="pt-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectAlert(alert.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#C9533B] focus:ring-[#C9533B] cursor-pointer"
                      aria-label={`Select alert ${alert.title || alert.id}`}
                    />
                  </div>

                  {/* Category Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs mt-0.5 ${
                    alert.severity === 'critical' ? 'bg-red-500/15 border border-red-500/30' :
                    alert.severity === 'warning' ? 'bg-amber-500/15 border border-amber-500/30' :
                    'bg-[#12352D]/10 border border-[#12352D]/20'
                  }`}>
                    {getCategoryIcon(alert.category)}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
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

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B7280] mt-1.5">
                      <span>Source: <strong className="text-[#12352D] font-bold">{alert.source}</strong></span>
                      <span>&middot;</span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Middle Column: Assignment & Status */}
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

                {/* Right Column: Actions including DELETE */}
                <div className="flex items-center space-x-2 shrink-0 justify-end">
                  {/* Jump to related entity if available */}
                  {alert.relatedEntity?.path && (
                    <button
                      onClick={() => navigate(alert.relatedEntity!.path)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#12352D] hover:bg-[#F8F6F2] flex items-center space-x-1 border border-[#E5E7EB] transition-colors"
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
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#6B7280] hover:text-[#17202A] hover:bg-[#F8F6F2] transition-colors"
                    title="Assign Alert"
                  >
                    Assign
                  </button>

                  {/* Mark Resolved Toggle */}
                  <button
                    onClick={() => handleToggleResolved(alert)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 shadow-2xs ${
                      alert.resolved
                        ? 'bg-[#E5E7EB] text-[#6B7280] hover:bg-[#D1D5DB]'
                        : 'bg-[#16845B] text-white hover:bg-[#136E4B]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{alert.resolved ? 'Reopen' : 'Resolve'}</span>
                  </button>

                  {/* Single Delete Button */}
                  <button
                    type="button"
                    onClick={() => setDeleteTargetAlert(alert)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                    title="Delete this alert permanently from Firestore"
                    aria-label={`Delete alert ${alert.title || alert.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Single Alert Delete Confirmation Modal ── */}
      {deleteTargetAlert && (
        <Modal
          isOpen={Boolean(deleteTargetAlert)}
          onClose={() => setDeleteTargetAlert(null)}
          title="Delete Alert"
        >
          <div className="space-y-4 p-1 select-none text-left">
            <p className="text-xs text-[#6B7280]">
              Are you sure you want to permanently delete this operational alert from Firestore? This action cannot be undone.
            </p>

            <div className="p-4 rounded-2xl bg-[#FAF8F4] border border-[#E5E0D9] space-y-1.5">
              <div className="flex items-center space-x-2">
                <Badge variant={deleteTargetAlert.severity === 'critical' ? 'danger' : 'warning'}>
                  {deleteTargetAlert.category}
                </Badge>
                <h4 className="font-bold text-sm text-[#17202A]">{deleteTargetAlert.title}</h4>
              </div>
              <p className="text-xs text-[#17202A]">{deleteTargetAlert.message}</p>
              <div className="text-[11px] text-[#6B7280] pt-1">
                Source: <strong>{deleteTargetAlert.source}</strong> &middot; {new Date(deleteTargetAlert.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <Button 
                variant="secondary" 
                onClick={() => setDeleteTargetAlert(null)}
                disabled={isDeletingSingle}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleConfirmDeleteSingle}
                disabled={isDeletingSingle}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingSingle ? 'Deleting...' : 'Delete Alert'}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Bulk Delete Confirmation Modal ── */}
      {isBulkDeleteModalOpen && (
        <Modal
          isOpen={isBulkDeleteModalOpen}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          title={`Delete ${selectedAlertIds.size} Selected Alerts`}
        >
          <div className="space-y-4 p-1 select-none text-left">
            <div className="flex items-start space-x-3 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800">
              <AlertOctagon className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-red-900">Permanent Bulk Removal</p>
                <p>
                  You are about to permanently delete <strong>{selectedAlertIds.size}</strong> selected alerts from your restaurant database in atomic batches.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#6B7280]">
              This action will clean up the selected alert records and audit logs will record the batch deletion.
            </p>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <Button 
                variant="secondary" 
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isBulkProcessing}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleConfirmDeleteSelected}
                disabled={isBulkProcessing}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBulkProcessing ? 'Deleting Batches...' : `Delete ${selectedAlertIds.size} Alerts`}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Alerts Purge & Maintenance Workspace Modal ── */}
      {isPurgeModalOpen && (
        <Modal
          isOpen={isPurgeModalOpen}
          onClose={() => !isPurging && setIsPurgeModalOpen(false)}
          title="Alerts Maintenance & Cleanup"
        >
          <div className="space-y-4 p-1 select-none text-left">
            <p className="text-xs text-[#6B7280]">
              Quickly clean up bulk or obsolete alerts to keep your restaurant's notification feed relevant and fast.
            </p>

            {/* Current Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-[#FAF8F4] border border-[#E5E0D9] text-center">
              <div>
                <p className="text-[10px] font-bold text-[#6B7280] uppercase">Total Alerts</p>
                <p className="text-base font-black text-[#17202A]">{metrics.total}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#6B7280] uppercase">Unread</p>
                <p className="text-base font-black text-[#C9533B]">{metrics.unread}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#6B7280] uppercase">Resolved</p>
                <p className="text-base font-black text-[#16845B]">{metrics.resolved}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#6B7280] uppercase">Auto-Expiry</p>
                <p className="text-base font-black text-amber-700">{metrics.expiryCount}</p>
              </div>
            </div>

            {/* Action Cards */}
            <div className="space-y-2.5">
              {/* Action 1: Purge Automated Expiry Warnings */}
              <div className="p-3.5 rounded-xl border border-[#E5E0D9] hover:border-amber-300 bg-white flex items-center justify-between gap-3 transition-colors">
                <div>
                  <h4 className="text-xs font-bold text-[#17202A]">Purge Automated Expiry Warnings</h4>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    Deletes all background expiry alerts (e.g. "Expired ingredient: boneless chicken", tomato).
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPurging || metrics.expiryCount === 0}
                  onClick={() => handleExecutePurge('expiry', 'Automated Expiry Warnings')}
                  className="shrink-0 text-xs font-bold text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100"
                >
                  {isPurging && purgingLabel === 'Automated Expiry Warnings' ? 'Purging...' : `Purge (${metrics.expiryCount})`}
                </Button>
              </div>

              {/* Action 2: Clear All Resolved Alerts */}
              <div className="p-3.5 rounded-xl border border-[#E5E0D9] hover:border-emerald-300 bg-white flex items-center justify-between gap-3 transition-colors">
                <div>
                  <h4 className="text-xs font-bold text-[#17202A]">Clear Resolved Alerts</h4>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    Permanently deletes alerts that staff or managers already marked as resolved.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPurging || metrics.resolved === 0}
                  onClick={() => handleExecutePurge('resolved', 'Resolved Alerts')}
                  className="shrink-0 text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                >
                  {isPurging && purgingLabel === 'Resolved Alerts' ? 'Purging...' : `Clear (${metrics.resolved})`}
                </Button>
              </div>

              {/* Action 3: Clear All Read Alerts */}
              <div className="p-3.5 rounded-xl border border-[#E5E0D9] hover:border-blue-300 bg-white flex items-center justify-between gap-3 transition-colors">
                <div>
                  <h4 className="text-xs font-bold text-[#17202A]">Clear All Read Alerts</h4>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">
                    Deletes all alerts that have already been opened or marked as read.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPurging || (metrics.total - metrics.unread) === 0}
                  onClick={() => handleExecutePurge('read', 'Read Alerts')}
                  className="shrink-0 text-xs font-bold text-blue-800 bg-blue-50 border-blue-200 hover:bg-blue-100"
                >
                  {isPurging && purgingLabel === 'Read Alerts' ? 'Purging...' : `Clear (${metrics.total - metrics.unread})`}
                </Button>
              </div>

              {/* Action 4: Clear All Alerts (Total Reset) */}
              <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-red-900">Delete ALL Alerts (Reset Log)</h4>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    Permanently deletes every single alert document for this restaurant.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={isPurging || metrics.total === 0}
                  onClick={() => {
                    if (window.confirm(`Are you absolutely sure you want to delete ALL ${metrics.total} alerts? This cannot be undone.`)) {
                      handleExecutePurge('all', 'ALL Alerts');
                    }
                  }}
                  className="shrink-0 text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                >
                  {isPurging && purgingLabel === 'ALL Alerts' ? 'Purging All...' : `Delete All (${metrics.total})`}
                </Button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <Button 
                variant="secondary" 
                onClick={() => setIsPurgeModalOpen(false)}
                disabled={isPurging}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
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
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none cursor-pointer"
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
