import { RestaurantFilterState, DEFAULT_COST_RANGE, ActiveFilterTag } from '../types/restaurantFilters';

export interface FilterableRestaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number | null;
  reviewsCount: number | null;
  priceRange: string;
  costForTwo?: number | null;
  vegOptions?: boolean;
  nonVegOptions?: boolean;
  openNow: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
  hasOffer?: boolean;
  discountPercent?: number | null;
  offers?: any[] | null;
  image?: string | null;
  logoUrl?: string | null;
  city?: string;
  state?: string;
  country?: string;
  area?: string;
  street?: string;
  address?: any;
  googleMapsUrl?: string | null;
  description?: string;
  currency?: string;
  currencySymbol?: string;
  latitude?: number | null;
  longitude?: number | null;
  facilities?: any;
  accessibility?: any;
  experience?: any;
  dietary?: any;
  ambience?: any;
  businessHours?: any;
  hours?: string | null;
  tags?: string[];
  [key: string]: any;
}

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Resolves a realistic Cost for Two amount in INR from restaurant data.
 */
export function estimateCostForTwo(r: FilterableRestaurant): number {
  if (typeof r.costForTwo === 'number' && r.costForTwo > 0) {
    return r.costForTwo;
  }
  if (typeof r.cost_for_two === 'number' && r.cost_for_two > 0) {
    return r.cost_for_two;
  }
  if (typeof r.averageCost === 'number' && r.averageCost > 0) {
    return r.averageCost;
  }

  // Price range fallback
  const pr = String(r.priceRange || '').trim();
  if (pr === '₹' || pr === '$') return 350;
  if (pr === '₹₹' || pr === '$$') return 800;
  if (pr === '₹₹₹' || pr === '$$$') return 1600;
  if (pr === '₹₹₹₹' || pr === '$$$$') return 2800;

  return 600;
}

/**
 * Checks if restaurant matches any of the requested offers.
 */
export function matchesOffers(r: FilterableRestaurant, selectedOffers: string[]): boolean {
  if (selectedOffers.length === 0) return true;

  const desc = String(r.description || '').toLowerCase();
  const rawOffers: any[] = Array.isArray(r.offers) ? r.offers : [];
  const discountPct = typeof r.discountPercent === 'number' ? r.discountPercent : (r.hasOffer ? 15 : 0);

  return selectedOffers.some(offerKey => {
    if (offerKey === '10_percent') {
      return discountPct >= 10 || rawOffers.some(o => /10%|15%|20%|25%|30%|40%|50%/.test(String(o?.title || o?.name || o)));
    }
    if (offerKey === '20_percent') {
      return discountPct >= 20 || rawOffers.some(o => /20%|25%|30%|40%|50%/.test(String(o?.title || o?.name || o)));
    }
    if (offerKey === '30_percent') {
      return discountPct >= 30 || rawOffers.some(o => /30%|40%|50%/.test(String(o?.title || o?.name || o)));
    }
    if (offerKey === 'complimentary') {
      return rawOffers.some(o => /complimentary|free|dessert|drink|beverage|item/i.test(String(o?.title || o?.name || o))) ||
             /complimentary|free dessert|free drink|welcome drink/i.test(desc);
    }
    return false;
  });
}

/**
 * Checks if restaurant operating hours match the requested meal window or open now status.
 */
export function matchesOperatingHours(r: FilterableRestaurant, selectedHours: string[]): boolean {
  if (selectedHours.length === 0) return true;

  const desc = String(r.description || '').toLowerCase();
  const hoursText = String(r.hours || (typeof r.businessHours === 'string' ? r.businessHours : '')).toLowerCase();
  const openTime = r.businessHours?.openingTime || '';
  const closeTime = r.businessHours?.closingTime || '';

  return selectedHours.some(key => {
    if (key === 'open_now') {
      return r.openNow === true;
    }
    if (key === 'open_breakfast') {
      // 07:00 - 11:30
      if (/breakfast|tiffin|morning|idli|dosa/i.test(desc) || /breakfast/i.test(hoursText)) return true;
      if (openTime && openTime <= '10:00' && (closeTime > '11:00' || closeTime < openTime)) return true;
      return false;
    }
    if (key === 'open_lunch') {
      // 12:00 - 16:00
      if (/lunch|thali|buffet/i.test(desc) || /lunch/i.test(hoursText)) return true;
      if (openTime && openTime <= '13:00' && (closeTime >= '15:00' || closeTime < openTime)) return true;
      // Most full-service active restaurants serve lunch
      return r.openNow !== false && r.status === 'active';
    }
    if (key === 'open_dinner') {
      // 19:00 - 23:30
      if (/dinner|night|supper|evening/i.test(desc) || /dinner/i.test(hoursText)) return true;
      if (closeTime && (closeTime >= '21:00' || closeTime <= '04:00')) return true;
      return r.openNow !== false && r.status === 'active';
    }
    return false;
  });
}

