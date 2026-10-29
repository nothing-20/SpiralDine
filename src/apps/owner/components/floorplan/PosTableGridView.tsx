import React, { useMemo } from 'react';
import { 
  Users, 
  Clock, 
  Receipt, 
  Utensils, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  QrCode, 
  Edit2, 
  Copy, 
  Trash2, 
  Layers, 
  Compass, 
  Search, 
  Plus,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { ITableItem, IFloor, ISection } from '../../pages/OwnerTablesManager';
import { formatPrice } from '../../../../utils/format';
import { 
  isTableAvailable, 
  isTableOccupied, 
  isTableCleaning 
} from '../../../../shared/domain/tables/types';
import Badge from '../../../../components/ui/Badge/Badge';
import Button from '../../../../components/ui/Button/Button';

interface PosTableGridViewProps {
  tables: ITableItem[];
  floors: IFloor[];
  sections: ISection[];
  activeFloorFilter: string;
  onSelectFloorFilter: (floorName: string) => void;
  activeOrdersMap?: Record<string, any>;
  selectedTableId: string | null;
  onSelectTable: (table: ITableItem) => void;
  onOpenEditModal: (table: ITableItem) => void;
  onShowQrModal: (table: ITableItem) => void;
  onDuplicateTable: (table: ITableItem) => void;
  onArchiveTable: (table: ITableItem) => void;
  onAddNewTable: () => void;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
}

/**
 * Format elapsed time in mins or hours from ISO string
 */
function getElapsedTime(timeStr?: string): string | null {
  if (!timeStr) return null;
  try {
    const start = new Date(timeStr).getTime();
    if (isNaN(start)) return null;
    const diffMs = Date.now() - start;
    if (diffMs <= 0) return 'Just seated';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `${diffHrs}h ${remMins}m`;
  } catch {
    return null;
  }
}

export const PosTableGridView: React.FC<PosTableGridViewProps> = ({
  tables,
  floors,
  sections,
  activeFloorFilter,
  onSelectFloorFilter,
  activeOrdersMap = {},
  selectedTableId,
  onSelectTable,
  onOpenEditModal,
  onShowQrModal,
  onDuplicateTable,
  onArchiveTable,
  onAddNewTable,
  onResetFilters,
  hasActiveFilters = false
}) => {
  // 1. Filter tables by floor if an explicit floor is selected (or 'all' for all floors)
  const floorFilteredTables = useMemo(() => {
    if (!activeFloorFilter || activeFloorFilter === 'all') return tables;
    return tables.filter(t => t.floor === activeFloorFilter);
  }, [tables, activeFloorFilter]);

  // 2. Group tables hierarchically: Floor -> Section -> Tables
  const groupedData = useMemo(() => {
    // Collect unique floor names present in matching tables
    const floorMap = new Map<string, Map<string, ITableItem[]>>();

    floorFilteredTables.forEach(tbl => {
      const floorName = tbl.floor || 'Main Floor';
      const sectionName = tbl.section || 'General Seating';

      if (!floorMap.has(floorName)) {
        floorMap.set(floorName, new Map<string, ITableItem[]>());
      }
      const secMap = floorMap.get(floorName)!;
      if (!secMap.has(sectionName)) {
        secMap.set(sectionName, []);
      }
      secMap.get(sectionName)!.push(tbl);
    });

    // Transform into clean structured array
    const result: {
      floorName: string;
      totalTables: number;
      availableCount: number;
      occupiedCount: number;
      reservedCount: number;
      cleaningCount: number;
      sections: {
        sectionName: string;
        tables: ITableItem[];
        availableCount: number;
        occupiedCount: number;
      }[];
    }[] = [];

    floorMap.forEach((secMap, floorName) => {
      let floorTotal = 0;
      let floorAvail = 0;
      let floorOcc = 0;
      let floorRes = 0;
      let floorClean = 0;

      const sectionList: {
        sectionName: string;
        tables: ITableItem[];
        availableCount: number;
        occupiedCount: number;
      }[] = [];

      secMap.forEach((tblList, sectionName) => {
        // Natural numerical sort for table codes (#1, #2, #10)
        tblList.sort((a, b) => {
          return (a.tableNumber || '').localeCompare(b.tableNumber || '', undefined, {
            numeric: true,
            sensitivity: 'base'
          });
        });

        const sAvail = tblList.filter(t => isTableAvailable(t.status, t.isActive)).length;
        const sOcc = tblList.filter(t => isTableOccupied(t.status) || t.status === 'Occupied' || t.status === 'Dining' || t.status === 'Bill Requested' || t.status === 'Ordering' || t.status === 'Preparing').length;
        const sRes = tblList.filter(t => (t.status || '').toLowerCase() === 'reserved').length;
        const sClean = tblList.filter(t => isTableCleaning(t.status)).length;

        floorTotal += tblList.length;
        floorAvail += sAvail;
        floorOcc += sOcc;
        floorRes += sRes;
        floorClean += sClean;

        sectionList.push({
          sectionName,
          tables: tblList,
          availableCount: sAvail,
          occupiedCount: sOcc
        });
      });

      // Sort sections alphabetically
      sectionList.sort((a, b) => a.sectionName.localeCompare(b.sectionName));

      result.push({
        floorName,
        totalTables: floorTotal,
        availableCount: floorAvail,
        occupiedCount: floorOcc,
        reservedCount: floorRes,
        cleaningCount: floorClean,
        sections: sectionList
      });
    });

    // Sort floors to respect existing floor list order if available
    result.sort((a, b) => {
      const idxA = floors.findIndex(f => f.name === a.floorName);
      const idxB = floors.findIndex(f => f.name === b.floorName);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return a.floorName.localeCompare(b.floorName);
    });

    return result;
  }, [floorFilteredTables, floors]);

  // Status Styling Configuration
  const getStatusConfig = (status: string, isActive: boolean) => {
    if (!isActive || status === 'Disabled') {
      return {
        stripBg: 'bg-slate-400',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
        cardBorder: 'border-slate-200 hover:border-slate-400',
        accentText: 'text-slate-600',
        icon: AlertCircle,
        label: 'Disabled'
      };
    }
    if (isTableCleaning(status)) {
      return {
        stripBg: 'bg-sky-500',
        badgeBg: 'bg-[#E0F2FE] text-[#0369A1] border-sky-300',
        cardBorder: 'border-sky-200 hover:border-sky-400',
        accentText: 'text-sky-700',
        icon: Sparkles,
        label: 'Cleaning'
      };
    }
    if (status.toLowerCase() === 'reserved') {
      return {
        stripBg: 'bg-amber-500',
        badgeBg: 'bg-[#FEF3C7] text-[#92400E] border-amber-300',
        cardBorder: 'border-amber-200 hover:border-amber-400',
        accentText: 'text-amber-700',
        icon: Calendar,
        label: 'Reserved'
      };
    }
    if (isTableOccupied(status) || status === 'Occupied' || status === 'Dining' || status === 'Bill Requested' || status === 'Ordering' || status === 'Preparing') {
      const isBillReq = status === 'Bill Requested' || status.toLowerCase() === 'bill_requested';
      return {
        stripBg: isBillReq ? 'bg-purple-600' : 'bg-[#C9533B]',
        badgeBg: isBillReq ? 'bg-purple-100 text-purple-900 border-purple-300' : 'bg-[#FBEAE5] text-[#9B331D] border-[#F5CBC4]',
        cardBorder: 'border-[#F5CBC4] hover:border-[#C9533B]',
        accentText: 'text-[#9B331D]',
        icon: Utensils,
        label: isBillReq ? 'Bill Requested' : 'Occupied'
      };
    }
    // Default: Available
    return {
      stripBg: 'bg-[#16A34A]',
      badgeBg: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
      cardBorder: 'border-emerald-200 hover:border-emerald-500',
      accentText: 'text-[#166534]',
      icon: CheckCircle2,
      label: 'Available'
    };
  };

  return (
    <div className="space-y-6 text-left">
      {/* ── Floor Quick-Filter Pills Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-[#D8DDD6]">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5F675F] flex items-center space-x-1 shrink-0 mr-1">
            <Layers className="w-3.5 h-3.5 text-[#D94F2B]" />
            <span>Floor:</span>
          </span>
          <button
            type="button"
            onClick={() => onSelectFloorFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border shrink-0 ${
              !activeFloorFilter || activeFloorFilter === 'all'
                ? 'bg-[#12352D] text-white border-[#12352D] shadow-xs'
                : 'bg-white text-[#5F675F] border-[#D8DDD6] hover:bg-[#FAF8F4]'
            }`}
          >
            <span>All Floors</span>
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20">
              {tables.length}
            </span>
          </button>
          {floors.map(f => {
            const floorCount = tables.filter(t => t.floor === f.name).length;
            const isSelected = activeFloorFilter === f.name;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelectFloorFilter(f.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border shrink-0 ${
                  isSelected
                    ? 'bg-[#12352D] text-white border-[#12352D] shadow-xs'
                    : 'bg-white text-[#5F675F] border-[#D8DDD6] hover:bg-[#FAF8F4]'
                }`}
              >
                <span>{f.name}</span>
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-[#D94F2B] text-white' : 'bg-[#F0F2F0] text-[#5F675F]'
                }`}>
                  {floorCount}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={onAddNewTable}
            className="rounded-xl bg-[#12352D] hover:bg-[#1A473C] text-white text-xs font-bold shadow-xs flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Table</span>
          </Button>
        </div>
      </div>

      {/* ── Empty State ── */}
      {groupedData.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-3xl bg-white border border-[#D8DDD6] shadow-2xs space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF8F4] border border-[#D8DDD6] flex items-center justify-center text-[#5F675F]">
            <Search className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-extrabold text-[#202820]">No tables found</h4>
            <p className="text-xs text-[#5F675F]">
              No dining tables match the current filter or search criteria. Try modifying your filters or add a new table.
            </p>
          </div>
          {hasActiveFilters && onResetFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="rounded-xl border-[#D8DDD6] hover:bg-[#FAF8F4] text-xs font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        /* ── Hierarchical Floor & Section Grid ── */
        <div className="space-y-8">
          {groupedData.map(floorGroup => (
            <div key={floorGroup.floorName} className="space-y-5">
              {/* Floor Group Header Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b-2 border-[#12352D]/15">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#12352D] text-white flex items-center justify-center shadow-2xs">
                    <Layers className="w-4 h-4 text-[#D94F2B]" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-[#12352D] tracking-wide uppercase font-serif">
                    {floorGroup.floorName}
                  </h3>
                </div>

                {/* Floor Summary Stats Badge Pills */}
                <div className="flex items-center space-x-2 text-[11px] font-bold">
                  <span className="px-2 py-0.5 rounded-lg bg-white border border-[#D8DDD6] text-[#202820]">
                    {floorGroup.totalTables} Tables
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
                    {floorGroup.availableCount} Available
                  </span>
                  {floorGroup.occupiedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#FBEAE5] text-[#9B331D] border border-[#F5CBC4]">
                      {floorGroup.occupiedCount} Occupied
                    </span>
                  )}
                  {floorGroup.reservedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#FEF3C7] text-[#92400E] border border-amber-200">
                      {floorGroup.reservedCount} Reserved
                    </span>
                  )}
                  {floorGroup.cleaningCount > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] border border-sky-200">
                      {floorGroup.cleaningCount} Cleaning
                    </span>
                  )}
                </div>
              </div>

              {/* Sections within Floor */}
              <div className="space-y-6 pl-0 sm:pl-2">
                {floorGroup.sections.map(secGroup => (
                  <div key={secGroup.sectionName} className="space-y-3">
                    {/* Section Sub-header */}
                    <div className="flex items-center space-x-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#D94F2B]" />
                      <span className="font-extrabold text-[#202820] text-xs sm:text-sm">
                        {secGroup.sectionName}
                      </span>
                      <span className="text-[11px] font-bold text-[#5F675F]">
                        ({secGroup.tables.length} {secGroup.tables.length === 1 ? 'Table' : 'Tables'} • {secGroup.availableCount} free)
                      </span>
                    </div>

                    {/* Table Cards POS Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5 sm:gap-4">
                      {secGroup.tables.map(tbl => {
                        const isSelected = selectedTableId === tbl.id;
                        const statusConfig = getStatusConfig(tbl.status, tbl.isActive);
                        const StatusIcon = statusConfig.icon;
                        const isOccupied = isTableOccupied(tbl.status) || tbl.status === 'Occupied' || tbl.status === 'Dining' || tbl.status === 'Bill Requested' || tbl.status === 'Ordering' || tbl.status === 'Preparing';
                        const isCleaning = isTableCleaning(tbl.status);
                        const isReserved = (tbl.status || '').toLowerCase() === 'reserved';

                        // Lookup live order details if occupied
                        const activeOrder = activeOrdersMap[tbl.activeOrderId || ''] || 
                                            activeOrdersMap[`table_${tbl.id}`] || 
                                            activeOrdersMap[`tablenum_${tbl.tableNumber}`];
                        
                        const orderTotal = activeOrder?.total || activeOrder?.totalAmount;
                        const orderNumber = activeOrder?.id || activeOrder?.orderId || tbl.activeOrderId;
                        const guestsCount = tbl.guestsCount || activeOrder?.guestsCount;
                        const seatedTime = tbl.seatingTime || tbl.seatedAt || tbl.occupiedAt || activeOrder?.createdAt;
                        const elapsedTime = getElapsedTime(seatedTime);

                        return (
                          <div
                            key={tbl.id}
                            onClick={() => onSelectTable(tbl)}
                            className={`group relative flex flex-col justify-between rounded-2xl bg-white border-2 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden text-left select-none ${
                              statusConfig.cardBorder
                            } ${
                              isSelected ? 'ring-2 ring-[#D94F2B] border-[#D94F2B]' : ''
                            }`}
                          >
                            {/* Color Top Accent Strip */}
                            <div className={`h-1.5 w-full ${statusConfig.stripBg}`} />

                            {/* Card Content Area */}
                            <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                              {/* Header Row: Table Number & Status Pill */}
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-[#12352D] text-white font-mono font-black text-xs sm:text-sm tracking-tight shadow-2xs">
                                    #{tbl.tableNumber}
                                  </span>
                                  {tbl.tableName && tbl.tableName !== `Table ${tbl.tableNumber}` && (
                                    <span className="font-extrabold text-xs text-[#202820] truncate max-w-[90px]" title={tbl.tableName}>
                                      {tbl.tableName}
                                    </span>
                                  )}
                                </div>

                                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${statusConfig.badgeBg}`}>
                                  <StatusIcon className="w-2.5 h-2.5 shrink-0" />
                                  <span>{statusConfig.label}</span>
                                </span>
                              </div>

                              {/* Capacity & Shape Row */}
                              <div className="flex items-center justify-between text-[11px] text-[#5F675F] font-bold">
                                <div className="flex items-center space-x-1">
                                  <Users className="w-3.5 h-3.5 text-[#5F675F]" />
                                  <span>{tbl.capacity} Seats</span>
                                </div>
                                <span className="text-[10px] uppercase font-bold text-[#5F675F] bg-[#FAF8F4] px-1.5 py-0.5 rounded-md border border-[#D8DDD6]">
                                  {tbl.shape}
                                </span>
                              </div>

                              {/* ── Operational Info Block (State Dependent) ── */}
                              {isOccupied ? (
                                <div className="p-2.5 rounded-xl bg-[#FAF3F0] border border-[#F5CBC4] space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-[#9B331D] flex items-center space-x-1">
                                      <Receipt className="w-3 h-3 text-[#C9533B]" />
                                      <span>{orderNumber ? `#${orderNumber.slice(-5)}` : 'ACTIVE ORDER'}</span>
                                    </span>
                                    {orderTotal !== undefined && (
                                      <span className="font-mono font-black text-xs text-[#9B331D]">
                                        {formatPrice(orderTotal)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] font-bold text-[#5F675F] pt-0.5 border-t border-[#F5CBC4]/50">
                                    <span>{guestsCount ? `${guestsCount} Guests` : `${tbl.capacity} Guests`}</span>
                                    {elapsedTime && (
                                      <span className="flex items-center space-x-1 text-[#C9533B]">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>{elapsedTime}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : isReserved ? (
                                <div className="p-2.5 rounded-xl bg-[#FFFDF0] border border-[#FDE6B0] space-y-1 text-xs">
                                  <div className="flex items-center space-x-1 text-[10px] font-extrabold text-[#92400E]">
                                    <Calendar className="w-3 h-3 text-amber-600" />
                                    <span className="truncate">{tbl.customerName || 'Reserved Guest'}</span>
                                  </div>
                                  <p className="text-[10px] font-bold text-amber-800">
                                    {tbl.notes || 'Awaiting party arrival'}
                                  </p>
                                </div>
                              ) : isCleaning ? (
                                <div className="p-2.5 rounded-xl bg-[#F0F9FF] border border-[#CBE0F7] flex items-center space-x-2 text-xs">
                                  <Sparkles className="w-4 h-4 text-sky-600 animate-pulse shrink-0" />
                                  <span className="text-[11px] font-bold text-sky-900 leading-tight">
                                    Sanitization in progress
                                  </span>
                                </div>
                              ) : !tbl.isActive ? (
                                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-center">
                                  <span className="text-[10px] font-bold text-slate-500">
                                    Out of service
                                  </span>
                                </div>
                              ) : (
                                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800 font-bold">
                                  <span>Ready for guests</span>
                                  <ArrowRight className="w-3 h-3 text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                </div>
                              )}
                            </div>

                            {/* Card Footer: Quick Action Buttons Bar */}
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-2 bg-[#FAF8F4] border-t border-[#D8DDD6] flex items-center justify-between text-[#5F675F]"
                            >
                              <span className="text-[10px] font-bold text-[#5F675F] truncate max-w-[100px]">
                                {tbl.section}
                              </span>

                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => onShowQrModal(tbl)}
                                  className="p-1 rounded-md hover:bg-white hover:text-[#D94F2B] transition-colors"
                                  title="View QR Code"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenEditModal(tbl)}
                                  className="p-1 rounded-md hover:bg-white hover:text-[#167647] transition-colors"
                                  title="Edit Table"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDuplicateTable(tbl)}
                                  className="p-1 rounded-md hover:bg-white hover:text-[#175CD3] transition-colors"
                                  title="Duplicate Table"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onArchiveTable(tbl)}
                                  className="p-1 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="Archive Table"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PosTableGridView;
