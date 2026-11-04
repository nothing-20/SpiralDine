import React from 'react';
import { IKdsOrder } from '../../../features/kitchen-dashboard/types';
import { DEFAULT_STATIONS, inferStationForItem } from '../../../shared/services/kitchenService';
import { 
  Layers, 
  Flame, 
  UtensilsCrossed, 
  Coffee, 
  Cake, 
  Soup, 
  ArrowRight 
} from 'lucide-react';

interface IKitchenStationsLiveBarProps {
  orders: IKdsOrder[];
  onSelectStation?: (stationName: string) => void;
  onViewAll?: () => void;
}

const STATION_ICONS: Record<string, React.ReactNode> = {
  'Starters': <UtensilsCrossed className="w-4 h-4 text-emerald-600" />,
  'Tandoor': <Flame className="w-4 h-4 text-orange-500" />,
  'Chinese': <UtensilsCrossed className="w-4 h-4 text-amber-500" />,
  'Main Course': <Soup className="w-4 h-4 text-rose-500" />,
  'Beverages': <Coffee className="w-4 h-4 text-amber-600" />,
  'Desserts': <Cake className="w-4 h-4 text-purple-500" />,
};

export const KitchenStationsLiveBar: React.FC<IKitchenStationsLiveBarProps> = ({
  orders,
  onSelectStation,
  onViewAll,
}) => {
  // Aggregate items across active orders per station
  const stationCounts = React.useMemo(() => {
    const counts: Record<string, { total: number; preparing: number; delayed: number }> = {};
    
    DEFAULT_STATIONS.forEach((s: any) => {
      counts[s.name] = { total: 0, preparing: 0, delayed: 0 };
    });

    const activeOrders = orders.filter(o => 
      !['COMPLETED', 'ARCHIVED', 'CANCELLED', 'DELIVERED', 'SERVED'].includes(o.status)
    );

    activeOrders.forEach(order => {
      order.items.forEach(item => {
        // Skip served or cancelled items
        const itemStatus = (item as any).status || (item as any).prepStatus || 'NOT_STARTED';
        if (itemStatus === 'SERVED' || itemStatus === 'CANCELLED') return;

        const stationName = (item as any).station || inferStationForItem(item.name, (item as any).category);
        if (!counts[stationName]) {
          counts[stationName] = { total: 0, preparing: 0, delayed: 0 };
        }
        
        counts[stationName].total += Number(item.count || 1);
        if (itemStatus === 'PREPARING') {
          counts[stationName].preparing += Number(item.count || 1);
        }
      });
    });

    return counts;
  }, [orders]);

  return (
    <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 shadow-xs text-left">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-[#18201D]">
            Kitchen Stations (Live)
          </h3>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-[#18201D] hover:text-[#183B2B] flex items-center space-x-1 transition-colors group cursor-pointer"
          >
            <span>View All Stations</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {/* 6 Stations Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DEFAULT_STATIONS.map((station: any) => {
          const stats = stationCounts[station.name] || { total: 0, preparing: 0, delayed: 0 };
          const hasItems = stats.total > 0;
          const isBusy = stats.total >= 4;

          return (
            <div
              key={station.id}
              onClick={() => onSelectStation && onSelectStation(station.name)}
              className="bg-[#FAF8F5] hover:bg-[#F4F0E8] border border-[#E8E3DA] hover:border-[#D1C9BC] rounded-xl p-3 transition-all cursor-pointer flex flex-col justify-between space-y-2 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-md bg-white border border-[#E3DED5] flex items-center justify-center shrink-0">
                    {STATION_ICONS[station.name] || <UtensilsCrossed className="w-3.5 h-3.5 text-stone-600" />}
                  </div>
                  <span className="font-bold text-xs text-[#18201D] truncate group-hover:text-[#183B2B]">
                    {station.name}
                  </span>
                </div>

                {/* Status Dot */}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                    hasItems 
                      ? isBusy 
                        ? 'bg-amber-500 animate-pulse' 
                        : 'bg-emerald-500' 
                      : 'bg-stone-300'
                  }`}
                  title={hasItems ? (isBusy ? 'Busy' : 'Active') : 'Idle'}
                />
              </div>

              <div className="text-[11px] font-semibold text-[#71717A]">
                <span className={hasItems ? 'text-[#18201D] font-bold' : ''}>
                  {stats.total} {stats.total === 1 ? 'Item' : 'Items'}
                </span>
                {stats.preparing > 0 && (
                  <span className="text-amber-600 ml-1 font-medium">
                    ({stats.preparing} cooking)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KitchenStationsLiveBar;
