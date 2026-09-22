export type TTableStatus = 
  | 'Available' 
  | 'Occupied' 
  | 'Cleaning' 
  | 'Reserved' 
  | 'Disabled'
  | 'empty' 
  | 'occupied' 
  | 'seated'
  | 'browsing'
  | 'service_requested' 
  | 'bill_requested' 
  | 'cleaning';

export interface ITable {
  tableNumber: string;
  id: string;
  tenantId: string;
  number: string;
  seatingCapacity: number;
  status: TTableStatus | string;
  tableStatus?: string;
  subStatus?: 'browsing' | 'seated' | 'ordering' | 'dining' | 'bill_requested' | 'cleaning' | string;
  diningStatus?: string;
  customerPresent?: boolean;
  activeOrderId?: string;
  qrCodeUrl: string;
  capacity?: number;
  floor?: string;
  
  // Waiter assignments & lifecycle
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  guestsCount?: number;
  currentOrderId?: string;
  section?: string;
  tableNotes?: string;
  seatingTime?: string;
  seatedAt?: string;
  lastActiveAt?: string;
  billRequestedAt?: string;
  occupiedAt?: string;
  cleaningStartedAt?: string;
  cleaningDurationMinutes?: number;
  cleaningCompletedAt?: string;
  billPaidAt?: string;
  customerName?: string;
  customerPhone?: string;
  orderSource?: string;
  tableName?: string;
  name?: string;
  isActive?: boolean;
  branchId?: string;
}

/**
 * Checks whether a table is available for customer seating and ordering.
 * Strictly excludes occupied, cleaning, reserved, maintenance, and disabled tables.
 */
export const isTableAvailable = (status?: string, isActive?: boolean): boolean => {
  if (isActive === false) return false;
  if (!status) return true;
  const s = status.toLowerCase().trim();
  if (s === 'available' || s === 'empty') return true;
  if (
    s === 'occupied' || 
    s === 'seated' ||
    s === 'browsing' ||
    s === 'dining' ||
    s === 'cleaning' || 
    s === 'needs_cleaning' ||
    s === 'reserved' || 
    s === 'disabled' || 
    s === 'maintenance' || 
    s === 'service_requested' || 
    s === 'bill_requested'
  ) {
    return false;
  }
  return false;
};

/**
 * Checks whether a table is currently occupied by active diners (seated, browsing, ordering or dining).
 */
export const isTableOccupied = (status?: string, subStatus?: string, diningStatus?: string): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  const sub = (subStatus || diningStatus || '').toLowerCase().trim();
  return (
    s === 'occupied' || 
    s === 'seated' || 
    s === 'dining' || 
    s === 'service_requested' || 
    s === 'bill_requested' ||
    sub === 'seated' ||
    sub === 'dining' ||
    sub === 'ordering'
  );
};

/**
 * Checks whether a table has a diner actively browsing the menu without a committed order yet.
 * Ephemeral: expires after maxAgeMinutes of inactivity so abandoned views do not ghost-occupy tables.
 */
export const isTableBrowsing = (table: ITable, maxAgeMinutes: number = 5): boolean => {
  const status = (table.status || table.tableStatus || '').toLowerCase().trim();
  const sub = (table.subStatus || table.diningStatus || '').toLowerCase().trim();
  const hasOrder = Boolean(table.activeOrderId || table.currentOrderId);
  if (hasOrder) return false;

  const isBrowsingStatus = status === 'browsing' || sub === 'browsing' || (status === 'occupied' && sub === 'seated');
  if (!isBrowsingStatus) return false;

  const timestamp = table.lastActiveAt || table.seatedAt || table.occupiedAt || (table as any).updatedAt;
  if (timestamp) {
    const ageMins = (Date.now() - new Date(timestamp).getTime()) / 60000;
    if (ageMins > maxAgeMinutes) {
      return false; // Stale / abandoned browsing session
    }
  }

  return true;
};

/**
 * Checks whether a table is awaiting or undergoing sanitization/cleaning.
 */
export const isTableCleaning = (status?: string): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'cleaning' || s === 'needs_cleaning' || s === 'sanitizing';
};



