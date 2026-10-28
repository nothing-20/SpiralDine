import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import Badge from '../../../components/ui/Badge/Badge';
import { 
  Star, MapPin, Search, X, RotateCcw, 
  ExternalLink, Utensils, Compass, ArrowUpDown, 
  ChevronDown, SlidersHorizontal, AlertCircle, Heart, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import ErrorBoundary from '../../../shared/ui/feedback/ErrorBoundary';
import { 
  RestaurantFilterState, 
  INITIAL_FILTER_STATE, 
  DEFAULT_COST_RANGE,
  SortOption 
} from '../types/restaurantFilters';
import { getCurrencySymbol } from '../../../shared/utils/format';
import { 
  FilterableRestaurant, 
  evaluateRestaurantFilters, 
  sortRestaurants, 
  countActiveFilters, 
  getActiveFilterTags,
  calculateHaversineDistanceKm,
  estimateCostForTwo
} from '../utils/restaurantFilters';
import { RestaurantFilterModal } from '../components/filters/RestaurantFilterModal';

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
    if (new RegExp(`\\b${area.replace(/\\s+/g, '\\s+')}\\b`, 'i').test(street)) {
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

const DEFAULT_LOCATION = {
  country: 'India',
  state: 'Telangana',
  city: 'Hyderabad',
  area: 'All Areas',
  latitude: 17.3850,
  longitude: 78.4867,
  label: 'Hyderabad, Telangana'
};

function getSafeLocation() {
  try {
    const saved = localStorage.getItem('diner_location');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.city === 'string' && parsed.city.trim().length > 0) {
        return {
          country: typeof parsed.country === 'string' ? parsed.country : 'India',
          state: typeof parsed.state === 'string' ? parsed.state : 'Telangana',
          city: parsed.city.trim(),
          area: typeof parsed.area === 'string' ? parsed.area.trim() : 'All Areas',
          latitude: typeof parsed.latitude === 'number' ? parsed.latitude : 17.3850,
          longitude: typeof parsed.longitude === 'number' ? parsed.longitude : 78.4867,
          label: typeof parsed.label === 'string' ? parsed.label : `${parsed.city}, India`
        };
      }
    }
  } catch (err) {
    console.warn('[Explore] Failed to parse diner_location from localStorage:', err);
  }
  return DEFAULT_LOCATION;
}

