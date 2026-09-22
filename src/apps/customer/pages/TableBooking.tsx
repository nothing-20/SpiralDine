import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { 
  Calendar, Users, Clock, CheckCircle2, ArrowLeft, MapPin, Sparkles, 
  Search, AlertCircle, Trash2, Edit2, Navigation, Lock, Utensils, 
  ShieldCheck, Heart, Repeat, FileText, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useToastStore } from '../../../components/ui/Toast/Toast';

const showFeedback = (msg: string, type: 'success' | 'error') => {
  if (type === 'success') {
    toast.success(msg);
  } else {
    toast.error(msg);
  }
  try {
    useToastStore.getState().addToast(msg, type);
  } catch (_) {}
};

const HYDERABAD_AREAS = [
  'Jubilee Hills', 'Banjara Hills', 'Hitech City', 'Gachibowli', 'Madhapur', 
  'Tolichowki', 'RTC X Road', 'RTC X Roads', 'Chikkadpally', 'Secunderabad', 
  'Ramgopalpet', 'Madeenaguda', 'Kukatpally', 'Miyapur', 'Begumpet', 
  'Charminar', 'Nallakunta', 'Ameerpet', 'Kondapur', 'Dilsukhnagar',
  'Himayatnagar', 'Somajiguda', 'Abids', 'Mehdipatnam'
];

function extractAreaFromAddress(street: string, fallbackCity: string): string {
  if (!street || typeof street !== 'string') return fallbackCity;
  for (const area of HYDERABAD_AREAS) {
    if (new RegExp(`\\b${area.replace(/\s+/g, '\\s+')}\\b`, 'i').test(street)) {
      if (area.toLowerCase() === 'rtc x roads') return 'RTC X Road';
      return area;
    }
  }
  const parts = street.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const candidate = parts[parts.length - 1];
    if (candidate.length < 35 && !/\d{5,6}/.test(candidate)) {
      return candidate;
    }
  }
  return fallbackCity;
}

function formatCuisines(cuisineInput?: string | string[] | null): string {
  if (!cuisineInput) return '';
  let parts: string[] = [];
  if (Array.isArray(cuisineInput)) {
    parts = cuisineInput.map(p => String(p).trim()).filter(Boolean);
  } else if (typeof cuisineInput === 'string') {
    parts = cuisineInput
      .split(/[/,]/)
      .map(p => p.trim())
      .filter(Boolean);
  }
  if (parts.length === 0) return '';
  return parts.slice(0, 3).join(' · ');
}

