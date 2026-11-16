import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useAuth } from '../../../context/AuthContext';
import { IRestaurantEvent } from '../../domain/events/types';
import Card from '../cards/Card';
import Badge from '../badges/Badge';
import LoadingSpinner from '../loading/LoadingSpinner';

import { 
  Search, 
  Filter, 
  Clock, 
  MapPin, 
  User, 
  Activity, 
  CheckCircle,
  AlertTriangle,
  UtensilsCrossed,
  DollarSign
} from 'lucide-react';

interface ActivityFeedProps {
  maxEvents?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ maxEvents = 100 }) => {
  const { user } = useAuth();
  
  const [events, setEvents] = useState<IRestaurantEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [tableSearch, setTableSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [dateSearch, setDateSearch] = useState('');

  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({
    Operational: true,
    Kitchen: true,
    Waiter: true,
    Billing: true,
    Payment: true,
    Customer: true,
    Cleaning: true,
    Management: true,
    System: true
  });

  // Subscribe to Events Collection
  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);
    const colRef = collection(db, 'restaurants', user.tenantId, 'events');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxEvents));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: IRestaurantEvent[] = [];
      snapshot.forEach(docSnap => {
        list.push({ eventId: docSnap.id, ...docSnap.data() } as IRestaurantEvent);
      });
      setEvents(list);
      setIsLoading(false);
    }, (err) => {
      console.error('Error loading events stream:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.tenantId, maxEvents]);

  // Derived Filtered List
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Table Filter
      if (tableSearch && !e.tableNumber?.toLowerCase().includes(tableSearch.toLowerCase())) {
        return false;
      }
      // Order Filter
      if (orderSearch && !e.orderId?.toLowerCase().includes(orderSearch.toLowerCase())) {
        return false;
      }
      // Employee Filter
      if (employeeSearch && !e.performedBy?.toLowerCase().includes(employeeSearch.toLowerCase())) {
        return false;
      }
      // Event Type Filter
      if (typeSearch && !e.eventType?.toLowerCase().includes(typeSearch.toLowerCase())) {
        return false;
      }
      // Date Filter
      if (dateSearch && !e.timestamp?.startsWith(dateSearch)) {
        return false;
      }
      // Category Filter
      if (!selectedCategories[e.eventCategory]) {
        return false;
      }

      return true;
    });
  }, [events, tableSearch, orderSearch, employeeSearch, typeSearch, dateSearch, selectedCategories]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Kitchen': return 'danger';
      case 'Waiter': return 'warning';
      case 'Billing': return 'info';
      case 'Payment': return 'success';
      case 'Customer': return 'primary';
      case 'Cleaning': return 'muted';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6 text-left select-none">
      {/* Search & Filters Controls */}
      <Card className="p-5 border-slate-850 bg-slate-900/30 rounded-2xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-850 pb-2">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-extrabold uppercase text-textPearl tracking-wider">Search & Feed Filters</h3>
        </div>

        {/* Inputs row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">Search Table</label>
            <input
              type="text"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-300 outline-none placeholder:opacity-30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">Search Order ID</label>
            <input
              type="text"
              value={orderSearch}
              onChange={e => setOrderSearch(e.target.value)}
              placeholder="Order ID key..."
              className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-300 outline-none placeholder:opacity-30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">Search Employee</label>
            <input
              type="text"
              value={employeeSearch}
              onChange={e => setEmployeeSearch(e.target.value)}
              placeholder="Actor name..."
              className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-350 outline-none placeholder:opacity-30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">Event Type</label>
            <input
              type="text"
              value={typeSearch}
              onChange={e => setTypeSearch(e.target.value)}
              placeholder="Order Ready..."
              className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-300 outline-none placeholder:opacity-30"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">Date Filter</label>
            <input
              type="date"
              value={dateSearch}
              onChange={e => setDateSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-300 outline-none"
            />
          </div>
        </div>

        {/* Category checkboxes */}
        <div className="space-y-1.5 pt-2">
          <span className="text-[10px] text-slate-500 font-extrabold uppercase">Filter by Event Category</span>
          <div className="flex flex-wrap gap-2">
            {Object.keys(selectedCategories).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1 rounded-xl text-[10.5px] font-bold border transition-all ${
                  selectedCategories[cat]
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'border-slate-800 text-slate-500 hover:text-slate-350'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Events Listing feed */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner label="Loading real-time event feed..." />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-850 rounded-3xl">
          <Activity className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-sm font-semibold">Zero logs match search filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(event => (
            <Card
              key={event.eventId}
              className="p-4 border-slate-850 bg-slate-900/35 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:border-slate-800 transition-colors"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <Badge variant={getCategoryColor(event.eventCategory)}>
                    {event.eventCategory}
                  </Badge>
                  <span className="font-extrabold text-textPearl">{event.eventType}</span>
                  {event.tableNumber && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-450 border border-blue-500/20 text-[9px] font-bold">
                      Table {event.tableNumber}
                    </span>
                  )}
                  {event.orderId && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-mono">
                      #{event.orderId.substring(0, 8)}
                    </span>
                  )}
                </div>

                <p className="text-slate-355 font-semibold">{event.description}</p>
                
                <div className="flex items-center space-x-3 text-[10px] text-slate-500">
                  <div className="flex items-center space-x-0.5">
                    <User className="w-3 h-3 text-slate-650" />
                    <span className="font-bold text-slate-400">{event.performedBy}</span>
                    <span className="opacity-60">({event.performedByRole})</span>
                  </div>
                  <span>·</span>
                  <div className="flex items-center space-x-0.5">
                    <Clock className="w-3 h-3 text-slate-650" />
                    <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              {/* Extra Metadata Payload details if present */}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="bg-slate-950/40 p-2.5 border border-slate-850 rounded-xl text-[9.5px] font-mono text-slate-455 max-w-xs overflow-hidden shrink-0 text-left">
                  {Object.entries(event.metadata).map(([k, v]) => (
                    <div key={k} className="truncate">
                      <span className="text-primary font-bold">{k}:</span> {String(v)}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
export default ActivityFeed;
