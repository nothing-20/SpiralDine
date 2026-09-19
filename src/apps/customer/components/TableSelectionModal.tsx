import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import { getTablePath } from '../../../shared/firebase/collections';
import { 
  X, 
  MapPin, 
  Users, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Coffee, 
  ArrowRight,
  Layers,
  Sparkles
} from 'lucide-react';

import { isTableAvailable } from '../../../shared/domain/tables/types';

export interface ITableData {
  id: string;
  tableId?: string;
  tableNumber?: string;
  number?: string;
  tableName?: string;
  name?: string;
  capacity?: number;
  seatingCapacity?: number;
  floor?: string;
  section?: string;
  status?: string;
  tableStatus?: string;
  isActive?: boolean;
  branchId?: string;
}

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  restaurantName: string;
  branchId?: string;
  currentTableId?: string;
  onSelectTable: (table: ITableData) => void;
}

export const TableSelectionModal: React.FC<TableSelectionModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  restaurantName,
  branchId,
  currentTableId,
  onSelectTable,
}) => {
  const [tables, setTables] = useState<ITableData[]>([]);
  const [totalConfiguredTables, setTotalConfiguredTables] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<ITableData | null>(null);

  // Fetch real Firestore tables
  const fetchTables = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const tablesRef = collection(db, getTablePath(tenantId));
      const snap = await getDocs(tablesRef);
      const list: ITableData[] = [];

      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          tableId: data.tableId || docSnap.id,
          tableNumber: data.tableNumber || data.number || docSnap.id.replace(/^TBL-/i, ''),
          number: data.number || data.tableNumber,
          tableName: data.tableName || data.name || `Table ${data.tableNumber || data.number || docSnap.id.replace(/^TBL-/i, '')}`,
          name: data.name,
          capacity: data.capacity || data.seatingCapacity,
          seatingCapacity: data.seatingCapacity || data.capacity,
          floor: data.floor,
          section: data.section,
          status: data.status || data.tableStatus || 'Available',
          tableStatus: data.tableStatus || data.status,
          isActive: data.isActive !== false,
          branchId: data.branchId || 'main',
        });
      });

      // Filter: strictly only available tables that diners can legitimately sit at
      const selectable = list.filter(t => {
        if (!isTableAvailable(t.status || t.tableStatus, t.isActive)) return false;
        // If branchId is specified and table has branchId, match branch
        if (branchId && t.branchId && t.branchId !== branchId && branchId !== 'all') {
          return false;
        }
        return true;
      });

      // Natural numeric sort: 1, 2, 3...
      selectable.sort((a, b) => {
        const numA = parseInt(a.tableNumber || '0', 10);
        const numB = parseInt(b.tableNumber || '0', 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return (a.tableName || '').localeCompare(b.tableName || '');
      });

      setTotalConfiguredTables(list.length);
      setTables(selectable);

      // Pre-select currentTableId if provided
      if (currentTableId) {
        const match = selectable.find(t => t.id === currentTableId || t.tableId === currentTableId || `TBL-${t.tableNumber}` === currentTableId);
        if (match) {
          setSelectedTable(match);
        }
      }
    } catch (err: any) {
      console.error('[TableSelectionModal] Failed to load tables:', err);
      setError('Unable to load tables.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTables();
    } else {
      setSelectedTable(null);
    }
  }, [isOpen, tenantId, branchId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedTable) {
      onSelectTable(selectedTable);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-[#FCFAF7] border border-[#E5DCD5] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#E5DCD5]/70 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF8F2] border border-[#E5DCD5] text-[11px] font-extrabold text-[#C85A3F]">
                <Coffee className="w-3 h-3 text-[#C85A3F]" />
                <span>Dine-In Seating</span>
              </div>
              <h2 className="text-xl md:text-2xl font-display font-extrabold text-[#202124] tracking-tight">
                Where are you dining?
              </h2>
              <p className="text-xs text-[#756B64]">
                {restaurantName ? (
                  <>At <strong className="text-[#202124]">{restaurantName}</strong> — select the table you're sitting at to continue.</>
                ) : (
                  'Select the table you\'re sitting at to continue.'
                )}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#F3E8DF]/60 hover:bg-[#E5DCD5] text-[#202124] flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <RefreshCw className="w-8 h-8 text-[#C85A3F] animate-spin" />
              <p className="text-xs font-bold text-[#756B64]">Finding available tables...</p>
            </div>
          ) : error ? (
            <div className="py-10 px-4 bg-rose-50/60 border border-rose-200/80 rounded-2xl text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-[#202124]">{error}</p>
                <p className="text-xs text-[#756B64]">Please check your connection and try again.</p>
              </div>
              <button
                onClick={fetchTables}
                className="px-4 py-2 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          ) : tables.length === 0 ? (
            <div className="py-12 px-6 bg-white border border-[#E5DCD5] rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F3E8DF] flex items-center justify-center mx-auto text-[#C85A3F]">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-extrabold text-[#202124]">
                  {totalConfiguredTables > 0 
                    ? 'All tables are currently occupied or being cleaned.' 
                    : 'No tables are currently configured for this restaurant.'}
                </h3>
                <p className="text-xs text-[#756B64] leading-relaxed">
                  {totalConfiguredTables > 0
                    ? 'Please ask our floor staff for seating or check back in a few minutes.'
                    : 'Please ask restaurant staff for assistance.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#756B64] px-1 font-semibold">
                <span>Available Tables ({tables.length})</span>
                <span className="text-[11px] text-[#756B64]/80">Tap to select</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tables.map(table => {
                  const isSelected = selectedTable?.id === table.id;
                  const isCleaning = String(table.status).toLowerCase() === 'cleaning';
                  const isOccupied = String(table.status).toLowerCase() === 'occupied';

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTable(table)}
                      className={`relative p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer group ${
                        isSelected
                          ? 'bg-[#FFF8F2] border-[#C85A3F] ring-2 ring-[#C85A3F]/30 shadow-sm'
                          : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/50 hover:bg-[#FCFAF7]'
                      }`}
                    >
                      {/* Top Row: Title + Selected Checkmark */}
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <span className="block text-sm font-black text-[#202124] group-hover:text-[#C85A3F] transition-colors truncate">
                            {table.tableName || `Table ${table.tableNumber}`}
                          </span>
                          {table.section && (
                            <span className="text-[10px] font-semibold text-[#756B64] block truncate">
                              {table.section}
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#C85A3F] text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Capacity + Status Badge */}
                      <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-[#E5DCD5]/60">
                        {table.capacity ? (
                          <span className="inline-flex items-center gap-1 text-[#756B64] font-medium">
                            <Users className="w-3 h-3 text-[#756B64]/70" />
                            <span>{table.capacity}p</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#756B64]/70">Dine-in</span>
                        )}

                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${
                          isOccupied
                            ? 'bg-amber-100/70 text-amber-800'
                            : isCleaning
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-emerald-100/70 text-emerald-800'
                        }`}>
                          {table.status || 'Available'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-4 sm:p-5 border-t border-[#E5DCD5]/70 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#756B64]">
            {selectedTable ? (
              <span className="font-semibold text-[#202124]">
                Selected: <strong className="text-[#C85A3F] font-bold">{selectedTable.tableName || `Table ${selectedTable.tableNumber}`} ✓</strong>
              </span>
            ) : (
              <span>Please choose your table to proceed.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 border border-[#E5DCD5] hover:bg-[#F3E8DF]/60 text-[#202124] text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedTable}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-[#C85A3F]/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Continue to Menu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableSelectionModal;
