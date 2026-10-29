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
import { restaurantService } from '../../../shared/services/restaurantService';
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

    // Fetch authorized restaurants
    const fetchRest = async () => {
      try {
        const list = await restaurantService.getAuthorizedRestaurants(user);
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
    const act = (action || '').toUpperCase();
    if (act === 'CREATE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#E8F5EE] text-[#167647] border border-[#A6E1C4]">
          CREATE
        </span>
      );
    }
    if (act === 'UPDATE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF]">
          UPDATE
        </span>
      );
    }
    if (act === 'DELETE' || act === 'REMOVE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FEE4E2] text-[#B42318] border border-[#FECDCA]">
          DELETE
        </span>
      );
    }
    if (act === 'PRICE_CHANGE' || act === 'PRICE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FEF3D6] text-[#8A5700] border border-[#FDE68A]">
          PRICE CHANGE
        </span>
      );
    }
    if (act === 'STATUS_CHANGE' || act === 'STATUS') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FEF3D6] text-[#8A5700] border border-[#FDE68A]">
          STATUS CHANGE
        </span>
      );
    }
    if (act === 'TRANSFER') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]">
          TRANSFER
        </span>
      );
    }
    if (act === 'EXPORT') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#F0F2F0] text-[#374151] border border-[#D8DDD6]">
          EXPORT
        </span>
      );
    }
    if (act.includes('AI') || act.includes('RECOMMENDATION')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
          {act.replace(/_/g, ' ')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FAF8F4] text-[#374151] border border-[#D8DDD6]">
        {act.replace(/_/g, ' ')}
      </span>
    );
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
      <div className="p-4 rounded-2xl bg-white border border-[#D8DDD6] shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by user, entity, action..." 
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Restaurant Filter (if multiple) */}
          {restaurants.length > 1 && (
            <select 
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-[#D8DDD6] bg-white text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all"
            >
              <option value="all">All Restaurants</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          )}

          {/* Module Filter */}
          <select 
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-[#D8DDD6] bg-white text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all"
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
            className="px-3 py-2 text-xs font-bold rounded-xl border border-[#D8DDD6] bg-white text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all"
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
            className="px-3 py-2 text-xs font-bold rounded-xl border border-[#D8DDD6] bg-white text-[#202820] outline-none cursor-pointer focus:border-[#D94F2B] focus:ring-2 focus:ring-[#D94F2B]/20 transition-all"
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
        <div className="rounded-3xl bg-white border border-[#D8DDD6] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#D8DDD6] text-[#5F675F] uppercase text-[10px] font-extrabold tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Module</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DDD6] text-[#202820]">
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-[#FAF8F4]/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 text-[#5F675F] font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>

                    <td className="py-3 px-4 font-extrabold text-[#202820]">
                      {log.module}
                    </td>

                    <td className="py-3 px-4">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="py-3 px-4 font-semibold text-[#202820] line-clamp-1 max-w-xs">
                      {log.targetEntity}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-extrabold text-[#202820]">{log.userName || 'System'}</p>
                      <p className="text-[10px] text-[#5F675F] truncate max-w-[180px]">{log.userEmail}</p>
                    </td>

                    <td className="py-3 px-4 font-mono uppercase text-[11px] font-bold text-[#5F675F]">
                      {log.userRole || 'OWNER'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center space-x-1 text-[#D94F2B] font-extrabold text-[11px] group-hover:underline">
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
          title={`Audit Log Record — #${selectedLog.id?.slice(-8) || selectedLog.id || 'N/A'}`}
        >
          <div className="space-y-4 p-1 select-none text-left">
            {/* Meta Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF8F4] border border-[#D8DDD6] space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#D8DDD6]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-lg bg-[#12352D] text-white">
                    {selectedLog.module} Module
                  </span>
                  {getActionBadge(selectedLog.action)}
                </div>
                <span className="text-[11px] font-mono text-[#5F675F] font-bold">
                  ID: #{selectedLog.id?.slice(-8) || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#5F675F] uppercase tracking-wider block">Target Entity</span>
                <h3 className="font-extrabold text-base text-[#202820] tracking-tight mt-0.5">
                  {selectedLog.targetEntity}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-[#D8DDD6] text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#5F675F] uppercase tracking-wider block">Actor / User</span>
                  <p className="font-extrabold text-[#202820]">
                    {selectedLog.userName || 'System'} <span className="font-normal text-[#5F675F]">({selectedLog.userRole || 'OWNER'})</span>
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#5F675F] uppercase tracking-wider block">Email Address</span>
                  <p className="font-semibold text-[#202820] truncate">
                    {selectedLog.userEmail || 'System Automated'}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#5F675F] uppercase tracking-wider block">Timestamp</span>
                  <p className="font-semibold text-[#202820] font-mono text-[11px]">
                    {new Date(selectedLog.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#5F675F] uppercase tracking-wider block">Restaurant / Tenant</span>
                  <p className="font-semibold text-[#202820] truncate">
                    {selectedLog.restaurantName ? `${selectedLog.restaurantName} (${selectedLog.tenantId})` : selectedLog.tenantId}
                  </p>
                </div>
              </div>
            </div>

            {/* Before / After Payload Inspector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5F675F]">Previous Value</span>
                  {selectedLog.previousValue !== undefined && (
                    <span className="text-[9px] font-extrabold text-[#5F675F] bg-[#F0F2F0] px-2 py-0.5 rounded-md border border-[#D8DDD6]">
                      BEFORE
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#D8DDD6] font-mono text-xs text-[#202820] max-h-52 overflow-y-auto shadow-2xs">
                  {selectedLog.previousValue !== undefined ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.previousValue, null, 2)}</pre>
                  ) : (
                    <div className="py-3 text-center text-[#5F675F] space-y-1">
                      <p className="text-xs font-semibold italic">Initial creation or action without prior state</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#167647]">New Value / Mutation</span>
                  {selectedLog.newValue !== undefined && (
                    <span className="text-[9px] font-extrabold text-[#167647] bg-[#E8F5EE] px-2 py-0.5 rounded-md border border-[#A6E1C4]">
                      AFTER
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#A6E1C4] font-mono text-xs text-[#167647] max-h-52 overflow-y-auto shadow-2xs">
                  {selectedLog.newValue !== undefined ? (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.newValue, null, 2)}</pre>
                  ) : (
                    <div className="py-3 text-center text-[#5F675F] space-y-1">
                      <p className="text-xs font-semibold italic">Event executed successfully without direct state payload</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata Inspector if present */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5F675F]">Event Metadata</span>
                <div className="p-3 rounded-xl bg-white border border-[#D8DDD6] font-mono text-xs text-[#202820] max-h-32 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => setSelectedLog(null)}
                className="bg-[#D94F2B] hover:bg-[#C2411F] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Close Record
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OwnerAuditLogs;
