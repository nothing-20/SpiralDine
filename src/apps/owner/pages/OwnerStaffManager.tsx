import React, { useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth as fbAuth } from '../../../config/firebase';
import { getResetActionCodeSettings } from '../../../shared/firebase/auth';
import { createStaffInvitation, generateSecureToken, buildStaffActivationLink } from '../../../services/staff/invitationService';
import { useAuth } from '../../../context/AuthContext';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import toast from 'react-hot-toast';
import Tabs from '../../../components/ui/Tabs/Tabs';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import {
  Plus,
  Edit2,
  Trash2,
  Shield,
  User,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Archive,
  Mail,
  Send,
  UserCheck,
  Clock,
  ChefHat
} from 'lucide-react';

// Types
type EmployeeStatus = 'pending' | 'active' | 'suspended' | 'archived';
type ActivationStatus = 'invited' | 'activated';

interface IEmployee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  tenantId: string;
  branchId: string;
  department: string;
  status: EmployeeStatus;
  activationStatus: ActivationStatus;
  firebaseUid: string | null;
  invitationToken?: string;
  expiresAt?: string;
  invitedAt: string;
  activatedAt?: string;
  createdBy: string;
  updatedAt: string;
}

interface IInviteForm {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
}

const BLANK_FORM: IInviteForm = {
  fullName: '',
  email: '',
  phone: '',
  role: 'waiter',
  department: '',
};

