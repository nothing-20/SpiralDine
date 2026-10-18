export type SortOption = 
  | 'relevance' 
  | 'rating_desc' 
  | 'rating_asc' 
  | 'cost_asc' 
  | 'cost_desc' 
  | 'distance';

export interface RestaurantFilterState {
  sortBy: SortOption;
  cuisines: string[];
  minRating: number | null;
  costForTwo: [number, number]; // [min, max]
  offers: string[]; // '10_percent', '20_percent', '30_percent', 'complimentary'
  operatingHours: string[]; // 'open_now', 'open_breakfast', 'open_lunch', 'open_dinner'
  distance: string | null; // 'under_2km', 'under_5km', 'under_10km', 'under_15km'
  accessibility: string[]; // 'wheelchair', 'step_free', 'stroller'
  experience: string[]; // 'pet_friendly', 'family_friendly', 'romantic', 'live_music', 'outdoor_seating', 'good_for_groups', 'sports_screening'
  dietary: string[]; // 'pure_veg', 'jain', 'vegan'
  facilities: string[]; // 'valet', 'parking', 'ev_charging', 'wifi'
  ambience: string[]; // 'casual', 'family', 'romantic', 'business', 'luxury'
  more: string[]; // 'newly_opened', 'party_friendly', 'newly_listed'
}

export const DEFAULT_COST_RANGE: [number, number] = [0, 5000];

export const INITIAL_FILTER_STATE: RestaurantFilterState = {
  sortBy: 'relevance',
  cuisines: [],
  minRating: null,
  costForTwo: [0, 5000],
  offers: [],
  operatingHours: [],
  distance: null,
  accessibility: [],
  experience: [],
  dietary: [],
  facilities: [],
  ambience: [],
  more: []
};

export interface FilterCategoryDef {
  id: keyof RestaurantFilterState;
  label: string;
  shortLabel: string;
  iconName: string;
  description: string;
}

export const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: 'sortBy', label: 'Sort By', shortLabel: 'Sort', iconName: 'ArrowUpDown', description: 'Order by rating, cost, distance, or relevance' },
  { id: 'cuisines', label: 'Cuisines', shortLabel: 'Cuisine', iconName: 'Utensils', description: 'Filter by authentic and regional food styles' },
  { id: 'minRating', label: 'Rating', shortLabel: 'Rating', iconName: 'Star', description: 'Customer reviews and ratings' },
  { id: 'costForTwo', label: 'Cost for Two', shortLabel: 'Price', iconName: 'IndianRupee', description: 'Estimated budget for two diners' },
  { id: 'offers', label: 'Offers & Discounts', shortLabel: 'Offers', iconName: 'Percent', description: 'Special promotions and complimentary items' },
  { id: 'operatingHours', label: 'Operating Hours', shortLabel: 'Hours', iconName: 'Clock', description: 'Meal windows and current opening status' },
  { id: 'distance', label: 'Distance', shortLabel: 'Distance', iconName: 'MapPin', description: 'Proximity to your current GPS location' },
  { id: 'dietary', label: 'Dietary Preferences', shortLabel: 'Dietary', iconName: 'Leaf', description: 'Vegetarian, Jain, and vegan dining options' },
  { id: 'experience', label: 'Experience Enhancers', shortLabel: 'Experience', iconName: 'Sparkles', description: 'Atmosphere, live entertainment, and seating' },
  { id: 'accessibility', label: 'Accessibility', shortLabel: 'Access', iconName: 'Accessibility', description: 'Wheelchair access and step-free entry' },
  { id: 'facilities', label: 'Facilities', shortLabel: 'Facilities', iconName: 'Building', description: 'Parking, valet, Wi-Fi, and EV charging' },
  { id: 'ambience', label: 'Ambience', shortLabel: 'Ambience', iconName: 'Smile', description: 'Dining vibe from casual to luxury' },
  { id: 'more', label: 'More Filters', shortLabel: 'More', iconName: 'Sliders', description: 'Newly opened and special venue tags' }
];

export interface ActiveFilterTag {
  id: string;
  category: keyof RestaurantFilterState;
  label: string;
  onRemove: () => void;
}
