export type TTableStatus = 
  | 'Available' 
  | 'Occupied' 
  | 'Cleaning' 
  | 'Reserved' 
  | 'Disabled'
  | 'empty' 
  | 'occupied' 
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
  activeOrderId?: string;
  qrCodeUrl: string;
  capacity?: number;
  floor?: string;
  
  // Waiter assignments
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  guestsCount?: number;
  currentOrderId?: string;
  section?: string;
  tableNotes?: string;
  seatingTime?: string;
  billRequestedAt?: string;
  occupiedAt?: string;
  cleaningStartedAt?: string;
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
    s === 'cleaning' || 
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
 * Checks whether a table is currently occupied by active diners.
 */
export const isTableOccupied = (status?: string): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'occupied' || s === 'service_requested' || s === 'bill_requested';
};

/**
 * Checks whether a table is awaiting or undergoing sanitization/cleaning.
 */
export const isTableCleaning = (status?: string): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === 'cleaning';
};


