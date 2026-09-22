export interface IMenuCategory {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  image: string;
}

export interface IMenuItem {
  rating?: number;
  id: string;
  name: string;
  description: string;
  categoryId: string;
  category: string; // for backward compatibility
  price: number; // in cents
  discountPrice?: number; // in cents
  image: string;
  imageUrl: string; // for backward compatibility
  preparationTime: number; // in minutes
  isVeg: boolean;
  veg: boolean; // for backward compatibility
  isAvailable: boolean;
  available: boolean; // for backward compatibility
  availability?: boolean; // for backward compatibility
  isBestSeller: boolean;
  isRecommended: boolean;
  spiceLevel: string; // 'none' | 'mild' | 'medium' | 'hot'
  tags: string[];
  station?: string; // e.g. 'Grill', 'Pizza', 'Drinks', etc.
  createdAt?: string;
  updatedAt?: string;

  // Batch Prepared Food Management
  preparationMethod?: 'fresh' | 'batch';
  defaultBatchSize?: number;
  availableServings?: number;
  lowStockThreshold?: number;
  autoUnavailable?: boolean;
  showServingsToStaff?: boolean;
  allowRefill?: boolean;
  productionMode?: 'On Demand' | 'Batch Production';
  createdBy?: string;
  updatedBy?: string;
  status?: string;
  bestseller?: boolean;
  recommended?: boolean;
  prepTime?: number;
  vegetarian?: boolean;
  isPublished?: boolean; // Customer-facing visibility
  published?: boolean; // for backward compatibility
  flags?: {
    vegetarian?: boolean;
    bestseller?: boolean;
    recommended?: boolean;
    published?: boolean;
  };
}

export interface IMenuVariant {
  id: string;
  itemId: string;
  name: string; // e.g. 'Small', 'Medium', 'Large'
  price: number; // in cents or direct currency units
  priceOffset?: number; // relative to base item price
  isAvailable: boolean;
  available?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IMenuAddon {
  id: string;
  itemId?: string; // specific item or optional if global
  name: string; // e.g. 'Extra Cheese', 'Truffle Sauce'
  price: number;
  isAvailable: boolean;
  available?: boolean;
  isGlobal?: boolean;
  applicableItems?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IMenuComboItem {
  itemId: string;
  itemName?: string;
  quantity: number;
}

export interface IMenuCombo {
  id: string;
  name: string;
  description: string;
  price: number;
  items: IMenuComboItem[];
  image?: string;
  imageUrl?: string;
  isAvailable: boolean;
  available?: boolean;
  isPublished: boolean;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