function formatLocalityCity(area?: string | null, city?: string | null): string {
  const rawCity = (city || 'Hyderabad').trim();
  const c = rawCity.split(',')[0].trim() || 'Hyderabad';
  if (!area || area === 'All Areas' || area.toLowerCase() === c.toLowerCase()) {
    return c;
  }
  const cleanArea = area.replace(new RegExp(`,?\\s*${c}$`, 'i'), '').trim();
  if (!cleanArea || cleanArea.toLowerCase() === c.toLowerCase()) {
    return c;
  }
  return `${cleanArea}, ${c}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const DEFAULT_BOOKING_CONFIG = {
  supportsSeatPreference: false,
  supportedSeatZones: [] as string[],
  availableTimeSlots: ['12:00 PM', '1:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'],
  maxGuests: 8
};

export const TableBooking: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const queryTenantId = searchParams.get('tenantId') || '';

  // Data Loading States
  const [allRestaurants, setAllRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection Form States
  const [selectedRest, setSelectedRest] = useState<any | null>(null);
  const [imgError, setImgError] = useState(false);
  const [guestsCount, setGuestsCount] = useState<number>(2);
  const [bookDate, setBookDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [seatingPreference, setSeatingPreference] = useState<string>('');
  const [specialNotes, setSpecialNotes] = useState<string>('');

  // Editing existing booking states
  const [isModifying, setIsModifying] = useState(false);
  const [modifyingBookingId, setModifyingBookingId] = useState<string>('');

  // Processing & Success states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState<any | null>(null);

  // Today's minimum selectable date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Format date nicely for customer preview
  const formattedDatePreview = useMemo(() => {
    if (!bookDate) return '';
    try {
      const [year, month, day] = bookDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return bookDate;
    }
  }, [bookDate]);

  // Fetch real restaurants from Firestore
  const fetchRestaurants = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      const list: any[] = [];
      let index = 0;
      snap.forEach(d => {
        const data = d.data();
        const tenantId = d.id;

        // Skip suspended or inactive tenants
        const status = data.status || 'active';
        if (status === 'suspended' || status === 'inactive') {
          return;
        }

        const city = typeof data.address === 'object' && data.address?.city 
          ? data.address.city 
          : (data.city || 'Hyderabad');
        const street = typeof data.address === 'string' 
          ? data.address 
          : (data.address?.street || data.street || '');
        const rawArea = (typeof data.address === 'object' && data.address?.area) || data.area || '';
        const area = rawArea || extractAreaFromAddress(street, city);

        const config = data.settings?.bookingConfig || DEFAULT_BOOKING_CONFIG;

        const availableSlots = data.availableTimeSlots || data.settings?.availableTimeSlots || config.availableTimeSlots || ['6:00 PM', '7:30 PM', '9:00 PM', '10:00 PM'];
        const supportedZones = data.supportedSeatZones || config.supportedSeatZones || [];
        const maxGuests = Number(data.maxGuests || config.maxGuests || 8);
        const supportsSeatPref = data.supportsSeatPreference !== undefined ? Boolean(data.supportsSeatPreference) : Boolean(config.supportsSeatPreference);

        // Safe rating & reviews count parsing
        let numRating: number | null = null;
        if (typeof data.rating === 'number' && !isNaN(data.rating)) {
          numRating = data.rating;
        } else if (typeof data.rating === 'string') {
          const p = parseFloat(data.rating);
          if (!isNaN(p)) numRating = p;
        }

        let numReviews: number | null = null;
        if (typeof data.reviewsCount === 'number' && !isNaN(data.reviewsCount)) {
          numReviews = data.reviewsCount;
        } else if (typeof data.reviewsCount === 'string') {
          const p = parseInt(data.reviewsCount, 10);
          if (!isNaN(p)) numReviews = p;
        }

        list.push({
          id: tenantId,
          name: data.restaurantName || data.name || 'Restaurant',
          cuisine: data.cuisine || 'Multi-Cuisine',
          address: street || data.address || '',
          landmark: data.landmark || '',
          area,
          city,
          rating: numRating,
          reviewsCount: numReviews,
          status,
          openNow: status === 'active' || data.openNow !== false,
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
          image: data.coverImageUrl || data.coverImage || data.image || data.logoUrl || data.logo || null,
          availableTimeSlots: availableSlots,
          supportedSeatZones: supportedZones,
          supportsSeatPreference: supportsSeatPref,
          maxGuests
        });
        index++;
      });

      setAllRestaurants(list);
    } catch (e) {
      console.error('[TableBooking] Failed to load restaurants:', e);
      setAllRestaurants([]);
      setLoadError('Unable to load restaurants. Please try again.');
      showFeedback('Failed to load restaurants.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Pre-select restaurant from URL parameter if available
  useEffect(() => {
    if (queryTenantId && allRestaurants.length > 0) {
      const matched = allRestaurants.find(r => r.id === queryTenantId);
      if (matched) {
        handleSelectRestaurant(matched);
      }
    }
  }, [queryTenantId, allRestaurants]);

  // Filter restaurants based on user search
  const filteredRestaurants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allRestaurants;
    return allRestaurants.filter(r => 
      (r.name || '').toLowerCase().includes(q) ||
      (r.cuisine || '').toLowerCase().includes(q) ||
      (r.area || '').toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q)
    );
  }, [allRestaurants, searchQuery]);

  // Set default slot when restaurant selected
  const handleSelectRestaurant = (rest: any) => {
    setSelectedRest(rest);
    setImgError(false);
    setGuestsCount(2);
    if (rest.availableTimeSlots && rest.availableTimeSlots.length > 0) {
      setSelectedTime(rest.availableTimeSlots[0]);
    } else {
      setSelectedTime('');
    }
    if (rest.supportsSeatPreference && rest.supportedSeatZones && rest.supportedSeatZones.length > 0) {
      setSeatingPreference(rest.supportedSeatZones[0]);
    } else {
      setSeatingPreference('');
    }
  };

  // Submit Reservation
  const handleSubmitBooking = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedRest) {
      showFeedback('Please select a restaurant first.', 'error');
      return;
    }
    if (!selectedTime) {
      showFeedback('Please select an available time slot.', 'error');
      return;
    }
    if (!bookDate) {
      showFeedback('Please select a booking date.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingId = isModifying && modifyingBookingId ? modifyingBookingId : `RES-${Math.floor(100000 + Math.random() * 900000)}`;
      const notifId = `NOT-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const bookingPayload = {
        id: bookingId,
        bookingId,
        customerId: user?.uid || 'guest-uid',
        customerName: user?.displayName || user?.email || 'Guest Diner',
        customerEmail: user?.email || '',
        customerPhone: user?.phoneNumber || '',
        restaurantId: selectedRest.id,
        restaurantName: selectedRest.name,
        date: bookDate,
        time: selectedTime,
        guests: guestsCount,
        seatingPreference: selectedRest.supportsSeatPreference ? seatingPreference : '',
        specialNotes: (specialNotes || '').trim(),
        status: isModifying ? 'Modified' : 'Pending',
        directions: `${selectedRest.landmark ? `Near ${selectedRest.landmark}, ` : ''}${selectedRest.address || formatLocalityCity(selectedRest.area, selectedRest.city)}`,
        lat: selectedRest.latitude || null,
        lng: selectedRest.longitude || null,
        createdAt: new Date().toISOString()
      };

      // 1. Write booking details to Customer Profile Reservations History (both customers/{uid} and users/{uid})
      if (user?.uid) {
        await Promise.allSettled([
          setDoc(doc(db, 'customers', user.uid, 'reservations', bookingId), bookingPayload),
          setDoc(doc(db, 'users', user.uid, 'reservations', bookingId), bookingPayload)
        ]);
      }
      
      // 2. Write booking details to Restaurant central reservations collection
      try {
        await setDoc(doc(db, 'restaurants', selectedRest.id, 'reservations', bookingId), bookingPayload);
      } catch (restErr) {
        console.warn('[TableBooking] Primary restaurants reservations write warning, trying fallback:', restErr);
        try {
          await setDoc(doc(db, 'tenants', selectedRest.id, 'reservations', bookingId), bookingPayload);
        } catch (_) {}
      }

      // 3. Generate Central Booking Notification for Dashboards (non-blocking)
      try {
        const notificationPayload = {
          id: notifId,
          type: 'reservation',
          bookingId,
          customerName: user?.displayName || user?.email || 'Guest Diner',
          guests: guestsCount,
          date: bookDate,
          time: selectedTime,
          restaurantName: selectedRest.name,
          restaurantId: selectedRest.id,
          branchName: 'Main Branch',
          tableStatus: isModifying ? 'Modified' : 'Pending',
          specialNotes: (specialNotes || '').trim(),
          bookingStatus: isModifying ? 'Modified' : 'Pending',
          notificationStatus: 'unread',
          timestamp: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'restaurants', selectedRest.id, 'notifications', notifId), notificationPayload);
      } catch (notifErr) {
        console.warn('[TableBooking] Notification write warning (non-fatal):', notifErr);
      }

      // 4. Save to local storage for persistent guest/customer reservation history
      try {
        const localKey = 'spiral_dine_customer_reservations';
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = [bookingPayload, ...existing.filter((item: any) => item.id !== bookingId)];
        localStorage.setItem(localKey, JSON.stringify(updated));
      } catch (_) {}

      setBookingConfirmed(bookingPayload);
      showFeedback(isModifying ? 'Reservation successfully updated!' : 'Reservation successfully requested!', 'success');
      setIsModifying(false);
      setModifyingBookingId('');
    } catch (e: any) {
      console.error('[TableBooking] Error submitting reservation:', e);
      showFeedback(e?.message || 'Failed to register reservation details. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Modify reservation (prefills form and sets editing mode)
  const handleModifyBooking = () => {
    if (!bookingConfirmed) return;
    setIsModifying(true);
    setModifyingBookingId(bookingConfirmed.id);
    
    // Find restaurant record
    const matched = allRestaurants.find(r => r.id === bookingConfirmed.restaurantId);
    if (matched) {
      setSelectedRest(matched);
    }
    setGuestsCount(bookingConfirmed.guests);
    setBookDate(bookingConfirmed.date);
    setSelectedTime(bookingConfirmed.time);
    setSeatingPreference(bookingConfirmed.seatingPreference || '');
    setSpecialNotes(bookingConfirmed.specialNotes || '');
    setBookingConfirmed(null);
    showFeedback('Form loaded. Update your reservation details.', 'success');
  };

  // Cancel Reservation
  const handleCancelBooking = async () => {
    if (!bookingConfirmed) return;
    try {
      // Delete in both customer and tenant collections
      if (user?.uid) {
        await deleteDoc(doc(db, 'customers', user.uid, 'reservations', bookingConfirmed.id)).catch(() => {});
        await deleteDoc(doc(db, 'users', user.uid, 'reservations', bookingConfirmed.id)).catch(() => {});
      }
      await deleteDoc(doc(db, 'restaurants', bookingConfirmed.restaurantId, 'reservations', bookingConfirmed.id)).catch(() => {});
      await deleteDoc(doc(db, 'tenants', bookingConfirmed.restaurantId, 'reservations', bookingConfirmed.id)).catch(() => {});

      // Remove from local storage
      try {
        const localKey = 'spiral_dine_customer_reservations';
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = existing.filter((item: any) => item.id !== bookingConfirmed.id);
        localStorage.setItem(localKey, JSON.stringify(updated));
      } catch (_) {}
      
      showFeedback('Reservation booking cancelled.', 'success');
      setBookingConfirmed(null);
      setSelectedRest(null);
      setIsModifying(false);
    } catch (e) {
      console.error('[TableBooking] Error cancelling booking:', e);
      showFeedback('Failed to cancel reservation.', 'error');
    }
  };

  // Polished Skeleton Loading State
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 text-left select-none pb-12 px-4 sm:px-6">
        <div className="h-4 bg-[#F3E8DF] rounded w-32 animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 bg-[#F3E8DF] rounded w-64 animate-pulse" />
          <div className="h-4 bg-[#F3E8DF]/60 rounded w-96 max-w-full animate-pulse" />
        </div>
        <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row gap-4 animate-pulse">
          <div className="w-full sm:w-56 aspect-[16/9] bg-[#F3E8DF] rounded-xl" />
          <div className="flex-1 space-y-3">
            <div className="h-3 bg-[#F3E8DF] rounded w-28" />
            <div className="h-6 bg-[#F3E8DF] rounded w-48" />
            <div className="h-3 bg-[#F3E8DF]/70 rounded w-36" />
            <div className="h-3 bg-[#F3E8DF]/50 rounded w-44" />
          </div>
        </div>
        <div className="bg-white border border-[#E5DCD5] rounded-2xl p-6 space-y-6 animate-pulse">
          <div className="h-16 bg-[#F3E8DF]/40 rounded-xl" />
          <div className="h-16 bg-[#F3E8DF]/40 rounded-xl" />
          <div className="h-24 bg-[#F3E8DF]/40 rounded-xl" />
          <div className="h-14 bg-[#C85A3F]/30 rounded-xl" />
        </div>
      </div>
    );
  }

  // Error State
  if (loadError) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4 select-none">
        <div className="w-14 h-14 bg-[#F3E8DF] rounded-full flex items-center justify-center mx-auto text-[#C85A3F]">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-extrabold text-[#202124]">Unable to load restaurants</h3>
          <p className="text-xs text-[#756B64]">Please check your connection and try again.</p>
        </div>
        <button
          onClick={fetchRestaurants}
          className="px-6 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // Booking Confirmation View (Customer Palette)
  if (bookingConfirmed) {
    return (
      <div className="max-w-lg mx-auto p-6 sm:p-8 space-y-6 text-center select-none bg-white border border-[#E5DCD5] rounded-3xl mt-4 sm:mt-8 shadow-sm">
        {/* Success Icon */}
        <div className="w-16 h-16 bg-[#2E8B57]/10 border border-[#2E8B57]/20 rounded-full flex items-center justify-center mx-auto shadow-xs text-[#2E8B57]">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        
        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-2xl font-display font-extrabold text-[#202124]">Booking Confirmed!</h2>
          <p className="text-xs sm:text-sm text-[#756B64] leading-relaxed max-w-sm mx-auto">
            Your dining table reservation has been requested and sent to the restaurant dashboard.
          </p>
        </div>

        {/* Details Card */}
        <div className="p-5 bg-[#FCFAF7] border border-[#E5DCD5] rounded-2xl space-y-3.5 text-left text-xs text-[#756B64]">
          <div className="flex justify-between items-center font-bold border-b border-[#E5DCD5] pb-2.5 text-[#202124]">
            <span>Reservation ID</span>
            <span className="text-[#C85A3F] font-mono font-extrabold text-sm">{bookingConfirmed.id}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Restaurant Name</span>
            <span className="font-extrabold text-[#202124]">{bookingConfirmed.restaurantName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Diners Count</span>
            <span className="font-extrabold text-[#202124]">{bookingConfirmed.guests} Guests</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Booking Date</span>
            <span className="font-extrabold text-[#202124]">{formatDisplayDate(bookingConfirmed.date)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Selected Time</span>
            <span className="font-extrabold text-[#202124]">{bookingConfirmed.time}</span>
          </div>
          {bookingConfirmed.seatingPreference && (
            <div className="flex justify-between items-center">
              <span>Seating Preference</span>
              <span className="font-extrabold text-[#202124]">{bookingConfirmed.seatingPreference}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span>Booking Status</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-[#F3E8DF] text-[#C85A3F] border border-[#E5DCD5]">
              {bookingConfirmed.status}
            </span>
          </div>

          {/* Directions / Address section */}
          {bookingConfirmed.directions && (
            <div className="flex flex-col gap-1 border-t border-[#E5DCD5] pt-2.5 text-[11px]">
              <span className="text-[#756B64] font-extrabold uppercase tracking-wider block text-[9.5px]">Directions & Address</span>
              <div className="flex items-start gap-1.5 text-[#202124]">
                <MapPin className="w-4 h-4 text-[#C85A3F] shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-[#756B64]">{bookingConfirmed.directions}</p>
                  {bookingConfirmed.lat && bookingConfirmed.lng && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${bookingConfirmed.lat},${bookingConfirmed.lng}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#C85A3F] hover:underline text-[10px] font-bold inline-flex items-center gap-1 mt-1 bg-[#F3E8DF]/80 border border-[#E5DCD5] py-1 px-2.5 rounded-lg w-fit transition-colors"
                    >
                      <Navigation className="w-3 h-3 text-[#C85A3F]" />
                      <span>Open in Google Maps</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="grid grid-cols-2 gap-2.5">
            <button 
              onClick={handleModifyBooking}
              className="py-3 bg-[#FCFAF7] hover:bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/50 text-[#202124] font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#C85A3F]" />
              <span>Modify</span>
            </button>
            <button 
              onClick={handleCancelBooking}
              className="py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
          <button 
            onClick={() => {
              setBookingConfirmed(null);
              setSelectedRest(null);
            }}
            className="w-full bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold py-3.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
          >
            Find Another Restaurant
          </button>
        </div>
      </div>
    );
  }

  // Generate party size options up to maxGuests
  const maxParty = selectedRest?.maxGuests || 8;
  const partyOptions = [1, 2, 3, 4, 5, 6, 8].filter(n => n <= maxParty);
  if (!partyOptions.includes(maxParty) && maxParty > 0 && maxParty <= 12) {
    partyOptions.push(maxParty);
    partyOptions.sort((a, b) => a - b);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left select-none pb-16 px-4 sm:px-6">
      
      {/* PAGE HEADER */}
      <div className="flex items-center justify-between">
        <button 
          type="button"
          onClick={() => {
            if (selectedRest) {
              navigate(`/customer/restaurant/${selectedRest.id}`);
            } else {
              navigate('/customer/home');
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#756B64] hover:text-[#C85A3F] transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>{selectedRest ? 'Back to Restaurant' : 'Back to Home'}</span>
        </button>

        {/* Decorative subtle script phrase */}
        <span className="hidden sm:inline-block text-xs font-serif italic text-[#C85A3F]/80">
          Good Food Brings People Together
        </span>
      </div>

      {/* MAIN TITLE & SUBTITLE */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#202124] tracking-tight">
          Reserve Your Table {isModifying && <span className="ml-2 text-xs font-bold text-[#C85A3F] bg-[#F3E8DF] px-2.5 py-0.5 rounded-full">Modifying</span>}
        </h1>
        <p className="text-xs sm:text-sm text-[#756B64] font-medium leading-relaxed">
          Choose your preferred date, time and party size. We'll keep your table ready.
        </p>
      </div>

      {/* PHASE 1: SEARCH & CHOOSE RESTAURANT (When no restaurant is selected) */}
      {!selectedRest ? (
        <div className="space-y-5">
          <div className="relative bg-white border border-[#E5DCD5] rounded-2xl shadow-xs focus-within:border-[#C85A3F]/60 transition-colors">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#756B64]" />
            <input 
              type="text" 
              placeholder="Search restaurant by name, cuisine, area, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 bg-transparent text-xs text-[#202124] placeholder-[#756B64] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRestaurants.map(rest => {
              const cuisines = formatCuisines(rest.cuisine);
              const locality = formatLocalityCity(rest.area, rest.city);

              return (
                <div 
                  key={rest.id}
                  onClick={() => handleSelectRestaurant(rest)}
                  className="bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/50 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="w-full aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#F3E8DF] to-[#E5DCD5] relative flex items-center justify-center">
                      {rest.image ? (
                        <img 
                          src={rest.image} 
                          alt={rest.name} 
                          loading="lazy" 
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-[#E5DCD5] flex items-center justify-center text-[#C85A3F] font-extrabold text-sm mb-1 shadow-2xs">
                            {rest.name ? rest.name.charAt(0).toUpperCase() : <Utensils className="w-4 h-4 text-[#C85A3F]" />}
                          </div>
                          <span className="text-xs font-extrabold text-[#202124] truncate max-w-[140px]">{rest.name}</span>
                        </div>
                      )}

                      {/* Status badge */}
                      <span className="absolute top-2.5 right-2.5">
                        {rest.openNow ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-[#2E8B57] text-white shadow-2xs">
                            Open Now
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-[#756B64] text-white shadow-2xs">
                            Closed
                          </span>
                        )}
                      </span>

                      {/* Rating */}
                      {rest.rating !== null && rest.rating !== undefined && rest.rating > 0 && (
                        <div className="absolute bottom-2.5 right-2.5 z-10 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md border border-[#E5DCD5] shadow-2xs flex items-center gap-1 text-[10px] font-extrabold text-[#202124]">
                          <Star className="w-3 h-3 text-[#E5A93C] fill-[#E5A93C]" />
                          <span>{rest.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 space-y-1">
                      <h4 className="text-sm font-extrabold text-[#202124] group-hover:text-[#C85A3F] transition-colors truncate">
                        {rest.name}
                      </h4>
                      {cuisines && (
                        <p className="text-xs text-[#756B64] font-medium truncate">
                          {cuisines}
                        </p>
                      )}
                      <div className="flex items-center text-xs text-[#756B64] font-medium truncate pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-[#C85A3F] shrink-0 mr-1" />
                        <span className="truncate">{locality}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 pt-2 border-t border-[#F3E8DF] flex justify-between items-center text-xs">
                    <span className="text-[#756B64] font-medium text-[11px]">Max: {rest.maxGuests} diners</span>
                    <span className="text-[#C85A3F] font-extrabold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Select Restaurant →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* PHASE 2: BOOKING FORM WITH SELECTED RESTAURANT CARD */
        <div className="space-y-6">
          
          {/* SELECTED RESTAURANT INFORMATION PANEL */}
          <div className="bg-white border border-[#E5DCD5] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5">
            {/* Cover Image */}
            <div className="relative w-full sm:w-52 md:w-60 aspect-[16/9] sm:aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-[#F3E8DF] to-[#E5DCD5] border border-[#E5DCD5] shrink-0 flex items-center justify-center">
              {selectedRest.image && !imgError ? (
                <img 
                  src={selectedRest.image} 
                  alt={selectedRest.name} 
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E5DCD5] flex items-center justify-center text-[#C85A3F] font-extrabold text-sm mb-1 shadow-2xs">
                    {selectedRest.name ? selectedRest.name.charAt(0).toUpperCase() : <Utensils className="w-4 h-4 text-[#C85A3F]" />}
                  </div>
                  <span className="text-xs font-extrabold text-[#202124] truncate max-w-[140px]">{selectedRest.name}</span>
                </div>
              )}
            </div>

            {/* Information & Change button */}
            <div className="flex-1 flex flex-col justify-between min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold text-[#756B64] uppercase tracking-wider">
                  Restaurant Selected
                </span>
                {selectedRest.openNow ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57]"></span>
                    <span>Open Now</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#756B64]/10 text-[#756B64] border border-[#756B64]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#756B64]"></span>
                    <span>Closed</span>
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#202124] truncate" title={selectedRest.name}>
                  {selectedRest.name}
                </h3>

                {/* Rating & Review Count */}
                {selectedRest.rating !== null && selectedRest.rating !== undefined && selectedRest.rating > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-[#202124] font-bold mt-0.5">
                    <span className="text-[#E5A93C]">⭐</span>
                    <span>{selectedRest.rating.toFixed(1)}</span>
                    {selectedRest.reviewsCount && typeof selectedRest.reviewsCount === 'number' && selectedRest.reviewsCount > 0 && (
                      <span className="text-[#756B64] font-medium">
                        · {selectedRest.reviewsCount >= 1000 ? `${(selectedRest.reviewsCount / 1000).toFixed(1).replace(/\.0$/, '')}k` : selectedRest.reviewsCount} reviews
                      </span>
                    )}
                  </div>
                )}

                {/* Cuisines */}
                {formatCuisines(selectedRest.cuisine) && (
                  <p className="text-xs text-[#756B64] font-medium truncate mt-0.5">
                    {formatCuisines(selectedRest.cuisine)}
                  </p>
                )}

                {/* Locality + City */}
                <div className="flex items-center text-xs text-[#756B64] font-medium truncate mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#C85A3F] shrink-0 mr-1" />
                  <span className="truncate">{formatLocalityCity(selectedRest.area, selectedRest.city)}</span>
                </div>
              </div>

              {/* Change Restaurant Action */}
              <div className="pt-2 flex justify-end">
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedRest(null);
                    setIsModifying(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[#C85A3F] text-[#C85A3F] hover:bg-[#C85A3F] hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Change Restaurant</span>
                </button>
              </div>
            </div>
          </div>

          {/* MAIN RESERVATION FORM */}
          <form onSubmit={handleSubmitBooking} className="bg-white border border-[#E5DCD5] p-5 sm:p-7 rounded-2xl shadow-xs space-y-6">
            
            {/* 1. PARTY SIZE */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-baseline">
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#202124] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#C85A3F]" />
                    <span>Party Size</span>
                  </label>
                  <p className="text-[11px] text-[#756B64] font-medium mt-0.5">How many diners?</p>
                </div>
                <span className="text-[11px] font-bold text-[#756B64]">
                  {selectedRest.maxGuests ? `Max ${selectedRest.maxGuests} guests` : ''}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {partyOptions.map((num) => {
                  const isSelected = guestsCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestsCount(num)}
                      className={`min-w-10 h-10 px-3.5 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs'
                          : 'bg-[#FCFAF7] hover:bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50 text-[#202124]'
                      }`}
                    >
                      {num >= 8 && selectedRest.maxGuests > 8 ? `${num}+` : num}
                    </button>
                  );
                })}

                {/* Fine-tune +/- Stepper */}
                <div className="flex items-center ml-auto bg-[#FCFAF7] border border-[#E5DCD5] rounded-xl p-1 gap-2">
                  <button 
                    type="button" 
                    onClick={() => setGuestsCount(g => Math.max(1, g - 1))}
                    disabled={guestsCount <= 1}
                    className="w-8 h-8 bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/50 rounded-lg flex items-center justify-center text-[#202124] disabled:opacity-40 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Decrease party size"
                  >
                    -
                  </button>
                  <span className="text-xs font-extrabold text-[#202124] min-w-[55px] text-center">
                    {guestsCount} {guestsCount === 1 ? 'Diner' : 'Diners'}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setGuestsCount(g => Math.min(selectedRest.maxGuests || 12, g + 1))}
                    disabled={guestsCount >= (selectedRest.maxGuests || 12)}
                    className="w-8 h-8 bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/50 rounded-lg flex items-center justify-center text-[#202124] disabled:opacity-40 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Increase party size"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 2. BOOKING DATE */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#202124] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#C85A3F]" />
                    <span>Booking Date</span>
                  </label>
                  <p className="text-[11px] text-[#756B64] font-medium mt-0.5">Select a date</p>
                </div>
                {formattedDatePreview && (
                  <span className="text-xs font-extrabold text-[#C85A3F] bg-[#F3E8DF] px-2.5 py-0.5 rounded-lg">
                    {formattedDatePreview}
                  </span>
                )}
              </div>

              <div className="relative">
                <input 
                  type="date"
                  min={todayStr}
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="w-full p-3 bg-[#FCFAF7] border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl text-xs text-[#202124] font-bold focus:outline-none transition-colors cursor-pointer shadow-2xs"
                />
              </div>
            </div>

            {/* 3. SELECT TIME SLOT */}
            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#202124] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#C85A3F]" />
                  <span>Select Time Slot</span>
                </label>
                <p className="text-[11px] text-[#756B64] font-medium mt-0.5">Choose an available time</p>
              </div>

              {(!selectedRest.availableTimeSlots || selectedRest.availableTimeSlots.length === 0) ? (
                <div className="p-4 bg-[#FCFAF7] border border-[#E5DCD5] rounded-xl text-center space-y-1">
                  <p className="text-xs font-extrabold text-[#202124]">No available time slots for this date.</p>
                  <p className="text-[11px] text-[#756B64]">Please choose another date for table reservation.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {selectedRest.availableTimeSlots.map((slot: string) => {
                    const isSelected = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`py-3 px-3 text-xs font-extrabold rounded-xl border transition-all text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs'
                            : 'bg-[#FCFAF7] hover:bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50 text-[#202124]'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. PREFERRED SEATING ZONE (If restaurant supports it) */}
            {selectedRest.supportsSeatPreference && selectedRest.supportedSeatZones && selectedRest.supportedSeatZones.length > 0 && (
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#202124] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#C85A3F]" />
                    <span>Preferred Seating Area</span>
                  </label>
                  <p className="text-[11px] text-[#756B64] font-medium mt-0.5">Subject to table availability upon arrival</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {selectedRest.supportedSeatZones.map((zone: string) => {
                    const isSelected = seatingPreference === zone;
                    return (
                      <button
                        key={zone}
                        type="button"
                        onClick={() => setSeatingPreference(zone)}
                        className={`py-2.5 px-3 border rounded-xl font-bold text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs'
                            : 'bg-[#FCFAF7] hover:bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50 text-[#202124]'
                        }`}
                      >
                        {zone}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. SPECIAL REQUESTS */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <div>
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#202124] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#C85A3F]" />
                    <span>Special Requests</span>
                    <span className="text-[10px] font-normal text-[#756B64] lowercase">(optional)</span>
                  </label>
                  <p className="text-[11px] text-[#756B64] font-medium mt-0.5">Let us know if you have any special requirements</p>
                </div>
                <span className="text-[10px] font-bold text-[#756B64]">
                  {specialNotes.length} / 200
                </span>
              </div>

              <textarea
                value={specialNotes}
                maxLength={200}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="E.g. Table near window, baby chair, anniversary celebration..."
                className="w-full p-3.5 bg-[#FCFAF7] border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl text-xs text-[#202124] placeholder-[#756B64] focus:outline-none h-24 resize-none transition-colors shadow-2xs"
              />
            </div>

            {/* 6. PRIMARY CTA: CONFIRM BOOKING */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                id="confirm-booking-btn"
                onClick={() => handleSubmitBooking()}
                disabled={isSubmitting}
                className="w-full h-14 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Confirming Reservation...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4.5 h-4.5" />
                    <span>{isModifying ? 'Update Booking Slot' : 'Confirm Booking →'}</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-[#756B64] font-medium flex items-center justify-center gap-1.5 pt-1">
                <Lock className="w-3.5 h-3.5 text-[#C85A3F]" />
                <span>Your reservation request is submitted directly to the restaurant host.</span>
              </p>
            </div>

          </form>

          {/* TRUST / REASSURANCE SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F] shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-extrabold text-[#202124]">Easy Reservations</h5>
                <p className="text-[11px] text-[#756B64] font-medium">Quick & hassle-free</p>
              </div>
            </div>

            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-extrabold text-[#202124]">Secure Booking</h5>
                <p className="text-[11px] text-[#756B64] font-medium">Your data is safe</p>
              </div>
            </div>

            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-full bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F] shrink-0">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-extrabold text-[#202124]">Great Dining</h5>
                <p className="text-[11px] text-[#756B64] font-medium">We can't wait to serve you</p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default TableBooking;
