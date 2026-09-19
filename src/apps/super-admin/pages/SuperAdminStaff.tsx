import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, limit, query } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { ChefHat, Search, Mail, Building2, Calendar, Shield } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

interface IStaffMember {
  id: string;
  fullName?: string;
  email?: string;
  role?: string;
  department?: string;
  tenantId?: string;
  status?: string;
  activationStatus?: string;
  invitedAt?: string;
  createdAt?: string;
}

export const SuperAdminStaff: React.FC = () => {
  const [staff, setStaff] = useState<IStaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Listen to employees collection
    const q = query(collection(db, 'employees'), limit(150));
    const unsub = onSnapshot(q, (snap) => {
      const list: IStaffMember[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setStaff(list);
      setIsLoading(false);
    }, (err) => {
      console.error('[SuperAdminStaff] Listener error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = staff.filter(s => {
    const q = searchTerm.toLowerCase();
    return (
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q) ||
      (s.tenantId || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Staff & Employees</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real staff records registered across restaurant workspaces ({staff.length} total)
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search staff members..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner label="Loading staff records from Firestore..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-12 text-center">
          <ChefHat className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Staff Members Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm ? 'No staff matched your query.' : 'No staff members currently registered in the database.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Role / Dept</th>
                  <th className="px-5 py-3.5">Restaurant Workspace</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Invited / Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-primary shrink-0 text-xs">
                          {((item.fullName || item.email || 'S')[0]).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {item.fullName || 'Staff Member'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        <Shield className="w-3 h-3 text-primary" />
                        <span className="font-semibold uppercase text-[10px] tracking-wider text-primary">
                          {item.role || 'Staff'}
                        </span>
                        {item.department && (
                          <span className="text-slate-500 text-[10px]">({item.department})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.tenantId || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.activationStatus === 'activated' || item.status === 'active'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                      }`}>
                        {item.activationStatus || item.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>
                          {item.invitedAt || item.createdAt 
                            ? new Date(item.invitedAt || item.createdAt || '').toLocaleDateString()
                            : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminStaff;