const ROLE_OPTIONS = [
  { value: 'waiter',    label: 'Waiter / Service Staff' },
  { value: 'kitchen',  label: 'Kitchen / Chef Staff' },
  { value: 'manager',  label: 'Branch Manager' },
  { value: 'cashier',  label: 'Cashier Desk' },
  { value: 'reception',label: 'Receptionist' },
  { value: 'admin',    label: 'Administrator' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' | 'primary'; icon: React.FC<{className?: string}> }> = {
  pending:   { label: 'Invited',    variant: 'warning', icon: Clock },
  active:    { label: 'Active',     variant: 'success', icon: UserCheck },
  suspended: { label: 'Suspended',  variant: 'danger',  icon: ShieldAlert },
  archived:  { label: 'Archived',   variant: 'neutral', icon: Archive },
};

export const OwnerStaffManager: React.FC = () => {
  const { user } = useAuth();

  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('role') || 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isInviteOpen, setIsInviteOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('action') === 'invite';
  });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<IEmployee | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteSuccessData, setInviteSuccessData] = useState<{
    fullName: string;
    email: string;
    role: string;
    activationLink: string;
    emailSent: boolean;
  } | null>(null);

  // Form state
  const [form, setForm] = useState<IInviteForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<IInviteForm>>({});

  const fetchEmployees = useCallback(async () => {
    if (!user?.tenantId) return;
    setIsLoading(true);
    try {
      const empRef = collection(db, 'employees');
      const q = query(
        empRef,
        where('tenantId', '==', user.tenantId),
        orderBy('invitedAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: IEmployee[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<IEmployee, 'id'>),
      }));
      setEmployees(list);
    } catch (err: any) {
      console.error(err);
      try {
        const empRef = collection(db, 'employees');
        const q2 = query(empRef, where('tenantId', '==', user.tenantId));
        const snap2 = await getDocs(q2);
        const list2: IEmployee[] = snap2.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<IEmployee, 'id'>),
        }));
        setEmployees(list2);
      } catch (fallbackErr) {
        toast.error('Failed to load staff roster.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const validateForm = () => {
    const next: Partial<IInviteForm> = {};
    if (!form.fullName.trim()) next.fullName = 'Full name is required.';
    if (!form.email.trim()) {
      next.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!form.phone.trim()) next.phone = 'Phone number is required.';
    if (!form.role) next.role = 'Role is required.';
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !user?.tenantId) return;

    setIsSubmitting(true);
    try {
      const trimmedEmail = form.email.trim().toLowerCase();

      const result = await createStaffInvitation({
        fullName: form.fullName.trim(),
        email: trimmedEmail,
        phone: form.phone.trim(),
        role: form.role,
        department: form.department.trim(),
        tenantId: user.tenantId,
        createdBy: user.uid,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to create staff invitation.');
        return;
      }

      console.info('[StaffInvitation] Created', {
        employeeId: result.employeeId,
        hasToken: Boolean(result.token),
        hasEmail: Boolean(trimmedEmail),
        activationLinkHasId: result.activationLink.includes('&id='),
      });

      toast.success(`Invitation created for ${form.fullName.trim()}!`);
      const createdData = {
        fullName: form.fullName.trim(),
        email: trimmedEmail,
        role: form.role,
        activationLink: result.activationLink,
        emailSent: result.emailSent || false,
      };

      setForm(BLANK_FORM);
      setIsInviteOpen(false);
      fetchEmployees();
      setInviteSuccessData(createdData);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create invitation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (emp: IEmployee) => {
    setEditingEmployee(emp);
    setForm({
      fullName: emp.fullName,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      department: emp.department || '',
    });
    setFormErrors({});
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setIsSubmitting(true);
    try {
      const empRef = doc(db, 'employees', editingEmployee.id);
      await updateDoc(empRef, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        role: form.role,
        department: form.department.trim(),
        updatedAt: new Date().toISOString(),
      });

      if (editingEmployee.firebaseUid) {
        const userRef = doc(db, 'users', editingEmployee.firebaseUid);
        await updateDoc(userRef, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          role: form.role,
          updatedAt: new Date().toISOString(),
        });
      }

      toast.success('Employee details updated.');
      setIsEditOpen(false);
      fetchEmployees();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspend = async (emp: IEmployee) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'employees', emp.id), { status: 'suspended', updatedAt: now });
      if (emp.firebaseUid) {
        await updateDoc(doc(db, 'users', emp.firebaseUid), { status: 'suspended', updatedAt: now });
      }
      toast.success(`${emp.fullName} has been suspended.`);
      fetchEmployees();
    } catch (err) {
      console.error(err);
      toast.error('Failed to suspend employee.');
    }
  };

  const handleReactivate = async (emp: IEmployee) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'employees', emp.id), { status: 'active', updatedAt: now });
      if (emp.firebaseUid) {
        await updateDoc(doc(db, 'users', emp.firebaseUid), { status: 'active', updatedAt: now });
      }
      toast.success(`${emp.fullName} has been reactivated.`);
      fetchEmployees();
    } catch (err) {
      console.error(err);
      toast.error('Failed to reactivate employee.');
    }
  };

  const handleArchive = async (emp: IEmployee) => {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'employees', emp.id), { status: 'archived', updatedAt: now });
      if (emp.firebaseUid) {
        await updateDoc(doc(db, 'users', emp.firebaseUid), { status: 'suspended', updatedAt: now });
      }
      toast.success(`${emp.fullName} has been archived.`);
      fetchEmployees();
    } catch (err) {
      console.error(err);
      toast.error('Failed to archive employee.');
    }
  };

  const handleResendInvite = async (emp: IEmployee) => {
    let token = emp.invitationToken;
    if (!token) {
      token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, 'employees', emp.id), {
        invitationToken: token,
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString()
      });
      emp.invitationToken = token;
      emp.expiresAt = expiresAt;
    }
    const activationLink = buildStaffActivationLink(token, emp.email, emp.id);
    console.info('[StaffInvitation] Resend link generated', {
      employeeId: emp.id,
      hasToken: Boolean(token),
      hasEmail: Boolean(emp.email),
      activationLinkHasId: activationLink.includes('&id='),
    });
    try {
      await navigator.clipboard.writeText(activationLink);
      toast.success(`Activation link copied for ${emp.fullName}! Share it directly.`, { duration: 5000 });
    } catch {
      toast.success(`Share this link with ${emp.fullName}: ${activationLink}`, { duration: 6000 });
    }
  };

  const handlePasswordReset = async (emp: IEmployee) => {
    if (!emp.firebaseUid) {
      toast.error('Employee has not activated their account yet. No Firebase account exists to reset.');
      return;
    }
    try {
      await sendPasswordResetEmail(fbAuth, emp.email, getResetActionCodeSettings());
      toast.success(`Password reset email sent to ${emp.email}.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send reset email.');
    }
  };

  const triggerDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      const emp = employees.find((e) => e.id === deletingId);
      await deleteDoc(doc(db, 'employees', deletingId));
      if (emp?.firebaseUid) {
        try {
          await deleteDoc(doc(db, 'users', emp.firebaseUid));
        } catch (e) {
          console.warn('Could not delete users/{uid}:', e);
        }
      }
      toast.success('Employee record permanently deleted.');
      fetchEmployees();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete employee.');
    } finally {
      setIsDeleteOpen(false);
      setDeletingId(null);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchRole = filterRole === 'all' || e.role === filterRole;
    const matchSearch = !searchQuery.trim() ||
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phone && e.phone.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchStatus && matchRole && matchSearch;
  });

  const roleCounts = employees.reduce<Record<string, number>>((acc, e) => {
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchSearch = !searchQuery.trim() ||
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phone && e.phone.toLowerCase().includes(searchQuery.toLowerCase()));
    if (matchStatus && matchSearch) {
      acc[e.role] = (acc[e.role] || 0) + 1;
      acc['all'] = (acc['all'] || 0) + 1;
    }
    return acc;
  }, {});

  const statusCounts = employees.reduce<Record<string, number>>((acc, e) => {
    const matchRole = filterRole === 'all' || e.role === filterRole;
    const matchSearch = !searchQuery.trim() ||
      e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phone && e.phone.toLowerCase().includes(searchQuery.toLowerCase()));
    if (matchRole && matchSearch) {
      acc[e.status] = (acc[e.status] || 0) + 1;
      acc['all'] = (acc['all'] || 0) + 1;
    }
    return acc;
  }, {});

  const renderFormFields = (disableEmail = false) => (
    <div className="space-y-4">
      <Input
        label="Full Name *"
        type="text"
        placeholder="John Doe"
        value={form.fullName}
        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
        error={formErrors.fullName}
        disabled={isSubmitting}
        required
      />
      <Input
        label="Email Address *"
        type="email"
        placeholder="john@restaurant.com"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        error={formErrors.email}
        disabled={isSubmitting || disableEmail}
        required
      />
      <Input
        label="Phone Number *"
        type="tel"
        placeholder="+91 98765 43210"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        error={formErrors.phone}
        disabled={isSubmitting}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Assigned Role *"
          options={ROLE_OPTIONS}
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          error={formErrors.role}
          disabled={isSubmitting}
        />
        <Input
          label="Department (optional)"
          type="text"
          placeholder="e.g. Main Floor"
          value={form.department}
          onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-[#17202A] text-left">Staff Roster</h1>
          <p className="text-xs text-[#52606D] text-left">
            Invite team members, manage access, and monitor activation status.
          </p>
        </div>
        <div className="flex items-center space-x-2 self-start">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchEmployees}
            className="border border-[#E5E0D9] bg-white text-[#52606D] hover:text-[#17202A] hover:bg-[#F8F6F2]"
            title="Refresh roster"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={() => { setForm(BLANK_FORM); setFormErrors({}); setIsInviteOpen(true); }} className="flex items-center space-x-1.5 bg-[#C9533B] hover:bg-[#A94332] text-white">
            <Plus className="w-4 h-4" />
            <span>Invite Employee</span>
          </Button>
        </div>
      </div>

      <Tabs
        activeTabId={filterRole}
        onTabChange={setFilterRole}
        tabs={[
          { id: 'all', label: `All Staff (${roleCounts['all'] || 0})`, icon: User },
          { id: 'waiter', label: `Waiters (${roleCounts['waiter'] || 0})`, icon: UserCheck },
          { id: 'kitchen', label: `Kitchen / Chefs (${roleCounts['kitchen'] || 0})`, icon: ChefHat },
          { id: 'manager', label: `Managers (${roleCounts['manager'] || 0})`, icon: Shield },
          { id: 'admin', label: `Admin Access (${roleCounts['admin'] || 0})`, icon: ShieldCheck }
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {(['all', 'pending', 'active', 'suspended', 'archived'] as const).map((s) => {
            const count = s === 'all' ? (statusCounts['all'] || 0) : (statusCounts[s] || 0);
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                  filterStatus === s
                    ? 'bg-[#C9533B] text-white border-[#C9533B] shadow-xs'
                    : 'bg-white text-[#52606D] border-[#E5E0D9] hover:text-[#17202A] hover:bg-[#F8F6F2]'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${filterStatus === s ? 'bg-white/20 text-white' : 'bg-[#F8F6F2] text-[#7B8794]'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="w-full md:w-72">
          <SearchBar
            placeholder="Search staff by name, email..."
            value={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner label="Loading staff roster..." />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card className="p-10 text-center border border-dashed border-slate-800/60 rounded-2xl bg-slate-900/10">
          <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">
            {employees.length === 0
              ? 'No staff members yet. Click Invite to begin.'
              : 'No staff members match the selected filters.'}
          </p>
          {employees.length === 0 && (
            <Button onClick={() => setIsInviteOpen(true)} className="mt-4" size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Send First Invitation
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden border-slate-800/60 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 bg-slate-900/60">
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Activation</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, i) => {
                  const statusCfg = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr
                      key={emp.id}
                      className={`border-b border-slate-800/30 hover:bg-slate-900/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/10'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                            {emp.fullName?.charAt(0)?.toUpperCase() || <User className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-textPearl text-[13px]">{emp.fullName}</p>
                            <p className="text-[10px] text-slate-500">{emp.email}</p>
                            {emp.phone && <p className="text-[10px] text-slate-600">{emp.phone}</p>}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={emp.role === 'admin' || emp.role === 'manager' ? 'primary' : emp.role === 'kitchen' ? 'success' : 'warning'}>
                          {emp.role.toUpperCase()}
                        </Badge>
                        {emp.department && (
                          <p className="text-[9px] text-slate-600 mt-0.5">{emp.department}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5">
                          <StatusIcon className={`w-3 h-3 ${
                            emp.status === 'active' ? 'text-emerald-400' :
                            emp.status === 'suspended' ? 'text-red-400' :
                            emp.status === 'archived' ? 'text-slate-500' : 'text-amber-400'
                          }`} />
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className={`text-[10px] font-bold ${emp.activationStatus === 'activated' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {emp.activationStatus === 'activated' ? '✓ Activated' : '⏳ Pending Setup'}
                          </span>
                          {emp.activatedAt && (
                            <p className="text-[9px] text-slate-600">
                              {new Date(emp.activatedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          {emp.activationStatus === 'invited' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleResendInvite(emp)}
                              className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                              title="Copy activation link"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {emp.status === 'active' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleSuspend(emp)}
                              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg"
                              title="Suspend employee"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {(emp.status === 'suspended' || emp.status === 'archived') && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleReactivate(emp)}
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg"
                              title="Reactivate employee"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          {emp.status === 'active' && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleArchive(emp)}
                              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/40 rounded-lg"
                              title="Archive employee"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="ghost" size="sm"
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-800/50 rounded-lg"
                            title="Edit details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost" size="sm"
                            onClick={() => triggerDelete(emp.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                            title="Delete employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite New Employee"
      >
        <div className="mb-4 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
          <p className="text-[11px] text-emerald-300 font-semibold leading-relaxed">
            <Mail className="w-3 h-3 inline mr-1" />
            An invitation record will be created. A secure direct activation link will be generated for the employee to set their password.
          </p>
        </div>
        <form onSubmit={handleInviteSubmit} className="space-y-4 text-left">
          {renderFormFields(false)}
          <div className="flex items-center space-x-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsInviteOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 flex items-center justify-center space-x-1.5" isLoading={isSubmitting}>
              <Send className="w-3.5 h-3.5" />
              <span>Send Invitation</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invitation Success Modal with 1-Click Copy Link */}
      <Modal
        isOpen={!!inviteSuccessData}
        onClose={() => setInviteSuccessData(null)}
        title="Staff Invitation Created"
      >
        {inviteSuccessData && (
          <div className="space-y-4 text-left">
            <div className="flex items-center space-x-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-textPearl">{inviteSuccessData.fullName}</p>
                <p className="text-[11px] text-emerald-400 capitalize">{inviteSuccessData.role} • Pending Activation</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Direct Activation Link
              </label>
              <p className="text-[11px] text-slate-400">
                Share this activation link with <strong className="text-slate-200">{inviteSuccessData.fullName}</strong> ({inviteSuccessData.email}) so they can set their password and log in:
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={inviteSuccessData.activationLink}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 select-all font-mono focus:outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteSuccessData.activationLink);
                      toast.success('Activation link copied to clipboard!');
                    } catch {
                      toast.error('Failed to copy to clipboard.');
                    }
                  }}
                  className="shrink-0"
                >
                  Copy Link
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/40 flex justify-end">
              <Button variant="secondary" onClick={() => setInviteSuccessData(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Employee Details"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-left">
          {renderFormFields(true)}
          <div className="flex items-center space-x-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remove Employee Record"
        message="This will permanently delete the employee invitation and their Firestore user profile. Their Firebase Authentication account will remain but become unlinked. This cannot be undone."
        confirmLabel="Delete Permanently"
        isDangerous={true}
      />
    </div>
  );
};

export default OwnerStaffManager;
