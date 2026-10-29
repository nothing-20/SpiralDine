export type TArchitecturalType = 
  | 'main_entrance'
  | 'entrance'
  | 'kitchen'
  | 'washroom'
  | 'billing_counter'
  | 'reception'
  | 'service_station'
  | 'bar'
  | 'wall'
  | 'window'
  | 'door'
  | 'column'
  | 'custom_area';

export interface IArchitecturalElement {
  id: string;
  type: TArchitecturalType;
  label: string;
  x: number;       // Coordinate X in local canvas space (0 - 1000)
  y: number;       // Coordinate Y in local canvas space (0 - 700)
  width: number;   // Dimension in local canvas units
  height: number;
  rotation: number;// Degrees: 0, 45, 90, 180, 270
  color?: string;
  floorId: string;
  sectionId?: string;
  zIndex?: number;
  notes?: string;
  customIcon?: string;
}

export interface ITableVisualConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  shape?: 'circle' | 'square' | 'rectangle';
  sectionId?: string;
  zIndex?: number;
}

export interface IFloorPlanConfig {
  id: string;                       // e.g. "floorplan_FLR-12345"
  floorId: string;                  // Matches IFloor.id or IFloor.name
  floorName: string;
  tenantId: string;
  branchId?: string;
  elements: IArchitecturalElement[];
  tablePositions: Record<string, ITableVisualConfig>; // Keyed by tableId or table document ID
  canvasWidth?: number;             // Default 1000
  canvasHeight?: number;            // Default 700
  physicalWidth?: number;           // Real floor width (e.g. 20)
  physicalHeight?: number;          // Real floor height (e.g. 14)
  measurementUnit?: 'meters' | 'feet';
  gridSnap?: boolean;
  gridSize?: number;                // e.g. 20
  version?: number;
  updatedAt: string;
  updatedBy: string;
}

export interface IFloorPlanPreset {
  type: TArchitecturalType;
  label: string;
  defaultWidth: number;
  defaultHeight: number;
  iconName: string;
  category: 'entrances' | 'service' | 'facilities' | 'structural';
}

export const ARCHITECTURAL_PRESETS: IFloorPlanPreset[] = [
  {
    type: 'main_entrance',
    label: 'Main Entrance',
    defaultWidth: 120,
    defaultHeight: 50,
    iconName: 'DoorOpen',
    category: 'entrances'
  },
  {
    type: 'entrance',
    label: 'Side Entrance / Exit',
    defaultWidth: 100,
    defaultHeight: 45,
    iconName: 'LogOut',
    category: 'entrances'
  },
  {
    type: 'reception',
    label: 'Host & Reception Desk',
    defaultWidth: 130,
    defaultHeight: 60,
    iconName: 'Bell',
    category: 'service'
  },
  {
    type: 'billing_counter',
    label: 'Billing / Cashier',
    defaultWidth: 140,
    defaultHeight: 65,
    iconName: 'CreditCard',
    category: 'service'
  },
  {
    type: 'kitchen',
    label: 'Main Kitchen / Dispense',
    defaultWidth: 200,
    defaultHeight: 110,
    iconName: 'ChefHat',
    category: 'service'
  },
  {
    type: 'bar',
    label: 'Bar Counter',
    defaultWidth: 180,
    defaultHeight: 70,
    iconName: 'Wine',
    category: 'service'
  },
  {
    type: 'service_station',
    label: 'Waiter Service Station',
    defaultWidth: 90,
    defaultHeight: 60,
    iconName: 'Utensils',
    category: 'service'
  },
  {
    type: 'washroom',
    label: 'Restrooms / Washroom',
    defaultWidth: 130,
    defaultHeight: 90,
    iconName: 'Bath',
    category: 'facilities'
  },
  {
    type: 'wall',
    label: 'Partition Wall',
    defaultWidth: 160,
    defaultHeight: 20,
    iconName: 'Square',
    category: 'structural'
  },
  {
    type: 'window',
    label: 'Exterior Window',
    defaultWidth: 120,
    defaultHeight: 16,
    iconName: 'Maximize2',
    category: 'structural'
  },
  {
    type: 'column',
    label: 'Structural Pillar',
    defaultWidth: 40,
    defaultHeight: 40,
    iconName: 'Circle',
    category: 'structural'
  },
  {
    type: 'custom_area',
    label: 'VIP / Patio Zone',
    defaultWidth: 220,
    defaultHeight: 160,
    iconName: 'Sparkles',
    category: 'structural'
  }
];

