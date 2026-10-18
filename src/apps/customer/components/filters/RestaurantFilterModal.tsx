import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, RotateCcw, Search, Check, 
  ArrowUpDown, Utensils, Star, IndianRupee, Percent, 
  Clock, MapPin, Leaf, Sparkles, Accessibility, 
  Building, Smile, Sliders, AlertCircle
} from 'lucide-react';
import { 
  RestaurantFilterState, 
  FILTER_CATEGORIES, 
  DEFAULT_COST_RANGE,
  INITIAL_FILTER_STATE,
  SortOption
} from '../../types/restaurantFilters';
import { 
  FilterableRestaurant, 
  evaluateRestaurantFilters, 
  countActiveFilters 
} from '../../utils/restaurantFilters';

interface RestaurantFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: RestaurantFilterState;
  onApply: (filters: RestaurantFilterState) => void;
  onReset: () => void;
  allRestaurants: FilterableRestaurant[];
  availableCuisines: string[];
  userLocation: { latitude?: number | null; longitude?: number | null; label?: string } | null;
  onOpenLocationModal?: () => void;
}

export const RestaurantFilterModal: React.FC<RestaurantFilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
  onReset,
  allRestaurants,
  availableCuisines,
  userLocation,
  onOpenLocationModal
}) => {
  // Local draft state to let user experiment with live restaurant count preview
  const [draft, setDraft] = useState<RestaurantFilterState>(filters);
  const [activeCategory, setActiveCategory] = useState<keyof RestaurantFilterState>('sortBy');
  const [cuisineSearch, setCuisineSearch] = useState('');

  // Sync draft whenever modal opens or parent filters change
  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
      setCuisineSearch('');
    }
  }, [isOpen, filters]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live count of matching restaurants with current draft
  const matchingCount = useMemo(() => {
    return allRestaurants.filter(r => evaluateRestaurantFilters(r, draft, userLocation)).length;
  }, [allRestaurants, draft, userLocation]);

  // Total active filter count in draft
  const totalDraftActiveCount = useMemo(() => {
    return countActiveFilters(draft);
  }, [draft]);

  // Per-category active count for badge indicators
  const categoryActiveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    counts['sortBy'] = draft.sortBy !== 'relevance' ? 1 : 0;
    counts['cuisines'] = draft.cuisines.length;
    counts['minRating'] = draft.minRating !== null ? 1 : 0;
    counts['costForTwo'] = (draft.costForTwo[0] > DEFAULT_COST_RANGE[0] || draft.costForTwo[1] < DEFAULT_COST_RANGE[1]) ? 1 : 0;
    counts['offers'] = draft.offers.length;
    counts['operatingHours'] = draft.operatingHours.length;
    counts['distance'] = draft.distance !== null ? 1 : 0;
    counts['accessibility'] = draft.accessibility.length;
    counts['experience'] = draft.experience.length;
    counts['dietary'] = draft.dietary.length;
    counts['facilities'] = draft.facilities.length;
    counts['ambience'] = draft.ambience.length;
    counts['more'] = draft.more.length;
    return counts;
  }, [draft]);

  // Filtered cuisines in search
  const filteredCuisinesList = useMemo(() => {
    const list = availableCuisines.filter(c => c.toLowerCase() !== 'all');
    if (!cuisineSearch.trim()) return list;
    return list.filter(c => c.toLowerCase().includes(cuisineSearch.toLowerCase().trim()));
  }, [availableCuisines, cuisineSearch]);

  if (!isOpen) return null;

  // Toggle multi-select array helper
  const toggleArrayOption = (key: keyof RestaurantFilterState, value: string) => {
    setDraft(prev => {
      const current = prev[key] as string[];
      const exists = current.includes(value);
      const updated = exists ? current.filter(item => item !== value) : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  // Clear single category
  const clearCurrentCategory = () => {
    setDraft(prev => {
      switch (activeCategory) {
        case 'sortBy':
          return { ...prev, sortBy: 'relevance' };
        case 'cuisines':
          return { ...prev, cuisines: [] };
        case 'minRating':
          return { ...prev, minRating: null };
        case 'costForTwo':
          return { ...prev, costForTwo: [...DEFAULT_COST_RANGE] as [number, number] };
        case 'offers':
          return { ...prev, offers: [] };
        case 'operatingHours':
          return { ...prev, operatingHours: [] };
        case 'distance':
          return { ...prev, distance: null };
        case 'accessibility':
          return { ...prev, accessibility: [] };
        case 'experience':
          return { ...prev, experience: [] };
        case 'dietary':
          return { ...prev, dietary: [] };
        case 'facilities':
          return { ...prev, facilities: [] };
        case 'ambience':
          return { ...prev, ambience: [] };
        case 'more':
          return { ...prev, more: [] };
        default:
          return prev;
      }
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleResetAll = () => {
    setDraft(INITIAL_FILTER_STATE);
    onReset();
  };

  // Icon helper
  const renderCategoryIcon = (name: string, isSelected: boolean) => {
    const props = { className: `w-4 h-4 shrink-0 transition-colors ${isSelected ? 'text-[#C85A3F]' : 'text-[#756B64]'}` };
    switch (name) {
      case 'ArrowUpDown': return <ArrowUpDown {...props} />;
      case 'Utensils': return <Utensils {...props} />;
      case 'Star': return <Star {...props} />;
      case 'IndianRupee': return <IndianRupee {...props} />;
      case 'Percent': return <Percent {...props} />;
      case 'Clock': return <Clock {...props} />;
      case 'MapPin': return <MapPin {...props} />;
      case 'Leaf': return <Leaf {...props} />;
      case 'Sparkles': return <Sparkles {...props} />;
      case 'Accessibility': return <Accessibility {...props} />;
      case 'Building': return <Building {...props} />;
      case 'Smile': return <Smile {...props} />;
      case 'Sliders': return <Sliders {...props} />;
      default: return <Sliders {...props} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-[#202124]/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      
      {/* Modal Dialog Card */}
      <div 
        className="w-full h-full sm:h-[90vh] sm:max-h-[820px] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E5DCD5]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-[#F3E8DF] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[#202124] tracking-tight">
                  Restaurant Filters
                </h2>
                {totalDraftActiveCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#C85A3F] text-white text-[11px] font-extrabold">
                    {totalDraftActiveCount} applied
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#756B64] font-medium hidden sm:block">
                Refine discovery by cuisine, budget, ratings, offers, and dining features
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalDraftActiveCount > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="text-xs font-bold text-[#C85A3F] hover:text-[#A94332] px-2.5 py-1.5 rounded-xl hover:bg-[#F3E8DF] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#756B64] hover:text-[#202124] hover:bg-[#F3E8DF] rounded-xl transition-colors cursor-pointer"
              title="Close filter modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2-Pane Content Area (Left: Categories, Right: Options) */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-[#FCFAF7]">
          
          {/* Left Navigation: Categories Sidebar */}
          <div className="w-[120px] sm:w-[220px] border-r border-[#F3E8DF] bg-white overflow-y-auto shrink-0 scrollbar-thin">
            <div className="p-1 sm:p-2 space-y-1">
              {FILTER_CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat.id;
                const activeCount = categoryActiveCounts[cat.id] || 0;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full text-left px-2 sm:px-3.5 py-2.5 rounded-2xl transition-all flex items-center justify-between text-xs font-bold cursor-pointer group ${
                      isSelected
                        ? 'bg-[#F3E8DF] text-[#C85A3F] shadow-xs'
                        : 'text-[#202124] hover:bg-[#FCFAF7]'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      {renderCategoryIcon(cat.iconName, isSelected)}
                      <span className="truncate text-[11px] sm:text-xs">
                        <span className="hidden sm:inline">{cat.label}</span>
                        <span className="sm:hidden">{cat.shortLabel}</span>
                      </span>
                    </div>

                    {activeCount > 0 && (
                      <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#C85A3F] text-white text-[9px] sm:text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {activeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Content: Active Category Options */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FCFAF7]">
            
            {/* Category Header with Reset */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F3E8DF]">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#202124]">
                  {FILTER_CATEGORIES.find(c => c.id === activeCategory)?.label}
                </h3>
                <p className="text-[11px] text-[#756B64] font-medium">
                  {FILTER_CATEGORIES.find(c => c.id === activeCategory)?.description}
                </p>
              </div>

              {(categoryActiveCounts[activeCategory] || 0) > 0 && (
                <button
                  type="button"
                  onClick={clearCurrentCategory}
                  className="text-[11px] font-bold text-[#C85A3F] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Category Pane Switcher */}
            <div className="space-y-4">
              
              {/* A. SORT BY */}
              {activeCategory === 'sortBy' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'relevance' as SortOption, title: 'Relevance', desc: 'Featured restaurants & verified popularity' },
                    { id: 'rating_desc' as SortOption, title: 'Rating: High to Low', desc: 'Top rated dining venues first' },
                    { id: 'rating_asc' as SortOption, title: 'Rating: Low to High', desc: 'Ascending customer ratings' },
                    { id: 'cost_asc' as SortOption, title: 'Cost: Low to High', desc: 'Pocket-friendly & budget options first' },
                    { id: 'cost_desc' as SortOption, title: 'Cost: High to Low', desc: 'Premium, fine dining & luxury experiences' },
                    { 
                      id: 'distance' as SortOption, 
                      title: 'Distance: Near to Far', 
                      desc: userLocation?.latitude ? 'Closest venues based on your location' : 'Requires GPS / location coordinates',
                      disabled: !userLocation?.latitude
                    }
                  ].map((opt) => {
                    const isChecked = draft.sortBy === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                          opt.disabled 
                            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' 
                            : isChecked 
                              ? 'bg-white border-[#C85A3F] shadow-xs' 
                              : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="sortBy"
                          disabled={opt.disabled}
                          checked={isChecked}
                          onChange={() => setDraft(prev => ({ ...prev, sortBy: opt.id }))}
                          className="mt-1 accent-[#C85A3F] w-4 h-4 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-[#202124] block">
                            {opt.title}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {opt.desc}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* B. CUISINES */}
              {activeCategory === 'cuisines' && (
                <div className="space-y-3">
                  {/* Search within cuisines */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#756B64]" />
                    <input
                      type="text"
                      placeholder="Search within cuisines (e.g. Italian, South Indian, Asian)..."
                      value={cuisineSearch}
                      onChange={(e) => setCuisineSearch(e.target.value)}
                      className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl text-xs text-[#202124] outline-none shadow-2xs"
                    />
                    {cuisineSearch && (
                      <button
                        type="button"
                        onClick={() => setCuisineSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#756B64] hover:text-[#202124]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {filteredCuisinesList.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-[#E5DCD5]">
                      <p className="text-xs text-[#756B64] font-medium">
                        No cuisines matching "{cuisineSearch}" found.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[380px] overflow-y-auto pr-1">
                      {filteredCuisinesList.map((c) => {
                        const isChecked = draft.cuisines.includes(c);
                        return (
                          <label
                            key={c}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs font-bold cursor-pointer ${
                              isChecked
                                ? 'bg-white border-[#C85A3F] text-[#C85A3F] shadow-xs'
                                : 'bg-white border-[#E5DCD5] text-[#202124] hover:border-[#C85A3F]/50'
                            }`}
                          >
                            <span className="truncate pr-2">{c}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleArrayOption('cuisines', c)}
                              className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* C. RATING */}
              {activeCategory === 'minRating' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { rating: 4.5, label: '4.5 stars and above', desc: 'Top tier exceptional customer dining rating' },
                      { rating: 4.0, label: '4.0 stars and above', desc: 'Highly rated, verified high customer satisfaction' },
                      { rating: 3.5, label: '3.5 stars and above', desc: 'Popular dining venues with good customer feedback' },
                      { rating: 3.0, label: '3.0 stars and above', desc: 'Average to good ratings across all diners' }
                    ].map((item) => {
                      const isSelected = draft.minRating === item.rating;
                      return (
                        <button
                          type="button"
                          key={item.rating}
                          onClick={() => setDraft(prev => ({ ...prev, minRating: isSelected ? null : item.rating }))}
                          className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-white border-[#C85A3F] shadow-xs'
                              : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                          }`}
                        >
                          <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-[#C85A3F] text-white' : 'bg-[#F3E8DF] text-[#C85A3F]'
                          }`}>
                            <Star className="w-4 h-4 fill-current" />
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-[#202124] block">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-[#756B64] font-medium block">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* D. COST FOR TWO */}
              {activeCategory === 'costForTwo' && (
                <div className="space-y-6 bg-white p-5 rounded-2xl border border-[#E5DCD5]">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#756B64]">Selected Price Range</span>
                      <div className="text-base sm:text-lg font-extrabold text-[#C85A3F]">
                        ₹{draft.costForTwo[0]} — {draft.costForTwo[1] >= 5000 ? '₹5,000+' : `₹${draft.costForTwo[1]}`}
                      </div>
                    </div>

                    {/* Quick Budget Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Under ₹500', range: [0, 500] as [number, number] },
                        { label: '₹500 - ₹1,000', range: [500, 1000] as [number, number] },
                        { label: '₹1,000 - ₹2,000', range: [1000, 2000] as [number, number] },
                        { label: '₹2,000+', range: [2000, 5000] as [number, number] }
                      ].map((chip) => {
                        const isMatch = draft.costForTwo[0] === chip.range[0] && draft.costForTwo[1] === chip.range[1];
                        return (
                          <button
                            type="button"
                            key={chip.label}
                            onClick={() => setDraft(prev => ({ ...prev, costForTwo: [...chip.range] }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              isMatch
                                ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-2xs'
                                : 'bg-[#FCFAF7] border-[#E5DCD5] text-[#202124] hover:border-[#C85A3F]/50'
                            }`}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dual Price Sliders */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-[#756B64] font-bold">
                        <span>Minimum Cost</span>
                        <span className="text-[#202124]">₹{draft.costForTwo[0]}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={4000}
                        step={100}
                        value={draft.costForTwo[0]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDraft(prev => ({
                            ...prev,
                            costForTwo: [Math.min(val, prev.costForTwo[1] - 100), prev.costForTwo[1]]
                          }));
                        }}
                        className="w-full accent-[#C85A3F] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-[#756B64] font-bold">
                        <span>Maximum Cost</span>
                        <span className="text-[#202124]">
                          {draft.costForTwo[1] >= 5000 ? '₹5,000+' : `₹${draft.costForTwo[1]}`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={500}
                        max={5000}
                        step={100}
                        value={draft.costForTwo[1]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDraft(prev => ({
                            ...prev,
                            costForTwo: [prev.costForTwo[0], Math.max(val, prev.costForTwo[0] + 100)]
                          }));
                        }}
                        className="w-full accent-[#C85A3F] cursor-pointer"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#756B64] font-medium pt-1">
                    Filters using the restaurant's actual cost-for-two and verified menu pricing.
                  </p>
                </div>
              )}

              {/* E. OFFERS */}
              {activeCategory === 'offers' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: '10_percent', label: 'Minimum 10% Discount', desc: 'Restaurants offering at least 10% instant discount' },
                    { id: '20_percent', label: 'Minimum 20% Discount', desc: 'Great deals offering at least 20% off bill' },
                    { id: '30_percent', label: 'Minimum 30% Discount', desc: 'Mega deals offering 30% or more savings' },
                    { id: 'complimentary', label: 'Complimentary Dishes or Items', desc: 'Includes free dessert, beverage, or appetiser perks' }
                  ].map((item) => {
                    const isChecked = draft.offers.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('offers', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* F. OPERATING HOURS */}
              {activeCategory === 'operatingHours' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'open_now', label: 'Open Now', desc: 'Currently accepting diners and table orders' },
                    { id: 'open_breakfast', label: 'Open for Breakfast', desc: 'Morning service window (7:00 AM – 11:30 AM)' },
                    { id: 'open_lunch', label: 'Open for Lunch', desc: 'Afternoon dining window (12:00 PM – 4:00 PM)' },
                    { id: 'open_dinner', label: 'Open for Dinner', desc: 'Evening and late dining window (7:00 PM – 11:30 PM)' }
                  ].map((item) => {
                    const isChecked = draft.operatingHours.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('operatingHours', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* G. DISTANCE */}
              {activeCategory === 'distance' && (
                <div className="space-y-4">
                  {/* Location status badge */}
                  <div className="p-4 bg-white rounded-2xl border border-[#E5DCD5] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F]">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#202124] block">
                          Current Location: {userLocation?.label || 'Hyderabad'}
                        </span>
                        <span className="text-[11px] text-[#756B64] font-medium block">
                          {userLocation?.latitude 
                            ? 'GPS coordinates active for precise distance' 
                            : 'Location coordinates not provided. Click change location to set coordinates.'}
                        </span>
                      </div>
                    </div>

                    {onOpenLocationModal && (
                      <button
                        type="button"
                        onClick={onOpenLocationModal}
                        className="px-3 py-1.5 rounded-xl bg-[#FCFAF7] border border-[#E5DCD5] hover:border-[#C85A3F]/50 text-xs font-bold text-[#202124] cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'under_2km', label: 'Under 2 km', desc: 'Short walking or quick 5-min drive' },
                      { id: 'under_5km', label: 'Under 5 km', desc: 'Neighborhood and nearby vicinity' },
                      { id: 'under_10km', label: 'Under 10 km', desc: 'Within local municipal radius' },
                      { id: 'under_15km', label: 'Under 15 km', desc: 'Wider metropolitan area' }
                    ].map((item) => {
                      const isSelected = draft.distance === item.id;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          disabled={!userLocation?.latitude}
                          onClick={() => setDraft(prev => ({ ...prev, distance: isSelected ? null : item.id }))}
                          className={`p-3.5 rounded-2xl border transition-all text-left flex items-start justify-between cursor-pointer ${
                            !userLocation?.latitude
                              ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                              : isSelected
                                ? 'bg-white border-[#C85A3F] shadow-xs'
                                : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-[#202124] block">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-[#756B64] font-medium block">
                              {item.desc}
                            </span>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'border-[#C85A3F] bg-[#C85A3F] text-white' : 'border-[#E5DCD5]'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* H. ACCESSIBILITY */}
              {activeCategory === 'accessibility' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'wheelchair', label: 'Wheelchair Accessible', desc: 'Ramps, accessible restrooms, and wide aisles' },
                    { id: 'step_free', label: 'Step-free Entry', desc: 'Smooth, ground-floor or elevator accessibility' },
                    { id: 'stroller', label: 'Baby-stroller Friendly', desc: 'Spacious seating areas accommodating prams and strollers' }
                  ].map((item) => {
                    const isChecked = draft.accessibility.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('accessibility', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* I. EXPERIENCE ENHANCERS */}
              {activeCategory === 'experience' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'pet_friendly', label: 'Pet-friendly', desc: 'Welcomes four-legged companions & furry friends' },
                    { id: 'family_friendly', label: 'Family-friendly', desc: 'Kid friendly menus, high chairs & relaxed seating' },
                    { id: 'romantic', label: 'Romantic Dining', desc: 'Intimate ambiance, candlelight & aesthetic decor' },
                    { id: 'live_music', label: 'Live Music', desc: 'Acoustic performances, live bands & artists' },
                    { id: 'outdoor_seating', label: 'Outdoor Seating', desc: 'Rooftop, patio, or garden terrace dining' },
                    { id: 'good_for_groups', label: 'Good for Groups', desc: 'Large sharing tables & party celebrations' },
                    { id: 'sports_screening', label: 'Sports Screening', desc: 'Live cricket, football & major sports matches' }
                  ].map((item) => {
                    const isChecked = draft.experience.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('experience', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* J. DIETARY PREFERENCES */}
              {activeCategory === 'dietary' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'pure_veg', label: '🌱 Pure Vegetarian', desc: 'Exclusively vegetarian kitchens and zero meat' },
                    { id: 'jain', label: 'Jain-friendly', desc: 'Root-vegetable free preparations on request' },
                    { id: 'vegan', label: 'Vegan Options', desc: 'Plant-based, 100% dairy-free and cruelty-free dishes' }
                  ].map((item) => {
                    const isChecked = draft.dietary.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('dietary', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* K. FACILITIES */}
              {activeCategory === 'facilities' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'valet', label: 'Valet Parking', desc: 'Convenient valet assistance at the entrance' },
                    { id: 'parking', label: 'Dedicated Parking', desc: 'Designated guest parking spaces on-premises' },
                    { id: 'ev_charging', label: 'EV Charging', desc: 'Electric vehicle charging stations available' },
                    { id: 'wifi', label: 'Wi-Fi Available', desc: 'Complimentary high-speed Internet access for patrons' }
                  ].map((item) => {
                    const isChecked = draft.facilities.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('facilities', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* L. AMBIENCE */}
              {activeCategory === 'ambience' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'casual', label: 'Casual & Relaxed', desc: 'Informal cafe and bistro dining vibe' },
                    { id: 'family', label: 'Family Atmosphere', desc: 'Spacious and welcoming for all family generations' },
                    { id: 'romantic', label: 'Romantic & Cozy', desc: 'Dim ambient lighting and peaceful tables' },
                    { id: 'business', label: 'Business-friendly', desc: 'Quiet environment suitable for corporate lunches' },
                    { id: 'luxury', label: 'Luxury & Fine Dining', desc: 'Premium white-glove service and gourmet curation' }
                  ].map((item) => {
                    const isChecked = draft.ambience.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('ambience', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* M. MORE */}
              {activeCategory === 'more' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'newly_opened', label: 'Newly Opened', desc: 'Fresh new dining venues recently launched in city' },
                    { id: 'party_friendly', label: 'Party-friendly', desc: 'Hosts birthdays, anniversaries, and reunions' },
                    { id: 'newly_listed', label: 'Newly Listed on SpiralDine', desc: 'Recently verified partners on the platform' }
                  ].map((item) => {
                    const isChecked = draft.more.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#C85A3F] shadow-xs'
                            : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <div className="space-y-0.5 pr-2">
                          <span className="text-xs font-bold text-[#202124] block">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-[#756B64] font-medium block">
                            {item.desc}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleArrayOption('more', item.id)}
                          className="accent-[#C85A3F] w-4 h-4 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-white border-t border-[#F3E8DF] flex items-center justify-between gap-3 shrink-0 pb-safe">
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs font-bold text-[#756B64] hover:text-[#202124] px-4 py-3 rounded-2xl hover:bg-[#FCFAF7] transition-colors cursor-pointer"
          >
            Clear All
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex-1 sm:flex-initial sm:min-w-[240px] py-3 px-6 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Show {matchingCount} Restaurant{matchingCount === 1 ? '' : 's'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
