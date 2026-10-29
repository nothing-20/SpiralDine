import React, { useState } from 'react';
import { 
  Plus, 
  DoorOpen, 
  LogOut, 
  ChefHat, 
  CreditCard, 
  Wine, 
  Utensils, 
  Bath, 
  Bell, 
  Sparkles,
  Square,
  Circle,
  Save,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  X
} from 'lucide-react';
import Button from '../../../../components/ui/Button/Button';
import { 
  TArchitecturalType, 
  ARCHITECTURAL_PRESETS 
} from '../../../../shared/domain/floorplan/types';
import { ITableItem } from '../../pages/OwnerTablesManager';

interface FloorPlanEditorToolbarProps {
  isDesignMode: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  unplacedTables: ITableItem[];
  gridSnap: boolean;
  onToggleDesignMode: () => void;
  onAddArchitecturalElement: (type: TArchitecturalType) => void;
  onPlaceTable: (tableId: string) => void;
  onToggleGridSnap: () => void;
  onSaveLayout: () => void;
  onDiscardChanges: () => void;
}

export const FloorPlanEditorToolbar: React.FC<FloorPlanEditorToolbarProps> = ({
  isDesignMode,
  hasUnsavedChanges,
  isSaving,
  unplacedTables,
  gridSnap,
  onToggleDesignMode,
  onAddArchitecturalElement,
  onPlaceTable,
  onToggleGridSnap,
  onSaveLayout,
  onDiscardChanges
}) => {
  const [isElementsPaletteOpen, setIsElementsPaletteOpen] = useState(false);
  const [isUnplacedTablesOpen, setIsUnplacedTablesOpen] = useState(false);

  return (
    <div className="space-y-3 select-none">
      {/* ── Mode Banner & Main Controls ── */}
      <div className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs ${
        isDesignMode 
          ? 'bg-[#FEF3D6]/60 border-[#FDE68A]' 
          : 'bg-white border-[#D8DDD6]'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
            isDesignMode 
              ? 'bg-[#D97706] text-white' 
              : 'bg-[#12352D] text-white'
          }`}>
            {isDesignMode ? '📐' : '📍'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-extrabold text-[#202820]">
                {isDesignMode ? 'Floor Plan Designer Active' : 'Operational Floor Plan'}
              </h3>
              {isDesignMode && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FEF3D6] text-[#8A5700] border border-[#FDE68A]">
                  Editing Mode
                </span>
              )}
            </div>
            <p className="text-xs text-[#5F675F] mt-0.5">
              {isDesignMode 
                ? 'Drag dining tables, reposition architectural facilities, resize walls, and save layout coordinates.' 
                : 'Interactive realtime view. Click any dining table to view guest orders, bills, and operations.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 self-end md:self-auto flex-wrap gap-2">
          {isDesignMode ? (
            <>
              {/* Add Facility Dropdown */}
              <div className="relative">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsElementsPaletteOpen(!isElementsPaletteOpen)}
                  className="flex items-center space-x-1.5 text-xs font-bold border-[#D8DDD6] hover:bg-[#FAF8F4]"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D94F2B]" />
                  <span>Add Facility</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </Button>

                {/* Elements Dropdown Palette */}
                {isElementsPaletteOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#D8DDD6] shadow-xl rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D8DDD6]">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F]">
                        Architectural Elements
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsElementsPaletteOpen(false)}
                        className="p-1 text-[#5F675F] hover:text-[#202820]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
                      {ARCHITECTURAL_PRESETS.map((preset) => (
                        <button
                          key={preset.type}
                          type="button"
                          onClick={() => {
                            onAddArchitecturalElement(preset.type);
                            setIsElementsPaletteOpen(false);
                          }}
                          className="flex items-center space-x-2 p-2 rounded-xl text-left hover:bg-[#FAF8F4] border border-transparent hover:border-[#D8DDD6] transition-all group cursor-pointer"
                        >
                          <span className="p-1 rounded-lg bg-[#FAF8F4] group-hover:bg-[#E8F5EE] group-hover:text-[#167647] text-[#202820]">
                            {preset.type.includes('entrance') && <DoorOpen className="w-3.5 h-3.5" />}
                            {preset.type === 'kitchen' && <ChefHat className="w-3.5 h-3.5" />}
                            {preset.type === 'billing_counter' && <CreditCard className="w-3.5 h-3.5" />}
                            {preset.type === 'bar' && <Wine className="w-3.5 h-3.5" />}
                            {preset.type === 'service_station' && <Utensils className="w-3.5 h-3.5" />}
                            {preset.type === 'washroom' && <Bath className="w-3.5 h-3.5" />}
                            {preset.type === 'reception' && <Bell className="w-3.5 h-3.5" />}
                            {preset.type === 'custom_area' && <Sparkles className="w-3.5 h-3.5" />}
                            {preset.type === 'wall' && <Square className="w-3.5 h-3.5" />}
                            {preset.type === 'column' && <Circle className="w-3.5 h-3.5" />}
                          </span>
                          <span className="text-xs font-bold text-[#202820] leading-tight">
                            {preset.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Unplaced Tables Drawer Trigger if any */}
              {unplacedTables.length > 0 && (
                <div className="relative">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsUnplacedTablesOpen(!isUnplacedTablesOpen)}
                    className="flex items-center space-x-1.5 text-xs font-bold border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-700" />
                    <span>Unplaced Tables ({unplacedTables.length})</span>
                  </Button>

                  {/* Popover to drop unplaced tables */}
                  {isUnplacedTablesOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#D8DDD6] shadow-xl rounded-2xl p-3 z-50">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#D8DDD6]">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F]">
                          Add Table to Floor
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsUnplacedTablesOpen(false)}
                          className="p-1 text-[#5F675F] hover:text-[#202820]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {unplacedTables.map((tbl) => (
                          <div
                            key={tbl.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-[#FAF8F4] border border-[#D8DDD6] text-xs"
                          >
                            <div>
                              <p className="font-extrabold text-[#202820]">Table #{tbl.tableNumber}</p>
                              <p className="text-[10px] text-[#5F675F]">{tbl.capacity} seats · {tbl.shape}</p>
                            </div>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => {
                                onPlaceTable(tbl.id);
                                setIsUnplacedTablesOpen(false);
                              }}
                              className="font-bold text-[10px] bg-[#E8F5EE] text-[#167647] hover:bg-[#D4EFE0]"
                            >
                              + Place
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Grid Snap Toggle */}
              <button
                type="button"
                onClick={onToggleGridSnap}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
                  gridSnap 
                    ? 'bg-[#FAF8F4] text-[#167647] border-[#A6E1C4]' 
                    : 'bg-white text-[#5F675F] border-[#D8DDD6]'
                }`}
                title="Toggle 20px Grid Snap"
              >
                <span>Grid Snap</span>
                <span className={`w-2 h-2 rounded-full ${gridSnap ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'}`} />
              </button>

              {/* Discard / Cancel */}
              <Button
                size="sm"
                variant="secondary"
                onClick={onDiscardChanges}
                disabled={isSaving}
                className="text-xs font-bold border-[#D8DDD6] hover:bg-[#FAF8F4]"
              >
                Cancel
              </Button>

              {/* Save Layout */}
              <Button
                size="sm"
                onClick={onSaveLayout}
                disabled={isSaving}
                className="bg-[#D94F2B] hover:bg-[#C2411F] text-white font-extrabold text-xs px-4 flex items-center space-x-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Floor Plan'}</span>
              </Button>
            </>
          ) : (
            /* View Mode: Trigger Editor */
            <Button
              size="sm"
              variant="secondary"
              onClick={onToggleDesignMode}
              className="text-xs font-extrabold flex items-center space-x-1.5 border-[#D8DDD6] hover:bg-[#FAF8F4] text-[#202820]"
            >
              <Sliders className="w-3.5 h-3.5 text-[#D94F2B]" />
              <span>Rearrange Tables</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FloorPlanEditorToolbar;