/**
 * Safe helper to check presence of an attribute in object, array, or text.
 */
function checkAttribute(
  container: any,
  keys: string[],
  textCorpus: string
): boolean {
  if (!container && !textCorpus) return false;

  // Check object properties
  if (container && typeof container === 'object' && !Array.isArray(container)) {
    for (const k of keys) {
      if (container[k] === true || container[k] === 1) return true;
    }
  }

  // Check array elements
  if (Array.isArray(container)) {
    for (const item of container) {
      const s = String(item).toLowerCase();
      for (const k of keys) {
        if (s.includes(k.toLowerCase().replace(/_/g, ' '))) return true;
      }
    }
  }

  // Check description or string text
  if (textCorpus) {
    const lower = textCorpus.toLowerCase();
    for (const k of keys) {
      const cleanKey = k.toLowerCase().replace(/_/g, ' ');
      if (new RegExp(`\\b${cleanKey}\\b`, 'i').test(lower)) return true;
    }
  }

  return false;
}

/**
 * Checks Accessibility options.
 */
export function matchesAccessibility(r: FilterableRestaurant, options: string[]): boolean {
  if (options.length === 0) return true;

  const corpus = `${r.description || ''} ${r.features || ''} ${JSON.stringify(r.facilities || {})}`;
  return options.some(opt => {
    if (opt === 'wheelchair') {
      return checkAttribute(r.accessibility, ['wheelchair', 'wheelchairAccessible', 'wheelchairAccess'], corpus) ||
             checkAttribute(r.facilities, ['wheelchair', 'wheelchairAccessible', 'wheelchairAccess'], corpus);
    }
    if (opt === 'step_free') {
      return checkAttribute(r.accessibility, ['stepFree', 'stepFreeEntry', 'groundFloor'], corpus) ||
             checkAttribute(r.facilities, ['stepFree', 'stepFreeEntry'], corpus);
    }
    if (opt === 'stroller') {
      return checkAttribute(r.accessibility, ['strollerFriendly', 'stroller', 'pramFriendly'], corpus) ||
             checkAttribute(r.facilities, ['strollerFriendly', 'stroller'], corpus);
    }
    return false;
  });
}

/**
 * Checks Experience Enhancers.
 */
export function matchesExperience(r: FilterableRestaurant, options: string[]): boolean {
  if (options.length === 0) return true;

  const corpus = `${r.description || ''} ${r.name || ''} ${JSON.stringify(r.facilities || {})} ${JSON.stringify(r.ambience || {})}`;
  return options.some(opt => {
    if (opt === 'pet_friendly') {
      return checkAttribute(r.experience, ['petFriendly', 'pet_friendly', 'petsAllowed'], corpus) ||
             checkAttribute(r.facilities, ['petFriendly', 'pet_friendly', 'petsAllowed'], corpus);
    }
    if (opt === 'family_friendly') {
      return checkAttribute(r.experience, ['familyFriendly', 'family_friendly', 'kidFriendly'], corpus) ||
             checkAttribute(r.ambience, ['family', 'familyFriendly'], corpus) ||
             checkAttribute(r.facilities, ['kidsArea', 'familyFriendly'], corpus);
    }
    if (opt === 'romantic') {
      return checkAttribute(r.experience, ['romantic', 'candlelight', 'couples'], corpus) ||
             checkAttribute(r.ambience, ['romantic', 'candlelight'], corpus);
    }
    if (opt === 'live_music') {
      return checkAttribute(r.experience, ['liveMusic', 'live_music', 'band', 'acoustic'], corpus) ||
             checkAttribute(r.facilities, ['liveMusic', 'live_music'], corpus);
    }
    if (opt === 'outdoor_seating') {
      return checkAttribute(r.experience, ['outdoorSeating', 'outdoor_seating', 'rooftop', 'patio', 'terrace'], corpus) ||
             checkAttribute(r.facilities, ['outdoorSeating', 'outdoor_seating', 'rooftop', 'patio'], corpus);
    }
    if (opt === 'good_for_groups') {
      return checkAttribute(r.experience, ['goodForGroups', 'groups', 'partyHall', 'largeGroups'], corpus) ||
             checkAttribute(r.facilities, ['goodForGroups', 'largeGroups'], corpus);
    }
    if (opt === 'sports_screening') {
      return checkAttribute(r.experience, ['sportsScreening', 'liveScreening', 'projector', 'iplScreening'], corpus) ||
             checkAttribute(r.facilities, ['sportsScreening', 'liveScreening'], corpus);
    }
    return false;
  });
}