const DiscoverPageInner: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL parameters
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialArea = searchParams.get('area') || 'All Areas';

  // Location Hub State (Unified single source of truth from localStorage with safe fallback)
  const [currentLocation, setCurrentLocation] = useState(getSafeLocation);

  // Primary Data States
  const [restaurantsList, setRestaurantsList] = useState<FilterableRestaurant[]>(() => {
    try {
      const cached = (window as any)?.__cachedTenants;
      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    } catch (_) {}
    return [];
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const cached = (window as any)?.__cachedTenants;
      return !(Array.isArray(cached) && cached.length > 0);
    } catch (_) {
      return true;
    }
  });

  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Area Filter States
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedArea, setSelectedArea] = useState(initialArea);

  // Comprehensive Filter State
  const [filters, setFilters] = useState<RestaurantFilterState>(() => {
    const base = { ...INITIAL_FILTER_STATE };
    if (initialCategory && initialCategory !== 'All') {
      base.cuisines = [initialCategory];
    }
    return base;
  });

  // Filter Drawer / Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Favourites list stored in localStorage
  const [favourites, setFavourites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('diner_favourites');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      }
    } catch (_) {}
    return [];
  });

  // Synchronize location changes from custom window events and storage
  useEffect(() => {
    const handleLocationChanged = () => {
      const loc = getSafeLocation();
      setCurrentLocation(loc);
    };

    window.addEventListener('diner_location_changed', handleLocationChanged);
    window.addEventListener('storage', handleLocationChanged);

    return () => {
      window.removeEventListener('diner_location_changed', handleLocationChanged);
      window.removeEventListener('storage', handleLocationChanged);
    };
  }, []);

  // Update internal search query when URL param changes
  useEffect(() => {
    const s = searchParams.get('search');
    if (s !== null && s !== searchQuery) {
      setSearchQuery(s);
    }
    const c = searchParams.get('category');
    if (c && c !== 'All' && !filters.cuisines.includes(c)) {
      setFilters(prev => ({ ...prev, cuisines: [c] }));
    }
  }, [searchParams]);

  // Stream real Firestore tenants in real-time
  const loadTenants = useCallback(() => {
    setIsLoading(prev => restaurantsList.length === 0 ? true : prev);
    setLoadError(null);

    try {
      const qTenants = query(collection(db, 'tenants'), limit(50));
      const unsubscribe = onSnapshot(qTenants, (snap) => {
        const list: FilterableRestaurant[] = [];
        
        snap.forEach(d => {
          try {
            const data = d.data();
            if (!data) return;
            
            // Exclude suspended / inactive accounts only
            const status = String(data.status || 'active').toLowerCase();
            if (status === 'suspended' || status === 'inactive') {
              return;
            }

            const city = String(data.address?.city || data.city || 'Hyderabad').trim();
            const state = String(data.address?.state || data.state || 'Telangana').trim();
            const country = String(data.address?.country || data.country || 'India').trim();
            const street = String(data.address?.street || data.street || '').trim();
            const area = String(data.area || data.address?.area || extractAreaFromAddress(street, city)).trim();

            const currency = String(data.currency || data.settings?.currency || 'INR');
            const currencySymbol = String(data.currencySymbol || data.settings?.currencySymbol || getCurrencySymbol(currency));

            // Safe cuisine string formatting
            let cuisineStr = 'Multi-Cuisine';
            if (Array.isArray(data.cuisine)) {
              cuisineStr = data.cuisine.filter(Boolean).join(' / ');
            } else if (typeof data.cuisine === 'string' && data.cuisine.trim().length > 0) {
              cuisineStr = data.cuisine.trim();
            }

            // Safe rating parsing
            let numRating: number | null = null;
            if (typeof data.rating === 'number' && !isNaN(data.rating)) {
              numRating = data.rating;
            } else if (typeof data.rating === 'string') {
              const p = parseFloat(data.rating);
              if (!isNaN(p)) numRating = p;
            }

            // Safe reviewsCount parsing
            let numReviews: number | null = null;
            if (typeof data.reviewsCount === 'number' && !isNaN(data.reviewsCount)) {
              numReviews = data.reviewsCount;
            } else if (typeof data.reviewsCount === 'string') {
              const p = parseInt(data.reviewsCount, 10);
              if (!isNaN(p)) numReviews = p;
            }

            // Safe cost for two parsing
            let numCost: number | null = null;
            if (typeof data.costForTwo === 'number' && !isNaN(data.costForTwo)) {
              numCost = data.costForTwo;
            } else if (typeof data.cost_for_two === 'number' && !isNaN(data.cost_for_two)) {
              numCost = data.cost_for_two;
            } else if (typeof data.averageCost === 'number' && !isNaN(data.averageCost)) {
              numCost = data.averageCost;
            }

            list.push({
              id: d.id,
              name: String(data.restaurantName || data.name || 'Restaurant').trim(),
              cuisine: cuisineStr,
              rating: numRating,
              reviewsCount: numReviews,
              priceRange: String(data.priceRange || '₹₹'),
              costForTwo: numCost,
              vegOptions: data.vegOptions !== undefined ? Boolean(data.vegOptions) : true,
              nonVegOptions: data.nonVegOptions !== undefined ? Boolean(data.nonVegOptions) : true,
              openNow: status === 'active' || data.openNow !== false,
              isFeatured: Boolean(data.isFeatured),
              isTrending: Boolean(data.isTrending),
              isNew: Boolean(data.isNew || data.newlyOpened),
              hasOffer: Boolean(data.hasOffer || data.discountPercent || (Array.isArray(data.offers) && data.offers.length > 0)),
              discountPercent: typeof data.discountPercent === 'number' ? data.discountPercent : null,
              offers: Array.isArray(data.offers) ? data.offers : (data.offer ? [data.offer] : []),
              image: data.coverImageUrl || data.coverImage || null,
              logoUrl: data.logoUrl || data.logo || null,
              city,
              state,
              country,
              area,
              street,
              address: data.address || null,
              googleMapsUrl: typeof data.googleMapsUrl === 'string' ? data.googleMapsUrl : null,
              description: String(data.description || ''),
              currency,
              currencySymbol,
              latitude: typeof data.latitude === 'number' ? data.latitude : null,
              longitude: typeof data.longitude === 'number' ? data.longitude : null,
              facilities: data.facilities || null,
              accessibility: data.accessibility || null,
              experience: data.experience || null,
              dietary: data.dietary || null,
              ambience: data.ambience || null,
              businessHours: data.businessHours || null,
              hours: data.hours || null,
              isPureVeg: Boolean(data.isPureVeg || data.pureVeg),
              newlyOpened: Boolean(data.newlyOpened),
              partyFriendly: Boolean(data.partyFriendly),
              newlyListed: Boolean(data.newlyListed)
            });
          } catch (itemErr) {
            console.error('[Explore] Error processing tenant document:', d.id, itemErr);
          }
        });

        setRestaurantsList(list);
        try {
          (window as any).__cachedTenants = list;
        } catch (_) {}
        setIsLoading(false);
      }, (error) => {
        console.error('[Explore] runtime error in Firestore subscription:', error);
        setLoadError('Unable to load restaurants. Please check your network connection.');
        setIsLoading(false);
      });

      return unsubscribe;
    } catch (subErr) {
      console.error('[Explore] runtime error creating Firestore query:', subErr);
      setLoadError('Unable to connect to database.');
      setIsLoading(false);
      return () => {};
    }
  }, [restaurantsList.length]);

  useEffect(() => {
    const unsub = loadTenants();
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [loadTenants]);

  const toggleFavourite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavourites(prev => {
      const updated = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      try {
        localStorage.setItem('diner_favourites', JSON.stringify(updated));
      } catch (_) {}
      toast.success(prev.includes(id) ? 'Removed from favorites' : 'Added to favorites', { icon: '❤️' });
      return updated;
    });
  };

  // Trigger global location modal
  const openLocationModal = () => {
    window.dispatchEvent(new Event('open_location_modal'));
  };

  // Base list of restaurants in current city
  const cityRestaurants = useMemo(() => {
    if (!currentLocation || !currentLocation.city || currentLocation.city === 'All Cities') {
      return restaurantsList;
    }
    const curCity = String(currentLocation.city).toLowerCase().trim();
    return restaurantsList.filter(r => {
      const rCity = String(r.city || '').toLowerCase().trim();
      return rCity === curCity || rCity.includes(curCity) || curCity.includes(rCity);
    });
  }, [restaurantsList, currentLocation]);

  // Dynamic list of cuisines extracted from current city's restaurants
  const availableCuisines = useMemo(() => {
    const set = new Set<string>();
    
    cityRestaurants.forEach(r => {
      if (typeof r.cuisine === 'string') {
        r.cuisine.split(/[/,]/).forEach((c: string) => {
          const clean = c.trim();
          if (clean.length > 2 && clean.length < 32) {
            set.add(clean);
          }
        });
      }
    });

    return ['All', ...Array.from(set).sort()];
  }, [cityRestaurants]);

  // Dynamic list of areas extracted from current city's restaurants
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    const currentCity = String(currentLocation?.city || 'Hyderabad').toLowerCase().trim();

    cityRestaurants.forEach(r => {
      if (r.area && r.area !== 'All Areas' && String(r.area).toLowerCase().trim() !== currentCity) {
        set.add(r.area);
      }
    });

    return ['All Areas', ...Array.from(set).sort()];
  }, [cityRestaurants, currentLocation]);

  // Universal Filtered & Sorted Restaurant Set
  const filteredRestaurants = useMemo(() => {
    let result = [...cityRestaurants];

    // 1. Area Filter:
    const curCity = String(currentLocation?.city || 'Hyderabad').toLowerCase().trim();
    const locArea = currentLocation?.area && currentLocation.area !== 'All Areas' && String(currentLocation.area).toLowerCase().trim() !== curCity
      ? currentLocation.area 
      : 'All Areas';

    const activeAreaFilter = selectedArea !== 'All Areas' ? selectedArea : locArea;

    if (activeAreaFilter !== 'All Areas') {
      const targetArea = String(activeAreaFilter).toLowerCase().trim();
      result = result.filter(r => {
        const rArea = String(r.area || '').toLowerCase();
        const rStreet = String(r.street || '').toLowerCase();
        return rArea.includes(targetArea) || rStreet.includes(targetArea);
      });
    }

    // 2. Search Query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const matchesName = String(r.name || '').toLowerCase().includes(q);
        const matchesCuisine = String(r.cuisine || '').toLowerCase().includes(q);
        const matchesArea = String(r.area || '').toLowerCase().includes(q);
        const matchesCity = String(r.city || '').toLowerCase().includes(q);
        const matchesStreet = String(r.street || '').toLowerCase().includes(q);
        const matchesDescription = String(r.description || '').toLowerCase().includes(q);
        return matchesName || matchesCuisine || matchesArea || matchesCity || matchesStreet || matchesDescription;
      });
    }

    // 3. Multi-Category Advanced Filters Evaluation
    result = result.filter(r => evaluateRestaurantFilters(r, filters, currentLocation));

    // 4. Sorting
    result = sortRestaurants(result, filters.sortBy, currentLocation);

    return result;
  }, [
    cityRestaurants, 
    currentLocation, 
    selectedArea, 
    searchQuery, 
    filters
  ]);

  // Count of active filters for drawer badge
  const totalActiveFilterCount = useMemo(() => {
    let count = countActiveFilters(filters);
    if (selectedArea !== 'All Areas') count++;
    return count;
  }, [filters, selectedArea]);

  // Active filter tags for quick 1-click removal pills
  const activeTags = useMemo(() => {
    return getActiveFilterTags(filters, setFilters);
  }, [filters]);

  const clearAllFilters = () => {
    setFilters(INITIAL_FILTER_STATE);
    setSelectedArea('All Areas');
    setSearchQuery('');
    setSearchParams({});
    toast.success('All filters reset');
  };

  const currentCityName = currentLocation?.city || 'Hyderabad';

  return (
    <div className="w-full min-h-[60vh] space-y-6 text-left max-w-6xl mx-auto pb-24 select-none">
      
      {/* 1. Header Bar: Title, Contextual Location Badge & Search Bar */}
      <div className="bg-white border border-[#F3E8DF] rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-[#F3E8DF] text-[#C85A3F]">
                <Compass className="w-5 h-5" />
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#202124] tracking-tight font-display">
                Explore Restaurants
              </h1>
            </div>
            <p className="text-xs md:text-sm text-[#756B64] font-medium pl-0.5">
              Discover verified dining venues and gourmet cuisines across <span className="font-bold text-[#202124]">{currentCityName}</span>.
            </p>
          </div>

          {/* Unified Location Indicator */}
          <button
            type="button"
            onClick={openLocationModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#FCFAF7] border border-[#F3E8DF] hover:border-[#C85A3F]/50 rounded-2xl transition-all group shadow-2xs cursor-pointer"
            title="Change Dining City or Area"
          >
            <MapPin className="w-4 h-4 text-[#C85A3F] shrink-0" />
            <span className="text-xs font-bold text-[#202124] group-hover:text-[#C85A3F] transition-colors">
              {currentLocation?.label || currentCityName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#756B64] group-hover:text-[#C85A3F] transition-colors" />
          </button>
        </div>

        {/* Search Bar & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C85A3F]" />
            <input 
              type="text" 
              placeholder="Search by restaurant name, cuisine, dish or area..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) {
                  setSearchParams({ search: e.target.value });
                } else {
                  const p = new URLSearchParams(searchParams);
                  p.delete('search');
                  setSearchParams(p);
                }
              }}
              className="w-full pl-11 pr-10 py-3 bg-[#FCFAF7] border border-[#F3E8DF] focus:border-[#C85A3F] focus:bg-white rounded-2xl text-xs md:text-sm text-[#202124] placeholder-[#756B64] transition-all outline-none shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  const p = new URLSearchParams(searchParams);
                  p.delete('search');
                  setSearchParams(p);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#756B64] hover:text-[#202124] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Quick Area Dropdown */}
            {availableAreas.length > 1 && (
              <div className="relative flex-1 sm:flex-initial">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full sm:w-44 px-3.5 py-3 bg-[#FCFAF7] border border-[#F3E8DF] hover:border-[#C85A3F]/50 rounded-2xl text-xs font-bold text-[#202124] outline-none cursor-pointer appearance-none pr-8 transition-colors shadow-2xs"
                >
                  {availableAreas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#756B64] pointer-events-none" />
              </div>
            )}

            {/* Advanced Filters Button */}
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className="px-4 py-3 bg-[#FCFAF7] border border-[#F3E8DF] hover:border-[#C85A3F]/50 text-xs font-bold text-[#202124] rounded-2xl transition-all flex items-center gap-2 shadow-2xs cursor-pointer relative shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#C85A3F]" />
              <span>Filters</span>
              {totalActiveFilterCount > 0 && (
                <span className="w-5 h-5 bg-[#C85A3F] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center">
                  {totalActiveFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 2. Horizontal Cuisine Chips */}
        <div className="space-y-2 pt-2 border-t border-[#F3E8DF]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold uppercase tracking-wider text-[#756B64] text-[11px]">
              Cuisines
            </span>
            {filters.cuisines.length > 0 && (
              <button 
                type="button"
                onClick={() => setFilters(prev => ({ ...prev, cuisines: [] }))}
                className="text-[#C85A3F] font-bold hover:underline cursor-pointer text-[11px]"
              >
                Clear Cuisines ({filters.cuisines.length})
              </button>
            )}
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {availableCuisines.map((c) => {
              const isAll = c.toLowerCase() === 'all';
              const isSelected = isAll 
                ? filters.cuisines.length === 0 
                : filters.cuisines.some(x => x.toLowerCase() === c.toLowerCase());
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    if (isAll) {
                      setFilters(prev => ({ ...prev, cuisines: [] }));
                    } else {
                      setFilters(prev => {
                        const exists = prev.cuisines.some(x => x.toLowerCase() === c.toLowerCase());
                        const updated = exists 
                          ? prev.cuisines.filter(x => x.toLowerCase() !== c.toLowerCase()) 
                          : [...prev.cuisines, c];
                        return { ...prev, cuisines: updated };
                      });
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs'
                      : 'bg-[#F3E8DF] border-[#F3E8DF] text-[#202124] hover:bg-[#EBDDD2]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Quick Feature Toggles Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Open Now Toggle */}
          <button
            type="button"
            onClick={() => {
              const isCurrentlyActive = filters.operatingHours.includes('open_now');
              setFilters(prev => ({
                ...prev,
                operatingHours: isCurrentlyActive 
                  ? prev.operatingHours.filter(h => h !== 'open_now') 
                  : [...prev.operatingHours, 'open_now']
              }));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              filters.operatingHours.includes('open_now')
                ? 'bg-[#2E8B57]/10 border-[#2E8B57] text-[#2E8B57]' 
                : 'bg-[#FCFAF7] border-[#F3E8DF] text-[#756B64] hover:border-[#C85A3F]/40 hover:text-[#202124]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filters.operatingHours.includes('open_now') ? 'bg-[#2E8B57]' : 'bg-[#756B64]'}`} />
            Open Now
          </button>

          {/* Top Rated (4.0+) Toggle */}
          <button
            type="button"
            onClick={() => {
              setFilters(prev => ({
                ...prev,
                minRating: prev.minRating === 4.0 ? null : 4.0
              }));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              filters.minRating === 4.0 
                ? 'bg-[#C85A3F]/10 border-[#C85A3F] text-[#C85A3F]' 
                : 'bg-[#FCFAF7] border-[#F3E8DF] text-[#756B64] hover:border-[#C85A3F]/40 hover:text-[#202124]'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${filters.minRating === 4.0 ? 'text-[#C85A3F] fill-current' : 'text-[#756B64]'}`} />
            Top Rated (4.0+)
          </button>

          {/* Pure Vegetarian Toggle */}
          <button
            type="button"
            onClick={() => {
              const isVeg = filters.dietary.includes('pure_veg');
              setFilters(prev => ({
                ...prev,
                dietary: isVeg ? prev.dietary.filter(d => d !== 'pure_veg') : [...prev.dietary, 'pure_veg']
              }));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              filters.dietary.includes('pure_veg')
                ? 'bg-[#2E8B57]/10 border-[#2E8B57] text-[#2E8B57]' 
                : 'bg-[#FCFAF7] border-[#F3E8DF] text-[#756B64] hover:border-[#C85A3F]/40 hover:text-[#202124]'
            }`}
          >
            🌱 Vegetarian
          </button>

          {/* Offers Toggle */}
          <button
            type="button"
            onClick={() => {
              const hasOfferFilter = filters.offers.length > 0;
              setFilters(prev => ({
                ...prev,
                offers: hasOfferFilter ? [] : ['10_percent']
              }));
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              filters.offers.length > 0
                ? 'bg-[#C85A3F]/10 border-[#C85A3F] text-[#C85A3F]' 
                : 'bg-[#FCFAF7] border-[#F3E8DF] text-[#756B64] hover:border-[#C85A3F]/40 hover:text-[#202124]'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Special Offers
          </button>

          {totalActiveFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#C85A3F] hover:bg-[#F3E8DF] transition-all flex items-center gap-1 cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> Clear Filters
            </button>
          )}
        </div>

        {/* 4. Active Filter Tags Pill Bar (Clickable Removals) */}
        {activeTags.length > 0 && (
          <div className="pt-2 border-t border-[#F3E8DF] space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#756B64]">
              <span className="font-extrabold uppercase text-[10px] tracking-wider">
                Applied Filters ({activeTags.length})
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-[#C85A3F] hover:underline cursor-pointer"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeTags.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={tag.onRemove}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCFAF7] border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-bold transition-all group shadow-2xs cursor-pointer"
                  title="Remove this filter"
                >
                  <span>{tag.label}</span>
                  <X className="w-3 h-3 text-[#756B64] group-hover:text-[#C85A3F] transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Results Header: Count & Sort */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-sm md:text-base font-extrabold text-[#202124] tracking-tight">
            Restaurants in {currentCityName}
          </h2>
          <p className="text-xs text-[#756B64] font-medium">
            {isLoading && restaurantsList.length === 0
              ? 'Loading restaurants...' 
              : `Showing ${filteredRestaurants.length} dining venue${filteredRestaurants.length === 1 ? '' : 's'}`
            }
          </p>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#756B64]" />
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as SortOption }))}
            className="bg-white border border-[#F3E8DF] text-xs font-bold text-[#202124] rounded-xl px-2.5 py-1.5 outline-none cursor-pointer hover:border-[#C85A3F]/50 transition-colors shadow-2xs"
          >
            <option value="relevance">Relevance / Featured</option>
            <option value="rating_desc">Rating: High to Low</option>
            <option value="rating_asc">Rating: Low to High</option>
            <option value="cost_asc">Cost: Low to High</option>
            <option value="cost_desc">Cost: High to Low</option>
            {currentLocation?.latitude && (
              <option value="distance">Distance: Near to Far</option>
            )}
          </select>
        </div>
      </div>

      {/* 6. Main Content: Loading, Error, Empty State, or Restaurant Grid */}
      {isLoading && restaurantsList.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white border border-[#E5DCD5] rounded-3xl overflow-hidden p-4 space-y-4 animate-pulse">
              <div className="h-44 bg-[#F3E8DF] rounded-2xl w-full" />
              <div className="space-y-2">
                <div className="h-4 bg-[#F3E8DF] rounded-md w-3/4" />
                <div className="h-3 bg-[#F3E8DF] rounded-md w-1/2" />
              </div>
              <div className="h-8 bg-[#F3E8DF] rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-white border border-[#F3E8DF] rounded-3xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#A94332]/10 text-[#A94332] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[#202124]">Unable to load restaurants</h3>
            <p className="text-xs text-[#756B64] max-w-md mx-auto">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => loadTenants()}
            className="px-6 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <div className="bg-white border border-[#F3E8DF] rounded-3xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#F3E8DF] text-[#C85A3F] flex items-center justify-center mx-auto">
            <Utensils className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[#202124]">No restaurants found</h3>
            <p className="text-xs text-[#756B64] max-w-md mx-auto">
              No dining venues match your current combination of filters. Try broadening your cuisine selection, adjusting your price range, or resetting filters.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-5 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs"
            >
              Clear All Filters
            </button>
            <button
              type="button"
              onClick={openLocationModal}
              className="px-5 py-2.5 bg-[#FCFAF7] border border-[#F3E8DF] hover:border-[#C85A3F]/50 text-[#202124] rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-2xs"
            >
              Change Location
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredRestaurants.map((r) => {
            const isFav = favourites.includes(r.id);
            const hasValidRating = typeof r.rating === 'number' && !isNaN(r.rating);
            const hasValidReviews = typeof r.reviewsCount === 'number' && !isNaN(r.reviewsCount) && r.reviewsCount > 0;
            const costAmount = estimateCostForTwo(r);

            // Distance calculation
            let distanceFormatted: string | null = null;
            if (currentLocation?.latitude && currentLocation?.longitude && r.latitude && r.longitude) {
              const km = calculateHaversineDistanceKm(
                currentLocation.latitude,
                currentLocation.longitude,
                r.latitude,
                r.longitude
              );
              distanceFormatted = `${km} km`;
            }

            return (
              <div
                key={r.id}
                onClick={() => navigate(`/customer/restaurant/${r.id}`)}
                className="group bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/60 rounded-3xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5"
              >
                {/* Visual Cover / Fallback Initial Badge */}
                <div className="h-44 w-full overflow-hidden relative bg-[#F3E8DF] flex items-center justify-center">
                  {r.image ? (
                    <img 
                      src={r.image} 
                      alt={r.name} 
                      className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4 select-none">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-[#E5DCD5] flex items-center justify-center text-[#C85A3F] font-extrabold text-base mb-1 shadow-inner">
                        {(r.name || 'R').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-extrabold text-[#202124] truncate max-w-[180px]">
                        {r.name}
                      </span>
                    </div>
                  )}

                  {/* Top Badges: Rating & Favorite */}
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none">
                    {hasValidRating ? (
                      <div className="bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full border border-[#E5DCD5] text-[10.5px] text-[#202124] flex items-center gap-1 font-extrabold shadow-xs pointer-events-auto">
                        <Star className="w-3.5 h-3.5 text-[#F4B942] fill-current" />
                        <span>{r.rating!.toFixed(1)}</span>
                        {hasValidReviews && (
                          <span className="text-[#756B64] font-medium text-[9.5px]">({r.reviewsCount})</span>
                        )}
                      </div>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      onClick={(e) => toggleFavourite(r.id, e)}
                      className="w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs border border-[#E5DCD5] flex items-center justify-center text-[#756B64] hover:text-[#C85A3F] transition-colors shadow-xs cursor-pointer pointer-events-auto"
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'text-[#C85A3F] fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Status Badge: Open Now & Offers */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 pointer-events-none">
                    {r.openNow ? (
                      <Badge className="bg-[#2E8B57] text-white border-0 text-[9.5px] font-extrabold px-2 py-0.5 shadow-xs">
                        Open Now
                      </Badge>
                    ) : (
                      <Badge className="bg-[#756B64] text-white border-0 text-[9.5px] font-extrabold px-2 py-0.5 shadow-xs">
                        Closed
                      </Badge>
                    )}

                    {r.hasOffer && (
                      <Badge className="bg-[#C85A3F] text-white border-0 text-[9.5px] font-extrabold px-2 py-0.5 shadow-xs flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />
                        Offer
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Card Information */}
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#202124] group-hover:text-[#C85A3F] transition-colors truncate">
                      {r.name}
                    </h3>
                    <p className="text-xs text-[#756B64] font-semibold mt-0.5 truncate">
                      {r.cuisine}
                    </p>
                  </div>

                  {/* Locality, Pricing & Distance */}
                  <div className="flex items-center justify-between text-xs text-[#756B64] pt-2 border-t border-[#F3E8DF]">
                    <div className="flex items-center gap-1 truncate max-w-[170px]" title={`${r.area || ''}, ${r.city}`}>
                      <MapPin className="w-3.5 h-3.5 text-[#C85A3F] shrink-0" />
                      <span className="truncate font-medium">{r.area || r.city}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {distanceFormatted && (
                        <span className="text-[10px] font-bold text-[#2E8B57] bg-[#2E8B57]/10 px-1.5 py-0.5 rounded">
                          {distanceFormatted}
                        </span>
                      )}
                      <span className="text-[10px] font-extrabold bg-[#F3E8DF] text-[#202124] px-2 py-0.5 rounded-md">
                        ₹{costAmount} for two
                      </span>
                    </div>
                  </div>

                  {/* Google Maps link if present */}
                  {r.googleMapsUrl && (
                    <div className="pt-0.5">
                      <a
                        href={r.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center text-[10.5px] text-[#C85A3F] hover:underline font-bold"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> View on Maps
                      </a>
                    </div>
                  )}

                  {/* Primary CTA */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => navigate(`/customer/restaurant/${r.id}`)}
                      className="w-full py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-2xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      View Restaurant
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Advanced Restaurant Discovery Filter Modal */}
      <RestaurantFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApply={(updatedFilters) => setFilters(updatedFilters)}
        onReset={() => {
          setFilters(INITIAL_FILTER_STATE);
          setSelectedArea('All Areas');
          setSearchQuery('');
        }}
        allRestaurants={cityRestaurants}
        availableCuisines={availableCuisines}
        userLocation={currentLocation}
        onOpenLocationModal={openLocationModal}
      />

    </div>
  );
};

export const DiscoverPage: React.FC = () => {
  return (
    <ErrorBoundary
      fallbackTitle="Explore failed to load"
      fallbackSubtitle="Something went wrong while opening restaurant discovery."
    >
      <DiscoverPageInner />
    </ErrorBoundary>
  );
};

export default DiscoverPage;
