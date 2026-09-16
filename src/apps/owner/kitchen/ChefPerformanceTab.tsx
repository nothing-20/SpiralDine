import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import Card from '../../../components/ui/Card/Card';
import { ChefHat, Star, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { filterKitchenStaff } from '../../../shared/services/kitchenService';

interface IChefPerformanceTabProps {
  orders: any[];
  employees: any[];
}

export const ChefPerformanceTab: React.FC<IChefPerformanceTabProps> = ({ orders, employees }) => {
  const { user } = useAuth();
  const [ratingsList, setRatingsList] = useState<any[]>([]);

  // Real-time listener for satisfaction ratings
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'satisfactionRatings');
    const unsub = onSnapshot(colRef, (snap) => {
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRatingsList(list);
    }, (err) => {
      console.error('Ratings load error:', err);
    });

    return () => unsub();
  }, [user?.tenantId]);

  // Derive chef list (employees with kitchen-authorized role)
  const chefs = useMemo(() => {
    const list = filterKitchenStaff(employees);
    // Fallback: collect from assigned chef names in orders if employees is empty
    if (list.length === 0) {
      const names = new Set<string>();
      orders.forEach(o => { if (o.assignedChefName) names.add(o.assignedChefName); });
      return Array.from(names).map(name => ({ id: name, fullName: name }));
    }
    return list;
  }, [employees, orders]);

  // Calculate metrics per chef
  const chefMetrics = useMemo(() => {
    // Current shift determination
    const hr = new Date().getHours();
    const currentShift = hr >= 6 && hr < 14 ? 'Morning Shift' : hr >= 14 && hr < 22 ? 'Evening Shift' : 'Night Shift';

    return chefs.map(chef => {
      let completed = 0;
      let delayed = 0;
      let totalCookTime = 0;
      let cookTimeCount = 0;
      let fastest = Infinity;
      let slowest = 0;
      let active = 0;
      
      const chefOrders = orders.filter(
        o => o.assignedChefName === chef.fullName || o.assignedChefId === chef.id
      );

      chefOrders.forEach(order => {
        const isCompletedState = ['READY', 'DELIVERED', 'COMPLETED', 'ARCHIVED'].includes(order.status);
        
        if (isCompletedState) {
          completed += 1;

          // Cook time calculation (cookingStartedAt to readyAt)
          if (order.cookingStartedAt && order.readyAt) {
            const cookTime = (new Date(order.readyAt).getTime() - new Date(order.cookingStartedAt).getTime()) / 60000;
            if (cookTime > 0) {
              totalCookTime += cookTime;
              cookTimeCount += 1;
              if (cookTime < fastest) fastest = cookTime;
              if (cookTime > slowest) slowest = cookTime;

              // Check if delay occurred relative to estimated prep time
              const estTime = order.estimatedPrepTime || order.items?.length * 5 || 15;
              if (cookTime > estTime) {
                delayed += 1;
              }
            }
          }
        } else if (order.status !== 'CANCELLED') {
          active += 1;
        }
      });

      const avgCookTime = cookTimeCount > 0 ? (totalCookTime / cookTimeCount) : 0;
      const efficiency = completed > 0 ? Math.round(((completed - delayed) / completed) * 100) : 100;

      // Average rating from satisfaction ratings
      const chefRatings = ratingsList.filter(r => 
        chefOrders.some(o => o.orderId === r.orderId)
      );
      const avgRating = chefRatings.length > 0
        ? (chefRatings.reduce((acc, r) => acc + (r.rating || 0), 0) / chefRatings.length).toFixed(1)
        : '—';

      return {
        id: chef.id,
        name: chef.fullName,
        completed,
        delayed,
        avgCookTime,
        fastest: fastest === Infinity ? 0 : fastest,
        slowest,
        shift: currentShift,
        active,
        efficiency,
        rating: avgRating
      };
    });
  }, [chefs, orders, ratingsList]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 text-left select-none font-sans">
      {chefMetrics.map(chef => (
        <div 
          key={chef.id} 
          className="p-5 bg-white border border-[#E3DED5] rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)] flex flex-col justify-between space-y-4"
        >
          <div>
            {/* Chef Identity */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[#F7F4EE] flex items-center justify-center border border-[#E3DED5] shrink-0">
                <ChefHat className="w-5 h-5 text-[#18201D]" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-base text-[#18201D] truncate">{chef.name}</h4>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#287A55]" />
                  <p className="text-[11px] text-[#5F6762] font-semibold uppercase tracking-wider">{chef.shift}</p>
                </div>
              </div>
            </div>

            {/* Core Stats Row */}
            <div className="grid grid-cols-3 gap-2.5 mt-4 text-center">
              <div className="bg-[#FBF9F5] p-2.5 rounded-lg border border-[#E3DED5]">
                <span className="text-xl font-bold font-mono text-[#287A55] block leading-none">{chef.completed}</span>
                <p className="text-[10px] font-semibold text-[#5F6762] uppercase tracking-wider mt-1.5">Completed</p>
              </div>
              <div className="bg-[#FBF9F5] p-2.5 rounded-lg border border-[#E3DED5]">
                <span className={`text-xl font-bold font-mono block leading-none ${chef.delayed > 0 ? 'text-[#C7463A]' : 'text-[#5F6762]'}`}>
                  {chef.delayed}
                </span>
                <p className="text-[10px] font-semibold text-[#5F6762] uppercase tracking-wider mt-1.5">Delayed</p>
              </div>
              <div className="bg-[#FBF9F5] p-2.5 rounded-lg border border-[#E3DED5]">
                <span className="text-xl font-bold font-mono text-[#287A55] block leading-none">{chef.efficiency}%</span>
                <p className="text-[10px] font-semibold text-[#5F6762] uppercase tracking-wider mt-1.5">Efficiency</p>
              </div>
            </div>

            {/* Performance Parameters */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-[#E3DED5]">
                <span className="text-[#5F6762] flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#5F6762]" />
                  <span>Avg Cook Time:</span>
                </span>
                <span className="font-mono font-semibold text-[#18201D]">
                  {chef.avgCookTime > 0 ? `${chef.avgCookTime.toFixed(1)}m` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-[#E3DED5]">
                <span className="text-[#5F6762]">Fastest Order:</span>
                <span className="font-mono font-semibold text-[#287A55]">
                  {chef.fastest > 0 ? `${chef.fastest.toFixed(1)}m` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-[#E3DED5]">
                <span className="text-[#5F6762]">Slowest Order:</span>
                <span className={`font-mono font-semibold ${chef.slowest > 25 ? 'text-[#C7463A]' : 'text-[#18201D]'}`}>
                  {chef.slowest > 0 ? `${chef.slowest.toFixed(1)}m` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-[#E3DED5]">
                <span className="text-[#5F6762]">Active Load:</span>
                <span className={`font-mono font-semibold ${chef.active === 0 ? 'text-[#287A55]' : 'text-[#D79A24]'}`}>
                  {chef.active} tickets
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-[#5F6762] flex items-center space-x-1.5">
                  <Star className="w-3.5 h-3.5 text-[#D79A24]" />
                  <span>Chef Rating:</span>
                </span>
                <span className="font-semibold text-[#A66B00] flex items-center space-x-0.5">
                  <span>{chef.rating}</span>
                  {chef.rating !== '—' && <Star className="w-3 h-3 fill-current text-[#D79A24]" />}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
export default ChefPerformanceTab;