/**
 * Checks Dietary Preferences.
 */
export function matchesDietary(r: FilterableRestaurant, options: string[]): boolean {
  if (options.length === 0) return true;

  const corpus = `${r.cuisine || ''} ${r.name || ''} ${r.description || ''}`;
  return options.some(opt => {
    if (opt === 'pure_veg') {
      const isPureVegExplicit = r.isPureVeg === true || (r.vegOptions === true && r.nonVegOptions === false);
      const isPureVegInCorpus = /pure veg|pure-veg|100% veg|strictly vegetarian/i.test(corpus);
      return isPureVegExplicit || isPureVegInCorpus;
    }
    if (opt === 'jain') {
      return checkAttribute(r.dietary, ['jain', 'jainFriendly', 'jainAvailable'], corpus) ||
             /jain food|jain options|jain friendly|jain/i.test(corpus);
    }
    if (opt === 'vegan') {
      return checkAttribute(r.dietary, ['vegan', 'veganFriendly'], corpus) ||
             /vegan friendly|vegan menu|vegan/i.test(corpus);
    }
    return false;
  });
}

/**
 * Checks Facilities.
 */
export function matchesFacilities(r: FilterableRestaurant, options: string[]): boolean {
  if (options.length === 0) return true;

  const corpus = `${r.description || ''} ${JSON.stringify(r.facilities || {})}`;
  return options.some(opt => {
    if (opt === 'valet') {
      return checkAttribute(r.facilities, ['valet', 'valetParking'], corpus);
    }
    if (opt === 'parking') {
      return checkAttribute(r.facilities, ['parking', 'dedicatedParking', 'freeParking', 'carParking'], corpus);
    }
    if (opt === 'ev_charging') {
      return checkAttribute(r.facilities, ['evCharging', 'ev', 'electricVehicleCharging'], corpus);
    }
    if (opt === 'wifi') {
      return checkAttribute(r.facilities, ['wifi', 'freeWifi', 'highSpeedWifi'], corpus);
    }
    return false;
  });
}

/**
 * Checks Ambience.
 */
export function matchesAmbience(r: FilterableRestaurant, options: string[]): boolean {
  if (options.length === 0) return true;

  const corpus = `${r.description || ''} ${JSON.stringify(r.ambience || {})}`;
  return options.some(opt => {
    if (opt === 'casual') {
      return checkAttribute(r.ambience, ['casual', 'cafe', 'bistro'], corpus) ||
             /casual dining|cafe vibe|cozy/i.test(corpus);
    }
    if (opt === 'family') {
      return checkAttribute(r.ambience, ['family', 'familyDining'], corpus) ||
             /family friendly|family restaurant/i.test(corpus);
    }
    if (opt === 'romantic') {
      return checkAttribute(r.ambience, ['romantic', 'dimLighting', 'fineDine'], corpus) ||
             /romantic dining|candlelight/i.test(corpus);
    }
    if (opt === 'business') {
      return checkAttribute(r.ambience, ['business', 'formal', 'corporate'], corpus) ||
             /business lunch|corporate meetings/i.test(corpus);
    }
    if (opt === 'luxury') {
      return checkAttribute(r.ambience, ['luxury', 'fineDining', 'upscale'], corpus) ||
             r.priceRange === '₹₹₹₹' || r.priceRange === '$$$$' ||
             /luxury|fine dining|gourmet/i.test(corpus);
    }
    return false;
  });
}

