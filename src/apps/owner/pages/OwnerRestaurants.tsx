import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { ITenant } from '../../../types';
import { logAuditEvent } from '../../../shared/services/auditService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Icons & Toast
import toast from 'react-hot-toast';
import { 
  Building2, 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  UserCheck, 
  Users, 
  DollarSign, 
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Edit2, 
  Power, 
  UtensilsCrossed, 
  QrCode,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Clock
} from 'lucide-react';

interface IRestaurantWithStats extends ITenant {
  todaySales?: number;
  todayOrders?: number;
  tableCount?: number;
  staffCount?: number;
  managerName?: string;
  managerId?: string;
  city?: string;
}

interface IBranchSummary {
  id: string;
  name: string;
  address?: string;
  managerName?: string;
  phone?: string;
  tableCount?: number;
  activeOrders?: number;
}

export const OwnerRestaurants: React.FC = () => {
  const { user } = useAuth();
  const currentTenantId = user?.tenantId;

  const [restaurants, setRestaurants] = useState<IRestaurantWithStats[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  // Detail Drawer / Modal state
  const [selectedRestaurant, setSelectedRestaurant] = useState<IRestaurantWithStats | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [branches, setBranches] = useState<IBranchSummary[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formCuisine, setFormCuisine] = useState<string>('');
  const [formPlan, setFormPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Assign Manager Modal state
  const [isAssignManagerOpen, setIsAssignManagerOpen] = useState<boolean>(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [targetRestaurantForManager, setTargetRestaurantForManager] = useState<IRestaurantWithStats | null>(null);

  // Confirmation for status toggle
  const [statusDialogData, setStatusDialogData] = useState<{ id: string; name: string; currentStatus: string } | null>(null);

  // 1. Fetch authorized restaurants and employees
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    let isMounted = true;

    const loadData = async () => {
      try {
        // Look up restaurants owned by user or where id == currentTenantId
        const restList: IRestaurantWithStats[] = [];

        // Query restaurants by ownerUid if available
        let q = query(collection(db, 'restaurants'));
        if (user.role !== 'super-admin') {
          // If tenantId exists, look up by tenantId or ownerUid
          try {
            const qOwner = query(collection(db, 'restaurants'), where('ownerUid', '==', user.uid));
            const snapOwner = await getDocs(qOwner);
            snapOwner.forEach(d => {
              restList.push({ id: d.id, ...d.data() } as IRestaurantWithStats);
            });
          } catch (_) {}
        }

        // If nothing found yet, fetch tenantId restaurant
        if (currentTenantId && !restList.some(r => r.id === currentTenantId)) {
          try {
            const snapSingle = await getDocs(query(collection(db, 'restaurants'), where('__name__', '==', currentTenantId)));
            snapSingle.forEach(d => {
              restList.push({ id: d.id, ...d.data() } as IRestaurantWithStats);
            });
          } catch (_) {}
        }

        // Also check tenants collection as fallback
        if (restList.length === 0) {
          try {
            const qTenants = query(collection(db, 'tenants'), where('ownerUid', '==', user.uid));
            const snapTenants = await getDocs(qTenants);
            snapTenants.forEach(d => {
              restList.push({ id: d.id, ...d.data() } as IRestaurantWithStats);
            });
          } catch (_) {}
        }

        // Fetch operational metrics for each restaurant
        const enrichedList = await Promise.all(
          restList.map(async (rest) => {
            let sales = 0;
            let orderCount = 0;
            let tablesCount = 0;

            try {
              // 1. Tables count
              const tablesSnap = await getDocs(collection(db, 'restaurants', rest.id, 'tables'));
              tablesCount = tablesSnap.size;

              // 2. Orders summary (today's orders)
              const ordersSnap = await getDocs(collection(db, 'restaurants', rest.id, 'orders'));
              orderCount = ordersSnap.size;
              ordersSnap.forEach(o => {
                const od = o.data();
                if (od.total) sales += Number(od.total);
              });
            } catch (_) {}

            return {
              ...rest,
              city: typeof rest.address === 'object' ? rest.address.city : (rest.city || 'Primary City'),
              todaySales: sales > 1000 ? Math.round(sales / 100) : sales, // Handle cents
              todayOrders: orderCount,
              tableCount: tablesCount
            };
          })
        );

        // Fetch staff directory for manager assignment
        if (currentTenantId) {
          const empSnap = await getDocs(query(collection(db, 'employees'), where('tenantId', '==', currentTenantId)));
          const emps: any[] = [];
          empSnap.forEach(d => emps.push({ id: d.id, ...d.data() }));
          if (isMounted) setEmployees(emps);
        }

        if (isMounted) {
          setRestaurants(enrichedList);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading restaurants:', err);
        if (isMounted) {
          toast.error('Failed to load restaurant list');
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user, currentTenantId]);

  // Unique locations for filter
  const locations = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach(r => {
      if (r.city) set.add(r.city);
    });
    return Array.from(set);
  }, [restaurants]);

  // Filtered list
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r => {
      const matchQuery = 
        !searchQuery ||
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.city?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'active' && (r.status === 'active' || !r.status)) ||
        (statusFilter === 'inactive' && ((r.status as string) === 'suspended' || (r.status as string) === 'inactive'));

      const matchLoc = locationFilter === 'all' || r.city === locationFilter;

      return matchQuery && matchStatus && matchLoc;
    });
  }, [restaurants, searchQuery, statusFilter, locationFilter]);

  // Open Details view
  const handleViewDetails = async (rest: IRestaurantWithStats) => {
    setSelectedRestaurant(rest);
    setIsDetailsOpen(true);
    setIsLoadingDetails(true);

    try {
      // Load branches for this restaurant
      const branchSnap = await getDocs(collection(db, 'restaurants', rest.id, 'branches'));
      const branchList: IBranchSummary[] = [];
      branchSnap.forEach(b => {
        branchList.push({ id: b.id, ...b.data() } as IBranchSummary);
      });
      setBranches(branchList);
    } catch (err) {
      console.warn('Error loading branches:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Open Edit modal
  const handleOpenEdit = (rest: IRestaurantWithStats) => {
    setIsEditing(true);
    setEditingId(rest.id);
    setFormName(rest.name || '');
    setFormCity(rest.city || '');
    setFormAddress(typeof rest.address === 'string' ? rest.address : rest.address?.street || '');
    setFormPhone(rest.phone || '');
    setFormCuisine(Array.isArray(rest.cuisine) ? rest.cuisine.join(', ') : (rest.cuisine || ''));
    setFormPlan(rest.planTier || 'pro');
    setIsFormOpen(true);
  };

  // Open Create modal
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId('');
    setFormName('');
    setFormCity('');
    setFormAddress('');
    setFormPhone('');
    setFormCuisine('');
    setFormPlan('pro');
    setIsFormOpen(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Restaurant name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const restId = isEditing ? editingId : `rest-${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      const payload = {
        id: restId,
        name: formName.trim(),
        ownerUid: user?.uid || '',
        city: formCity.trim() || 'Hyderabad',
        address: formAddress.trim() ? { street: formAddress.trim(), city: formCity.trim(), zipCode: '' } : formAddress.trim(),
        phone: formPhone.trim(),
        cuisine: formCuisine ? formCuisine.split(',').map(s => s.trim()) : ['Multicuisine'],
        planTier: formPlan,
        status: isEditing ? (selectedRestaurant?.status || 'active') : 'active',
        updatedAt: now,
        ...(isEditing ? {} : { createdAt: now })
      };

      await setDoc(doc(db, 'restaurants', restId), payload, { merge: true });
      await setDoc(doc(db, 'tenants', restId), payload, { merge: true });

      await logAuditEvent({
        userId: user?.uid || 'unknown',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: restId,
        restaurantName: formName,
        module: 'Restaurants',
        action: isEditing ? 'UPDATE' : 'CREATE',
        targetEntity: `Restaurant ${formName} (${restId})`,
        newValue: payload
      });

      toast.success(isEditing ? 'Restaurant profile updated' : 'Restaurant added successfully');
      setIsFormOpen(false);

      // Refresh local state
      setRestaurants(prev => {
        if (isEditing) {
          return prev.map(r => r.id === restId ? { ...r, ...payload } : r);
        }
        const newRecord: IRestaurantWithStats = {
          ...payload,
          createdAt: now,
          updatedAt: now,
          logoUrl: '',
          stripeCustomerId: '',
          stripeSubscriptionId: '',
          todaySales: 0,
          todayOrders: 0,
          tableCount: 0
        };
        return [newRecord, ...prev];
      });
    } catch (err: any) {
      console.error('Save restaurant error:', err);
      toast.error(err.message || 'Failed to save restaurant');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Activate / Deactivate status
  const confirmToggleStatus = async () => {
    if (!statusDialogData) return;
    const { id, currentStatus, name } = statusDialogData;
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

    try {
      await updateDoc(doc(db, 'restaurants', id), { status: newStatus, updatedAt: new Date().toISOString() });
      await updateDoc(doc(db, 'tenants', id), { status: newStatus, updatedAt: new Date().toISOString() });

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: id,
        restaurantName: name,
        module: 'Restaurants',
        action: 'STATUS_CHANGE',
        targetEntity: `Restaurant status changed to ${newStatus}`,
        previousValue: currentStatus,
        newValue: newStatus
      });

      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status: newStatus as any } : r));
      toast.success(`Restaurant ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      setStatusDialogData(null);
    } catch (err) {
      console.error('Toggle status error:', err);
      toast.error('Failed to change status');
    }
  };

  // Open Manager Assignment Modal
  const handleOpenAssignManager = (rest: IRestaurantWithStats) => {
    setTargetRestaurantForManager(rest);
    setSelectedManagerId(rest.managerId || '');
    setIsAssignManagerOpen(true);
  };

  // Confirm Manager Assignment
  const handleSaveManager = async () => {
    if (!targetRestaurantForManager) return;
    const managerObj = employees.find(e => e.id === selectedManagerId);

    try {
      const updatePayload = {
        managerId: selectedManagerId || null,
        managerName: managerObj ? (managerObj.fullName || managerObj.name) : null,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'restaurants', targetRestaurantForManager.id), updatePayload);

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetRestaurantForManager.id,
        restaurantName: targetRestaurantForManager.name,
        module: 'Restaurants',
        action: 'UPDATE',
        targetEntity: `Assigned Branch Manager: ${updatePayload.managerName || 'Unassigned'}`
      });

      setRestaurants(prev => prev.map(r => 
        r.id === targetRestaurantForManager.id 
          ? { ...r, managerId: updatePayload.managerId || undefined, managerName: updatePayload.managerName || undefined } 
          : r
      ));

      toast.success('Branch manager assigned successfully');
      setIsAssignManagerOpen(false);
    } catch (err) {
      console.error('Assign manager error:', err);
      toast.error('Failed to assign manager');
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Top Header & KPI Summary ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <Building2 className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Restaurants & Branches
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Centralized management of your restaurant portfolio, branches, and branch managers.
          </p>
        </div>

        <Button 
          variant="primary" 
          onClick={handleOpenCreate}
          className="bg-[#C9533B] hover:bg-[#B34530] text-white flex items-center space-x-2 rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Add Restaurant</span>
        </Button>
      </div>

      {/* ── Metric Snapshot Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#12352D]/10 flex items-center justify-center text-[#12352D]">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Total Locations</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">{restaurants.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#16845B]/10 flex items-center justify-center text-[#16845B]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Active</p>
            <p className="text-xl font-bold font-serif text-[#16845B]">
              {restaurants.filter(r => r.status === 'active' || !r.status).length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9533B]/10 flex items-center justify-center text-[#C9533B]">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Total Orders</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">
              {restaurants.reduce((sum, r) => sum + (r.todayOrders || 0), 0)}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Managed Tables</p>
            <p className="text-xl font-bold font-serif text-[#17202A]">
              {restaurants.reduce((sum, r) => sum + (r.tableCount || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by name, city, ID..." 
          />
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none focus:ring-1 focus:ring-[#C9533B]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Suspended / Inactive</option>
          </select>

          {/* Location Filter */}
          <select 
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none focus:ring-1 focus:ring-[#C9533B]"
          >
            <option value="all">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Content / Cards List ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Loading your restaurant portfolio..." />
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <EmptyState 
          title="No restaurants found"
          description={searchQuery ? "No restaurant matches your active search filters." : "You haven't added any restaurants to your portfolio yet."}
          actionLabel="Add Your First Restaurant"
          onActionClick={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRestaurants.map((rest) => {
            const isActive = rest.status === 'active' || !rest.status;

            return (
              <div 
                key={rest.id} 
                className="rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#C9533B]/40 transition-all duration-200 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                {/* Card Top */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-xl bg-[#12352D] text-white flex items-center justify-center font-serif font-bold text-lg shadow-sm">
                        {rest.name?.charAt(0) || 'R'}
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-base text-[#17202A] line-clamp-1">
                          {rest.name}
                        </h3>
                        <div className="flex items-center text-xs text-[#6B7280] space-x-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-[#C9533B] shrink-0" />
                          <span className="truncate">{rest.city || 'Main Branch'}</span>
                        </div>
                      </div>
                    </div>

                    <Badge variant={isActive ? 'success' : 'danger'}>
                      {isActive ? 'Active' : 'Suspended'}
                    </Badge>
                  </div>

                  {/* Branch Manager Information */}
                  <div className="mt-3.5 p-2.5 rounded-xl bg-[#F8F6F2] border border-[#E5E7EB]/60 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <UserCheck className="w-4 h-4 text-[#12352D]" />
                      <div>
                        <p className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">Branch Manager</p>
                        <p className="font-bold text-[#17202A] truncate max-w-[150px]">
                          {rest.managerName || 'Unassigned'}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleOpenAssignManager(rest)}
                      className="text-[11px] font-bold text-[#C9533B] hover:underline"
                    >
                      {rest.managerName ? 'Change' : 'Assign'}
                    </button>
                  </div>

                  {/* Operational Stats Row */}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center py-2.5 px-3 rounded-xl bg-[#12352D]/5 border border-[#12352D]/10">
                    <div>
                      <p className="text-[10px] font-semibold text-[#6B7280] uppercase">Tables</p>
                      <p className="font-bold font-serif text-[#17202A] text-sm mt-0.5">{rest.tableCount || 0}</p>
                    </div>
                    <div className="border-x border-[#12352D]/10">
                      <p className="text-[10px] font-semibold text-[#6B7280] uppercase">Orders</p>
                      <p className="font-bold font-serif text-[#17202A] text-sm mt-0.5">{rest.todayOrders || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[#6B7280] uppercase">Sales</p>
                      <p className="font-bold font-serif text-[#16845B] text-sm mt-0.5">${rest.todaySales || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3.5 bg-[#F8F6F2] border-t border-[#E5E7EB] flex items-center justify-between text-xs">
                  <button 
                    onClick={() => handleViewDetails(rest)}
                    className="flex items-center space-x-1.5 font-bold text-[#12352D] hover:text-[#C9533B] transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View Restaurant</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handleOpenEdit(rest)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#17202A] hover:bg-white transition-colors"
                      title="Edit Restaurant"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button 
                      onClick={() => setStatusDialogData({ id: rest.id, name: rest.name, currentStatus: rest.status || 'active' })}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isActive 
                          ? 'text-[#6B7280] hover:text-red-600 hover:bg-red-50' 
                          : 'text-[#16845B] hover:bg-green-50'
                      }`}
                      title={isActive ? 'Deactivate' : 'Activate'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detailed Restaurant View Modal / Drawer ── */}
      {isDetailsOpen && selectedRestaurant && (
        <Modal 
          isOpen={isDetailsOpen} 
          onClose={() => setIsDetailsOpen(false)}
          title={`Branch Operational Summary — ${selectedRestaurant.name}`}
        >
          <div className="space-y-5 p-1 select-none">
            {/* Overview Banner */}
            <div className="p-4 rounded-2xl bg-[#12352D] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#C9533B] bg-white/10 px-2 py-0.5 rounded">
                  Branch ID: {selectedRestaurant.id}
                </span>
                <h2 className="text-xl font-serif font-bold text-white mt-1">
                  {selectedRestaurant.name}
                </h2>
                <p className="text-xs text-[#A2B5AF] mt-0.5">
                  {selectedRestaurant.city} &middot; {selectedRestaurant.phone || 'No phone recorded'}
                </p>
              </div>

              <Badge variant={selectedRestaurant.status === 'active' || !selectedRestaurant.status ? 'success' : 'danger'}>
                {selectedRestaurant.status === 'active' || !selectedRestaurant.status ? 'Operational' : 'Suspended'}
              </Badge>
            </div>

            {/* Manager and Operations Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8F6F2]">
                <p className="text-[11px] font-semibold text-[#6B7280]">Assigned Manager</p>
                <p className="text-sm font-bold text-[#17202A] mt-0.5">
                  {selectedRestaurant.managerName || 'None Assigned'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F8F6F2]">
                <p className="text-[11px] font-semibold text-[#6B7280]">Plan Subscription</p>
                <p className="text-sm font-bold text-[#C9533B] uppercase mt-0.5">
                  {selectedRestaurant.planTier || 'Pro'}
                </p>
              </div>
            </div>

            {/* Today's Operational Summary */}
            <div>
              <h4 className="text-xs font-bold text-[#17202A] uppercase tracking-wider mb-2">
                Operational Metrics
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-center">
                  <p className="text-[11px] text-[#6B7280]">Recorded Sales</p>
                  <p className="text-lg font-serif font-bold text-[#16845B] mt-0.5">
                    ${selectedRestaurant.todaySales || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-center">
                  <p className="text-[11px] text-[#6B7280]">Total Orders</p>
                  <p className="text-lg font-serif font-bold text-[#17202A] mt-0.5">
                    {selectedRestaurant.todayOrders || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-center">
                  <p className="text-[11px] text-[#6B7280]">Configured Tables</p>
                  <p className="text-lg font-serif font-bold text-[#17202A] mt-0.5">
                    {selectedRestaurant.tableCount || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-Branches List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-[#17202A] uppercase tracking-wider">
                  Associated Branches & Sections
                </h4>
                <span className="text-[11px] text-[#6B7280]">{branches.length} registered</span>
              </div>

              {isLoadingDetails ? (
                <div className="py-6 text-center"><LoadingSpinner label="Loading branches..." /></div>
              ) : branches.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] text-center text-xs text-[#6B7280]">
                  No sub-branches registered for this restaurant. Primary location functions as the single hub.
                </div>
              ) : (
                <div className="space-y-2">
                  {branches.map(b => (
                    <div key={b.id} className="p-3 rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#17202A]">{b.name}</p>
                        <p className="text-[11px] text-[#6B7280]">{b.address || 'Address pending'}</p>
                      </div>
                      <Badge variant="neutral">{b.tableCount || 0} tables</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" onClick={() => setIsDetailsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add / Edit Restaurant Modal ── */}
      {isFormOpen && (
        <Modal 
          isOpen={isFormOpen} 
          onClose={() => setIsFormOpen(false)}
          title={isEditing ? 'Edit Restaurant' : 'Add New Restaurant'}
        >
          <form onSubmit={handleSubmitForm} className="space-y-4 p-1">
            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Restaurant Name *</label>
              <Input 
                value={formName} 
                onChange={(e) => setFormName(e.target.value)} 
                placeholder="e.g. SpiralDine Bistro - Madhapur"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">City / Region *</label>
                <Input 
                  value={formCity} 
                  onChange={(e) => setFormCity(e.target.value)} 
                  placeholder="e.g. Hyderabad"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Contact Phone</label>
                <Input 
                  value={formPhone} 
                  onChange={(e) => setFormPhone(e.target.value)} 
                  placeholder="e.g. +91 9876543210"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Street Address</label>
              <Input 
                value={formAddress} 
                onChange={(e) => setFormAddress(e.target.value)} 
                placeholder="e.g. Plot 42, Hitech City Main Road"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Cuisine Type(s)</label>
                <Input 
                  value={formCuisine} 
                  onChange={(e) => setFormCuisine(e.target.value)} 
                  placeholder="e.g. Biryani, North Indian, Continental"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Plan Tier</label>
                <select 
                  value={formPlan}
                  onChange={(e) => setFormPlan(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none focus:ring-1 focus:ring-[#C9533B]"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2">
              <Button variant="secondary" type="button" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={isSubmitting}
                className="bg-[#C9533B] hover:bg-[#B34530] text-white"
              >
                {isSubmitting ? 'Saving...' : (isEditing ? 'Update Restaurant' : 'Create Restaurant')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Assign Branch Manager Modal ── */}
      {isAssignManagerOpen && targetRestaurantForManager && (
        <Modal
          isOpen={isAssignManagerOpen}
          onClose={() => setIsAssignManagerOpen(false)}
          title={`Assign Branch Manager — ${targetRestaurantForManager.name}`}
        >
          <div className="space-y-4 p-1">
            <p className="text-xs text-[#6B7280]">
              Select a team member from your staff directory to act as the primary operational branch manager.
            </p>

            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Branch Manager</label>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none focus:ring-1 focus:ring-[#C9533B]"
              >
                <option value="">-- No Manager Assigned --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName || emp.name} ({emp.role || 'Staff'}) - {emp.department || 'General'}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2">
              <Button variant="secondary" onClick={() => setIsAssignManagerOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleSaveManager}
                className="bg-[#12352D] hover:bg-[#1A473C] text-white"
              >
                Save Assignment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Status Toggle Confirmation Dialog ── */}
      {statusDialogData && (
        <Dialog
          isOpen={Boolean(statusDialogData)}
          onClose={() => setStatusDialogData(null)}
          onConfirm={confirmToggleStatus}
          title={statusDialogData.currentStatus === 'active' ? 'Deactivate Restaurant' : 'Activate Restaurant'}
          message={`Are you sure you want to ${statusDialogData.currentStatus === 'active' ? 'deactivate' : 'activate'} "${statusDialogData.name}"? Active operational access and ordering for this location will be updated.`}
          confirmLabel={statusDialogData.currentStatus === 'active' ? 'Deactivate' : 'Activate'}
          isDangerous={statusDialogData.currentStatus === 'active'}
        />
      )}
    </div>
  );
};

export default OwnerRestaurants;
