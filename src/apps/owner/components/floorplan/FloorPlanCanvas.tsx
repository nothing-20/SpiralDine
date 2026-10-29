import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  RotateCw, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  Move, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  DoorOpen, 
  LogOut, 
  ChefHat, 
  CreditCard, 
  Wine, 
  Utensils, 
  Bath, 
  Bell, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  IArchitecturalElement, 
  ITableVisualConfig, 
  TArchitecturalType 
} from '../../../../shared/domain/floorplan/types';
import { ITableItem } from '../../pages/OwnerTablesManager';

interface FloorPlanCanvasProps {
  canvasWidth?: number;
  canvasHeight?: number;
  elements: IArchitecturalElement[];
  tablePositions: Record<string, ITableVisualConfig>;
  tables: ITableItem[];
  selectedTableId: string | null;
  selectedElementId: string | null;
  isDesignMode: boolean;
  isDrawerOpen?: boolean;
  gridSnap?: boolean;
  gridSize?: number;
  physicalWidth?: number;
  physicalHeight?: number;
  measurementUnit?: 'meters' | 'feet';
  onSelectTable: (tableId: string | null) => void;
  onSelectElement: (elementId: string | null) => void;
  onUpdateElement: (updated: IArchitecturalElement) => void;
  onUpdateTablePosition: (tableId: string, pos: ITableVisualConfig) => void;
  onRemoveElement: (elementId: string) => void;
  onUnplaceTable: (tableId: string) => void;
}

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  canvasWidth = 1000,
  canvasHeight = 700,
  elements,
  tablePositions,
  tables,
  selectedTableId,
  selectedElementId,
  isDesignMode,
  isDrawerOpen = false,
  gridSnap = true,
  gridSize = 20,
  physicalWidth,
  physicalHeight,
  measurementUnit = 'meters',
  onSelectTable,
  onSelectElement,
  onUpdateElement,
  onUpdateTablePosition,
  onRemoveElement,
  onUnplaceTable
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging & Interaction State
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    kind: 'table' | 'element';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW?: number;
    origH?: number;
    handle?: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rot';
  } | null>(null);

  // Status Color Resolver
  const getTableColors = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'occupied' || s === 'dining' || s === 'bill requested' || s === 'ordering' || s === 'preparing') {
      return {
        fill: '#FFF5F2',
        border: '#C9533B',
        text: '#9B331D',
        badgeBg: '#FBEAE5',
        dot: '#C9533B',
        chair: '#8C311E',
        label: 'Occupied'
      };
    }
    if (s === 'reserved') {
      return {
        fill: '#FFFDF0',
        border: '#D97706',
        text: '#92400E',
        badgeBg: '#FEF3C7',
        dot: '#D97706',
        chair: '#B45309',
        label: 'Reserved'
      };
    }
    if (s === 'cleaning' || s === 'sanitizing') {
      return {
        fill: '#F0F9FF',
        border: '#0284C7',
        text: '#075985',
        badgeBg: '#E0F2FE',
        dot: '#0284C7',
        chair: '#0369A1',
        label: 'Cleaning'
      };
    }
    if (s === 'disabled' || s === 'maintenance') {
      return {
        fill: '#F8FAFC',
        border: '#94A3B8',
        text: '#475569',
        badgeBg: '#E2E8F0',
        dot: '#64748B',
        chair: '#64748B',
        label: 'Disabled'
      };
    }
    // Available (Default)
    return {
      fill: '#F0FDF4',
      border: '#16A34A',
      text: '#166534',
      badgeBg: '#DCFCE7',
      dot: '#16A34A',
      chair: '#15803D',
      label: 'Available'
    };
  };

  // ── Snap to Grid ──
  const snap = useCallback((val: number) => {
    if (!gridSnap || gridSize <= 0) return val;
    return Math.round(val / gridSize) * gridSize;
  }, [gridSnap, gridSize]);

    // ── Mouse Wheel & Webpage Scroll Interaction ──
  // Default behavior: Standard mouse-wheel scrolling bubbles naturally to allow normal vertical webpage scrolling.
  // Intentional canvas zoom occurs ONLY if the user explicitly holds Ctrl (or Cmd on macOS / pinch-to-zoom on trackpad).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Explicit modifier zoom: prevent browser whole-page zoom and zoom the canvas
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 2.5));
      }
      // When Ctrl/Cmd is NOT held: do NOT call preventDefault(), do NOT change canvas zoom.
      // The wheel event propagates naturally, enabling standard vertical scrolling of the webpage.
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, []);

  // ── Fit to Screen ──
  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const scaleX = (clientWidth - 40) / canvasWidth;
    const scaleY = (clientHeight - 40) / canvasHeight;
    const fitScale = Math.min(scaleX, scaleY, 1.2);
    setZoom(fitScale);
    setPan({
      x: (clientWidth - canvasWidth * fitScale) / 2,
      y: (clientHeight - canvasHeight * fitScale) / 2
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Center on mount and refit whenever canvas container or drawer state changes
  useEffect(() => {
    handleFitToScreen();
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitToScreen();
    }, 320);
    return () => clearTimeout(timer);
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      handleFitToScreen();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [canvasWidth, canvasHeight]);

  // ── Mouse Interaction Handlers ──
  const handleMouseDownBackground = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left-click
    // Deselect if not clicking elements
    onSelectTable(null);
    onSelectElement(null);
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Panning canvas
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
      return;
    }

    // 2. Dragging element / table in edit mode
    if (activeDrag && isDesignMode) {
      const dx = (e.clientX - activeDrag.startX) / zoom;
      const dy = (e.clientY - activeDrag.startY) / zoom;

      if (activeDrag.kind === 'element') {
        const el = elements.find(item => item.id === activeDrag.id);
        if (!el) return;

        if (activeDrag.handle === 'move') {
          const nextX = snap(Math.max(0, Math.min(activeDrag.origX + dx, canvasWidth - el.width)));
          const nextY = snap(Math.max(0, Math.min(activeDrag.origY + dy, canvasHeight - el.height)));
          onUpdateElement({ ...el, x: nextX, y: nextY });
        } else if (activeDrag.handle === 'se') {
          const nextW = Math.max(30, snap(Math.min((activeDrag.origW || el.width) + dx, canvasWidth - el.x)));
          const nextH = Math.max(20, snap(Math.min((activeDrag.origH || el.height) + dy, canvasHeight - el.y)));
          onUpdateElement({ ...el, width: nextW, height: nextH });
        }
      } else if (activeDrag.kind === 'table') {
        const currentPos = tablePositions[activeDrag.id] || {
          x: activeDrag.origX,
          y: activeDrag.origY,
          width: 80,
          height: 80,
          rotation: 0
        };

        if (activeDrag.handle === 'move') {
          const w = currentPos.width || 80;
          const h = currentPos.height || 80;
          const nextX = snap(Math.max(0, Math.min(activeDrag.origX + dx, canvasWidth - w)));
          const nextY = snap(Math.max(0, Math.min(activeDrag.origY + dy, canvasHeight - h)));
          onUpdateTablePosition(activeDrag.id, { ...currentPos, x: nextX, y: nextY });
        } else if (activeDrag.handle === 'se') {
          const nextW = Math.max(60, snap(Math.min((activeDrag.origW || currentPos.width || 80) + dx, canvasWidth - currentPos.x)));
          const nextH = Math.max(60, snap(Math.min((activeDrag.origH || currentPos.height || 80) + dy, canvasHeight - currentPos.y)));
          onUpdateTablePosition(activeDrag.id, { ...currentPos, width: nextW, height: nextH });
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setActiveDrag(null);
  };

  // ── Start Dragging an Item ──
  const startDragItem = (
    e: React.MouseEvent, 
    id: string, 
    kind: 'table' | 'element', 
    handle: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'rot' = 'move'
  ) => {
    e.stopPropagation();
    if (kind === 'table') {
      onSelectTable(id);
      onSelectElement(null);
    } else {
      onSelectElement(id);
      onSelectTable(null);
    }

    if (!isDesignMode) return;

    let origX = 0;
    let origY = 0;
    let origW = 80;
    let origH = 80;

    if (kind === 'table') {
      const pos = tablePositions[id] || { x: 50, y: 50, width: 80, height: 80 };
      origX = pos.x;
      origY = pos.y;
      origW = pos.width || 80;
      origH = pos.height || 80;
    } else {
      const el = elements.find(item => item.id === id);
      if (el) {
        origX = el.x;
        origY = el.y;
        origW = el.width;
        origH = el.height;
      }
    }

    setActiveDrag({
      id,
      kind,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
      origW,
      origH
    });
  };

  // ── Quick Rotation Handler ──
  const handleRotate = (e: React.MouseEvent, id: string, kind: 'table' | 'element') => {
    e.stopPropagation();
    if (kind === 'table') {
      const cur = tablePositions[id] || { x: 50, y: 50, rotation: 0 };
      const nextRot = ((cur.rotation || 0) + 45) % 360;
      onUpdateTablePosition(id, { ...cur, rotation: nextRot });
    } else {
      const el = elements.find(item => item.id === id);
      if (el) {
        const nextRot = ((el.rotation || 0) + 45) % 360;
        onUpdateElement({ ...el, rotation: nextRot });
      }
    }
  };

  // ── Render Architectural Element ──
  const renderArchitecturalElement = (el: IArchitecturalElement) => {
    const isSelected = selectedElementId === el.id;

    const getElementDetails = (type: TArchitecturalType) => {
      switch (type) {
        case 'main_entrance':
          return {
            title: el.label || 'Main Entrance',
            bg: '#F3F4F6',
            border: '#4B5563',
            icon: DoorOpen,
            badge: 'ENTRANCE',
            badgeBg: '#111827',
            badgeText: '#F9FAFB'
          };
        case 'entrance':
          return {
            title: el.label || 'Side Entrance',
            bg: '#F3F4F6',
            border: '#6B7280',
            icon: LogOut,
            badge: 'EXIT / ENTRY',
            badgeBg: '#374151',
            badgeText: '#F9FAFB'
          };
        case 'kitchen':
          return {
            title: el.label || 'Kitchen & Dispense',
            bg: '#F8FAFC',
            border: '#0F172A',
            icon: ChefHat,
            badge: 'KITCHEN ZONE',
            badgeBg: '#0F172A',
            badgeText: '#F8FAFC'
          };
        case 'billing_counter':
          return {
            title: el.label || 'Billing & Reception',
            bg: '#FEF3C7',
            border: '#D97706',
            icon: CreditCard,
            badge: 'CASHIER / POS',
            badgeBg: '#B45309',
            badgeText: '#FFFFFF'
          };
        case 'bar':
          return {
            title: el.label || 'Bar Counter',
            bg: '#F5F3FF',
            border: '#7C3AED',
            icon: Wine,
            badge: 'BAR & LOUNGE',
            badgeBg: '#6D28D9',
            badgeText: '#FFFFFF'
          };
        case 'service_station':
          return {
            title: el.label || 'Service Station',
            bg: '#F0FDF4',
            border: '#15803D',
            icon: Utensils,
            badge: 'WAITER STATION',
            badgeBg: '#166534',
            badgeText: '#FFFFFF'
          };
        case 'washroom':
          return {
            title: el.label || 'Washrooms',
            bg: '#E0F2FE',
            border: '#0284C7',
            icon: Bath,
            badge: 'RESTROOMS',
            badgeBg: '#0369A1',
            badgeText: '#FFFFFF'
          };
        case 'reception':
          return {
            title: el.label || 'Host Reception',
            bg: '#FFFBEB',
            border: '#F59E0B',
            icon: Bell,
            badge: 'RECEPTION',
            badgeBg: '#D97706',
            badgeText: '#FFFFFF'
          };
        case 'custom_area':
          return {
            title: el.label || 'VIP Lounge / Patio',
            bg: '#FAF5FF',
            border: '#9333EA',
            icon: Sparkles,
            badge: 'VIP PATIO',
            badgeBg: '#7E22CE',
            badgeText: '#FFFFFF'
          };
        case 'wall':
          return {
            title: '',
            bg: '#374151',
            border: '#111827',
            icon: null,
            badge: '',
            badgeBg: '',
            badgeText: ''
          };
        case 'column':
          return {
            title: '',
            bg: '#4B5563',
            border: '#1F2937',
            icon: null,
            badge: '',
            badgeBg: '',
            badgeText: ''
          };
        default:
          return {
            title: el.label || 'Area',
            bg: '#F9FAFB',
            border: '#9CA3AF',
            icon: Info,
            badge: 'FACILITY',
            badgeBg: '#4B5563',
            badgeText: '#FFFFFF'
          };
      }
    };

    const details = getElementDetails(el.type);
    const IconComponent = details.icon;
    const isPillar = el.type === 'column';
    const isWall = el.type === 'wall';

    return (
      <g
        key={el.id}
        transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation || 0}, ${el.width / 2}, ${el.height / 2})`}
        className={isDesignMode ? 'cursor-move' : 'pointer-events-none'}
        onMouseDown={(e) => startDragItem(e, el.id, 'element', 'move')}
      >
        {/* Pillar Special Shape */}
        {isPillar ? (
          <circle
            cx={el.width / 2}
            cy={el.height / 2}
            r={el.width / 2}
            fill={details.bg}
            stroke={isSelected ? '#D94F2B' : details.border}
            strokeWidth={isSelected ? 3 : 2}
            className="transition-all"
          />
        ) : isWall ? (
          /* Wall Solid Strip */
          <rect
            width={el.width}
            height={el.height}
            rx={4}
            fill={details.bg}
            stroke={isSelected ? '#D94F2B' : details.border}
            strokeWidth={isSelected ? 3 : 2}
            className="transition-all"
          />
        ) : (
          /* General Facility Box */
          <g>
            <rect
              width={el.width}
              height={el.height}
              rx={12}
              fill={details.bg}
              stroke={isSelected ? '#D94F2B' : details.border}
              strokeWidth={isSelected ? 3 : 2}
              strokeDasharray={el.type === 'custom_area' ? '6 4' : 'none'}
              className="transition-all shadow-sm"
            />
            {/* Facility Header Badge */}
            <rect
              x={8}
              y={8}
              width={Math.min(el.width - 16, 110)}
              height={18}
              rx={6}
              fill={details.badgeBg}
            />
            <text
              x={14}
              y={21}
              fontSize={9}
              fontWeight="800"
              fill={details.badgeText}
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.5px"
            >
              {details.badge}
            </text>

            {/* Label in Facility Center */}
            <text
              x={el.width / 2}
              y={el.height / 2 + 10}
              fontSize={Math.max(11, Math.min(el.width / 12, 14))}
              fontWeight="700"
              fill="#1F2937"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
            >
              {details.title}
            </text>

            {/* Icon Graphic */}
            {IconComponent && (
              <foreignObject
                x={el.width - 32}
                y={6}
                width={24}
                height={24}
                className="pointer-events-none"
              >
                <div className="w-6 h-6 flex items-center justify-center text-slate-700">
                  <IconComponent className="w-4 h-4 opacity-75" />
                </div>
              </foreignObject>
            )}
          </g>
        )}

        {/* Selected Highlight & Controls in Edit Mode */}
        {isSelected && isDesignMode && (
          <g>
            {/* Selection Outline */}
            <rect
              x={-3}
              y={-3}
              width={el.width + 6}
              height={el.height + 6}
              rx={el.type === 'column' ? el.width : 14}
              fill="none"
              stroke="#D94F2B"
              strokeWidth={2}
              strokeDasharray="4 4"
            />

            {/* Resize Handle (SE Corner) */}
            <circle
              cx={el.width + 3}
              cy={el.height + 3}
              r={6}
              fill="#D94F2B"
              stroke="#FFFFFF"
              strokeWidth={2}
              className="cursor-nwse-resize"
              onMouseDown={(e) => startDragItem(e, el.id, 'element', 'se')}
            />

            {/* Action pill above element */}
            <foreignObject
              x={el.width / 2 - 40}
              y={-34}
              width={80}
              height={30}
              className="overflow-visible"
            >
              <div className="flex items-center justify-center space-x-1 bg-white border border-[#D8DDD6] shadow-md rounded-full px-2 py-0.5 text-xs">
                <button
                  type="button"
                  onClick={(e) => handleRotate(e, el.id, 'element')}
                  title="Rotate 45°"
                  className="p-1 hover:text-[#D94F2B] transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveElement(el.id); }}
                  title="Remove Element"
                  className="p-1 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </foreignObject>
          </g>
        )}
      </g>
    );
  };

  // ── Render Dining Table with Chairs ──
  const renderTable = (tbl: ITableItem) => {
    const visual = tablePositions[tbl.id] || {
      x: tbl.positionX ? (tbl.positionX / 100) * (canvasWidth - 100) : 100,
      y: tbl.positionY ? (tbl.positionY / 100) * (canvasHeight - 100) : 100,
      width: tbl.shape === 'rectangle' ? 120 : 80,
      height: tbl.shape === 'rectangle' ? 80 : 80,
      rotation: 0
    };

    const isSelected = selectedTableId === tbl.id;
    const colors = getTableColors(tbl.status);
    const capacity = tbl.capacity || 4;
    const isCircle = tbl.shape === 'circle';
    const isRect = tbl.shape === 'rectangle';

    const width = visual.width || (isRect ? 120 : 80);
    const height = visual.height || 80;
    const centerX = width / 2;
    const centerY = height / 2;

    // Chair styling
    const chairW = 20;
    const chairH = 10;
    const chairOffset = 6;

    return (
      <g
        key={tbl.id}
        transform={`translate(${visual.x}, ${visual.y}) rotate(${visual.rotation || 0}, ${centerX}, ${centerY})`}
        className={isDesignMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        onMouseDown={(e) => startDragItem(e, tbl.id, 'table', 'move')}
        onClick={() => {
          if (!isDesignMode) {
            onSelectTable(tbl.id);
            onSelectElement(null);
          }
        }}
      >
        {/* ── Outer Chairs Render ── */}
        <g opacity={0.9}>
          {isCircle ? (
            /* Circular Chairs distributed radially */
            Array.from({ length: Math.min(capacity, 8) }).map((_, i) => {
              const count = Math.min(capacity, 8);
              const angle = (i * (360 / count)) * (Math.PI / 180);
              const r = width / 2 + chairOffset;
              const cx = centerX + r * Math.cos(angle);
              const cy = centerY + r * Math.sin(angle);
              return (
                <rect
                  key={i}
                  x={cx - chairW / 2}
                  y={cy - chairH / 2}
                  width={chairW}
                  height={chairH}
                  rx={4}
                  fill={colors.chair}
                  transform={`rotate(${(i * (360 / count)) + 90}, ${cx}, ${cy})`}
                />
              );
            })
          ) : isRect ? (
            /* Rectangular Table Chairs */
            <g>
              {/* Top side chairs */}
              <rect x={centerX - 35} y={-chairOffset - chairH} width={chairW} height={chairH} rx={4} fill={colors.chair} />
              <rect x={centerX + 15} y={-chairOffset - chairH} width={chairW} height={chairH} rx={4} fill={colors.chair} />
              {/* Bottom side chairs */}
              <rect x={centerX - 35} y={height + chairOffset} width={chairW} height={chairH} rx={4} fill={colors.chair} />
              <rect x={centerX + 15} y={height + chairOffset} width={chairW} height={chairH} rx={4} fill={colors.chair} />
              {/* Left End chair if capacity > 4 */}
              {capacity >= 5 && (
                <rect x={-chairOffset - chairH} y={centerY - chairW / 2} width={chairH} height={chairW} rx={4} fill={colors.chair} />
              )}
              {/* Right End chair if capacity >= 6 */}
              {capacity >= 6 && (
                <rect x={width + chairOffset} y={centerY - chairW / 2} width={chairH} height={chairW} rx={4} fill={colors.chair} />
              )}
            </g>
          ) : (
            /* Square Table Chairs (4-Top) */
            <g>
              {/* Top */}
              <rect x={centerX - chairW / 2} y={-chairOffset - chairH} width={chairW} height={chairH} rx={4} fill={colors.chair} />
              {/* Bottom */}
              <rect x={centerX - chairW / 2} y={height + chairOffset} width={chairW} height={chairH} rx={4} fill={colors.chair} />
              {/* Left */}
              <rect x={-chairOffset - chairH} y={centerY - chairW / 2} width={chairH} height={chairW} rx={4} fill={colors.chair} />
              {/* Right */}
              <rect x={width + chairOffset} y={centerY - chairW / 2} width={chairH} height={chairW} rx={4} fill={colors.chair} />
            </g>
          )}
        </g>

        {/* ── Table Surface ── */}
        {isCircle ? (
          <circle
            cx={centerX}
            cy={centerY}
            r={width / 2}
            fill={colors.fill}
            stroke={isSelected ? '#D94F2B' : colors.border}
            strokeWidth={isSelected ? 3.5 : 2}
            className="transition-all filter drop-shadow-sm"
          />
        ) : (
          <rect
            width={width}
            height={height}
            rx={16}
            fill={colors.fill}
            stroke={isSelected ? '#D94F2B' : colors.border}
            strokeWidth={isSelected ? 3.5 : 2}
            className="transition-all filter drop-shadow-sm"
          />
        )}

        {/* Status Dot */}
        <circle
          cx={centerX - 16}
          cy={centerY - 14}
          r={4}
          fill={colors.dot}
        />

        {/* Table Number Identifier */}
        <text
          x={centerX}
          y={centerY - 8}
          fontSize={15}
          fontWeight="900"
          fill="#17202A"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          letterSpacing="-0.5px"
        >
          #{tbl.tableNumber}
        </text>

        {/* Seating Capacity Pill */}
        <g transform={`translate(${centerX - 20}, ${centerY + 2})`}>
          <rect
            width={40}
            height={16}
            rx={8}
            fill={colors.badgeBg}
          />
          <text
            x={20}
            y={12}
            fontSize={9}
            fontWeight="800"
            fill={colors.text}
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            {capacity} SEATS
          </text>
        </g>

        {/* Substatus / Diner tag if occupied */}
        {tbl.status === 'Occupied' && (
          <text
            x={centerX}
            y={centerY + 28}
            fontSize={8}
            fontWeight="800"
            fill="#C9533B"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            {tbl.activeOrderId ? `#${tbl.activeOrderId.slice(-5)}` : 'ACTIVE'}
          </text>
        )}

        {/* Selection Highlighting & Controls in Edit Mode */}
        {isSelected && isDesignMode && (
          <g>
            {/* Dash halo */}
            <rect
              x={-5}
              y={-5}
              width={width + 10}
              height={height + 10}
              rx={isCircle ? width : 18}
              fill="none"
              stroke="#D94F2B"
              strokeWidth={2}
              strokeDasharray="4 4"
            />

            {/* Resize Corner Handle (SE) */}
            <circle
              cx={width + 5}
              cy={height + 5}
              r={6}
              fill="#D94F2B"
              stroke="#FFFFFF"
              strokeWidth={2}
              className="cursor-nwse-resize"
              onMouseDown={(e) => startDragItem(e, tbl.id, 'table', 'se')}
            />

            {/* Quick action pill above table */}
            <foreignObject
              x={centerX - 44}
              y={-40}
              width={88}
              height={32}
              className="overflow-visible"
            >
              <div className="flex items-center justify-center space-x-1 bg-white border border-[#D8DDD6] shadow-md rounded-full px-2 py-0.5 text-xs">
                <button
                  type="button"
                  onClick={(e) => handleRotate(e, tbl.id, 'table')}
                  title="Rotate 45°"
                  className="p-1 hover:text-[#D94F2B] transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUnplaceTable(tbl.id); }}
                  title="Unplace from floor plan (retains table record)"
                  className="p-1 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </foreignObject>
          </g>
        )}
      </g>
    );
  };

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDownBackground}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`relative w-full h-[620px] rounded-3xl overflow-hidden border border-[#D8DDD6] bg-[#FAF8F4] select-none shadow-xs ${
        isDesignMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* ── Floor Plan Blueprint Grid Pattern ── */}
      <svg
        className="w-full h-full"
        style={{
          transformOrigin: '0 0'
        }}
      >
        <defs>
          {/* Subtle architectural grid pattern */}
          <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E6E2DC" strokeWidth="0.75" />
          </pattern>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#smallGrid)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#D8DDD6" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* Viewport Transform Group */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Floor Canvas Boundary */}
          <rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill="url(#grid)"
            stroke="#202820"
            strokeWidth={4}
            rx={8}
            className="filter drop-shadow-md"
          />

          {/* Scale Marker / Dimensions in Top Left */}
          {physicalWidth && physicalHeight && (
            <text
              x={16}
              y={24}
              fontSize={11}
              fontWeight="800"
              fill="#5F675F"
              fontFamily="monospace"
              letterSpacing="0.5px"
            >
              📐 {physicalWidth} × {physicalHeight} {measurementUnit} (SCALE 1:50)
            </text>
          )}

          {/* 1. Render Architectural Elements (Walls, Entrances, Kitchens, Restrooms) */}
          {elements.map(renderArchitecturalElement)}

          {/* 2. Render Dining Tables */}
          {tables.map(renderTable)}
        </g>
      </svg>

      {/* ── Floating Canvas Control Bar (Zoom, Fit, Reset) — positioned bottom-left to prevent occlusion by drawer ── */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-1.5 bg-white/95 backdrop-blur-md border border-[#D8DDD6] shadow-md rounded-2xl p-1.5 z-20">
        <button
          type="button"
          onClick={() => setZoom(z => Math.min(z + 0.15, 2.5))}
          title="Zoom In (+)"
          className="p-2 rounded-xl text-[#202820] hover:bg-[#F0F2F0] hover:text-[#D94F2B] transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span title="Zoom Scale (Use buttons or Ctrl + Scroll to zoom)" className="text-xs font-mono font-bold text-[#5F675F] px-1 select-none cursor-default">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom(z => Math.max(z - 0.15, 0.4))}
          title="Zoom Out (-)"
          className="p-2 rounded-xl text-[#202820] hover:bg-[#F0F2F0] hover:text-[#D94F2B] transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-[#D8DDD6]" />
        <button
          type="button"
          onClick={handleFitToScreen}
          title="Fit Canvas to Viewport"
          className="p-2 rounded-xl text-[#202820] hover:bg-[#F0F2F0] hover:text-[#D94F2B] transition-colors flex items-center space-x-1"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="text-[10px] font-bold">Fit</span>
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          title="Reset to 100%"
          className="p-2 rounded-xl text-[#202820] hover:bg-[#F0F2F0] hover:text-[#D94F2B] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Status Color Legend Bar (Bottom Left) ── */}
      <div className="absolute bottom-4 left-4 hidden sm:flex items-center space-x-3 bg-white/95 backdrop-blur-md border border-[#D8DDD6] shadow-md rounded-2xl px-3.5 py-2 z-30 text-xs">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F675F]">LEGEND:</span>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
          <span className="font-bold text-[#166534] text-[11px]">Available</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#C9533B]" />
          <span className="font-bold text-[#9B331D] text-[11px]">Occupied</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
          <span className="font-bold text-[#92400E] text-[11px]">Reserved</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
          <span className="font-bold text-[#075985] text-[11px]">Cleaning</span>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanCanvas;