/**
 * Checks More Filter tags.
 */
export function matchesMore(r: FilterableRestaurant, options: string[]): boolean {
  if (options.length === 0) return true;

  const corpus = `${r.description || ''} ${r.name || ''}`;
  return options.some(opt => {
    if (opt === 'newly_opened') {
      return r.isNew === true || r.newlyOpened === true || /newly opened|grand opening|new/i.test(corpus);
    }
    if (opt === 'party_friendly') {
      return r.partyFriendly === true || checkAttribute(r.facilities, ['partyHall', 'privateDining'], corpus) ||
             /party|banquet|celebration/i.test(corpus);
    }
    if (opt === 'newly_listed') {
      return r.isNew === true || r.newlyListed === true;
    }
    return false;
  });
}

/**
 * Evaluates whether a restaurant satisfies all active filter categories.
 * Category combination uses AND logic; options within a category use OR logic.
 */
export function evaluateRestaurantFilters(
  r: FilterableRestaurant,
  filters: RestaurantFilterState,
  userLocation: { latitude?: number | null; longitude?: number | null } | null
): boolean {
  // 1. Cuisines (OR across selected cuisines)
  if (filters.cuisines.length > 0) {
    const rCuisine = String(r.cuisine || '').toLowerCase();
    const matchesAnyCuisine = filters.cuisines.some(c => 
      rCuisine.includes(c.toLowerCase()) || 
      new RegExp(`\\b${c.toLowerCase()}\\b`, 'i').test(rCuisine)
    );
    if (!matchesAnyCuisine) return false;
  }

  // 2. Rating (Min threshold)
  if (filters.minRating !== null) {
    if (typeof r.rating !== 'number' || isNaN(r.rating) || r.rating < filters.minRating) {
      return false;
    }
  }

  // 3. Cost for Two (Range check)
  const [minCost, maxCost] = filters.costForTwo;
  if (minCost > DEFAULT_COST_RANGE[0] || maxCost < DEFAULT_COST_RANGE[1]) {
    const cost = estimateCostForTwo(r);
    if (cost < minCost || cost > maxCost) {
      return false;
    }
  }

  // 4. Offers
  if (!matchesOffers(r, filters.offers)) {
    return false;
  }

  // 5. Operating Hours
  if (!matchesOperatingHours(r, filters.operatingHours)) {
    return false;
  }

  // 6. Distance
  if (filters.distance) {
    if (!userLocation?.latitude || !userLocation?.longitude || !r.latitude || !r.longitude) {
      // Reliable distance not available for this venue or user
      return false;
    }
    const dist = calculateHaversineDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      r.latitude,
      r.longitude
    );
    if (filters.distance === 'under_2km' && dist > 2) return false;
    if (filters.distance === 'under_5km' && dist > 5) return false;
    if (filters.distance === 'under_10km' && dist > 10) return false;
    if (filters.distance === 'under_15km' && dist > 15) return false;
  }

  // 7. Accessibility
  if (!matchesAccessibility(r, filters.accessibility)) {
    return false;
  }

  // 8. Experience Enhancers
  if (!matchesExperience(r, filters.experience)) {
    return false;
  }

  // 9. Dietary Preferences
  if (!matchesDietary(r, filters.dietary)) {
    return false;
  }

  // 10. Facilities
  if (!matchesFacilities(r, filters.facilities)) {
    return false;
  }

  // 11. Ambience
  if (!matchesAmbience(r, filters.ambience)) {
    return false;
  }

  // 12. More
  if (!matchesMore(r, filters.more)) {
    return false;
  }

  return true;
}

/**
 * Sorts restaurants according to selected SortOption.
 */
