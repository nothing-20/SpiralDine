import React, { useState } from 'react';
import { ShieldAlert, Search, Filter, Calendar, Clock, CheckCircle, AlertTriangle, Key } from 'lucide-react';

interface IAuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  actorRole: string;
  resource: string;
  status: 'SUCCESS' | 'WARNING' | 'DENIED';
  ipAddress: string;
}

const SAMPLE_AUDIT_LOGS: IAuditLog[] = [
  {
    id: 'AUD-9021',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    action: 'TENANT_PROFILE_UPDATE',
    actor: 'owner@spiraldine.com',
    actorRole: 'owner',
    resource: 'restaurants/tenant_a',
    status: 'SUCCESS',
    ipAddress: '157.48.21.90'
  },
  {
    id: 'AUD-9020',
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    action: 'STAFF_ROLE_CHANGE',
    actor: 'admin@spiraldine.com',
    actorRole: 'admin',
    resource: 'users/waiter_04',
    status: 'SUCCESS',
    ipAddress: '157.48.21.90'
  },
  {
    id: 'AUD-9019',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    action: 'UNAUTHORIZED_CROSS_TENANT_ACCESS',
    actor: 'waiter_01@tenanta.com',
    actorRole: 'waiter',
    resource: 'restaurants/tenant_b/orders',
    status: 'DENIED',
    ipAddress: '103.22.45.12'
  },
  {
    id: 'AUD-9018',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    action: 'CANONICAL_BILL_SETTLEMENT',
    actor: 'cashier_01@tenanta.com',
    actorRole: 'cashier',
    resource: 'bills/BILL-ORD-1092',
    status: 'SUCCESS',
    ipAddress: '157.48.21.90'
  },
  {
    id: 'AUD-9017',
    timestamp: new Date(Date.now() - 1000 * 60 * 380).toISOString(),
    action: 'CUSTOMER_ACCOUNT_ANONYMIZED',
    actor: 'cust_88219@example.com',
    actorRole: 'customer',
    resource: 'customers/cust_88219',
    status: 'SUCCESS',
    ipAddress: '49.36.128.4'
  }
];

export const SuperAdminAuditLogs: React.FC = () => {
  const [logs] = useState<IAuditLog[]>(SAMPLE_AUDIT_LOGS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    const matchesSearch = !search || 
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.resource.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-display font-extrabold text-white tracking-tight">
          Security & Audit Logs
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable event trails for tenant configuration changes, role updates, and security verifications
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, actor, or resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'SUCCESS', 'WARNING', 'DENIED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st 
                  ? 'bg-primary text-slate-950 font-extrabold shadow-sm' 
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-3 px-4 text-slate-400 font-semibold">{log.id}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 font-sans font-bold text-white">{log.action}</td>
                  <td className="py-3 px-4 text-slate-300">
                    <span className="text-[11px]">{log.actor}</span>
                    <span className="block text-[10px] text-slate-500 uppercase font-bold">{log.actorRole}</span>
                  </td>
                  <td className="py-3 px-4 text-primary text-[11px]">{log.resource}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      log.status === 'SUCCESS' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminAuditLogs;
