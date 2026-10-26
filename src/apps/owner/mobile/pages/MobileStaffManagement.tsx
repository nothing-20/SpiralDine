import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  UserCheck, 
  UserX, 
  Mail, 
  Phone, 
  Shield, 
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  Clock,
  Archive,
  Share2,
  Copy,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  ChefHat
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { createStaffInvitation } from '../../../../services/staff/invitationService';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';

export interface IStaffMember {
  id: string;
  fullName: string;
  name?: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  status: 'pending' | 'active' | 'suspended' | 'archived';
  activationStatus?: 'invited' | 'activated';
  invitedAt?: string;
  activatedAt?: string;
  invitationToken?: string;
  tenantId: string;
}

export const MobileStaffManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [staffList, setStaffList] = useState<IStaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{
    name: string;
    email: string;
    role: string;
    activationLink: string;
  } | null>(null);

  const [selectedMember, setSelectedMember] = useState<IStaffMember | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [memberToArchive, setMemberToArchive] = useState<IStaffMember | null>(null);

  // Invite Form fields
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invRole, setInvRole] = useState('waiter');
  const [invDept, setInvDept] = useState('Dining Room');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edit Form fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('waiter');
  const [editDept, setEditDept] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch staff records with real-time listeners
  const fetchStaff = useCallback(() => {
    if (!tenantId) {
      setLoading(false);
      return () => {};
    }

    setLoading(true);

    // Primary: query employees collection
    const empCol = collection(db, 'employees');
    const q = query(empCol, where('tenantId', '==', tenantId));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: IStaffMember[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          fullName: data.fullName || data.name || 'Team Member',
          name: data.fullName || data.name || 'Team Member',
          email: data.email || '',
          phone: data.phone || '',
          role: data.role || 'waiter',
          department: data.department || '',
          status: (data.status as any) || (data.active === false ? 'suspended' : 'active'),
          activationStatus: data.activationStatus || (data.invitationToken ? 'invited' : 'activated'),
          invitedAt: data.invitedAt || data.createdAt || '',
          activatedAt: data.activatedAt || '',
          invitationToken: data.invitationToken || '',
          tenantId: data.tenantId || tenantId,
        });
      });

      // If empty in employees collection, check restaurants/{tenantId}/staff
      if (list.length === 0) {
        const staffSubCol = collection(db, 'restaurants', tenantId, 'staff');
        getDocs(staffSubCol).then((subSnap) => {
          if (!subSnap.empty) {
            const fallbackList: IStaffMember[] = [];
            subSnap.forEach((sd) => {
              const sdata = sd.data();
              fallbackList.push({
                id: sd.id,
                fullName: sdata.name || sdata.displayName || 'Team Member',
                name: sdata.name || sdata.displayName || 'Team Member',
                email: sdata.email || '',
                phone: sdata.phone || '',
                role: sdata.role || 'waiter',
                department: sdata.department || '',
                status: sdata.active === false ? 'suspended' : 'active',
                activationStatus: 'activated',
                invitedAt: sdata.createdAt || '',
                tenantId,
              });
            });
            setStaffList(fallbackList);
          } else {
            setStaffList([]);
          }
          setLoading(false);
        }).catch(() => {
          setStaffList([]);
          setLoading(false);
        });
      } else {
        setStaffList(list);
        setLoading(false);
      }
    }, (err) => {
      console.warn('[MobileStaffManagement] Snapshot warning:', err);
      setLoading(false);
    });

    return unsubscribe;
  }, [tenantId]);

  useEffect(() => {
    const unsub = fetchStaff();
    return () => unsub();
  }, [fetchStaff]);

  // Filtered List
  const filteredStaff = useMemo(() => {
    return staffList.filter((m) => {
      // Role filter
      if (selectedRole !== 'all') {
        const r = (m.role || '').toLowerCase();
        if (selectedRole === 'waiter' && !r.includes('waiter') && !r.includes('server')) return false;
        if (selectedRole === 'kitchen' && !r.includes('kitchen') && !r.includes('chef') && !r.includes('cook')) return false;
        if (selectedRole === 'manager' && !r.includes('manager')) return false;
        if (selectedRole === 'cashier' && !r.includes('cashier')) return false;
        if (selectedRole === 'admin' && !r.includes('admin') && !r.includes('owner')) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        const s = (m.status || '').toLowerCase();
        if (selectedStatus === 'active' && s !== 'active') return false;
        if (selectedStatus === 'pending' && s !== 'pending' && m.activationStatus !== 'invited') return false;
        if (selectedStatus === 'suspended' && s !== 'suspended') return false;
        if (selectedStatus === 'archived' && s !== 'archived') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.fullName.toLowerCase().includes(q);
        const matchEmail = m.email.toLowerCase().includes(q);
        const matchDept = (m.department || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchDept) return false;
      }

      return true;
    });
  }, [staffList, selectedRole, selectedStatus, searchQuery]);

  // Handle Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !invName.trim() || !invEmail.trim()) {
      setInviteError('Name and email are required.');
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      const result = await createStaffInvitation({
        fullName: invName.trim(),
        email: invEmail.trim().toLowerCase(),
        phone: invPhone.trim(),
        role: invRole,
        department: invDept.trim() || 'Service',
        tenantId,
        createdBy: user?.email || 'Owner',
      });

      if (result.success) {
        setInviteSuccess({
          name: invName.trim(),
          email: invEmail.trim(),
          role: invRole,
          activationLink: result.activationLink,
        });
        setShowInviteModal(false);
        setInvName('');
        setInvEmail('');
        setInvPhone('');
      } else {
        setInviteError(result.error || 'Failed to send invitation.');
      }
    } catch (err: any) {
      console.error('[MobileStaffManagement] Invite error:', err);
      setInviteError(err.message || 'Invitation failed.');
    } finally {
      setInviting(false);
    }
  };

  // Toggle Suspend / Activate
  const handleToggleStatus = async (member: IStaffMember) => {
    if (!tenantId || !member.id) return;
    const isSuspended = member.status === 'suspended';
    const nextStatus = isSuspended ? 'active' : 'suspended';

    try {
      const docRef = doc(db, 'employees', member.id);
      await updateDoc(docRef, {
        status: nextStatus,
        active: nextStatus === 'active',
        updatedAt: new Date().toISOString(),
      });
      // Also update restaurant subcollection if exists
      try {
        await updateDoc(doc(db, 'restaurants', tenantId, 'staff', member.id), {
          active: nextStatus === 'active',
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        });
      } catch (_) {}
    } catch (err) {
      console.error('[MobileStaffManagement] Toggle error:', err);
    }
  };

  // Archive Member
  const handleArchiveMember = async () => {
    if (!tenantId || !memberToArchive) return;
    try {
      const docRef = doc(db, 'employees', memberToArchive.id);
      await updateDoc(docRef, {
        status: 'archived',
        active: false,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMemberToArchive(null);
      setSelectedMember(null);
    } catch (err) {
      console.error('[MobileStaffManagement] Archive error:', err);
    }
  };

  // Save Edit Member
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedMember) return;

    setSavingEdit(true);
    try {
      const docRef = doc(db, 'employees', selectedMember.id);
      await updateDoc(docRef, {
        fullName: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        department: editDept.trim(),
        updatedAt: new Date().toISOString(),
      });
      setShowEditModal(false);
      setSelectedMember(null);
    } catch (err) {
      console.error('[MobileStaffManagement] Edit save error:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditModal = (member: IStaffMember) => {
    setSelectedMember(member);
    setEditName(member.fullName);
    setEditPhone(member.phone || '');
    setEditRole(member.role);
    setEditDept(member.department || '');
    setShowEditModal(true);
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'manager':
        return 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]';
      case 'kitchen':
      case 'chef':
      case 'cook':
        return 'bg-[#FFF4EE] text-[#FF7518] border-[#FFE0CE]';
      case 'cashier':
        return 'bg-[#FAF5FF] text-[#7C3AED] border-[#E9D5FF]';
      case 'admin':
        return 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]';
      case 'reception':
        return 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]';
      case 'waiter':
      default:
        return 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A]">Active</span>;
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#D97706]">Invited</span>;
      case 'suspended':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626]">Suspended</span>;
      case 'archived':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F3F4F6] text-[#6B7280]">Archived</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A]">Active</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/business')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="font-extrabold text-sm text-[#202124]">Staff Management</h1>
          <p className="text-[11px] text-[#707070]">{staffList.length} members enrolled</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchStaff()}
            className="w-8 h-8 rounded-full bg-[#F7F7F7] text-[#202124] flex items-center justify-center hover:bg-[#EBEBEB]"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="w-9 h-9 rounded-full bg-[#FF7518] text-white flex items-center justify-center shadow-sm shadow-[#FF7518]/25"
            aria-label="Invite Staff"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Role Filter Chips */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-[#EBEBEB] overflow-x-auto no-scrollbar flex items-center gap-2">
        <button
          onClick={() => setSelectedRole('all')}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            selectedRole === 'all'
              ? 'bg-[#202124] text-white'
              : 'bg-[#F7F7F7] text-[#707070] hover:bg-[#EBEBEB]'
          }`}
        >
          All Roles ({staffList.length})
        </button>
        <button
          onClick={() => setSelectedRole('waiter')}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            selectedRole === 'waiter'
              ? 'bg-[#16A34A] text-white'
              : 'bg-[#F0FDF4] text-[#16A34A]'
          }`}
        >
          Waiters
        </button>
        <button
          onClick={() => setSelectedRole('kitchen')}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            selectedRole === 'kitchen'
              ? 'bg-[#FF7518] text-white'
              : 'bg-[#FFF4EE] text-[#FF7518]'
          }`}
        >
          Kitchen / Chefs
        </button>
        <button
          onClick={() => setSelectedRole('manager')}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            selectedRole === 'manager'
              ? 'bg-[#2563EB] text-white'
              : 'bg-[#EFF6FF] text-[#2563EB]'
          }`}
        >
          Managers
        </button>
        <button
          onClick={() => setSelectedRole('cashier')}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            selectedRole === 'cashier'
              ? 'bg-[#7C3AED] text-white'
              : 'bg-[#FAF5FF] text-[#7C3AED]'
          }`}
        >
          Cashiers
        </button>
        <button
          onClick={() => setSelectedRole('admin')}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            selectedRole === 'admin'
              ? 'bg-[#D97706] text-white'
              : 'bg-[#FEF3C7] text-[#D97706]'
          }`}
        >
          Admins
        </button>
      </div>

      {/* Status Filter Chips & Search Bar */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff name, email, department..."
              className="w-full h-9 pl-8 pr-3 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] focus:outline-none focus:border-[#FF7518]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9E9E9E]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status selector */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-2.5 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] font-medium"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Invited</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Staff Roster List */}
        {loading ? (
          <MobileLoadingSkeleton count={3} />
        ) : filteredStaff.length === 0 ? (
          <MobileEmptyState
            icon={Users}
            title={searchQuery ? 'No Staff Found' : 'No Team Members Yet'}
            description={
              searchQuery
                ? 'Try adjusting your search query or filters.'
                : 'Send official email invitations to waiters, chefs, and managers to onboard your staff.'
            }
            actionLabel={searchQuery ? 'Clear Filters' : 'Invite First Member'}
            onAction={() => {
              if (searchQuery) {
                setSearchQuery('');
                setSelectedRole('all');
                setSelectedStatus('all');
              } else {
                setShowInviteModal(true);
              }
            }}
          />
        ) : (
          filteredStaff.map((member) => {
            const isSuspended = member.status === 'suspended';

            return (
              <div
                key={member.id}
                className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#FAF4F0] border border-[#FFE0CE] text-[#FF7518] flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {member.fullName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-xs text-[#202124] truncate">
                          {member.fullName}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${getRoleBadge(member.role)}`}>
                          {member.role || 'Staff'}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#707070] truncate mt-0.5 flex items-center gap-2">
                        {member.email && <span>{member.email}</span>}
                        {member.department && <span>• {member.department}</span>}
                      </div>

                      {member.phone && (
                        <div className="text-[10px] text-[#9E9E9E] mt-0.5">
                          {member.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {getStatusBadge(member.status)}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleStatus(member)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      isSuspended
                        ? 'bg-[#DCFCE7] text-[#16A34A] hover:bg-[#BBF7D0]'
                        : 'bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA]'
                    }`}
                  >
                    {isSuspended ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Activate</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Suspend</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => openEditModal(member)}
                    className="p-2 bg-[#F7F7F7] text-[#202124] rounded-xl hover:bg-[#EBEBEB]"
                    title="Edit Member"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setMemberToArchive(member)}
                    className="p-2 bg-[#F7F7F7] text-[#707070] hover:text-[#DC2626] rounded-xl hover:bg-[#FEE2E2]"
                    title="Archive Member"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Invite Staff Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#202124]">Invite Team Member</h3>
            <p className="text-xs text-[#707070]">
              The employee will receive a cryptographically signed onboarding invitation link.
            </p>

            {inviteError && (
              <div className="p-3 rounded-xl bg-[#FEE2E2] text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="rahul@spiraldine.com"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={invPhone}
                  onChange={(e) => setInvPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Role *</label>
                  <select
                    value={invRole}
                    onChange={(e) => setInvRole(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none font-medium"
                  >
                    <option value="waiter">Waiter / Server</option>
                    <option value="kitchen">Kitchen / Chef</option>
                    <option value="manager">Branch Manager</option>
                    <option value="cashier">Cashier</option>
                    <option value="reception">Receptionist</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Department</label>
                  <input
                    type="text"
                    value={invDept}
                    onChange={(e) => setInvDept(e.target.value)}
                    placeholder="Dining Room"
                    className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF7518] text-white text-xs font-bold shadow-sm"
                >
                  {inviting ? 'Generating...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Success Modal */}
      {inviteSuccess && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#202124]">Invitation Created!</h3>
              <p className="text-xs text-[#707070] mt-1">
                Invited <strong className="text-[#202124]">{inviteSuccess.name}</strong> as <span className="capitalize">{inviteSuccess.role}</span>.
              </p>
            </div>

            <div className="p-3 bg-[#F7F7F7] rounded-xl text-left border border-[#EBEBEB]">
              <span className="text-[10px] font-bold text-[#707070] uppercase">Activation Link</span>
              <p className="text-[11px] text-[#202124] break-all font-mono mt-0.5 select-all">
                {inviteSuccess.activationLink}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteSuccess.activationLink);
                  alert('Activation link copied!');
                }}
                className="flex-1 py-2.5 bg-[#F7F7F7] border border-[#EBEBEB] text-[#202124] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </button>

              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'SpiralDine Staff Invitation',
                      text: `Join the team on SpiralDine: ${inviteSuccess.activationLink}`,
                      url: inviteSuccess.activationLink,
                    });
                  } else {
                    navigator.clipboard.writeText(inviteSuccess.activationLink);
                    alert('Activation link copied!');
                  }
                }}
                className="flex-1 py-2.5 bg-[#FF7518] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>

            <button
              onClick={() => setInviteSuccess(null)}
              className="w-full py-2 text-xs font-bold text-[#707070] hover:text-[#202124]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-[#202124]">Edit Team Member</h3>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none font-medium"
                  >
                    <option value="waiter">Waiter / Server</option>
                    <option value="kitchen">Kitchen / Chef</option>
                    <option value="manager">Branch Manager</option>
                    <option value="cashier">Cashier</option>
                    <option value="reception">Receptionist</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Department</label>
                  <input
                    type="text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF7518] text-white text-xs font-bold shadow-sm"
                >
                  {savingEdit ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {memberToArchive && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center mx-auto">
              <Archive className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-[#202124]">Archive {memberToArchive.fullName}?</h3>
            <p className="text-xs text-[#707070]">
              The member will be removed from active rosters and shifts, while preserving past order history.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setMemberToArchive(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveMember}
                className="flex-1 py-2.5 rounded-xl bg-[#202124] text-white text-xs font-bold"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileStaffManagement;