export function sortRestaurants(
  restaurants: FilterableRestaurant[],
  sortOption: RestaurantFilterState['sortBy'],
  userLocation: { latitude?: number | null; longitude?: number | null } | null
): FilterableRestaurant[] {
  const result = [...restaurants];

  switch (sortOption) {
    case 'rating_desc':
      return result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'rating_asc':
      return result.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    case 'cost_asc':
      return result.sort((a, b) => estimateCostForTwo(a) - estimateCostForTwo(b));
    case 'cost_desc':
      return result.sort((a, b) => estimateCostForTwo(b) - estimateCostForTwo(a));
    case 'distance':
      if (userLocation?.latitude && userLocation?.longitude) {
        return result.sort((a, b) => {
          const distA = a.latitude && a.longitude 
            ? calculateHaversineDistanceKm(userLocation.latitude!, userLocation.longitude!, a.latitude, a.longitude)
            : 99999;
          const distB = b.latitude && b.longitude
            ? calculateHaversineDistanceKm(userLocation.latitude!, userLocation.longitude!, b.latitude, b.longitude)
            : 99999;
          return distA - distB;
        });
      }
      return result;
    case 'relevance':
    default:
      // Featured first, then highest rating
      return result.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
  }
}

/**
 * Calculates how many active filter criteria are currently applied.
 */
export function countActiveFilters(filters: RestaurantFilterState): number {
  let count = 0;
  if (filters.sortBy !== 'relevance') count++;
  count += filters.cuisines.length;
  if (filters.minRating !== null) count++;
  if (filters.costForTwo[0] > DEFAULT_COST_RANGE[0] || filters.costForTwo[1] < DEFAULT_COST_RANGE[1]) count++;
  count += filters.offers.length;
  count += filters.operatingHours.length;
  if (filters.distance !== null) count++;
  count += filters.accessibility.length;
  count += filters.experience.length;
  count += filters.dietary.length;
  count += filters.facilities.length;
  count += filters.ambience.length;
  count += filters.more.length;
  return count;
}

/**
 * Generates interactive active filter tags for the pill bar on the discovery page.
 */
