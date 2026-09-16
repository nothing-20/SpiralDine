import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  getDocs, 
  limit 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IAuditLogEntry } from '../../../shared/services/auditService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Modal from '../../../components/ui/Modal/Modal';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Toast & Icons
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Eye, 
  Activity, 
  ShieldAlert, 
  Layers, 
  Building2, 
  Calendar, 
  FileText,
  Lock
} from 'lucide-react';

export const OwnerAuditLogs: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [auditLogs, setAuditLogs] = useState<IAuditLogEntry[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');

  // Detail Inspector Modal
  const [selectedLog, setSelectedLog] = useState<IAuditLogEntry | null>(null);

  // 1. Subscribe to Audit Logs
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const targetTenant = tenantId || 'default';

    // Fetch restaurants
    const fetchRest = async () => {
      try {
        const snap = await getDocs(collection(db, 'restaurants'));
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setRestaurants(list);
      } catch (_) {}
    };
    fetchRest();

    // Query tenant-scoped audit logs (up to 200 recent events)
    const unsub = onSnapshot(
      collection(db, 'restaurants', targetTenant, 'auditLogs'),
      (snapshot) => {
        const list: IAuditLogEntry[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as IAuditLogEntry);
        });

        // Also check if root auditLogs can be retrieved for broader context
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAuditLogs(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Audit logs listener note:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [user, tenantId]);

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = log.userName?.toLowerCase().includes(q) || log.userEmail?.toLowerCase().includes(q);
        const matchEntity = log.targetEntity?.toLowerCase().includes(q);
        const matchModule = log.module?.toLowerCase().includes(q);
        const matchAction = log.action?.toLowerCase().includes(q);
        if (!matchUser && !matchEntity && !matchModule && !matchAction) return false;
      }

      // 2. Module Filter
      if (moduleFilter !== 'all') {
        if (log.module !== moduleFilter) return false;
      }

      // 3. Action Filter
      if (actionFilter !== 'all') {
        if (log.action !== actionFilter) return false;
      }

      // 4. Role Filter
      if (roleFilter !== 'all') {
        if (log.userRole !== roleFilter) return false;
      }

      // 5. Restaurant Filter
      if (restaurantFilter !== 'all') {
        if (log.tenantId !== restaurantFilter) return false;
      }

      return true;
    });
  }, [auditLogs, searchQuery, moduleFilter, actionFilter, roleFilter, restaurantFilter]);

  // Unique lists for filter options
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach(l => { if (l.userName) set.add(l.userName); });
    return Array.from(set);
  }, [auditLogs]);

  // Action badge formatting
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE': return <Badge variant="success">CREATE</Badge>;
      case 'UPDATE': return <Badge variant="primary">UPDATE</Badge>;
      case 'DELETE': return <Badge variant="danger">DELETE</Badge>;
      case 'STATUS_CHANGE': return <Badge variant="warning">STATUS</Badge>;
      case 'PRICE_CHANGE': return <Badge variant="danger">PRICE</Badge>;
      case 'TRANSFER': return <Badge variant="primary">TRANSFER</Badge>;
      case 'EXPORT': return <Badge variant="neutral">EXPORT</Badge>;
      default: return <Badge variant="neutral">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <ShieldCheck className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Centralized Audit Logs
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Immutable security log, track changes across menu items, prices, staff permissions, transfers, and operational settings.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#16845B]/10 border border-[#16845B]/20 text-[#16845B] text-xs font-bold flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Immutable Protection Active</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by user, entity, action..." 
          />
        </div>

        <div className="flex items-center space-x-2.5 overflow-x-auto w-full md:w-auto">
          {/* Module Filter */}
          <select 
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Modules</option>
            <option value="Menu">Menu</option>
            <option value="Staff">Staff</option>
            <option value="Tables">Tables</option>
            <option value="Billing">Billing</option>
            <option value="Inventory">Inventory</option>
            <option value="Reservations">Reservations</option>
            <option value="Feedback">Feedback</option>
            <option value="Marketing">Marketing</option>
            <option value="BranchTransfers">Branch Transfers</option>
            <option value="Restaurants">Restaurants</option>
            <option value="Settings">Settings</option>
          </select>

          {/* Action Filter */}
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="STATUS_CHANGE">Status Change</option>
            <option value="PRICE_CHANGE">Price Change</option>
            <option value="TRANSFER">Transfer</option>
            <option value="EXPORT">Export</option>
          </select>

          {/* Role Filter */}
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
            <option value="waiter">Waiter</option>
          </select>
        </div>
      </div>

      {/* ── Main Audit Table ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Loading immutable audit logs..." />
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState 
          title="No audit entries found"
          description={
            searchQuery 
              ? "No logged events match your filter parameters."
              : "System actions and data mutations will be recorded automatically into this immutable log."
          }
        />
      ) : (
        <div className="rounded-2xl bg-white border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12352D] text-white uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-[#17202A]">
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-[#F8F6F2] transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-[#6B7280] font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-bold text-[#12352D]">
                      {log.module}
                    </td>

                    <td className="py-3 px-4">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="py-3 px-4 font-semibold text-[#17202A] line-clamp-1 max-w-xs">
                      {log.targetEntity}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-bold text-[#17202A]">{log.userName || 'System'}</p>
                      <p className="text-[10px] text-[#6B7280]">{log.userEmail}</p>
                    </td>

                    <td className="py-3 px-4 font-mono uppercase text-[11px] text-[#6B7280]">
                      {log.userRole || 'OWNER'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center space-x-1 text-[#C9533B] font-bold text-[11px] group-hover:underline">
                        <span>Inspect</span>
                        <Eye className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Audit Detail Inspector Modal ── */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log Record — #${selectedLog.id || 'N/A'}`}
        >
          <div className="space-y-4 p-1 select-none">
            {/* Meta Card */}
            <div className="p-4 rounded-2xl bg-[#12352D] text-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/10">
                  {selectedLog.module} Module
                </span>
                {getActionBadge(selectedLog.action)}
              </div>

              <h3 className="font-bold text-sm text-white">
                {selectedLog.targetEntity}
              </h3>

              <div className="grid grid-cols-2 gap-2 text-xs text-[#A2B5AF] pt-1">
                <div>
                  <span className="text-[#6B7280]">Actor:</span> {selectedLog.userName} ({selectedLog.userRole})
                </div>
                <div>
                  <span className="text-[#6B7280]">Email:</span> {selectedLog.userEmail || 'N/A'}
                </div>
                <div>
                  <span className="text-[#6B7280]">Timestamp:</span> {new Date(selectedLog.timestamp).toLocaleString()}
                </div>
                <div>
                  <span className="text-[#6B7280]">Tenant ID:</span> {selectedLog.tenantId}
                </div>
              </div>
            </div>

            {/* Before / After Payload Inspector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase text-[#6B7280]">Previous Value</p>
                <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB] font-mono text-[11px] text-[#17202A] max-h-48 overflow-y-auto">
                  {selectedLog.previousValue !== undefined ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.previousValue, null, 2)}</pre>
                  ) : (
                    <span className="text-[#6B7280] italic">None (initial creation or action without prior state)</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase text-[#6B7280]">New Value / Mutation</p>
                <div className="p-3 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB] font-mono text-[11px] text-[#16845B] max-h-48 overflow-y-auto">
                  {selectedLog.newValue !== undefined ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.newValue, null, 2)}</pre>
                  ) : (
                    <span className="text-[#6B7280] italic">No payload attached</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OwnerAuditLogs;
