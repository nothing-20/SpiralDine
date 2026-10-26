import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { ITenant } from '../../../types';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { RestaurantGridCardSkeleton } from '../components/CustomerSkeletons';
import { 
  Star, MapPin, Clock, Compass, Filter, Grid, Flame, 
  Sparkles, CheckCircle2, ChevronDown, Check, X, ShieldAlert, Search
} from 'lucide-react';

export const RestaurantDiscovery: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL Param integrations
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || 'All';

  // Data state
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeCuisine, setActiveCuisine] = useState(initialCategory);
  const [activePrice, setActivePrice] = useState<string>('all');
  const [activeDistance, setActiveDistance] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>('rating');
  const [showVegOnly, setShowVegOnly] = useState(false);
  const [showOpenNow, setShowOpenNow] = useState(false);
  
  // Facilities filters
  const [facilities, setFacilities] = useState<Record<string, boolean>>({
    outdoorSeating: false,
    liveMusic: false,
    petFriendly: false,
    wheelchairAccess: false
  });

  const toggleFacility = (key: string) => {
    setFacilities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch list of restaurants
  useEffect(() => {
    const fetchRestaurantsList = async () => {
      setIsLoading(true);
      try {
        const colSnap = await getDocs(collection(db, 'tenants'));
        const list: any[] = [];
        colSnap.forEach(d => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.restaurantName || data.name || 'Restaurant',
            cuisine: data.cuisine || 'Multi-Cuisine',
            rating: typeof data.rating === 'number' ? data.rating : null,
            distance: typeof data.distanceNum === 'number' ? data.distanceNum : null,
            priceRange: data.priceRange || null,
            vegOptions: data.vegOptions !== undefined ? data.vegOptions : true,
            openNow: data.status === 'active',
            image: data.coverImage || data.coverImageUrl || data.logo || data.logoUrl || null,
            city: data.address?.city || data.city || '',
            street: data.address?.street || data.street || '',
            googleMapsUrl: data.googleMapsUrl || '',
            currencySymbol: data.currencySymbol || '₹',
            facilities: data.facilities || {}
          });
        });

        setRestaurants(list);
      } catch (e) {
        console.error('Error fetching restaurants for RestaurantDiscovery:', e);
        setRestaurants([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRestaurantsList();
  }, []);

  // Compute filtered & sorted lists in memory
  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];

    // 1. Text Search matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.cuisine.toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.street && r.street.toLowerCase().includes(q))
      );
    }

    // 2. Cuisine filter
    if (activeCuisine !== 'All') {
      result = result.filter(r => r.cuisine.toLowerCase().includes(activeCuisine.toLowerCase()));
    }

    // 3. Price Range filter
    if (activePrice !== 'all') {
      result = result.filter(r => r.priceRange === activePrice);
    }

    // 4. Distance limit filter - only if distance is available
    if (activeDistance < 10) {
      result = result.filter(r => r.distance === null || r.distance <= activeDistance);
    }

    // 5. Veg Options only
    if (showVegOnly) {
      result = result.filter(r => r.vegOptions);
    }

    // 6. Open Now only
    if (showOpenNow) {
      result = result.filter(r => r.openNow);
    }

    // 7. Facilities toggles
    Object.keys(facilities).forEach(key => {
      if (facilities[key]) {
        result = result.filter(r => r.facilities && r.facilities[key]);
      }
    });

    // 8. Sorting
    if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'distance') {
      result.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    return result;
  }, [restaurants, searchQuery, activeCuisine, activePrice, activeDistance, sortBy, showVegOnly, showOpenNow, facilities]);

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto">
      
      {/* Search Header banner */}
      <div className="space-y-1">
        <h2 className="text-xl font-display font-extrabold text-white">Find Your Dining Space</h2>
        <p className="text-xs text-slate-400">Apply filters to find the perfect restaurant matching your occasion.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* LEFT COLUMN - FILTER BAR SHELF */}
        <div className="w-full lg:w-[260px] bg-slate-900/50 border border-slate-900/80 p-5 rounded-2xl space-y-5 backdrop-blur-md shrink-0">
          
          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
            <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Advanced Filters
            </span>
            <button 
              onClick={() => {
                setActiveCuisine('All');
                setActivePrice('all');
                setActiveDistance(5);
                setShowVegOnly(false);
                setShowOpenNow(false);
                setFacilities({ outdoorSeating: false, liveMusic: false, petFriendly: false, wheelchairAccess: false });
              }}
              className="text-[9.5px] text-primary font-bold hover:underline cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Cuisine Filters */}
          <div className="space-y-2">
            <label className="text-[10.5px] text-slate-400 font-bold block">Cuisine Category</label>
            <div className="flex flex-wrap gap-1.5">
              {['All', 'French', 'Japanese', 'Italian', 'American'].map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCuisine(c)}
                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                    activeCuisine === c
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Price Filters */}
          <div className="space-y-2">
            <label className="text-[10.5px] text-slate-400 font-bold block">Price range</label>
            <div className="grid grid-cols-4 gap-1.5">
              {['all', '$', '$$', '$$$'].map((pr) => (
                <button
                  key={pr}
                  onClick={() => setActivePrice(pr)}
                  className={`py-1.5 border text-[10px] font-extrabold rounded-xl transition-all text-center ${
                    activePrice === pr
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-slate-950/40 border-slate-850 text-slate-400'
                  }`}
                >
                  {pr.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Filter Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10.5px] text-slate-450 font-bold">
              <span>Distance Radius</span>
              <span className="text-primary">{activeDistance} miles</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={activeDistance}
              onChange={(e) => setActiveDistance(Number(e.target.value))}
              className="w-full accent-primary bg-slate-950 rounded-lg cursor-pointer border border-slate-850"
            />
          </div>

          {/* Quick Dietary toggles */}
          <div className="space-y-2">
            <label className="text-[10.5px] text-slate-400 font-bold block">Dietary & Status</label>
            <div className="space-y-2 text-xs text-slate-350">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showVegOnly} 
                  onChange={(e) => setShowVegOnly(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-850 text-primary" 
                />
                <span className="text-[10.5px]">Vegetarian Options</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showOpenNow} 
                  onChange={(e) => setShowOpenNow(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-850 text-primary" 
                />
                <span className="text-[10.5px]">Open Now</span>
              </label>
            </div>
          </div>

          {/* Facilities filters */}
          <div className="space-y-2">
            <label className="text-[10.5px] text-slate-400 font-bold block">Amenities & Vibe</label>
            <div className="space-y-2 text-xs text-slate-350">
              {[
                { key: 'outdoorSeating', label: 'Outdoor Seating' },
                { key: 'liveMusic', label: 'Live Music' },
                { key: 'petFriendly', label: 'Pet Friendly' },
                { key: 'wheelchairAccess', label: 'Wheelchair Access' }
              ].map((f) => (
                <label key={f.key} className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={facilities[f.key]} 
                    onChange={() => toggleFacility(f.key)}
                    className="rounded bg-slate-950 border-slate-850 text-primary" 
                  />
                  <span className="text-[10.5px]">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN - SEARCH BOX & RESTAURANTS GRID */}
        <div className="flex-1 space-y-5 w-full">
          
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search restaurant names, cuisines, cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10.5 pr-4 py-3 bg-slate-900/40 border border-slate-900/60 rounded-xl text-xs text-white focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all shadow-inner"
              />
            </div>
            
            {/* Sort Switcher */}
            <div className="flex items-center space-x-2 self-end md:self-auto">
              <span className="text-[10.5px] text-slate-500 font-bold uppercase whitespace-nowrap">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-900 border border-slate-850 text-[10.5px] py-1.5 px-3 rounded-xl font-bold text-slate-300 focus:outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="rating">Top Rated ⭐</option>
                <option value="distance">Nearest 📍</option>
              </select>
            </div>
          </div>

          {/* Grid list results */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(idx => (
                <RestaurantGridCardSkeleton key={idx} />
              ))}
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/20 border border-slate-900 rounded-2xl space-y-4">
              <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto" />
              <div>
                <h4 className="text-sm font-extrabold text-slate-205">No Restaurants Match Filters</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">Try resetting some checkbox parameters or searching with a different cuisine tag.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((r) => (
                <Card 
                  key={r.id} 
                  onClick={() => navigate(`/customer/restaurant/${r.id}`)}
                  className="group bg-slate-900/20 border-slate-850 hover:border-slate-850 rounded-2xl overflow-hidden cursor-pointer transition-all flex flex-row md:flex-col justify-between shadow-lg"
                >
                  <div className="w-28 sm:w-36 md:w-full h-28 sm:h-36 md:h-36 shrink-0 overflow-hidden relative bg-slate-950 flex items-center justify-center">
                    {r.image ? (
                      <img src={r.image} alt={r.name} className="h-full w-full object-cover group-hover:scale-103 transition-all duration-300" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-sm">
                        {r.name ? r.name.charAt(0).toUpperCase() : 'R'}
                      </div>
                    )}
                    {r.rating !== null && (
                      <div className="absolute top-2 right-2 md:top-2.5 md:right-2.5 bg-slate-950/80 backdrop-blur-md px-1.5 md:px-2 py-0.5 rounded-lg border border-slate-800 text-[9px] text-slate-350 flex items-center gap-0.5 font-bold">
                        <Star className="w-2.5 h-2.5 text-primary fill-current" /> {r.rating}
                      </div>
                    )}
                  </div>
                  <div className="p-3 md:p-4 space-y-2 md:space-y-3 flex-1 min-w-0">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold text-white group-hover:text-primary transition-all truncate">{r.name}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold truncate">{r.cuisine}</p>
                      {r.street && <p className="text-[9.5px] text-slate-450 truncate">{r.street}</p>}
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-450 pt-2 border-t border-slate-900">
                      <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        {r.distance !== null ? `${r.distance.toFixed(1)} mi` : (r.street || r.city || 'Hyderabad')}
                      </span>
                      <div className="flex space-x-1 items-center">
                        {r.priceRange && (
                          <span className="text-slate-450 uppercase font-extrabold text-[8px] bg-slate-950/40 py-0.5 px-1.5 rounded border border-slate-900">{r.priceRange}</span>
                        )}
                        {r.openNow ? (
                          <Badge variant="success" className="text-[7.5px] uppercase font-bold py-0.5 px-1 border-0">Open</Badge>
                        ) : (
                          <Badge variant="muted" className="text-[7.5px] uppercase font-bold py-0.5 px-1 border-0">Closed</Badge>
                        )}
                      </div>
                    </div>
                    {r.googleMapsUrl && (
                      <div className="pt-0.5 hidden md:block">
                        <a
                          href={r.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-[9.5px] text-primary hover:underline font-bold"
                        >
                          <MapPin className="w-3 h-3 mr-0.5" /> View on Maps
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default RestaurantDiscovery;
