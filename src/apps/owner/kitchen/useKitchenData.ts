import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IKdsOrder, IKitchenTicket } from '../../../features/kitchen-dashboard/types';
import { filterKitchenStaff } from '../../../shared/services/kitchenService';

export function useKitchenData() {
  const { user } = useAuth();
  const [allOrders, setAllOrders] = useState<IKdsOrder[]>([]);
  const [kitchenTickets, setKitchenTickets] = useState<IKitchenTicket[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Real-time Orders Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);
    const colRef = collection(db, 'restaurants', user.tenantId, 'orders');

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: IKdsOrder[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as IKdsOrder);
        });
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setAllOrders(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('KDS useKitchenData onSnapshot error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 1b. Real-time Canonical Kitchen Tickets (KOT) Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    const ticketsCol = collection(db, 'restaurants', user.tenantId, 'kitchenTickets');
    const unsubscribe = onSnapshot(
      ticketsCol,
      (snapshot) => {
        const list: IKitchenTicket[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as IKitchenTicket);
        });
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setKitchenTickets(list);
      },
      (error) => {
        console.warn('KDS useKitchenData kitchenTickets onSnapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 2. Real-time Employees Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'employees');
    const q = query(
      colRef,
      where('tenantId', '==', user.tenantId),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setEmployees(list);
      },
      (error) => {
        console.error('Error fetching employees in useKitchenData:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 3. Real-time Menu Items Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'menu', 'default', 'items');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setMenuItems(list);
      },
      (error) => {
        console.error('Error fetching menu items in useKitchenData:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  const kitchenStaff = useMemo(() => filterKitchenStaff(employees), [employees]);

  // Enriched orders containing canonical KOT identifiers and printing status
  const enrichedOrders = useMemo(() => {
    if (kitchenTickets.length === 0) return allOrders;

    const ticketMap = new Map<string, IKitchenTicket>();
    kitchenTickets.forEach((t) => {
      if (t.orderId) {
        const existing = ticketMap.get(t.orderId);
        if (!existing || (t.round || 1) >= (existing.round || 1)) {
          ticketMap.set(t.orderId, t);
        }
      }
    });

    return allOrders.map((order) => {
      const kot = ticketMap.get(order.orderId);
      if (!kot) return order;
      return {
        ...order,
        ticketNumber: kot.ticketNumber,
        kotId: kot.id,
        kotRound: kot.round,
        kotIsSupplementary: kot.isSupplementary,
        kotPrintStatus: kot.printStatus,
        kotPrintCount: kot.printCount,
        station: kot.station || (order as any).station
      };
    });
  }, [allOrders, kitchenTickets]);

  return {
    allOrders: enrichedOrders,
    rawOrders: allOrders,
    kitchenTickets,
    employees,
    kitchenStaff,
    menuItems,
    isLoading
  };
}

