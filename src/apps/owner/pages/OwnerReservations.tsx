import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  where 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { restaurantService } from '../../../shared/services/restaurantService';
import { logAuditEvent } from '../../../shared/services/auditService';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState/EmptyState';

// Toast & Icons
import toast from 'react-hot-toast';
import { 
  CalendarCheck, 
  Plus, 
  Calendar, 
  Clock, 
  Users, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  UserCheck, 
  AlertCircle, 
  Edit3, 
  Phone, 
  Mail, 
  MessageSquare,
  QrCode,
  Building2,
  ChevronRight
} from 'lucide-react';

export interface IReservationRecord {
  id: string;
  bookingId?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  restaurantId: string;
  restaurantName?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  guests: number;
  tableNumber?: string;
  tableId?: string;
  seatingPreference?: string;
  specialNotes?: string;
  status: 'Pending' | 'Confirmed' | 'Arrived' | 'Seated' | 'Completed' | 'Cancelled' | 'No-Show';
  createdAt: string;
  updatedAt?: string;
}

type TStatusTab = 'today' | 'upcoming' | 'completed' | 'cancelled' | 'noshow' | 'all';

export const OwnerReservations: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [reservations, setReservations] = useState<IReservationRecord[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const [activeTab, setActiveTab] = useState<TStatusTab>('today');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingRes, setEditingRes] = useState<IReservationRecord | null>(null);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState<string>('19:00');
  const [formGuests, setFormGuests] = useState<number>(2);
  const [formTable, setFormTable] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formRestaurantId, setFormRestaurantId] = useState<string>(tenantId || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Action Dialog (Cancel / No-show)
  const [actionDialog, setActionDialog] = useState<{
    res: IReservationRecord;
    action: 'Cancelled' | 'No-Show' | 'Arrived' | 'Completed' | 'Confirmed';
  } | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Subscribe to Firestore reservations and restaurants
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    const targetTenant = tenantId || 'default';

    // Fetch authorized restaurants for filter dropdown
    const fetchRestaurants = async () => {
      try {
        const list = await restaurantService.getAuthorizedRestaurants(user);
        setRestaurants(list);
      } catch (_) {}
    };
    fetchRestaurants();

    // Fetch tables for assignment
    const fetchTables = async () => {
      try {
        const snapTables = await getDocs(collection(db, 'restaurants', targetTenant, 'tables'));
        const tList: any[] = [];
        snapTables.forEach(d => tList.push({ id: d.id, ...d.data() }));
        setTables(tList);
      } catch (_) {}
    };
    fetchTables();

    // Real-time listener for reservations
    const unsub = onSnapshot(
      collection(db, 'restaurants', targetTenant, 'reservations'),
      (snapshot) => {
        const list: IReservationRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as IReservationRecord);
        });

        // Sort by date and time
        list.sort((a, b) => {
          const dtA = `${a.date || ''} ${a.time || ''}`;
          const dtB = `${b.date || ''} ${b.time || ''}`;
          return dtB.localeCompare(dtA);
        });

        setReservations(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('Reservations stream error:', error);
        toast.error('Failed to load reservations');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [user, tenantId]);

  // Filter reservations based on tabs, search, and date
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      // 1. Tab Status Filter
      if (activeTab === 'today') {
        if (r.date !== todayStr) return false;
      } else if (activeTab === 'upcoming') {
        if (!r.date || r.date < todayStr || r.status === 'Completed' || r.status === 'Cancelled' || r.status === 'No-Show') return false;
      } else if (activeTab === 'completed') {
        if (r.status !== 'Completed') return false;
      } else if (activeTab === 'cancelled') {
        if (r.status !== 'Cancelled') return false;
      } else if (activeTab === 'noshow') {
        if (r.status !== 'No-Show') return false;
      }

      // 2. Search Query (Customer name, phone, table number, ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.customerName?.toLowerCase().includes(q);
        const matchPhone = r.customerPhone?.toLowerCase().includes(q);
        const matchTable = r.tableNumber?.toLowerCase().includes(q);
        const matchId = (r.bookingId || r.id)?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchTable && !matchId) return false;
      }

      // 3. Restaurant filter
      if (selectedRestaurantFilter !== 'all') {
        if (r.restaurantId !== selectedRestaurantFilter) return false;
      }

      // 4. Specific Date picker filter
      if (selectedDateFilter) {
        if (r.date !== selectedDateFilter) return false;
      }

      return true;
    });
  }, [reservations, activeTab, searchQuery, selectedRestaurantFilter, selectedDateFilter, todayStr]);

  // Metric counts
  const counts = useMemo(() => {
    return {
      today: reservations.filter(r => r.date === todayStr).length,
      upcoming: reservations.filter(r => r.date && r.date >= todayStr && r.status !== 'Completed' && r.status !== 'Cancelled' && r.status !== 'No-Show').length,
      completed: reservations.filter(r => r.status === 'Completed').length,
      cancelled: reservations.filter(r => r.status === 'Cancelled').length,
      noshow: reservations.filter(r => r.status === 'No-Show').length,
      all: reservations.length
    };
  }, [reservations, todayStr]);

  // Open Create Form
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingRes(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormDate(todayStr);
    setFormTime('19:30');
    setFormGuests(2);
    setFormTable('');
    setFormNotes('');
    setFormRestaurantId(tenantId || '');
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (res: IReservationRecord) => {
    setIsEditing(true);
    setEditingRes(res);
    setFormName(res.customerName || '');
    setFormPhone(res.customerPhone || '');
    setFormEmail(res.customerEmail || '');
    setFormDate(res.date || todayStr);
    setFormTime(res.time || '19:30');
    setFormGuests(res.guests || 2);
    setFormTable(res.tableNumber || '');
    setFormNotes(res.specialNotes || '');
    setFormRestaurantId(res.restaurantId || tenantId || '');
    setIsFormOpen(true);
  };

  // Save / Update Reservation
  const handleSaveReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDate || !formTime) {
      toast.error('Customer name, date, and time are required');
      return;
    }

    setIsSubmitting(true);
    const targetTenant = formRestaurantId || tenantId || 'default';
    const bookingId = isEditing && editingRes ? editingRes.id : `RES-${Date.now().toString(36).toUpperCase()}`;

    try {
      const payload: Partial<IReservationRecord> = {
        id: bookingId,
        bookingId,
        customerName: formName.trim(),
        customerPhone: formPhone.trim(),
        customerEmail: formEmail.trim(),
        restaurantId: targetTenant,
        restaurantName: restaurants.find(r => r.id === targetTenant)?.name || 'SpiralDine Bistro',
        date: formDate,
        time: formTime,
        guests: Number(formGuests),
        tableNumber: formTable || 'Unassigned',
        specialNotes: formNotes.trim(),
        status: isEditing && editingRes ? editingRes.status : 'Confirmed',
        updatedAt: new Date().toISOString(),
        ...(isEditing ? {} : { createdAt: new Date().toISOString() })
      };

      await setDoc(doc(db, 'restaurants', targetTenant, 'reservations', bookingId), payload, { merge: true });

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        restaurantName: payload.restaurantName,
        module: 'Reservations',
        action: isEditing ? 'UPDATE' : 'CREATE',
        targetEntity: `Reservation ${bookingId} for ${payload.customerName}`,
        newValue: payload
      });

      toast.success(isEditing ? 'Reservation updated successfully' : 'Reservation created successfully');
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Save reservation error:', err);
      toast.error('Failed to save reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Status Transition
  const executeStatusChange = async (res: IReservationRecord, newStatus: 'Cancelled' | 'No-Show' | 'Arrived' | 'Completed' | 'Confirmed') => {
    const targetTenant = res.restaurantId || tenantId || 'default';

    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'restaurants', targetTenant, 'reservations', res.id), updateData);

      await logAuditEvent({
        userId: user?.uid || '',
        userEmail: user?.email || '',
        userName: user?.displayName || 'Owner',
        userRole: user?.role || 'owner',
        tenantId: targetTenant,
        module: 'Reservations',
        action: 'STATUS_CHANGE',
        targetEntity: `Reservation ${res.bookingId || res.id} (${res.customerName})`,
        previousValue: res.status,
        newValue: newStatus
      });

      toast.success(`Reservation marked as ${newStatus}`);
      setActionDialog(null);
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Failed to update status');
    }
  };

  // Helper badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed': return <Badge variant="success">Confirmed</Badge>;
      case 'Arrived':
      case 'Seated': return <Badge variant="primary">Seated / Arrived</Badge>;
      case 'Completed': return <Badge variant="neutral">Completed</Badge>;
      case 'Cancelled': return <Badge variant="danger">Cancelled</Badge>;
      case 'No-Show': return <Badge variant="warning">No-Show</Badge>;
      default: return <Badge variant="warning">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-[#12352D] text-white shadow-sm">
              <CalendarCheck className="w-5 h-5 text-[#C9533B]" />
            </span>
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Table Reservations
            </h1>
          </div>
          <p className="text-xs text-[#6B7280] mt-1">
            Manage diner bookings, track arrivals, assign seating, and minimize no-shows.
          </p>
        </div>

        <Button 
          variant="primary" 
          onClick={handleOpenCreate}
          className="bg-[#C9533B] hover:bg-[#B34530] text-white flex items-center space-x-2 rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>New Reservation</span>
        </Button>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center space-x-2 border-b border-[#E5E7EB] overflow-x-auto pb-1">
        {[
          { id: 'today', label: "Today's Bookings", count: counts.today },
          { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
          { id: 'completed', label: 'Completed', count: counts.completed },
          { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
          { id: 'noshow', label: 'No-Shows', count: counts.noshow },
          { id: 'all', label: 'All Records', count: counts.all },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TStatusTab)}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
                isActive
                  ? 'bg-[#12352D] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#17202A] hover:bg-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                isActive ? 'bg-[#C9533B] text-white' : 'bg-[#E5E7EB] text-[#6B7280]'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by diner, phone, table..." 
          />
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          {/* Specific Date Filter */}
          <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F6F2]">
            <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
            <input 
              type="date" 
              value={selectedDateFilter} 
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="text-xs bg-transparent text-[#17202A] focus:outline-none"
            />
            {selectedDateFilter && (
              <button 
                onClick={() => setSelectedDateFilter('')} 
                className="text-[10px] text-red-500 hover:underline ml-1 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Restaurant filter if multiple */}
          {restaurants.length > 1 && (
            <select
              value={selectedRestaurantFilter}
              onChange={(e) => setSelectedRestaurantFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] text-[#17202A] focus:outline-none"
            >
              <option value="all">All Restaurants</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Main Reservations List ── */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <LoadingSpinner label="Loading reservation registry..." />
        </div>
      ) : filteredReservations.length === 0 ? (
        <EmptyState 
          title="No reservations found"
          description={
            searchQuery || selectedDateFilter
              ? "No booking records match your search criteria."
              : activeTab === 'today'
              ? "There are no table reservations scheduled for today."
              : "No reservation records logged in this category."
          }
          actionLabel="Create Reservation"
          onActionClick={handleOpenCreate}
        />
      ) : (
        <div className="space-y-3">
          {filteredReservations.map((res) => {
            const isToday = res.date === todayStr;

            return (
              <div 
                key={res.id} 
                className="p-4 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#C9533B]/40 transition-all shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                {/* Left Column: Diner Info */}
                <div className="flex items-start space-x-3.5 min-w-[260px]">
                  <div className="w-10 h-10 rounded-xl bg-[#12352D] text-white flex items-center justify-center font-serif font-bold text-sm shrink-0">
                    {res.customerName?.charAt(0) || 'G'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-serif font-bold text-sm text-[#17202A]">
                        {res.customerName}
                      </h3>
                      {getStatusBadge(res.status)}
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-[#6B7280] mt-1">
                      {res.customerPhone && (
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-[#C9533B]" />
                          <span>{res.customerPhone}</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3 text-[#12352D]" />
                        <span>{res.guests} Guests</span>
                      </span>
                    </div>

                    {res.specialNotes && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1.5 inline-block">
                        Note: {res.specialNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle Column: Schedule & Table */}
                <div className="flex items-center space-x-6 text-xs text-[#17202A] border-y md:border-y-0 md:border-x border-[#E5E7EB] py-2 md:py-0 md:px-6">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6B7280]">Date & Time</p>
                    <p className="font-bold flex items-center space-x-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-[#C9533B]" />
                      <span>{res.time}</span>
                      <span className="text-[#6B7280]">({res.date})</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6B7280]">Table Assigned</p>
                    <p className="font-bold flex items-center space-x-1 mt-0.5">
                      <QrCode className="w-3.5 h-3.5 text-[#12352D]" />
                      <span>{res.tableNumber || 'Unassigned'}</span>
                    </p>
                  </div>

                  {res.restaurantName && (
                    <div className="hidden lg:block">
                      <p className="text-[10px] uppercase font-bold text-[#6B7280]">Restaurant</p>
                      <p className="font-semibold text-[#6B7280] mt-0.5 truncate max-w-[120px]">
                        {res.restaurantName}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Column: Status Actions */}
                <div className="flex items-center space-x-2 shrink-0 justify-end">
                  {/* Mark Arrived / Seated */}
                  {res.status !== 'Arrived' && res.status !== 'Seated' && res.status !== 'Completed' && res.status !== 'Cancelled' && (
                    <button
                      onClick={() => executeStatusChange(res, 'Arrived')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#16845B]/10 text-[#16845B] hover:bg-[#16845B] hover:text-white transition-all"
                      title="Mark Customer Arrived"
                    >
                      Arrived
                    </button>
                  )}

                  {/* Mark Completed */}
                  {(res.status === 'Arrived' || res.status === 'Seated' || res.status === 'Confirmed') && (
                    <button
                      onClick={() => executeStatusChange(res, 'Completed')}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#12352D]/10 text-[#12352D] hover:bg-[#12352D] hover:text-white transition-all"
                      title="Mark Completed"
                    >
                      Complete
                    </button>
                  )}

                  {/* Mark No-Show */}
                  {res.status !== 'Completed' && res.status !== 'Cancelled' && res.status !== 'No-Show' && (
                    <button
                      onClick={() => setActionDialog({ res, action: 'No-Show' })}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-50 transition-all"
                      title="Mark No-Show"
                    >
                      No-Show
                    </button>
                  )}

                  {/* Cancel Booking */}
                  {res.status !== 'Completed' && res.status !== 'Cancelled' && (
                    <button
                      onClick={() => setActionDialog({ res, action: 'Cancelled' })}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                      title="Cancel Reservation"
                    >
                      Cancel
                    </button>
                  )}

                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEdit(res)}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#17202A] hover:bg-[#F8F6F2] transition-colors"
                    title="Edit Booking"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Reservation Modal ── */}
      {isFormOpen && (
        <Modal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          title={isEditing ? 'Edit Reservation' : 'Create New Table Reservation'}
        >
          <form onSubmit={handleSaveReservation} className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Customer Name *</label>
                <Input 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  placeholder="e.g. Rahul Sharma"
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Date *</label>
                <Input 
                  type="date"
                  value={formDate} 
                  onChange={(e) => setFormDate(e.target.value)} 
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Time *</label>
                <Input 
                  type="time"
                  value={formTime} 
                  onChange={(e) => setFormTime(e.target.value)} 
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Guests Count *</label>
                <Input 
                  type="number"
                  min={1}
                  max={50}
                  value={formGuests} 
                  onChange={(e) => setFormGuests(Number(e.target.value))} 
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">Assign Table</label>
                <select
                  value={formTable}
                  onChange={(e) => setFormTable(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none focus:ring-1 focus:ring-[#C9533B]"
                >
                  <option value="">-- Auto / Walk-in Assignment --</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.number || t.name}>
                      Table {t.number || t.name} ({t.capacity || 4} Seats - {t.status || 'Available'})
                    </option>
                  ))}
                </select>
              </div>

              {restaurants.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-[#17202A] mb-1">Restaurant Branch</label>
                  <select
                    value={formRestaurantId}
                    onChange={(e) => setFormRestaurantId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E7EB] bg-white text-[#17202A] focus:outline-none"
                  >
                    {restaurants.map(r => (
                      <option key={r.id} value={r.id}>{r.name || r.id}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-1">Special Notes / Dietary Requests</label>
              <Input 
                value={formNotes} 
                onChange={(e) => setFormNotes(e.target.value)} 
                placeholder="e.g. Window table requested, anniversary celebration"
              />
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
                {isSubmitting ? 'Saving...' : (isEditing ? 'Update Reservation' : 'Confirm Booking')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Status Action Confirmation Dialog ── */}
      {actionDialog && (
        <Dialog
          isOpen={Boolean(actionDialog)}
          onClose={() => setActionDialog(null)}
          onConfirm={() => executeStatusChange(actionDialog.res, actionDialog.action)}
          title={`Mark as ${actionDialog.action}?`}
          message={`Are you sure you want to mark reservation for "${actionDialog.res.customerName}" as ${actionDialog.action}?`}
          confirmLabel={`Mark ${actionDialog.action}`}
          isDangerous={actionDialog.action === 'Cancelled' || actionDialog.action === 'No-Show'}
        />
      )}
    </div>
  );
};

export default OwnerReservations;
