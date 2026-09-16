import React, { useState, useEffect, useMemo } from 'react';
import Card from '../../../components/ui/Card/Card';
import { Clock, Play, Square, Coffee, User, TrendingUp } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { IShiftRecord } from '../../../shared/domain/orders/types';
import { kitchenService, filterKitchenStaff } from '../../../shared/services/kitchenService';
import { toast } from 'react-hot-toast';

interface IShiftManagementPanelProps {
  employees: any[];
}

const ShiftManagementPanel: React.FC<IShiftManagementPanelProps> = ({ employees }) => {
  const { user } = useAuth();
  const [activeShifts, setActiveShifts] = useState<IShiftRecord[]>([]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = kitchenService.subscribeToActiveShifts(user.tenantId, setActiveShifts);
    return () => unsub();
  }, [user?.tenantId]);

  const kitchenStaff = useMemo(
    () => filterKitchenStaff(employees),
    [employees]
  );

  const isOnShift = (chefId: string) => activeShifts.some(s => s.chefId === chefId);

  const handleStartShift = async (chef: any) => {
    if (!user?.tenantId) return;
    try {
      await kitchenService.startShift(user.tenantId, chef.id, chef.fullName || chef.name);
      toast.success(`${chef.fullName || chef.name} started shift`);
    } catch (err) {
      toast.error('Failed to start shift');
    }
  };

  const handleEndShift = async (shift: IShiftRecord) => {
    if (!user?.tenantId || !shift.id) return;
    try {
      const shiftDurationMinutes = (Date.now() - new Date(shift.shiftStart).getTime()) / 60000;
      await kitchenService.endShift(user.tenantId, shift.id, {
        efficiency: Math.min(100, Math.round((shift.ordersCompleted / Math.max(shiftDurationMinutes / 10, 1)) * 100)),
      });
      toast.success(`${shift.chefName} ended shift`);
    } catch (err) {
      toast.error('Failed to end shift');
    }
  };

  const formatDuration = (startIso: string): string => {
    const ms = Date.now() - new Date(startIso).getTime();
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-extrabold text-textPearl flex items-center space-x-1.5">
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        <span>Shift Management</span>
        <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
          {activeShifts.length} active
        </span>
      </h3>

      {/* Active Shifts */}
      {activeShifts.length > 0 && (
        <div className="space-y-1.5">
          {activeShifts.map(shift => (
            <div
              key={shift.id}
              className="flex items-center justify-between px-3 py-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            >
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <span className="text-[10px] font-extrabold">{shift.chefName}</span>
                  <div className="text-[9px] opacity-60 flex items-center space-x-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{formatDuration(shift.shiftStart)}</span>
                    <span>·</span>
                    <span>{shift.ordersCompleted} orders</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleEndShift(shift)}
                className="flex items-center space-x-1 text-[9px] font-extrabold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 px-2 py-1 rounded-lg transition-all"
              >
                <Square className="w-2.5 h-2.5" />
                <span>End</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Available Staff (not on shift) */}
      {kitchenStaff.filter(c => !isOnShift(c.id)).length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
            Not on Shift
          </span>
          {kitchenStaff.filter(c => !isOnShift(c.id)).map(chef => (
            <div
              key={chef.id}
              className="flex items-center justify-between px-3 py-2 rounded-xl border bg-slate-900/40 border-slate-800 text-slate-400"
            >
              <div className="flex items-center space-x-2">
                <User className="w-3 h-3" />
                <span className="text-[10px] font-bold">{chef.fullName || chef.name}</span>
              </div>
              <button
                onClick={() => handleStartShift(chef)}
                className="flex items-center space-x-1 text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-2 py-1 rounded-lg transition-all"
              >
                <Play className="w-2.5 h-2.5" />
                <span>Start</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {kitchenStaff.length === 0 && (
        <p className="text-[10px] text-slate-500 text-center py-2">No kitchen staff configured</p>
      )}
    </div>
  );
};

export default ShiftManagementPanel;
