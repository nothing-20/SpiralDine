import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface IDiningSession {
  sessionId: string;
  tenantId: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
  tableNumber: string;
  tableName: string;
  orderSource: 'qr' | 'app';
  isLocked?: boolean;
  status: 'active' | 'completed' | 'cancelled';
  startedAt: string;
  updatedAt?: string;
  closedAt?: string | null;
  customerName?: string;
  customerPhone?: string;
  primaryOrderId?: string;
  activeOrderIds?: string[];
  billId?: string;
  billingStatus?: 'pending' | 'requested' | 'paid';
  itemsCount?: number;
  totalAmount?: number;
}

const STORAGE_KEY = 'restaurantos_dining_session';

/**
 * Normalizes table number or ID for safe comparison
 */
export const normalizeTableIdentifier = (idOrNum?: string | number): string => {
  if (!idOrNum) return '';
  return String(idOrNum).replace(/^TBL-/i, '').trim().toLowerCase();
};

/**
 * Generates a unique canonical session ID: SES-YYYYMMDD-XXXXXX
 */
export const generateSessionId = (): string => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SES-${dateStr}-${rand}`;
};

/**
 * Checks whether a dining session is currently active
 */
export const isDiningSessionActive = (session?: IDiningSession | null): boolean => {
  if (!session || !session.sessionId) return false;
  if (session.status === 'completed' || session.status === 'cancelled') return false;
  if (session.billingStatus === 'paid') return false;
  return true;
};

/**
 * Retrieves the currently active dining session from sessionStorage or localStorage.
 * Strictly validates that the session matches the expected tenantId and expected table.
 * Different tables must NEVER share a session or bill.
 */
export const getActiveDiningSession = (
  expectedTenantId?: string,
  expectedTableIdOrNumber?: string | number
): IDiningSession | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const session: IDiningSession = JSON.parse(raw);
    if (!session || !session.sessionId) return null;

    // Check if marked completed, cancelled, or paid
    if (!isDiningSessionActive(session)) {
      return null;
    }

    // Tenant check if requested
    if (expectedTenantId) {
      const match = session.restaurantId === expectedTenantId || session.tenantId === expectedTenantId;
      if (!match) return null;
    }

    // Table check if requested: never allow another table's session to be reused
    if (expectedTableIdOrNumber) {
      const expectedNormalized = normalizeTableIdentifier(expectedTableIdOrNumber);
      const sessionTableNorm = normalizeTableIdentifier(session.tableNumber || session.tableId);
      if (expectedNormalized && sessionTableNorm && expectedNormalized !== sessionTableNorm) {
        return null;
      }
    }

    return session;
  } catch (err) {
    console.warn('[diningSession] Failed to parse stored session:', err);
    return null;
  }
};

/**
 * Persists an active dining session to both sessionStorage and localStorage.
 */
export const saveActiveDiningSession = (session: IDiningSession): void => {
  try {
    const serialized = JSON.stringify(session);
    sessionStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.warn('[diningSession] Failed to persist session to storage:', err);
  }
};

/**
 * Clears the active dining session from storage.
 */
export const clearActiveDiningSession = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[diningSession] Failed to clear session:', err);
  }
};

/**
 * Writes or updates the dining session in Firestore at restaurants/{tenantId}/diningSessions/{sessionId}
 */
export const syncDiningSessionToFirestore = async (session: IDiningSession): Promise<void> => {
  if (!session.tenantId && !session.restaurantId) return;
  const tenant = session.tenantId || session.restaurantId;

  try {
    const sessionRef = doc(db, 'restaurants', tenant, 'diningSessions', session.sessionId);
    await setDoc(sessionRef, {
      ...session,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[diningSession] Non-blocking Firestore sync warning:', err);
  }
};

/**
 * Gracefully marks a dining session as completed and closed.
 */
export const closeDiningSession = async (tenantId: string, sessionId: string): Promise<void> => {
  if (!tenantId || !sessionId) return;
  const nowIso = new Date().toISOString();

  try {
    const sessionRef = doc(db, 'restaurants', tenantId, 'diningSessions', sessionId);
    await setDoc(sessionRef, {
      status: 'completed',
      closedAt: nowIso,
      updatedAt: nowIso
    }, { merge: true });

    // Check if the current cached session is this one, and clear it
    const active = getActiveDiningSession(tenantId);
    if (active && active.sessionId === sessionId) {
      clearActiveDiningSession();
    }
  } catch (err) {
    console.warn('[diningSession] Failed to close dining session in Firestore:', err);
  }
};