export function getActiveFilterTags(
  filters: RestaurantFilterState,
  onChange: (updated: RestaurantFilterState) => void
): ActiveFilterTag[] {
  const tags: ActiveFilterTag[] = [];

  // Sort By
  if (filters.sortBy !== 'relevance') {
    const labels: Record<string, string> = {
      rating_desc: 'Rating: High to Low',
      rating_asc: 'Rating: Low to High',
      cost_asc: 'Cost: Low to High',
      cost_desc: 'Cost: High to Low',
      distance: 'Distance: Near to Far'
    };
    tags.push({
      id: `sort_${filters.sortBy}`,
      category: 'sortBy',
      label: labels[filters.sortBy] || filters.sortBy,
      onRemove: () => onChange({ ...filters, sortBy: 'relevance' })
    });
  }

  // Cuisines
  filters.cuisines.forEach(c => {
    tags.push({
      id: `cuisine_${c}`,
      category: 'cuisines',
      label: c,
      onRemove: () => onChange({ ...filters, cuisines: filters.cuisines.filter(x => x !== c) })
    });
  });

  // Rating
  if (filters.minRating !== null) {
    tags.push({
      id: `rating_${filters.minRating}`,
      category: 'minRating',
      label: `★ ${filters.minRating}+`,
      onRemove: () => onChange({ ...filters, minRating: null })
    });
  }

  // Cost for Two
  if (filters.costForTwo[0] > DEFAULT_COST_RANGE[0] || filters.costForTwo[1] < DEFAULT_COST_RANGE[1]) {
    tags.push({
      id: 'cost_range',
      category: 'costForTwo',
      label: `₹${filters.costForTwo[0]} – ₹${filters.costForTwo[1]}`,
      onRemove: () => onChange({ ...filters, costForTwo: [...DEFAULT_COST_RANGE] as [number, number] })
    });
  }

  // Offers
  filters.offers.forEach(o => {
    const labels: Record<string, string> = {
      '10_percent': '10%+ Off',
      '20_percent': '20%+ Off',
      '30_percent': '30%+ Off',
      'complimentary': 'Complimentary Items'
    };
    tags.push({
      id: `offer_${o}`,
      category: 'offers',
      label: labels[o] || o,
      onRemove: () => onChange({ ...filters, offers: filters.offers.filter(x => x !== o) })
    });
  });

  // Operating Hours
  filters.operatingHours.forEach(h => {
    const labels: Record<string, string> = {
      'open_now': 'Open Now',
      'open_breakfast': 'Breakfast',
      'open_lunch': 'Lunch',
      'open_dinner': 'Dinner'
    };
    tags.push({
      id: `hours_${h}`,
      category: 'operatingHours',
      label: labels[h] || h,
      onRemove: () => onChange({ ...filters, operatingHours: filters.operatingHours.filter(x => x !== h) })
    });
  });

  // Distance
  if (filters.distance) {
    const labels: Record<string, string> = {
      'under_2km': '< 2 km',
      'under_5km': '< 5 km',
      'under_10km': '< 10 km',
      'under_15km': '< 15 km'
    };
    tags.push({
      id: `distance_${filters.distance}`,
      category: 'distance',
      label: labels[filters.distance] || filters.distance,
      onRemove: () => onChange({ ...filters, distance: null })
    });
  }

  // Accessibility
  filters.accessibility.forEach(a => {
    const labels: Record<string, string> = {
      'wheelchair': 'Wheelchair Accessible',
      'step_free': 'Step-free Entry',
      'stroller': 'Stroller Friendly'
    };
    tags.push({
      id: `access_${a}`,
      category: 'accessibility',
      label: labels[a] || a,
      onRemove: () => onChange({ ...filters, accessibility: filters.accessibility.filter(x => x !== a) })
    });
  });

  // Experience
  filters.experience.forEach(e => {
    const labels: Record<string, string> = {
      'pet_friendly': 'Pet Friendly',
      'family_friendly': 'Family Friendly',
      'romantic': 'Romantic Dining',
      'live_music': 'Live Music',
      'outdoor_seating': 'Outdoor Seating',
      'good_for_groups': 'Good for Groups',
      'sports_screening': 'Sports Screening'
    };
    tags.push({
      id: `exp_${e}`,
      category: 'experience',
      label: labels[e] || e,
      onRemove: () => onChange({ ...filters, experience: filters.experience.filter(x => x !== e) })
    });
  });

  // Dietary
  filters.dietary.forEach(d => {
    const labels: Record<string, string> = {
      'pure_veg': '🌱 Pure Veg',
      'jain': 'Jain Friendly',
      'vegan': 'Vegan'
    };
    tags.push({
      id: `diet_${d}`,
      category: 'dietary',
      label: labels[d] || d,
      onRemove: () => onChange({ ...filters, dietary: filters.dietary.filter(x => x !== d) })
    });
  });

  // Facilities
  filters.facilities.forEach(f => {
    const labels: Record<string, string> = {
      'valet': 'Valet Parking',
      'parking': 'Dedicated Parking',
      'ev_charging': 'EV Charging',
      'wifi': 'Free Wi-Fi'
    };
    tags.push({
      id: `fac_${f}`,
      category: 'facilities',
      label: labels[f] || f,
      onRemove: () => onChange({ ...filters, facilities: filters.facilities.filter(x => x !== f) })
    });
  });

  // Ambience
  filters.ambience.forEach(amb => {
    const labels: Record<string, string> = {
      'casual': 'Casual Ambience',
      'family': 'Family Ambience',
      'romantic': 'Romantic Ambience',
      'business': 'Business Dining',
      'luxury': 'Luxury / Fine Dining'
    };
    tags.push({
      id: `amb_${amb}`,
      category: 'ambience',
      label: labels[amb] || amb,
      onRemove: () => onChange({ ...filters, ambience: filters.ambience.filter(x => x !== amb) })
    });
  });

  // More
  filters.more.forEach(m => {
    const labels: Record<string, string> = {
      'newly_opened': 'Newly Opened',
      'party_friendly': 'Party Friendly',
      'newly_listed': 'Newly Listed'
    };
    tags.push({
      id: `more_${m}`,
      category: 'more',
      label: labels[m] || m,
      onRemove: () => onChange({ ...filters, more: filters.more.filter(x => x !== m) })
    });
  });

  return tags;
}
