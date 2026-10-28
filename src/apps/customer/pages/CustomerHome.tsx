import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import Modal from '../../../components/ui/Modal/Modal';
import { 
  Star, MapPin, Search, Clock, ArrowRight, Heart, ChevronRight, X,
  Utensils, Locate, Filter, Check, Bell, QrCode, Calendar,
  ChevronDown, Flame, LogOut, ChevronLeft, Sparkles, Tag, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { IPromotion } from '../../../shared/domain/promotions/types';
import { isPromotionActive } from '../../../shared/services/promotionEngine';
import { isOrderActive } from '../../../shared/utils/orderUtils';
import { formatPrice, getCurrencySymbol } from '../../../shared/utils/format';
import { tableService } from '../../../shared/services/tableService';
import QrScannerModal from '../../../shared/ui/components/QrScannerModal';
import rightPlateImg from '../../../assets/right_food_plate.png';
import { RestaurantCardSkeleton, MenuItemSkeleton } from '../components/CustomerSkeletons';

// Palette Constants — Unified SpiralDine White & Green Design System
const COLOR_PRIMARY_GREEN = '#16A34A';
const COLOR_DEEP_GREEN = '#166534';
const COLOR_LIGHT_GREEN = '#F0FDF4';
const COLOR_MAIN_BG = '#FFFFFF';
const COLOR_CARD_BG = '#FFFFFF';
const COLOR_PRIMARY_TEXT = '#111827';
const COLOR_SECONDARY_TEXT = '#6B7280';
const COLOR_TERRACOTTA = '#F97316';
const COLOR_BORDER = '#E5E7EB';
const COLOR_OPEN = '#16A34A';
const COLOR_CLOSED = '#EF4444';

const POPULAR_CITIES = [
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { name: 'Goa', lat: 15.2993, lng: 74.1240 }
];

const HYDERABAD_AREAS = [
  'Jubilee Hills', 'Banjara Hills', 'Hitech City', 'Gachibowli', 'Madhapur', 
  'Tolichowki', 'RTC X Road', 'RTC X Roads', 'Chikkadpally', 'Secunderabad', 
  'Ramgopalpet', 'Madeenaguda', 'Kukatpally', 'Miyapur', 'Begumpet', 
  'Charminar', 'Nallakunta', 'Ameerpet', 'Kondapur', 'Dilsukhnagar',
  'Himayatnagar', 'Somajiguda', 'Abids', 'Mehdipatnam'
];

// Curated Cuisines matching design
const CUISINE_ITEMS = [
  { name: 'Biryani', icon: '🍛', filter: 'biryani' },
  { name: 'North Indian', icon: '🫓', filter: 'north indian' },
  { name: 'South Indian', icon: '🥞', filter: 'south indian' },
  { name: 'Chinese', icon: '🍜', filter: 'chinese' },
  { name: 'Pizza', icon: '🍕', filter: 'pizza' },
  { name: 'Desserts', icon: '🍨', filter: 'dessert' },
];

function extractAreaFromAddress(street: string, fallbackCity: string): string {
  if (!street || typeof street !== 'string') return fallbackCity;
  for (const area of HYDERABAD_AREAS) {
    if (new RegExp(`\\b${area.replace(/\\s+/g, '\\s+')}\\b`, 'i').test(street)) {
      if (area.toLowerCase() === 'rtc x roads') return 'RTC X Road';
      return area;
    }
  }
  const parts = street.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const candidate = parts[parts.length - 1];
    if (candidate.length < 35 && !/\\d{5,6}/.test(candidate)) {
      return candidate;
    }
  }
  return fallbackCity;
}

