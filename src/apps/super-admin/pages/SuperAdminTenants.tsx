import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { ITenant } from '../../../types';
import { zodResolver } from '../../../utils/zodResolver';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';
import Table from '../../../components/ui/Table/Table';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, ShieldAlert, Check, XCircle } from 'lucide-react';

const tenantFormSchema = z.object({
  name: z.string().min(1, 'Restaurant name is required'),
  planTier: z.enum(['starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'approved', 'suspended', 'trial', 'pending_approval', 'rejected', 'more_info_required']),
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  zipCode: z.string().min(1, 'Zip code is required')
});

type TTenantForm = z.infer<typeof tenantFormSchema>;

export const SuperAdminTenants: React.FC = () => {
  const { user } = useAuth();
  
  const [tenants, setTenants] = useState<ITenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<ITenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('all');

  // Modal and Dialog Trigger states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<ITenant | null>(null);
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const planOptions = [
    { value: 'starter', label: 'Starter plan ($49/mo)' },
    { value: 'pro', label: 'Professional plan ($99/mo)' },
    { value: 'enterprise', label: 'Enterprise plan ($249/mo)' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active Subscription' },
    { value: 'trial', label: 'Trial Mode' },
    { value: 'suspended', label: 'Suspended Workspace' }
  ];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<TTenantForm>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      planTier: 'pro',
      status: 'trial'
    }
  });

  // Fetch all tenants
  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      const colRef = collection(db, 'tenants');
      const querySnap = await getDocs(query(colRef));
      const list: ITenant[] = [];
      querySnap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ITenant);
      });
      setTenants(list);
      setFilteredTenants(list);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to query merchant tenants.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Filter & Search logic
  useEffect(() => {
    let filtered = [...tenants];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.id.toLowerCase().includes(q)
      );
    }
    if (selectedPlan !== 'all') {
      filtered = filtered.filter(item => item.planTier === selectedPlan);
    }
    setFilteredTenants(filtered);
  }, [searchQuery, selectedPlan, tenants]);

  // Log Security Actions to Firestore auditLogs
  const logSecurityAction = async (action: string, targetName: string) => {
    try {
      const logId = `LOG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        action,
        target: targetName,
        userEmail: user?.email || 'super-admin',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to push security logs', err);
    }
  };

  const openAddModal = () => {
    setEditingTenant(null);
    reset({
      name: '',
      planTier: 'pro',
      status: 'trial',
      street: '',
      city: '',
      zipCode: ''
    });
    setIsFormOpen(true);
  };

  const openEditModal = (t: ITenant) => {
    setEditingTenant(t);
    reset({
      name: t.name,
      planTier: t.planTier,
      status: t.status,
      street: (t.address as any)?.street || '',
      city: (t.address as any)?.city || '',
      zipCode: (t.address as any)?.zipCode || ''
    });
    setIsFormOpen(true);
  };

  // Submit Operations
  const onSubmitForm = async (data: TTenantForm) => {
    setIsSubmitting(true);
    try {
      const tenantSlug = editingTenant ? editingTenant.id : data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const docRef = doc(db, 'tenants', tenantSlug);

      const tenantPayload: Omit<ITenant, 'id'> = {
        name: data.name,
        logoUrl: editingTenant ? editingTenant.logoUrl : '',
        planTier: data.planTier,
        status: data.status,
        address: {
          street: data.street,
          city: data.city,
          zipCode: data.zipCode
        },
        stripeCustomerId: editingTenant ? editingTenant.stripeCustomerId : 'cus_placeholder',
        stripeSubscriptionId: editingTenant ? editingTenant.stripeSubscriptionId : 'sub_placeholder',
        createdAt: editingTenant ? editingTenant.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, tenantPayload);

      // Audit logs additions
      if (editingTenant) {
        if (editingTenant.planTier !== data.planTier) {
          logSecurityAction('PLAN_MODIFIED', `${data.name} (${data.planTier.toUpperCase()})`);
        }
        if (editingTenant.status !== data.status) {
          logSecurityAction('STATUS_TOGGLED', `${data.name} (${data.status.toUpperCase()})`);
        }
      } else {
        logSecurityAction('RESTAURANT_CREATED', data.name);
      }

      toast.success(editingTenant ? 'Workspace profile updated successfully!' : 'Restaurant workspace created successfully!');
      setIsFormOpen(false);
      fetchTenants();
    } catch (e: any) {
      console.error(e);
      toast.error('Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Single Click Suspension controls
  const handleToggleSuspended = async (item: ITenant) => {
    try {
      const docRef = doc(db, 'tenants', item.id);
      const nextStatus = item.status === 'suspended' ? 'active' : 'suspended';
      await updateDoc(docRef, { status: nextStatus });
      
      logSecurityAction(
        nextStatus === 'suspended' ? 'RESTAURANT_SUSPENDED' : 'RESTAURANT_ACTIVATED', 
        item.name
      );

      toast.success(`${item.name} status updated to ${nextStatus.toUpperCase()}`);
      setTenants(prev => 
        prev.map(t => t.id === item.id ? { ...t, status: nextStatus } : t)
      );
    } catch (e) {
      console.error(e);
      toast.error('Failed to change suspension state.');
    }
  };

  const triggerDeleteConfirm = (id: string) => {
    setDeletingTenantId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTenantId) return;
    try {
      const targetTenant = tenants.find(t => t.id === deletingTenantId);
      const docRef = doc(db, 'tenants', deletingTenantId);
      
      await deleteDoc(docRef);
      if (targetTenant) {
        logSecurityAction('RESTAURANT_DELETED', targetTenant.name);
      }

      toast.success('Workspace deleted.');
      fetchTenants();
    } catch (e) {
      console.error(e);
      toast.error('Delete failed.');
    } finally {
      setIsDeleteOpen(false);
      setDeletingTenantId(null);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Workspace ID / Name',
      accessor: (row: ITenant) => (
        <div>
          <span className="font-semibold text-textPearl text-sm">{row.name}</span>
          <div className="text-[10px] text-slate-500 font-bold select-all">Slug: {row.id}</div>
        </div>
      )
    },
    {
      header: 'Address location',
      accessor: (row: ITenant) => {
        const city = (row.address && typeof row.address === 'object') ? row.address.city : (row.address || 'N/A');
        return <span className="text-slate-450 font-semibold">{city}</span>;
      }
    },
    {
      header: 'Subscription Plan',
      accessor: (row: ITenant) => (
        <Badge variant={row.planTier === 'enterprise' ? 'primary' : 'warning'}>
          {row.planTier.toUpperCase()}
        </Badge>
      )
    },
    {
      header: 'SaaS Status',
      accessor: (row: ITenant) => (
        <Badge variant={
          row.status === 'active' ? 'success' :
          row.status === 'trial' ? 'warning' : 'danger'
        }>
          {row.status.toUpperCase()}
        </Badge>
      )
    },
    {
      header: 'Suspension',
      accessor: (row: ITenant) => (
        <button
          onClick={() => handleToggleSuspended(row)}
          className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all ${
            row.status === 'suspended'
              ? 'bg-emerald-500/10 hover:bg-emerald-500 border-emerald-500/20 text-emerald-500 hover:text-slate-950'
              : 'bg-red-500/10 hover:bg-red-505 border-red-500/20 text-red-400 hover:text-slate-950'
          }`}
        >
          {row.status === 'suspended' ? 'Activate' : 'Suspend'}
        </button>
      )
    },
    {
      header: 'Actions',
      accessor: (row: ITenant) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
            className="p-1 text-slate-400 hover:text-primary hover:bg-slate-800/50"
            title="Edit Workspace"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => triggerDeleteConfirm(row.id)}
            className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-500/10"
            title="Delete Workspace"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 text-left select-none">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-textPearl">Merchant Directory</h1>
          <p className="text-xs text-mutedAsh font-semibold">Track and manage global SaaS client workspaces instances.</p>
        </div>
        <Button onClick={openAddModal} className="flex items-center space-x-1.5 self-start">
          <Plus className="w-4 h-4" />
          <span>Onboard Restaurant</span>
        </Button>
      </div>

      {/* Query filters */}
      <Card className="p-4 border-slate-850 bg-slate-900/35">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchBar 
              placeholder="Search workspaces by business title or slug..." 
              value={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
          <div className="w-full md:w-56">
            <Select 
              options={[
                { value: 'all', label: 'All Plan Tiers' },
                { value: 'starter', label: 'Starter Plan' },
                { value: 'pro', label: 'Professional Plan' },
                { value: 'enterprise', label: 'Enterprise Plan' }
              ]}
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Directory database output */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner label="Compiling client workspace lists..." />
        </div>
      ) : filteredTenants.length === 0 ? (
        <Card className="p-8 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
          <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-450">No workspaces matched filters.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-slate-850">
          <Table 
            columns={columns} 
            data={filteredTenants} 
            keyExtractor={(row) => row.id} 
          />
        </Card>
      )}

      {/* CRUD Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTenant ? 'Edit Restaurant Workspace' : 'Onboard Restaurant Workspace'}
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <Input
            label="Restaurant Workspace Name"
            type="text"
            placeholder="Gourmet Bistro"
            error={errors.name?.message}
            disabled={isSubmitting}
            {...register('name')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Subscription Plan Tier"
              options={planOptions}
              error={errors.planTier?.message}
              disabled={isSubmitting}
              {...register('planTier')}
            />
            <Select
              label="SaaS Account Status"
              options={statusOptions}
              error={errors.status?.message}
              disabled={isSubmitting}
              {...register('status')}
            />
          </div>

          <div className="border-t border-slate-800/40 pt-4 space-y-4">
            <span className="text-xs font-semibold text-slate-400 block select-none">Physical Location</span>
            
            <Input
              label="Street"
              type="text"
              placeholder="123 Delicious Rd"
              error={errors.street?.message}
              disabled={isSubmitting}
              {...register('street')}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="City"
                type="text"
                placeholder="New York"
                error={errors.city?.message}
                disabled={isSubmitting}
                {...register('city')}
              />
              <Input
                label="Zip Code"
                type="text"
                placeholder="10001"
                error={errors.zipCode?.message}
                disabled={isSubmitting}
                {...register('zipCode')}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-slate-800/40 mt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isSubmitting}
            >
              {editingTenant ? 'Save Changes' : 'Onboard Workspace'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Restaurant Workspace"
        message="WARNING: Deleting this workspace is irreversible. All menu items, staff employee configurations, table layouts, and active orders will be permanently erased."
        confirmLabel="Erase Workspace"
        isDangerous={true}
      />
    </div>
  );
};
export default SuperAdminTenants;
