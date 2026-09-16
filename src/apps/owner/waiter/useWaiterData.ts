import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IOrder, ITable } from '../../../types';

export function useWaiterData() {
  const { user } = useAuth();
  const [tables, setTables] = useState<ITable[]>([]);
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Real-time Tables Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);
    const tablesRef = collection(db, 'restaurants', user.tenantId, 'tables');
    const unsubscribe = onSnapshot(
      tablesRef,
      (snapshot) => {
        const list: ITable[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as ITable);
        });
        list.sort((a, b) => {
          const numA = String(a.number || (a as any).tableNumber || '');
          const numB = String(b.number || (b as any).tableNumber || '');
          return numA.localeCompare(numB, undefined, { numeric: true });
        });
        setTables(list);
      },
      (error) => {
        console.error('Error fetching tables in useWaiterData:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 2. Real-time Orders Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    const ordersRef = collection(db, 'restaurants', user.tenantId, 'orders');
    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        const list: IOrder[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, orderId: docSnap.id, ...(docSnap.data() as any) } as IOrder);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching orders in useWaiterData:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 3. Real-time Waiter Requests Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    const reqRef = collection(db, 'restaurants', user.tenantId, 'waiterRequests');
    const unsubscribe = onSnapshot(
      reqRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Exclude food order events from customer assistance requests
          if (data.requestType === 'New Order Placed' || data.type === 'New Order Placed') {
            return;
          }
          list.push({ id: docSnap.id, ...data });
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setWaiterRequests(list);
      },
      (error) => {
        console.error('Error fetching waiterRequests in useWaiterData:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 4. Real-time Employees Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    const employeesRef = collection(db, 'employees');
    const q = query(
      employeesRef,
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
        console.error('Error fetching employees in useWaiterData:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 5. Real-time Menu Items Listener
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
        console.error('Error fetching menu items in useWaiterData:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  return { tables, orders, waiterRequests, employees, menuItems, isLoading };
}