function formatCuisines(cuisineInput?: string | string[] | null): string {
  if (!cuisineInput) return 'Indian · Multi-Cuisine';
  let parts: string[] = [];
  if (Array.isArray(cuisineInput)) {
    parts = cuisineInput.map(p => String(p).trim()).filter(Boolean);
  } else if (typeof cuisineInput === 'string') {
    parts = cuisineInput
      .split(/[/,]/)
      .map(p => p.trim())
      .filter(Boolean);
  }
  if (parts.length === 0) return 'Indian · Multi-Cuisine';
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

function formatReviewsCount(count?: number | null): string | null {
  if (!count || typeof count !== 'number' || count <= 0) return null;
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\\.0$/, '')}k+`;
  }
  return `${count}+`;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // in kilometers
}

export const CustomerHome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Location Hub States (defaulting cleanly to Hyderabad, where onboarded dining venues exist)
  const [currentLocation, setCurrentLocation] = useState<{
    country: string;
    state: string;
    city: string;
    area: string;
    latitude: number;
    longitude: number;
    label: string;
  }>(() => {
    const defaultHyd = {
      country: 'India',
      state: 'Telangana',
      city: 'Hyderabad',
      area: 'All Areas',
      latitude: 17.3850,
      longitude: 78.4867,
      label: 'Hyderabad, India'
    };

    const saved = localStorage.getItem('diner_location');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.city) {
          localStorage.setItem('diner_location', JSON.stringify(defaultHyd));
          return defaultHyd;
        }
        return parsed;
      } catch (_) {}
    }
    
    localStorage.setItem('diner_location', JSON.stringify(defaultHyd));
    return defaultHyd;
  });

  const [recentLocations, setRecentLocations] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('recent_locations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active dining session state for compact active table card
  const [activeSession, setActiveSession] = useState<{
    restaurantId?: string;
    tenantId?: string;
    restaurantName?: string;
    tableNumber?: string | number;
    orderId?: string;
    sessionId?: string;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem('restaurantos_dining_session') || localStorage.getItem('restaurantos_dining_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeavingTable, setIsLeavingTable] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      try {
        const saved = sessionStorage.getItem('restaurantos_dining_session') || localStorage.getItem('restaurantos_dining_session');
        setActiveSession(saved ? JSON.parse(saved) : null);
      } catch {
        setActiveSession(null);
      }
    };
    window.addEventListener('storage', checkSession);
    window.addEventListener('restaurantos_dining_session_changed', checkSession);
    return () => {
      window.removeEventListener('storage', checkSession);
      window.removeEventListener('restaurantos_dining_session_changed', checkSession);
    };
  }, []);

  const handleLeaveTable = async () => {
    if (!activeSession) return;
    setIsLeavingTable(true);
    try {
      const targetTenant = activeSession.restaurantId || activeSession.tenantId;
      const targetTable = activeSession.tableNumber;
      if (targetTenant && targetTable) {
        await tableService.setTableCleaning(targetTenant, targetTable, 10);
      }
      sessionStorage.removeItem('restaurantos_dining_session');
      localStorage.removeItem('restaurantos_dining_session');
      setActiveSession(null);
      setShowLeaveModal(false);
      window.dispatchEvent(new Event('restaurantos_dining_session_changed'));
      toast.success(`Left Table #${targetTable}. Thank you for dining!`);
    } catch (err: any) {
      console.error('[CustomerHome] Leave table error:', err);
      toast.error(err?.message || 'Failed to release table. Please try again.');
    } finally {
      setIsLeavingTable(false);
    }
  };

  const [savedLocations] = useState<any[]>(() => [
    { name: 'Hyderabad Central', label: 'Hyderabad, India', city: 'Hyderabad', area: 'All Areas', lat: 17.3850, lng: 78.4867 },
    { name: 'Hitech City', label: 'Hitech City, Hyderabad', city: 'Hyderabad', area: 'Hitech City', lat: 17.4435, lng: 78.3772 },
    { name: 'Jubilee Hills', label: 'Jubilee Hills, Hyderabad', city: 'Hyderabad', area: 'Jubilee Hills', lat: 17.4319, lng: 78.4073 }
  ]);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [areaSearchQuery, setAreaSearchQuery] = useState('');

  // Primary Data States
  const [restaurantsList, setRestaurantsList] = useState<any[]>([]);
  const [popularDishes, setPopularDishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [localSearchVal, setLocalSearchVal] = useState(() => searchParams.get('search') || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Filter Modal / Toggles States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedCuisineFilter, setSelectedCuisineFilter] = useState<string>('All');
  const [showOpenNow, setShowOpenNow] = useState(false);
  const [showTopRated, setShowTopRated] = useState(false);
  const [filterPrice, setFilterPrice] = useState<string>('All');

  // QR Scanner Modal State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Favourites list stored in localStorage
  const [favourites, setFavourites] = useState<string[]>(() => {
    const saved = localStorage.getItem('diner_favourites');
    return saved ? JSON.parse(saved) : [];
  });

  // Active Live Order detection
  const [activeOrderBanner, setActiveOrderBanner] = useState<any>(null);

  // Active dynamic restaurant promotions for Customer Home Carousel
  const [homePromotions, setHomePromotions] = useState<(IPromotion & { restaurantName: string; restaurantId: string })[]>([]);
  const [activePromoIndex, setActivePromoIndex] = useState<number>(0);

  useEffect(() => {
    const checkActiveOrder = () => {
      try {
        const raw = localStorage.getItem('restaurantos_customer_orders');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            const active = list.find((o: any) => isOrderActive(o));
            if (active && active.tenantId && active.orderId) {
              setActiveOrderBanner(active);
              return;
            }
          }
        }
      } catch (_) {}
      setActiveOrderBanner(null);
    };

    checkActiveOrder();
    window.addEventListener('storage', checkActiveOrder);
    return () => window.removeEventListener('storage', checkActiveOrder);
  }, []);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearchVal);
      if (localSearchVal) {
        setSearchParams({ search: localSearchVal });
      } else {
        const copy = new URLSearchParams(searchParams);
        copy.delete('search');
        setSearchParams(copy);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [localSearchVal, setSearchParams, searchParams]);

  // Handle outside clicks to close the suggestions dropdown
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Listen to open_location_modal and diner_location_changed events
  useEffect(() => {
    const handleOpenLocation = () => setIsLocationModalOpen(true);
    const handleLocationChanged = () => {
      try {
        const saved = localStorage.getItem('diner_location');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.city) {
            setCurrentLocation(parsed);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('open_location_modal', handleOpenLocation);
    window.addEventListener('diner_location_changed', handleLocationChanged);
    window.addEventListener('storage', handleLocationChanged);

    return () => {
      window.removeEventListener('open_location_modal', handleOpenLocation);
      window.removeEventListener('diner_location_changed', handleLocationChanged);
      window.removeEventListener('storage', handleLocationChanged);
    };
  }, []);

  // Update search state if URL query parameter changes
  useEffect(() => {
    const searchVal = searchParams.get('search');
    if (searchVal !== null && searchVal !== localSearchVal) {
      setLocalSearchVal(searchVal);
      setSearchQuery(searchVal);
    }
  }, [searchParams]);

  // Stream onboarded restaurants branches from Firestore in real-time
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    const qTenants = query(collection(db, 'tenants'), limit(50));
    const unsubscribe = onSnapshot(qTenants, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        
        // Only include active restaurants
        const status = data.status || 'active';
        if (status === 'suspended' || status === 'inactive') {
          return;
        }

        const city = data.address?.city || data.city || 'Hyderabad';
        const state = data.address?.state || data.state || 'Telangana';
        const country = data.address?.country || data.country || 'India';
        const street = data.address?.street || data.street || '';
        const area = data.area || data.address?.area || extractAreaFromAddress(street, city);

        const currency = data.currency || data.settings?.currency || 'INR';
        const currencySymbol = data.currencySymbol || data.settings?.currencySymbol || getCurrencySymbol(currency);

        list.push({
          id: d.id,
          name: data.restaurantName || data.name || 'Restaurant',
          cuisine: data.cuisine || 'Multi-Cuisine',
          rating: typeof data.rating === 'number' ? data.rating : (4.0 + (d.id.charCodeAt(0) % 10) / 10),
          reviewsCount: typeof data.reviewsCount === 'number' ? data.reviewsCount : (150 + (d.id.charCodeAt(0) * 12) % 1500),
          priceRange: data.priceRange || '₹500 for two',
          openNow: data.status === 'active' || data.openNow !== false,
          image: data.coverImageUrl || data.coverImage || null,
          logoUrl: data.logoUrl || data.logo || null,
          city,
          state,
          country,
          area,
          street,
          address: data.address || null,
          currency,
          currencySymbol,
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
        });
      });

      setRestaurantsList(list);
      setIsLoading(false);
    }, (error) => {
      console.error('[CustomerHome] Failed to stream restaurants from Firestore:', error);
      setLoadError('Unable to load restaurants. Please check your connection.');
      setRestaurantsList([]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Stream popular dishes from top onboarded restaurants in Firestore
  useEffect(() => {
    if (restaurantsList.length === 0) return;
    const topRestaurants = restaurantsList.slice(0, 5);
    const unsubs: (() => void)[] = [];
    const dishesAccumulator = new Map<string, any>();

    topRestaurants.forEach((rest) => {
      try {
        const itemsRef = collection(db, 'restaurants', rest.id, 'menu', 'default', 'items');
        const qItems = query(itemsRef, limit(3));
        const unsub = onSnapshot(qItems, (snap) => {
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            dishesAccumulator.set(docSnap.id, {
              id: docSnap.id,
              name: d.name || 'Signature Dish',
              price: typeof d.price === 'number' ? d.price : (d.basePrice || 18000),
              image: d.imageUrl || d.image || null,
              restaurantId: rest.id,
              restaurantName: rest.name,
              isVeg: Boolean(d.isVegetarian || d.vegOptions)
            });
          });
          setPopularDishes(Array.from(dishesAccumulator.values()).slice(0, 8));
        }, () => {});
        unsubs.push(unsub);
      } catch (_) {}
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [restaurantsList]);

  // Stream active promotions from onboarded restaurants for Customer Home Carousel
  useEffect(() => {
    if (restaurantsList.length === 0) return;
    const topRestaurants = restaurantsList.slice(0, 10);
    const unsubs: (() => void)[] = [];
    const promosMap = new Map<string, IPromotion & { restaurantName: string; restaurantId: string }>();

    topRestaurants.forEach((rest) => {
      try {
        const promoRef = collection(db, 'restaurants', rest.id, 'promotions');
        const unsub = onSnapshot(promoRef, (snap) => {
          for (const [key, p] of promosMap.entries()) {
            if (p.restaurantId === rest.id) {
              promosMap.delete(key);
            }
          }

          snap.forEach((docSnap) => {
            const d = docSnap.data();
            const placementsArr = Array.isArray(d.placements) 
              ? d.placements 
              : (d.placement ? [d.placement] : ['restaurant_menu', 'cart_suggestion', 'home_carousel']);
            
            const promoObj: any = {
              id: docSnap.id,
              ...d,
              restaurantId: rest.id,
              restaurantName: rest.name,
              placements: placementsArr,
              value: Number(d.value ?? d.discountValue ?? 0),
              status: d.status || 'active',
              startDate: d.startDate || new Date().toISOString(),
              endDate: d.endDate || new Date(Date.now() + 30 * 86400000).toISOString(),
              startTime: d.startTime || (d.startDate?.includes('T') ? d.startDate.slice(11, 16) : '00:00'),
              endTime: d.endTime || (d.endDate?.includes('T') ? d.endDate.slice(11, 16) : '23:59')
            };

            const isHomePlacement = placementsArr.includes('home_carousel') || 
              placementsArr.includes('HOME_CAROUSEL' as any) || 
              placementsArr.includes('ALL' as any);

            if (isPromotionActive(promoObj) && isHomePlacement) {
              promosMap.set(`${rest.id}_${docSnap.id}`, promoObj);
            }
          });

          setHomePromotions(Array.from(promosMap.values()));
        }, () => {});
        unsubs.push(unsub);
      } catch (_) {}
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [restaurantsList]);

  // Auto-advance promotion carousel every 5 seconds if multiple promotions exist
  useEffect(() => {
    if (homePromotions.length <= 1) return;
    const timer = setInterval(() => {
      setActivePromoIndex((prev) => (prev + 1) % homePromotions.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [homePromotions.length]);

  // Detect GPS location with smart metro resolution
  const handleDetectLocation = (isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) toast.error("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`);
          const data = await res.json();
          if (data && data.address) {
            const country = data.address.country || 'India';
            const state = data.address.state || 'Telangana';
            const rawCity = data.address.city || data.address.town || data.address.village || 'Hyderabad';
            const suburb = data.address.suburb || data.address.neighbourhood || '';
            const area = suburb || 'All Areas';
            const resolvedCity = rawCity || 'Hyderabad';
            
            const newLoc = {
              country,
              state,
              city: resolvedCity,
              area: 'All Areas',
              latitude,
              longitude,
              label: `${area && area !== 'All Areas' ? area + ', ' : ''}${resolvedCity}`
            };
            setCurrentLocation(newLoc);
            localStorage.setItem('diner_location', JSON.stringify(newLoc));
            window.dispatchEvent(new Event('diner_location_changed'));
            addToRecentLocations(newLoc);
            toast.success(`Location set: ${newLoc.label}`);
          }
        } catch (_) {
          const newLoc = {
            country: 'India',
            state: 'Telangana',
            city: 'Hyderabad',
            area: 'All Areas',
            latitude,
            longitude,
            label: 'Hyderabad, India'
          };
          setCurrentLocation(newLoc);
          localStorage.setItem('diner_location', JSON.stringify(newLoc));
          window.dispatchEvent(new Event('diner_location_changed'));
        }
      },
      (error) => {
        console.warn("Geolocation permission error", error);
        if (!isAuto) {
          toast.error("Location permission denied. Select manually.");
          setIsLocationModalOpen(true);
        }
      },
      { timeout: 8000 }
    );
  };

  const addToRecentLocations = (loc: any) => {
    setRecentLocations(prev => {
      const filtered = prev.filter(p => p.label !== loc.label);
      const updated = [loc, ...filtered].slice(0, 3);
      localStorage.setItem('recent_locations', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectLocation = (loc: any) => {
    setCurrentLocation(loc);
    localStorage.setItem('diner_location', JSON.stringify(loc));
    window.dispatchEvent(new Event('diner_location_changed'));
    addToRecentLocations(loc);
    setIsLocationModalOpen(false);
  };

  const toggleFavourite = (restaurantId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavourites(prev => {
      let updated: string[];
      if (prev.includes(restaurantId)) {
        updated = prev.filter(id => id !== restaurantId);
        toast('Removed from favourites', { icon: '🤍' });
      } else {
        updated = [...prev, restaurantId];
        toast.success('Added to favourites!', { icon: '❤️' });
      }
      localStorage.setItem('diner_favourites', JSON.stringify(updated));
      return updated;
    });
  };

  const currentCity = currentLocation?.city || 'Hyderabad';

  // Filter restaurants by location, search, cuisine, and toggles
  const filteredRestaurants = useMemo(() => {
    return restaurantsList.map(r => {
      let distance: number | null = null;
      if (r.latitude && r.longitude && currentLocation?.latitude && currentLocation?.longitude) {
        distance = calculateDistance(
          currentLocation.latitude, 
          currentLocation.longitude, 
          r.latitude, 
          r.longitude
        );
      }
      return { ...r, distance };
    }).filter(r => {
      // 1. City / Region filter
      if (r.city && currentCity && !r.city.toLowerCase().includes(currentCity.toLowerCase()) && !currentCity.toLowerCase().includes(r.city.toLowerCase())) {
        return false;
      }
      // 2. Search query filter
      if (searchQuery.trim()) {
        const queryNorm = searchQuery.toLowerCase().trim();
        const matchesName = r.name.toLowerCase().includes(queryNorm);
        const matchesCuisine = typeof r.cuisine === 'string' && r.cuisine.toLowerCase().includes(queryNorm);
        const matchesArea = r.area && r.area.toLowerCase().includes(queryNorm);
        if (!matchesName && !matchesCuisine && !matchesArea) return false;
      }
      // 3. Cuisine filter chip
      if (selectedCuisineFilter !== 'All') {
        const cNorm = selectedCuisineFilter.toLowerCase();
        if (typeof r.cuisine === 'string' && !r.cuisine.toLowerCase().includes(cNorm)) {
          return false;
        }
      }
      // 4. Open Now toggle
      if (showOpenNow && !r.openNow) return false;
      // 5. Top Rated toggle
      if (showTopRated && (r.rating || 0) < 4.0) return false;

      return true;
    });
  }, [restaurantsList, currentCity, currentLocation, searchQuery, selectedCuisineFilter, showOpenNow, showTopRated]);

  // Checks if the selected city has any onboarded restaurants at all
  const cityHasAnyRestaurants = useMemo(() => {
    return restaurantsList.some(r => {
      if (!r.city || !currentCity) return false;
      return r.city.toLowerCase().includes(currentCity.toLowerCase()) || currentCity.toLowerCase().includes(r.city.toLowerCase());
    });
  }, [restaurantsList, currentCity]);

  // Autocomplete search suggestions
  const searchSuggestions = useMemo(() => {
    if (!localSearchVal.trim()) return [];
    const val = localSearchVal.toLowerCase().trim();
    const suggestions = new Set<string>();

    restaurantsList.forEach(r => {
      if (r.name.toLowerCase().includes(val)) suggestions.add(r.name);
      if (typeof r.cuisine === 'string') {
        r.cuisine.split(/[/,]/).forEach((c: string) => {
          const cleanC = c.trim();
          if (cleanC.toLowerCase().includes(val)) suggestions.add(cleanC);
        });
      }
    });

    return Array.from(suggestions).slice(0, 5);
  }, [localSearchVal, restaurantsList]);

  // Fallback image helper
  const renderFallbackImage = (name: string) => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#EAF5E7] text-[#2E8B3C]">
      <Utensils className="w-7 h-7 mb-1" />
      <span className="text-[10px] font-bold truncate max-w-[90px]">{name}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10 text-left" style={{ backgroundColor: COLOR_MAIN_BG, color: COLOR_PRIMARY_TEXT }}>
      
      {/* ========================================================================= */}
      {/* SECTION A — HEADER AND LOCATION                                           */}
      {/* ========================================================================= */}
      <section className="space-y-3 pt-1">
        {/* Location & Dining Context Header */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#65736A]">
              Dining in
            </span>
            <div 
              onClick={() => setIsLocationModalOpen(true)}
              className="inline-flex items-center gap-1.5 cursor-pointer group py-0.5 min-w-0"
            >
              <MapPin className="w-4 h-4 shrink-0" style={{ color: COLOR_PRIMARY_GREEN }} />
              <span className="text-sm sm:text-base font-black group-hover:underline truncate" style={{ color: COLOR_PRIMARY_TEXT }}>
                {currentLocation.city}, {currentLocation.country || 'India'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#65736A] transition-transform group-hover:translate-y-0.5 shrink-0" />
            </div>
            <p className="text-xs font-normal truncate" style={{ color: COLOR_SECONDARY_TEXT }}>
              Discover amazing restaurants near you
            </p>
          </div>

          {/* Quick Shortcuts: Favourites */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/customer/explore?filter=favorites')}
              aria-label="View Favorites"
              className="px-3 py-1.5 rounded-full bg-white border flex items-center gap-1.5 text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
              style={{ borderColor: COLOR_BORDER, color: favourites.length > 0 ? '#D95335' : '#65736A' }}
              title="Saved Favorites"
            >
              <Heart className={`w-3.5 h-3.5 ${favourites.length > 0 ? 'fill-[#D95335] text-[#D95335]' : 'text-[#65736A]'}`} />
              <span className="hidden xs:inline">Favorites</span>
            </button>
          </div>
        </div>

        {/* Dedicated Active Dining Session Card */}
        {activeSession && activeSession.tableNumber && (
          <div 
            className="rounded-2xl border p-3 min-[380px]:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs min-w-0"
            style={{ backgroundColor: '#F0FFF4', borderColor: '#C6F6D5' }}
          >
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 min-[340px]:w-9 min-[340px]:h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#38A169', color: '#FFFFFF' }}>
                <Utensils className="w-3.5 h-3.5 min-[340px]:w-4 min-[340px]:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[11px] min-[340px]:text-xs font-black tracking-wide truncate" style={{ color: '#22543D' }}>
                    ACTIVE TABLE: #{activeSession.tableNumber}
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full shrink-0" style={{ backgroundColor: '#C6F6D5', color: '#22543D' }}>
                    LIVE
                  </span>
                </div>
                <p className="text-[10px] min-[340px]:text-[11px] font-semibold truncate" style={{ color: '#2F855A' }}>
                  Restaurant: {activeSession.restaurantName || 'Dining Restaurant'}
                </p>
              </div>
            </div>
            <div className="flex flex-col min-[380px]:flex-row items-stretch min-[380px]:items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (activeSession.orderId) {
                    navigate(`/customer/restaurant/${activeSession.restaurantId || activeSession.tenantId}/order/${activeSession.orderId}`);
                  } else {
                    navigate('/customer/orders');
                  }
                }}
                className="w-full min-[380px]:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer text-center"
                style={{ backgroundColor: '#276749' }}
              >
                <span>View Active Order</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                className="w-full min-[380px]:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold border shadow-xs cursor-pointer hover:bg-red-50 text-center"
                style={{ borderColor: '#FEB2B2', color: '#C53030', backgroundColor: '#FFF5F5' }}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Leave Table</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION B — SEARCH BAR WITH FILTER BUTTON                                 */}
      {/* ========================================================================= */}
      <section className="relative min-w-0" ref={suggestionsRef}>
        <div 
          className="flex items-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl bg-white border transition-all shadow-xs focus-within:shadow-md min-w-0"
          style={{ borderColor: COLOR_BORDER }}
        >
          <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" style={{ color: COLOR_SECONDARY_TEXT }} />
          <input
            type="text"
            value={localSearchVal}
            onChange={(e) => {
              setLocalSearchVal(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search restaurants, dishes or cuisines..."
            className="w-full min-w-0 bg-transparent text-xs sm:text-sm font-medium focus:outline-none placeholder:text-[#65736A] truncate"
            style={{ color: COLOR_PRIMARY_TEXT }}
          />
          {localSearchVal && (
            <button
              type="button"
              onClick={() => {
                setLocalSearchVal('');
                setSearchQuery('');
                setShowSuggestions(false);
              }}
              className="p-1 rounded-full hover:bg-slate-100 text-[#65736A] shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className="p-1.5 shrink-0 rounded-xl border flex items-center justify-center transition-colors cursor-pointer hover:bg-[#EAF5E7]"
            style={{ 
              borderColor: COLOR_BORDER, 
              backgroundColor: (selectedCuisineFilter !== 'All' || showOpenNow || showTopRated) ? COLOR_LIGHT_GREEN : 'transparent',
              color: COLOR_PRIMARY_GREEN 
            }}
            title="Filter restaurants"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Autocomplete Search Suggestions */}
        {showSuggestions && searchSuggestions.length > 0 && (
          <div 
            className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-2xl shadow-xl p-1.5 z-40 divide-y divide-[#EAF5E7]"
            style={{ borderColor: COLOR_BORDER }}
          >
            {searchSuggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setLocalSearchVal(sug);
                  setSearchQuery(sug);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-[#EAF5E7]/50 rounded-xl flex items-center justify-between transition-colors"
                style={{ color: COLOR_PRIMARY_TEXT }}
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5" style={{ color: COLOR_PRIMARY_GREEN }} />
                  <span>{sug}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase" style={{ backgroundColor: COLOR_LIGHT_GREEN, color: COLOR_PRIMARY_GREEN }}>
                  Match
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ACTIVE ORDER BANNER (If customer has an in-flight order) */}
      {activeOrderBanner && (
        <div 
          onClick={() => navigate(`/customer/restaurant/${activeOrderBanner.tenantId}/order/${activeOrderBanner.orderId}`)}
          className="p-3.5 rounded-2xl border flex items-center justify-between shadow-xs hover:shadow-md transition-all cursor-pointer bg-white"
          style={{ borderColor: COLOR_PRIMARY_GREEN }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: COLOR_PRIMARY_GREEN }}>
              <Utensils className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: COLOR_TERRACOTTA }}>
                  Active Order #{activeOrderBanner.orderId}
                </span>
                <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: COLOR_OPEN }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: COLOR_OPEN }} />
                  <span>In Kitchen</span>
                </span>
              </div>
              <p className="text-xs font-bold mt-0.5" style={{ color: COLOR_PRIMARY_TEXT }}>
                {activeOrderBanner.restaurantName ? `Preparing at ${activeOrderBanner.restaurantName}` : 'Your order is being prepared!'}
                {activeOrderBanner.tableNumber ? ` · Table ${activeOrderBanner.tableNumber}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-extrabold" style={{ color: COLOR_PRIMARY_GREEN }}>
            <span>Track Live</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION C — PROMOTIONS CAROUSEL / FOOD DISCOVERY BANNER                   */}
      {/* ========================================================================= */}
      {homePromotions.length > 0 ? (
        (() => {
          const promo = homePromotions[activePromoIndex % homePromotions.length];
          const discountLabel = promo.badgeText || (
            promo.type === 'bogo' 
              ? 'BUY 1 GET 1' 
              : promo.type === 'fixed_amount' 
                ? `FLAT ₹${promo.value} OFF` 
                : `${promo.value}% OFF`
          );

          let scheduleText = '';
          try {
            const endDateObj = new Date(promo.endDate);
            const dateStr = endDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            let timeStr = '';
            if (promo.endTime) {
              const [h, m] = promo.endTime.split(':');
              const hNum = parseInt(h, 10);
              const ampm = hNum >= 12 ? 'PM' : 'AM';
              const h12 = hNum % 12 || 12;
              timeStr = `${h12}:${m || '00'} ${ampm}`;
            } else {
              timeStr = endDateObj.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
            scheduleText = `${dateStr}, ${timeStr}`;
          } catch (_) {
            scheduleText = promo.endDate;
          }

          return (
            <section 
              className="relative rounded-3xl overflow-hidden border p-4 sm:p-6 shadow-sm flex flex-col min-[340px]:flex-row items-center justify-between gap-4 min-w-0 transition-all bg-gradient-to-r from-[#FFF9F6] via-[#FFFDFB] to-[#F0FDF4]"
              style={{ borderColor: '#FDBA74' }}
            >
              <div className="space-y-2 sm:space-y-2.5 flex-1 min-w-0 z-10 w-full min-[340px]:w-auto pr-0 min-[340px]:pr-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] font-poppins font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white shadow-xs" style={{ backgroundColor: COLOR_TERRACOTTA }}>
                    {discountLabel}
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-[#166534] flex items-center gap-1">
                    <Utensils className="w-3 h-3 text-[#16A34A]" />
                    <span>{promo.restaurantName}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-xl font-poppins font-black text-[#111827] tracking-tight leading-snug">
                    {promo.name}
                  </h3>
                  {promo.description && (
                    <p className="text-[11px] sm:text-xs text-[#4B5563] font-medium leading-relaxed mt-0.5 line-clamp-2">
                      {promo.description}
                      {promo.minOrderValue ? ` • Min Order: ₹${promo.minOrderValue}` : ''}
                      {promo.maxDiscountAmount ? ` • Max Discount: ₹${promo.maxDiscountAmount}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {(promo.code || promo.couponCode) && (
                    <button
                      type="button"
                      onClick={() => {
                        const codeVal = promo.code || promo.couponCode || '';
                        navigator.clipboard.writeText(codeVal);
                        toast.success(`Coupon "${codeVal}" copied!`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#FDBA74] text-[#C2410C] font-mono font-extrabold text-xs shadow-2xs hover:bg-[#FFF7ED] transition-all cursor-pointer active:scale-95"
                      title="Click to copy coupon code"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>CODE: {promo.code || promo.couponCode}</span>
                      <Copy className="w-3 h-3 opacity-60" />
                    </button>
                  )}

                  {scheduleText && (
                    <span className="text-[10.5px] font-semibold text-[#6B7280] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#EA580C]" />
                      <span>Valid till {scheduleText}</span>
                    </span>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/customer/restaurant/${promo.restaurantId}/menu`)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-white text-xs font-poppins font-extrabold shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    style={{ backgroundColor: COLOR_PRIMARY_GREEN }}
                  >
                    <span>Order Menu &amp; Redeem</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Appetizing Food Image or Promo Graphic on Right */}
              <div className="w-20 h-20 min-[340px]:w-24 min-[340px]:h-24 sm:w-36 sm:h-36 shrink-0 relative flex items-center justify-center">
                <img
                  src={promo.imageUrl || rightPlateImg}
                  alt={promo.name}
                  className="w-full h-full object-contain drop-shadow-md select-none transition-transform hover:scale-105"
                />
              </div>

              {/* Carousel controls if more than 1 promotion */}
              {homePromotions.length > 1 && (
                <>
                  <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
                    <button
                      type="button"
                      onClick={() => setActivePromoIndex((prev) => (prev - 1 + homePromotions.length) % homePromotions.length)}
                      className="w-6 h-6 rounded-full bg-white/90 border border-slate-200 text-slate-700 hover:text-black flex items-center justify-center text-xs shadow-xs cursor-pointer"
                      title="Previous offer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePromoIndex((prev) => (prev + 1) % homePromotions.length)}
                      className="w-6 h-6 rounded-full bg-white/90 border border-slate-200 text-slate-700 hover:text-black flex items-center justify-center text-xs shadow-xs cursor-pointer"
                      title="Next offer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                    {homePromotions.map((_, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setActivePromoIndex(idx)}
                        className={`transition-all rounded-full cursor-pointer ${
                          idx === activePromoIndex % homePromotions.length
                            ? 'w-4 h-1.5 bg-[#EA580C]'
                            : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                        title={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })()
      ) : (
        <section 
          className="relative rounded-3xl overflow-hidden border p-3.5 min-[380px]:p-4 sm:p-6 shadow-xs flex flex-col min-[340px]:flex-row items-center justify-between gap-3 min-w-0"
          style={{ backgroundColor: COLOR_LIGHT_GREEN, borderColor: COLOR_BORDER }}
        >
          <div className="space-y-2 sm:space-y-2.5 flex-1 min-w-0 z-10 w-full min-[340px]:w-auto pr-0 min-[340px]:pr-1">
            <div>
              <h2 className="text-[10px] min-[340px]:text-[11px] sm:text-xs font-poppins font-extrabold uppercase tracking-wide" style={{ color: COLOR_DEEP_GREEN }}>
                DISCOVER SOMETHING
              </h2>
              <h3 className="text-sm min-[340px]:text-base sm:text-2xl font-poppins font-black uppercase tracking-tight leading-tight" style={{ color: COLOR_TERRACOTTA }}>
                DELICIOUS
              </h3>
            </div>
            <p className="text-[10px] min-[340px]:text-[10.5px] sm:text-xs font-medium leading-relaxed" style={{ color: COLOR_SECONDARY_TEXT }}>
              Find your next favourite meal from the best restaurants around you.
            </p>
            <div>
              <button
                type="button"
                onClick={() => navigate('/customer/explore')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-white text-[11px] sm:text-xs font-poppins font-extrabold shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer whitespace-nowrap w-full min-[340px]:w-auto"
                style={{ backgroundColor: COLOR_PRIMARY_GREEN }}
              >
                <span>Explore Restaurants</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>

          {/* Appetizing Food Image on Right */}
          <div className="w-16 h-16 min-[340px]:w-20 min-[340px]:h-20 sm:w-36 sm:h-36 md:w-40 md:h-40 shrink-0 relative flex items-center justify-center">
            <img
              src={rightPlateImg}
              alt="Delicious Meals"
              className="w-full h-full object-contain drop-shadow-md select-none transition-transform hover:scale-105"
            />
          </div>

          {/* Banner carousel dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_PRIMARY_GREEN }} />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* SECTION D — EXPLORE BY CUISINE                                            */}
      {/* ========================================================================= */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-poppins font-extrabold" style={{ color: COLOR_PRIMARY_TEXT }}>
            Explore by Cuisine
          </h3>
          <button
            type="button"
            onClick={() => navigate('/customer/explore')}
            className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
            style={{ color: COLOR_PRIMARY_GREEN }}
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none snap-x">
          {CUISINE_ITEMS.map((c) => {
            const isSelected = selectedCuisineFilter === c.filter;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  setSelectedCuisineFilter(prev => prev === c.filter ? 'All' : c.filter);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all shrink-0 cursor-pointer shadow-xs snap-start ${
                  isSelected ? 'border-[#2E8B3C] shadow-sm' : 'border-[#DDE7D8] bg-white hover:border-[#2E8B3C]/40'
                }`}
                style={{ 
                  backgroundColor: isSelected ? COLOR_LIGHT_GREEN : '#FFFFFF',
                  borderColor: isSelected ? COLOR_PRIMARY_GREEN : COLOR_BORDER 
                }}
              >
                <span className="text-base select-none">{c.icon}</span>
                <span className="text-xs font-extrabold whitespace-nowrap" style={{ color: isSelected ? COLOR_DEEP_GREEN : COLOR_PRIMARY_TEXT }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION E — QUICK ACTIONS (Scan QR, My Orders, Book a Table)              */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* 1. Scan QR */}
        <div
          onClick={() => setIsQrScannerOpen(true)}
          className="p-3 sm:p-3.5 rounded-2xl border bg-white flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group shadow-xs"
          style={{ borderColor: COLOR_BORDER }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105" style={{ backgroundColor: COLOR_LIGHT_GREEN, color: COLOR_PRIMARY_GREEN }}>
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-poppins font-extrabold line-clamp-1" style={{ color: COLOR_PRIMARY_TEXT }}>
              Scan QR
            </h4>
            <p className="text-[10px] font-medium line-clamp-1" style={{ color: COLOR_SECONDARY_TEXT }}>
              Open table menu
            </p>
          </div>
        </div>

        {/* 2. My Orders */}
        <div
          onClick={() => navigate('/customer/orders')}
          className="p-3 sm:p-3.5 rounded-2xl border bg-white flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group shadow-xs"
          style={{ borderColor: COLOR_BORDER }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105" style={{ backgroundColor: '#FFF3EE', color: COLOR_TERRACOTTA }}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-poppins font-extrabold line-clamp-1" style={{ color: COLOR_PRIMARY_TEXT }}>
              My Orders
            </h4>
            <p className="text-[10px] font-medium line-clamp-1" style={{ color: COLOR_SECONDARY_TEXT }}>
              Track your orders
            </p>
          </div>
        </div>

        {/* 3. Book a Table */}
        <div
          onClick={() => navigate('/customer/booking')}
          className="p-3 sm:p-3.5 rounded-2xl border bg-white flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group shadow-xs"
          style={{ borderColor: COLOR_BORDER }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105" style={{ backgroundColor: '#FFF9E6', color: '#D97706' }}>
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-poppins font-extrabold line-clamp-1" style={{ color: COLOR_PRIMARY_TEXT }}>
              Book a Table
            </h4>
            <p className="text-[10px] font-medium line-clamp-1" style={{ color: COLOR_SECONDARY_TEXT }}>
              Reserve your seat
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION F — POPULAR DISHES / EXPLORE DISHES                               */}
      {/* ========================================================================= */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-poppins font-extrabold" style={{ color: COLOR_PRIMARY_TEXT }}>
            Popular Dishes
          </h3>
          <button
            type="button"
            onClick={() => navigate('/customer/explore')}
            className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
            style={{ color: COLOR_PRIMARY_GREEN }}
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading && popularDishes.length === 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="w-36 sm:w-40 shrink-0">
                <MenuItemSkeleton />
              </div>
            ))}
          </div>
        ) : popularDishes.length === 0 ? (
          <div className="p-4 text-center text-xs" style={{ color: COLOR_SECONDARY_TEXT }}>
            No signature dishes available yet.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
            {popularDishes.map((dish) => {
              const displayPrice = formatPrice(dish.price); // Single canonical conversion
              return (
                <div
                  key={dish.id}
                  onClick={() => navigate(`/customer/restaurant/${dish.restaurantId}`)}
                  className="w-36 sm:w-40 rounded-2xl border bg-white overflow-hidden shrink-0 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group shadow-xs snap-start"
                  style={{ borderColor: COLOR_BORDER }}
                >
                  {/* Top: Dish Image */}
                  <div className="h-28 w-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    {dish.image ? (
                      <img
                        src={dish.image}
                        alt={dish.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      renderFallbackImage(dish.name)
                    )}
                  </div>

                  {/* Bottom: Info and + Add button */}
                  <div className="p-2.5 space-y-1.5 text-left">
                    <h5 className="text-xs font-bold truncate" style={{ color: COLOR_PRIMARY_TEXT }} title={dish.name}>
                      {dish.name}
                    </h5>
                    <p className="text-[10px] truncate" style={{ color: COLOR_SECONDARY_TEXT }}>
                      {dish.restaurantName}
                    </p>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-xs font-black" style={{ color: COLOR_PRIMARY_TEXT }}>
                        {displayPrice}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customer/restaurant/${dish.restaurantId}`);
                        }}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                        style={{ backgroundColor: COLOR_PRIMARY_GREEN }}
                        title="Add dish"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION G — RESTAURANT LISTINGS (COMPACT HORIZONTAL CARDS)                 */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-poppins font-extrabold" style={{ color: COLOR_PRIMARY_TEXT }}>
              Popular Restaurants
            </h3>
            {filteredRestaurants.length > 0 && (
              <p className="text-[10.5px] font-medium" style={{ color: COLOR_SECONDARY_TEXT }}>
                {filteredRestaurants.length} venue{filteredRestaurants.length === 1 ? '' : 's'} available in {currentCity}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/customer/explore')}
            className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
            style={{ color: COLOR_PRIMARY_GREEN }}
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadError ? (
          <div 
            className="p-6 text-center rounded-3xl border bg-white space-y-3 shadow-xs"
            style={{ borderColor: COLOR_BORDER }}
          >
            <p className="text-xs font-bold text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setLoadError(null);
                window.location.reload();
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer hover:opacity-90"
              style={{ backgroundColor: COLOR_PRIMARY_GREEN }}
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(idx => (
              <RestaurantCardSkeleton key={idx} />
            ))}
          </div>
        ) : filteredRestaurants.length === 0 ? (
          !cityHasAnyRestaurants ? (
            <div 
              className="p-8 text-center rounded-3xl border bg-white space-y-3 shadow-xs"
              style={{ borderColor: COLOR_BORDER }}
            >
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: COLOR_LIGHT_GREEN }}>
                <Utensils className="w-7 h-7" style={{ color: COLOR_PRIMARY_GREEN }} />
              </div>
              <h4 className="text-base font-extrabold" style={{ color: COLOR_PRIMARY_TEXT }}>
                SpiralDine Is Coming Soon!
              </h4>
              <p className="text-xs max-w-sm mx-auto" style={{ color: COLOR_SECONDARY_TEXT }}>
                We're working on bringing amazing restaurants to your area in <strong>{currentLocation?.label || currentCity}</strong>.
              </p>
              <p className="text-[11px]" style={{ color: COLOR_SECONDARY_TEXT }}>
                Stay tuned. We'll let you know when restaurants become available.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: COLOR_PRIMARY_GREEN }}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Change Location</span>
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="p-8 text-center rounded-3xl border border-dashed bg-white space-y-2 shadow-xs"
              style={{ borderColor: COLOR_BORDER }}
            >
              <Utensils className="w-8 h-8 mx-auto" style={{ color: COLOR_PRIMARY_GREEN }} />
              <h4 className="text-xs font-extrabold" style={{ color: COLOR_PRIMARY_TEXT }}>
                No restaurants found in {currentCity}
              </h4>
              <p className="text-[11px]" style={{ color: COLOR_SECONDARY_TEXT }}>
                Try selecting another city or clearing your search filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCuisineFilter('All');
                  setLocalSearchVal('');
                  setSearchQuery('');
                  setShowOpenNow(false);
                  setShowTopRated(false);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer"
                style={{ backgroundColor: COLOR_PRIMARY_GREEN }}
              >
                Reset Filters
              </button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredRestaurants.slice(0, 8).map((r) => {
              const isFav = favourites.includes(r.id);
              const imageUrl = r.image || r.coverImageUrl || r.coverImage || r.logoUrl || r.logo;
              const cuisinesStr = formatCuisines(r.cuisine);
              const locality = formatLocalityCity(r.area, r.city);

              return (
                <div
                  key={r.id}
                  onClick={() => navigate(`/customer/restaurant/${r.id}`)}
                  className="rounded-2xl border bg-white overflow-hidden p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-4 hover:shadow-md transition-all cursor-pointer group shadow-xs min-w-0"
                  style={{ borderColor: COLOR_BORDER }}
                >
                  {/* Left Column: Image with OPEN/CLOSED status badge */}
                  <div className="relative w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={r.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      renderFallbackImage(r.name)
                    )}

                    {/* Status Pill Badge */}
                    <div className="absolute top-1.5 left-1.5">
                      {r.openNow ? (
                        <span 
                          className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase text-white shadow-xs"
                          style={{ backgroundColor: COLOR_OPEN }}
                        >
                          OPEN NOW
                        </span>
                      ) : (
                        <span 
                          className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase text-white shadow-xs"
                          style={{ backgroundColor: COLOR_CLOSED }}
                        >
                          CLOSED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Restaurant Information */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs sm:text-sm font-black truncate group-hover:underline" style={{ color: COLOR_PRIMARY_TEXT }}>
                        {r.name}
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => toggleFavourite(r.id, e)}
                        className="p-1 rounded-full hover:bg-slate-100 text-[#65736A] shrink-0"
                        aria-label="Toggle favourite"
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-[#D95335] text-[#D95335]' : 'text-[#65736A]'}`} />
                      </button>
                    </div>

                    {/* Rating & Review Count */}
                    <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: COLOR_PRIMARY_TEXT }}>
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{r.rating ? r.rating.toFixed(1) : '4.5'}</span>
                      </span>
                      <span className="text-[10px] font-normal" style={{ color: COLOR_SECONDARY_TEXT }}>
                        ({formatReviewsCount(r.reviewsCount) || '980+'})
                      </span>
                    </div>

                    {/* Cuisines */}
                    <p className="text-[11px] truncate font-medium" style={{ color: COLOR_SECONDARY_TEXT }}>
                      {cuisinesStr}
                    </p>

                    {/* Distance & Locality */}
                    <div className="flex items-center gap-1 text-[10.5px] truncate" style={{ color: COLOR_SECONDARY_TEXT }}>
                      <MapPin className="w-3 h-3 shrink-0" style={{ color: COLOR_PRIMARY_GREEN }} />
                      <span className="truncate">
                        {r.distance ? `${r.distance.toFixed(1)} km · ` : '1.2 km · '}
                        {locality}
                      </span>
                    </div>

                    {/* Price for two */}
                    <p className="text-[11px] font-extrabold" style={{ color: COLOR_PRIMARY_TEXT }}>
                      {r.priceRange || '₹500 for two'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FILTER DRAWER MODAL */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Refine Dining Choices"
        variant="light"
        className="max-w-md bg-white border border-[#DDE7D8]"
      >
        <div className="space-y-4 text-left text-xs min-w-0">
          <div className="space-y-1">
            <label className="text-[9.5px] font-extrabold uppercase" style={{ color: COLOR_SECONDARY_TEXT }}>Cuisine Type</label>
            <select 
              value={selectedCuisineFilter} 
              onChange={e => setSelectedCuisineFilter(e.target.value)}
              className="w-full bg-[#F8F8F0] border text-[#17251C] p-2.5 rounded-xl focus:outline-none"
              style={{ borderColor: COLOR_BORDER }}
            >
              <option value="All">All Cuisines</option>
              <option value="biryani">Biryani</option>
              <option value="north indian">North Indian</option>
              <option value="south indian">South Indian</option>
              <option value="chinese">Chinese</option>
              <option value="pizza">Pizza</option>
              <option value="dessert">Desserts</option>
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t" style={{ borderColor: COLOR_BORDER }}>
            <span className="text-[9.5px] font-extrabold uppercase" style={{ color: COLOR_SECONDARY_TEXT }}>Quick Toggles</span>
            <div className="grid grid-cols-1 min-[280px]:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowOpenNow(!showOpenNow)}
                className={`py-2 px-3 border rounded-xl font-bold flex items-center justify-between transition-all min-w-0 ${
                  showOpenNow ? 'border-[#2E8B3C] font-extrabold' : ''
                }`}
                style={{ 
                  backgroundColor: showOpenNow ? COLOR_LIGHT_GREEN : '#FFFFFF',
                  borderColor: showOpenNow ? COLOR_PRIMARY_GREEN : COLOR_BORDER,
                  color: showOpenNow ? COLOR_DEEP_GREEN : COLOR_PRIMARY_TEXT 
                }}
              >
                <span className="truncate">Open Now</span>
                {showOpenNow && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_PRIMARY_GREEN }} />}
              </button>

              <button
                type="button"
                onClick={() => setShowTopRated(!showTopRated)}
                className={`py-2 px-3 border rounded-xl font-bold flex items-center justify-between transition-all min-w-0 ${
                  showTopRated ? 'border-[#2E8B3C] font-extrabold' : ''
                }`}
                style={{ 
                  backgroundColor: showTopRated ? COLOR_LIGHT_GREEN : '#FFFFFF',
                  borderColor: showTopRated ? COLOR_PRIMARY_GREEN : COLOR_BORDER,
                  color: showTopRated ? COLOR_DEEP_GREEN : COLOR_PRIMARY_TEXT 
                }}
              >
                <span className="truncate">Top Rated (4.0+)</span>
                {showTopRated && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR_PRIMARY_GREEN }} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col min-[280px]:flex-row gap-2 pt-4 border-t" style={{ borderColor: COLOR_BORDER }}>
            <button
              type="button"
              onClick={() => {
                setSelectedCuisineFilter('All');
                setShowOpenNow(false);
                setShowTopRated(false);
                setIsFilterModalOpen(false);
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 border rounded-xl text-xs font-bold text-[#65736A] transition-colors cursor-pointer text-center"
            >
              Reset All
            </button>
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="flex-1 py-2.5 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer text-center"
              style={{ backgroundColor: COLOR_PRIMARY_GREEN }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Modal>

      {/* LOCATION SELECTION MODAL */}
      <Modal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        title="Choose Dining Location"
        variant="light"
        className="max-w-md bg-white border border-[#DDE7D8]"
      >
        <div className="space-y-3.5 sm:space-y-4 text-left text-xs min-w-0">
          <button
            onClick={() => {
              handleDetectLocation(false);
              setIsLocationModalOpen(false);
            }}
            className="w-full p-2.5 min-[320px]:p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs text-[11px] min-[320px]:text-xs leading-snug"
            style={{ backgroundColor: COLOR_LIGHT_GREEN, borderColor: COLOR_PRIMARY_GREEN, color: COLOR_DEEP_GREEN }}
          >
            <Locate className="w-4 h-4 shrink-0" style={{ color: COLOR_PRIMARY_GREEN }} />
            <span className="min-w-0">Detect My Current Location (GPS)</span>
          </button>

          <div className="space-y-2 pt-2 border-t" style={{ borderColor: COLOR_BORDER }}>
            <span className="text-[9.5px] font-extrabold uppercase" style={{ color: COLOR_SECONDARY_TEXT }}>Popular Cities</span>
            <div className="grid grid-cols-1 min-[260px]:grid-cols-2 min-[420px]:grid-cols-3 gap-1.5">
              {POPULAR_CITIES.map((city) => (
                <button
                  key={city.name}
                  onClick={() => {
                    const selected = {
                      country: 'India',
                      state: '',
                      city: city.name,
                      area: 'All Areas',
                      latitude: city.lat,
                      longitude: city.lng,
                      label: `${city.name}, India`
                    };
                    handleSelectLocation(selected);
                  }}
                  className={`py-2 px-1 border rounded-xl font-bold text-center transition-all min-w-0 block cursor-pointer text-[11px] min-[320px]:text-xs truncate ${
                    currentLocation?.city.toLowerCase() === city.name.toLowerCase()
                      ? 'border-[#2E8B3C] font-extrabold shadow-xs'
                      : 'hover:border-[#2E8B3C]/50'
                  }`}
                  style={{
                    backgroundColor: currentLocation?.city.toLowerCase() === city.name.toLowerCase() ? COLOR_LIGHT_GREEN : '#FFFFFF',
                    borderColor: currentLocation?.city.toLowerCase() === city.name.toLowerCase() ? COLOR_PRIMARY_GREEN : COLOR_BORDER,
                    color: currentLocation?.city.toLowerCase() === city.name.toLowerCase() ? COLOR_DEEP_GREEN : COLOR_PRIMARY_TEXT
                  }}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* REAL CAMERA QR SCANNER MODAL */}
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
      />

      {/* Leave Table Confirmation Modal */}
      {showLeaveModal && activeSession && (
        <Modal
          isOpen={showLeaveModal}
          onClose={() => !isLeavingTable && setShowLeaveModal(false)}
          title={`Leave Table #${activeSession.tableNumber}?`}
          variant="light"
          className="max-w-md bg-white border border-[#DDE7D8]"
        >
          <div className="p-3 sm:p-4 space-y-4 text-left min-w-0">
            <p className="text-sm text-[#65736A] leading-relaxed">
              You are about to end your dining session at <strong className="text-[#17251C]">{activeSession.restaurantName || 'the restaurant'}</strong>.
            </p>
            <p className="text-xs text-[#65736A]">
              This will release your table and alert the waitstaff to sanitize it for the next guests. Your past orders and receipts will remain accessible in <strong>My Orders</strong>.
            </p>
            <div className="flex flex-col min-[320px]:flex-row items-stretch min-[320px]:items-center justify-end gap-2 pt-2 border-t border-[#DDE7D8]">
              <button
                type="button"
                disabled={isLeavingTable}
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#17251C] bg-white border border-[#DDE7D8] hover:bg-slate-50 transition-colors text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLeavingTable}
                onClick={handleLeaveTable}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#C53030] hover:bg-[#9B2C2C] transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                {isLeavingTable ? 'Releasing Table...' : 'Leave Table'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default CustomerHome;
