import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { 
  cleanTableIdentifier, 
  isTableAvailable, 
  isTableOccupied, 
  isTableCleaning 
} from '../../../shared/domain/tables/types';
import { zodResolver } from '../../../utils/zodResolver';
import { restaurantService, IBranchItem } from '../../../shared/services/restaurantService';
import { floorPlanService } from '../../../shared/services/floorPlanService';
import { 
  IArchitecturalElement, 
  ITableVisualConfig, 
  TArchitecturalType,
  ARCHITECTURAL_PRESETS 
} from '../../../shared/domain/floorplan/types';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';
import TextArea from '../../../components/ui/TextArea/TextArea';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Floor Plan Sub-components
import FloorPlanCanvas from '../components/floorplan/FloorPlanCanvas';
import FloorPlanEditorToolbar from '../components/floorplan/FloorPlanEditorToolbar';
import TableDetailsDrawer from '../components/floorplan/TableDetailsDrawer';

// Lucide Icons
import { 
  Plus, 
  Edit2, 
  Trash2, 
  QrCode, 
  Sliders, 
  Download, 
  Printer, 
  RefreshCw, 
  FolderPlus, 
  Users, 
  Compass, 
  Grid,
  Copy,
  AlertCircle,
  Building2,
  GitBranch,
  Search,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

// Zod schemas
const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number/code is required'),
  tableName: z.string().min(1, 'Table name is required'),
  capacity: z.preprocess(
    (val) => Number(val),
    z.number().min(1, 'Capacity must be at least 1 person')
  ),
  floor: z.string().min(1, 'Floor selection is required'),
  section: z.string().min(1, 'Section selection is required'),
  shape: z.enum(['circle', 'square', 'rectangle']).default('square'),
  notes: z.string().optional(),
  status: z.enum([
    'Available', 'Occupied', 'Reserved', 'Ordering', 'Preparing', 'Dining', 'Bill Requested', 'Cleaning', 'Disabled'
  ]).default('Available'),
  isActive: z.boolean().default(true)
});

type TTableForm = z.infer<typeof tableSchema>;

export interface ITableItem {
  id: string;
  tableId: string;
  tableNumber: string;
  tableName: string;
  floor: string;
  section: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Ordering' | 'Preparing' | 'Dining' | 'Bill Requested' | 'Cleaning' | 'Disabled';
  shape: 'circle' | 'square' | 'rectangle';
  positionX: number;
  positionY: number;
  rotation?: number;
  qrCodeId: string;
  branchId: string;
  isActive: boolean;
  isArchived?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  activeOrderId?: string;
  currentOrderId?: string;
  customerName?: string;
  guestsCount?: number;
  seatingTime?: string;
  seatedAt?: string;
  occupiedAt?: string;
}

export interface IFloor {
  id: string;
  name: string;
  physicalWidth?: number;
  physicalHeight?: number;
  measurementUnit?: 'meters' | 'feet';
}

export interface ISection {
  id: string;
  floorId: string;
  name: string;
}

/**
 * Normalizes raw Firestore document data safely into a complete ITableItem.
 */
const mapFirestoreDocToTable = (
  id: string, 
  raw: any, 
  index: number, 
  defaultFloor = 'Main Floor', 
  defaultSection = 'Main Dining Area'
): ITableItem => {
  const tableNumber = String(
    raw.tableNumber || raw.number || cleanTableIdentifier(id) || id || `T${index + 1}`
  ).trim();

  const tableName = String(
    raw.tableName || raw.name || `Table ${tableNumber}`
  ).trim();

  const rawCap = Number(raw.capacity ?? raw.seatingCapacity);
  const capacity = !isNaN(rawCap) && rawCap > 0 ? rawCap : 4;

  const rawStatus = String(raw.status || raw.tableStatus || 'Available').trim();
  let status: ITableItem['status'] = 'Available';
  const sLower = rawStatus.toLowerCase();
  if (sLower === 'disabled' || raw.isActive === false) {
    status = 'Disabled';
  } else if (isTableCleaning(rawStatus)) {
    status = 'Cleaning';
  } else if (sLower === 'reserved') {
    status = 'Reserved';
  } else if (isTableOccupied(rawStatus, raw.subStatus, raw.diningStatus)) {
    if (sLower === 'bill_requested' || sLower === 'bill requested') {
      status = 'Bill Requested';
    } else if (sLower === 'dining') {
      status = 'Dining';
    } else if (sLower === 'preparing') {
      status = 'Preparing';
    } else if (sLower === 'ordering') {
      status = 'Ordering';
    } else {
      status = 'Occupied';
    }
  } else if (sLower === 'occupied') {
    status = 'Occupied';
  } else {
    status = 'Available';
  }

  const validShapes = ['square', 'circle', 'rectangle'] as const;
  const shape = validShapes.includes(raw.shape) ? raw.shape : 'square';

  const posX = typeof raw.positionX === 'number' && !isNaN(raw.positionX)
    ? Math.max(0, Math.min(raw.positionX, 90))
    : 10 + (index % 5) * 16;
  const posY = typeof raw.positionY === 'number' && !isNaN(raw.positionY)
    ? Math.max(0, Math.min(raw.positionY, 90))
    : 10 + Math.floor(index / 5) * 16;

  return {
    id,
    tableId: raw.tableId || id,
    tableNumber,
    tableName,
    floor: raw.floor || defaultFloor,
    section: raw.section || defaultSection,
    capacity,
    status,
    shape,
    positionX: posX,
    positionY: posY,
    rotation: typeof raw.rotation === 'number' ? raw.rotation : 0,
    qrCodeId: raw.qrCodeId || `QR-${id}`,
    branchId: raw.branchId || 'main',
    isActive: status !== 'Disabled',
    isArchived: Boolean(raw.isArchived),
    notes: raw.notes || raw.tableNotes || '',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    createdBy: raw.createdBy || 'owner',
    activeOrderId: raw.activeOrderId || raw.currentOrderId,
    currentOrderId: raw.currentOrderId || raw.activeOrderId,
    customerName: raw.customerName,
    guestsCount: raw.guestsCount,
    seatingTime: raw.seatingTime || raw.seatedAt || raw.occupiedAt,
    seatedAt: raw.seatedAt,
    occupiedAt: raw.occupiedAt
  };
};

export const OwnerTablesManager: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { workspace, isLoading: workspaceLoading } = useWorkspace();
  const primaryTenantId = user?.tenantId || workspace?.tenant?.id;
  
  // Multi-restaurant & Branch state
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [branches, setBranches] = useState<IBranchItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(primaryTenantId || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Real-time collections
  const [tables, setTables] = useState<ITableItem[]>([]);
  const [floors, setFloors] = useState<IFloor[]>([]);
  const [sections, setSections] = useState<ISection[]>([]);
  
  // Floor Plan Specific Real-time state
  const [activeFloorId, setActiveFloorId] = useState<string>('');
  const [elements, setElements] = useState<IArchitecturalElement[]>([]);
  const [tablePositions, setTablePositions] = useState<Record<string, ITableVisualConfig>>({});
  const [gridSnap, setGridSnap] = useState<boolean>(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);

  // Connection and App States
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'visual' | 'list'>('visual');
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive Design Mode State
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Layout Modal Trigger states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLayoutManagerOpen, setIsLayoutManagerOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Targets
  const [editingTable, setEditingTable] = useState<ITableItem | null>(null);
  const [selectedTable, setSelectedTable] = useState<ITableItem | null>(null);
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);
  const [qrTable, setQrTable] = useState<ITableItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Layout Add states
  const [newFloorName, setNewFloorName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedSectionFloor, setSelectedSectionFloor] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<TTableForm>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      shape: 'square',
      status: 'Available',
      isActive: true
    }
  });

  const watchFloor = watch('floor');

  // 1. Resolve Authorized Restaurants & Branches
  useEffect(() => {
    if (!user) return;
    restaurantService.getAuthorizedRestaurants(user).then((rList) => {
      setRestaurants(rList);
      if (rList.length > 0 && !selectedTenantId) {
        setSelectedTenantId(rList[0].id);
      }
    }).catch(console.warn);
  }, [user]);

  useEffect(() => {
    if (selectedTenantId) {
      restaurantService.getAuthorizedBranches(selectedTenantId).then(setBranches).catch(console.warn);
    }
  }, [selectedTenantId]);

  const targetTenant = selectedTenantId || primaryTenantId || 'default';

  // 2. Subscribe to Floor Settings and Tables
  useEffect(() => {
    if (authLoading || workspaceLoading) {
      setIsLoading(true);
      return;
    }

    if (!targetTenant) {
      setIsLoading(false);
      setIsLive(false);
      setError('No restaurant ID found for this account. Please select an active restaurant.');
      return;
    }

    setIsLoading(true);
    setError(null);

    let isSubscribed = true;

    // 1. Subscribe to Floor Settings
    const layoutDocRef = doc(db, 'restaurants', targetTenant, 'settings', 'layout');
    const unsubLayout = onSnapshot(layoutDocRef, (docSnap) => {
      if (!isSubscribed) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedFloors: IFloor[] = data.floors || [];
        setFloors(loadedFloors);
        setSections(data.sections || []);
        if (loadedFloors.length > 0 && !activeFloorId) {
          setActiveFloorId(loadedFloors[0].name);
        }
      } else {
        // Default base floor
        const defaultFloors: IFloor[] = [{ id: 'FLR-MAIN', name: 'Main Floor' }];
        setFloors(defaultFloors);
        setSections([{ id: 'SEC-MAIN', floorId: 'FLR-MAIN', name: 'Main Dining Area' }]);
        setActiveFloorId('Main Floor');
      }
    }, (err) => {
      console.warn('[OwnerTablesManager] Layout settings listener error:', err);
    });

    // 2. Subscribe to Tables Collection
    const tablesColRef = collection(db, 'restaurants', targetTenant, 'tables');
    const unsubTables = onSnapshot(tablesColRef, (querySnap) => {
      if (!isSubscribed) return;
      try {
        const list: ITableItem[] = [];
        let idx = 0;
        querySnap.forEach((docSnap) => {
          const raw = docSnap.data();
          if (!raw.isArchived) {
            list.push(mapFirestoreDocToTable(docSnap.id, raw, idx++));
          }
        });

        try {
          list.sort((a, b) => {
            const numA = a.tableNumber || '';
            const numB = b.tableNumber || '';
            return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
          });
        } catch (_) {}

        setTables(list);
        setIsLoading(false);
        setIsLive(true);
        setError(null);
      } catch (procErr: any) {
        console.error('[OwnerTablesManager] Failed processing table snapshot:', procErr);
        setError(procErr?.message || 'Error processing table data.');
        setIsLoading(false);
      }
    }, (err) => {
      if (!isSubscribed) return;
      console.error('[OwnerTablesManager] Firestore tables subscription error:', err);
      setError(err?.message || 'Unable to connect to Firestore tables. Please check your connection.');
      setIsLoading(false);
      setIsLive(false);
    });

    return () => {
      isSubscribed = false;
      unsubLayout();
      unsubTables();
    };
  }, [targetTenant, authLoading, workspaceLoading, retryCount]);

  // 3. Subscribe to Floor Plan Layout for Active Floor
  useEffect(() => {
    if (!targetTenant || !activeFloorId) return;

    const unsub = floorPlanService.subscribeFloorPlan(targetTenant, activeFloorId, (fp) => {
      if (fp) {
        setElements(fp.elements || []);
        setTablePositions(fp.tablePositions || {});
      } else {
        // Derive initial positions from tables on this floor
        setElements([]);
        const initialPos: Record<string, ITableVisualConfig> = {};
        tables.filter(t => t.floor === activeFloorId).forEach(t => {
          initialPos[t.id] = {
            x: (t.positionX / 100) * 850 + 50,
            y: (t.positionY / 100) * 550 + 50,
            width: t.shape === 'rectangle' ? 120 : 80,
            height: 80,
            rotation: t.rotation || 0,
            shape: t.shape
          };
        });
        setTablePositions(initialPos);
      }
      setHasUnsavedChanges(false);
    });

    return () => unsub();
  }, [targetTenant, activeFloorId, tables.length]);

  // ----------------------------------------------------
  // SUMMARY CALCULATIONS (Real Backend Data)
  // ----------------------------------------------------
  const stats = useMemo(() => {
    const total = tables.length;
    const available = tables.filter(t => isTableAvailable(t.status, t.isActive)).length;
    const occupied = tables.filter(t => isTableOccupied(t.status) || t.status === 'Occupied' || t.status === 'Bill Requested' || t.status === 'Dining' || t.status === 'Ordering' || t.status === 'Preparing').length;
    const reserved = tables.filter(t => (t.status || '').toLowerCase() === 'reserved').length;
    const cleaning = tables.filter(t => isTableCleaning(t.status)).length;
    const disabled = tables.filter(t => t.status === 'Disabled' || t.isActive === false).length;

    return { total, available, occupied, reserved, cleaning, disabled };
  }, [tables]);

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------
  const filteredTables = useMemo(() => {
    return tables.filter((tbl) => {
      // Branch filter
      if (selectedBranchId !== 'all' && tbl.branchId && tbl.branchId !== selectedBranchId) return false;

      // In visual mode, only show tables for the active floor
      if (activeTab === 'visual') {
        if (activeFloorId && tbl.floor !== activeFloorId) return false;
      }

      // Section filter
      if (activeSectionFilter !== 'all' && tbl.section !== activeSectionFilter) return false;

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'Available' && !isTableAvailable(tbl.status, tbl.isActive)) return false;
        else if (statusFilter === 'Occupied' && (!isTableOccupied(tbl.status) && tbl.status !== 'Occupied')) return false;
        else if (statusFilter === 'Cleaning' && !isTableCleaning(tbl.status)) return false;
        else if (statusFilter === 'Reserved' && (tbl.status || '').toLowerCase() !== 'reserved') return false;
        else if (statusFilter === 'Disabled' && tbl.status !== 'Disabled' && tbl.isActive !== false) return false;
      }

      // Capacity filter
      if (capacityFilter !== 'all') {
        const filterVal = Number(capacityFilter);
        if ((tbl.capacity || 0) < filterVal) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = (tbl.tableNumber || '').toLowerCase().includes(q);
        const matchesName = (tbl.tableName || '').toLowerCase().includes(q);
        const matchesFloor = (tbl.floor || '').toLowerCase().includes(q);
        const matchesSec = (tbl.section || '').toLowerCase().includes(q);
        if (!matchesNum && !matchesName && !matchesFloor && !matchesSec) return false;
      }

      return true;
    });
  }, [tables, activeTab, activeFloorId, selectedBranchId, activeSectionFilter, statusFilter, capacityFilter, searchQuery]);

  // Unplaced Tables on Current Floor
  const unplacedTables = useMemo(() => {
    return tables.filter(t => t.floor === activeFloorId && !tablePositions[t.id]);
  }, [tables, activeFloorId, tablePositions]);

  // ----------------------------------------------------
  // FLOOR PLAN EDITOR ACTIONS
  // ----------------------------------------------------
  const handleAddArchitecturalElement = (type: TArchitecturalType) => {
    const preset = ARCHITECTURAL_PRESETS.find(p => p.type === type);
    const newEl: IArchitecturalElement = {
      id: `EL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      label: preset?.label || 'Facility',
      x: 100 + (elements.length % 5) * 40,
      y: 100 + Math.floor(elements.length / 5) * 40,
      width: preset?.defaultWidth || 120,
      height: preset?.defaultHeight || 60,
      rotation: 0,
      floorId: activeFloorId
    };

    setElements(prev => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setHasUnsavedChanges(true);
    toast.success(`Added ${preset?.label || 'Facility'} to floor plan.`);
  };

  const handlePlaceTable = (tableId: string) => {
    const tbl = tables.find(t => t.id === tableId);
    if (!tbl) return;

    const newPos: ITableVisualConfig = {
      x: 200 + (Object.keys(tablePositions).length % 4) * 90,
      y: 200 + Math.floor(Object.keys(tablePositions).length / 4) * 90,
      width: tbl.shape === 'rectangle' ? 120 : 80,
      height: 80,
      rotation: tbl.rotation || 0,
      shape: tbl.shape
    };

    setTablePositions(prev => ({ ...prev, [tableId]: newPos }));
    setHasUnsavedChanges(true);
    toast.success(`Placed Table #${tbl.tableNumber} on floor.`);
  };

  const handleUpdateElement = (updated: IArchitecturalElement) => {
    setElements(prev => prev.map(e => e.id === updated.id ? updated : e));
    setHasUnsavedChanges(true);
  };

  const handleUpdateTablePosition = (tableId: string, pos: ITableVisualConfig) => {
    setTablePositions(prev => ({ ...prev, [tableId]: pos }));
    setHasUnsavedChanges(true);
  };

  const handleRemoveElement = (elementId: string) => {
    setElements(prev => prev.filter(e => e.id !== elementId));
    if (selectedElementId === elementId) setSelectedElementId(null);
    setHasUnsavedChanges(true);
    toast.success('Removed facility from floor plan.');
  };

  const handleUnplaceTable = (tableId: string) => {
    setTablePositions(prev => {
      const copy = { ...prev };
      delete copy[tableId];
      return copy;
    });
    if (selectedTable?.id === tableId) setSelectedTable(null);
    setHasUnsavedChanges(true);
    toast.success('Table unplaced from floor plan (retained in restaurant).');
  };

  const handleSaveLayout = async () => {
    if (!targetTenant || !activeFloorId) return;
    setIsSavingLayout(true);

    try {
      // Map table coordinates to percentage positions for backward compatibility
      const tablesToSync = Object.entries(tablePositions).map(([tId, pos]) => {
        const tbl = tables.find(t => t.id === tId);
        return {
          id: tId,
          x: Math.round((pos.x / 1000) * 100),
          y: Math.round((pos.y / 700) * 100),
          shape: pos.shape || tbl?.shape || 'square',
          rotation: pos.rotation || 0,
          floor: activeFloorId
        };
      });

      await floorPlanService.saveFloorPlanLayout(
        targetTenant,
        activeFloorId,
        activeFloorId,
        {
          elements,
          tablePositions,
          canvasWidth: 1000,
          canvasHeight: 700,
          gridSnap
        },
        tablesToSync,
        user?.uid
      );

      setHasUnsavedChanges(false);
      setIsDesignMode(false);
      toast.success(`Floor plan for "${activeFloorId}" saved successfully!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to save floor plan layout.');
    } finally {
      setIsSavingLayout(false);
    }
  };

  const handleDiscardChanges = () => {
    // Revert back from loaded state
    floorPlanService.getFloorPlan(targetTenant, activeFloorId).then(fp => {
      if (fp) {
        setElements(fp.elements || []);
        setTablePositions(fp.tablePositions || {});
      }
      setHasUnsavedChanges(false);
      setIsDesignMode(false);
      toast.success('Unsaved changes discarded.');
    });
  };

  // ----------------------------------------------------
  // LAYOUT CONFIG OPERATIONS (Floors & Sections)
  // ----------------------------------------------------
  const handleSaveLayoutConfig = async (updatedFloors: IFloor[], updatedSections: ISection[]) => {
    if (!targetTenant) return;
    try {
      const docRef = doc(db, 'restaurants', targetTenant, 'settings', 'layout');
      await setDoc(docRef, { floors: updatedFloors, sections: updatedSections }, { merge: true });
      toast.success('Restaurant layout configuration saved.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save layout configuration.');
    }
  };

  const handleAddFloor = () => {
    if (!newFloorName.trim()) {
      toast.error('Floor name cannot be empty.');
      return;
    }
    const newFloor: IFloor = {
      id: `FLR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      name: newFloorName.trim()
    };
    const updated = [...floors, newFloor];
    setFloors(updated);
    handleSaveLayoutConfig(updated, sections);
    setNewFloorName('');
  };

  const handleDeleteFloor = (floorId: string) => {
    const updatedFloors = floors.filter(f => f.id !== floorId);
    const updatedSections = sections.filter(s => s.floorId !== floorId);
    setFloors(updatedFloors);
    setSections(updatedSections);
    handleSaveLayoutConfig(updatedFloors, updatedSections);
    if (activeFloorId === floors.find(f => f.id === floorId)?.name && updatedFloors.length > 0) {
      setActiveFloorId(updatedFloors[0].name);
    }
  };

  const handleAddSection = () => {
    if (!newSectionName.trim() || !selectedSectionFloor) {
      toast.error('Section name and floor selection are required.');
      return;
    }
    const newSec: ISection = {
      id: `SEC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      floorId: selectedSectionFloor,
      name: newSectionName.trim()
    };
    const updated = [...sections, newSec];
    setSections(updated);
    handleSaveLayoutConfig(floors, updated);
    setNewSectionName('');
  };

  const handleDeleteSection = (secId: string) => {
    const updated = sections.filter(s => s.id !== secId);
    setSections(updated);
    handleSaveLayoutConfig(floors, updated);
  };

  // ----------------------------------------------------
  // TABLE CRUD OPERATIONS
  // ----------------------------------------------------
  const openAddModal = () => {
    setEditingTable(null);
    const defaultFloor = activeFloorId || floors[0]?.name || 'Main Floor';
    const defaultSection = sections.filter(s => s.floorId === floors.find(f => f.name === defaultFloor)?.id)[0]?.name || 'Main Dining Area';
    reset({
      tableNumber: '',
      tableName: '',
      capacity: 4,
      floor: defaultFloor,
      section: defaultSection,
      shape: 'square',
      notes: '',
      status: 'Available',
      isActive: true
    });
    setIsFormOpen(true);
  };

  const openEditModal = (tbl: ITableItem) => {
    setEditingTable(tbl);
    reset({
      tableNumber: tbl.tableNumber || '',
      tableName: tbl.tableName || '',
      capacity: tbl.capacity || 4,
      floor: tbl.floor || floors[0]?.name || 'Main Floor',
      section: tbl.section || sections[0]?.name || 'Main Dining Area',
      shape: tbl.shape || 'square',
      notes: tbl.notes || '',
      status: tbl.status || 'Available',
      isActive: tbl.isActive ?? true
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: TTableForm) => {
    if (!targetTenant) {
      toast.error('No restaurant tenant identified.');
      return;
    }

    const hasDuplicateNumber = tables.some(
      (t) => (t.tableNumber || '').trim().toLowerCase() === data.tableNumber.trim().toLowerCase() && t.id !== editingTable?.id
    );
    const hasDuplicateName = tables.some(
      (t) => (t.tableName || '').trim().toLowerCase() === data.tableName.trim().toLowerCase() && t.id !== editingTable?.id
    );

    if (hasDuplicateNumber) {
      toast.error(`Table code/number "${data.tableNumber}" is already in use.`);
      return;
    }
    if (hasDuplicateName) {
      toast.error(`Table name "${data.tableName}" is already in use.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const tableId = editingTable ? editingTable.id : `TBL-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const docRef = doc(db, 'restaurants', targetTenant, 'tables', tableId);

      const tableData = {
        id: tableId,
        tableId,
        tableNumber: data.tableNumber.trim(),
        tableName: data.tableName.trim(),
        number: data.tableNumber.trim(),
        floor: data.floor,
        section: data.section,
        capacity: data.capacity,
        seatingCapacity: data.capacity,
        status: data.status,
        tableStatus: data.status,
        shape: data.shape,
        positionX: editingTable ? (editingTable.positionX ?? 10) : 10 + (tables.length % 5) * 15,
        positionY: editingTable ? (editingTable.positionY ?? 10) : 10 + Math.floor(tables.length / 5) * 15,
        qrCodeId: editingTable ? (editingTable.qrCodeId || `QR-${tableId}`) : `QR-${tableId}`,
        branchId: selectedBranchId !== 'all' ? selectedBranchId : 'main',
        isActive: data.status !== 'Disabled',
        notes: data.notes || '',
        createdAt: editingTable ? (editingTable.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.displayName || user?.email || 'owner'
      };

      await setDoc(docRef, tableData, { merge: true });
      toast.success(editingTable ? 'Table layout updated!' : 'Seating table added successfully!');
      setIsFormOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save table.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const duplicateTable = async (tbl: ITableItem) => {
    if (!targetTenant) return;
    try {
      const newId = `TBL-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const docRef = doc(db, 'restaurants', targetTenant, 'tables', newId);
      
      const duplicateData = {
        ...tbl,
        id: newId,
        tableId: newId,
        tableNumber: `${tbl.tableNumber || tbl.id}-Copy`,
        tableName: `${tbl.tableName || 'Table'} - Copy`,
        number: `${tbl.tableNumber || tbl.id}-Copy`,
        qrCodeId: `QR-${newId}`,
        positionX: Math.min((tbl.positionX || 10) + 5, 90),
        positionY: Math.min((tbl.positionY || 10) + 5, 90),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, duplicateData);
      toast.success(`Duplicated: ${tbl.tableName}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to duplicate table.');
    }
  };

  const archiveTable = async (tbl: ITableItem) => {
    if (!targetTenant) return;
    try {
      const docRef = doc(db, 'restaurants', targetTenant, 'tables', tbl.id);
      await updateDoc(docRef, { isArchived: true });
      toast.success(`Archived table: ${tbl.tableName}`);
      if (selectedTable?.id === tbl.id) setSelectedTable(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to archive table.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!targetTenant || !deletingTableId) return;
    try {
      const docRef = doc(db, 'restaurants', targetTenant, 'tables', deletingTableId);
      await deleteDoc(docRef);
      toast.success('Table layout deleted permanently.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete table.');
    } finally {
      setIsDeleteOpen(false);
      setDeletingTableId(null);
    }
  };

  // ----------------------------------------------------
  // QR EXPORTER & CANVAS GENERATION
  // ----------------------------------------------------
  const handlePrintQr = (tbl: ITableItem) => {
    const qrData = `${window.location.origin}/r/${targetTenant}/table/${tbl.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code - Table ${tbl.tableNumber}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #fff;
              color: #000;
            }
            .card {
              border: 3px solid #000;
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
              max-width: 350px;
            }
            .logo {
              font-size: 24px;
              font-weight: 800;
              margin-bottom: 20px;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .qr-code {
              width: 250px;
              height: 250px;
              border: 1px solid #eee;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .table-num {
              font-size: 28px;
              font-weight: 900;
              margin: 10px 0 5px;
            }
            .instructions {
              font-size: 12px;
              color: #666;
              margin-top: 15px;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="card">
            <div class="logo">Spiral Dine</div>
            <img class="qr-code" src="${qrUrl}" alt="QR code" />
            <div class="table-num">TABLE ${tbl.tableNumber}</div>
            <div>${tbl.tableName}</div>
            <div class="instructions">Scan to view digital menu & place orders</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadQr = async (tbl: ITableItem) => {
    const qrData = `${window.location.origin}/r/${targetTenant}/table/${tbl.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 500;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 400, 500);

      ctx.strokeStyle = '#c5a880';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 360, 460);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPIRAL DINE', 200, 70);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText('Digital Ordering Seating Card', 200, 95);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = URL.createObjectURL(blob);
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(75, 125, 250, 250);
        ctx.drawImage(img, 85, 135, 230, 230);

        ctx.fillStyle = '#c5a880';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`TABLE ${tbl.tableNumber}`, 200, 420);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText(`${tbl.tableName} (${tbl.capacity} seats)`, 200, 450);

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${tbl.tableName}_QR_Card.png`;
        link.href = url;
        link.click();
      };
    } catch (err) {
      console.error(err);
      toast.error('Download failed.');
    }
  };

  return (
    <div className="space-y-6 select-none text-left pb-16">
      {/* ── PHASE 1 HEADER: Restaurant & Branch Selector + Controls ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-serif font-bold text-[#17202A] tracking-tight">
              Restaurant Seating & Interactive Floor Plan
            </h1>
            <div className={`flex items-center space-x-1.5 font-bold text-[10px] tracking-wide uppercase px-2.5 py-1 rounded-full ${
              isLive 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isLive ? 'Realtime Live' : 'Connecting...'}</span>
            </div>
          </div>
          <p className="text-xs text-[#5F675F] mt-1">
            Design interactive visual floor plans, organize tables with realistic seating, and monitor dine-in orders in realtime.
          </p>
        </div>

        {/* Restaurant & Branch Selectors (Multi-Tenant Support) */}
        <div className="flex flex-wrap items-center gap-2">
          {restaurants.length > 1 && (
            <div className="flex items-center space-x-1.5 bg-white border border-[#D8DDD6] rounded-xl px-2.5 py-1.5 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-[#5F675F]" />
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#202820] outline-none cursor-pointer"
              >
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name || r.id}</option>
                ))}
              </select>
            </div>
          )}

          {branches.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-white border border-[#D8DDD6] rounded-xl px-2.5 py-1.5 shadow-2xs">
              <GitBranch className="w-3.5 h-3.5 text-[#5F675F]" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#202820] outline-none cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name || b.id}</option>
                ))}
              </select>
            </div>
          )}

          <Button 
            variant="secondary" 
            onClick={() => setIsLayoutManagerOpen(true)} 
            className="flex items-center space-x-1.5 text-xs font-bold border-[#D8DDD6] hover:bg-[#FAF8F4]" 
            size="sm"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#5F675F]" />
            <span>Manage Floors</span>
          </Button>

          <Button 
            onClick={openAddModal} 
            className="flex items-center space-x-1.5 bg-[#D94F2B] hover:bg-[#C2411F] text-white text-xs font-extrabold shadow-xs" 
            size="sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Seating Table</span>
          </Button>
        </div>
      </div>

      {/* ── SUMMARY CARDS: Real Firestore Backend Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        {[
          { 
            label: 'Total Tables', 
            count: isLoading ? '—' : stats.total, 
            color: 'bg-white border-[#D8DDD6] text-[#202820]' 
          },
          { 
            label: 'Available', 
            count: isLoading ? '—' : stats.available, 
            color: 'bg-[#E8F5EF] border-[#A6E1C4] text-[#167647]' 
          },
          { 
            label: 'Occupied', 
            count: isLoading ? '—' : stats.occupied, 
            color: 'bg-[#FBEAE5] border-[#F5CBC4] text-[#C9533B]' 
          },
          { 
            label: 'Reserved', 
            count: isLoading ? '—' : stats.reserved, 
            color: 'bg-[#FFF4DC] border-[#FDE6B0] text-[#9A6200]' 
          },
          { 
            label: 'Cleaning', 
            count: isLoading ? '—' : stats.cleaning, 
            color: 'bg-[#EAF2FB] border-[#CBE0F7] text-[#1D5D9B]' 
          }
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-2xl border ${stat.color} flex flex-col justify-between shadow-2xs`}>
            <span className="text-[10px] uppercase font-extrabold tracking-wider opacity-80">{stat.label}</span>
            <span className="text-2xl font-black mt-1 font-mono tracking-tight">{stat.count}</span>
          </div>
        ))}
      </div>

      {/* ── TOOLBAR: View Mode & Filters ── */}
      <div className="p-3.5 rounded-2xl bg-white border border-[#D8DDD6] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1.5 bg-[#FAF8F4] p-1 rounded-xl border border-[#D8DDD6] self-start md:self-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('visual'); setIsDesignMode(false); }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all outline-none cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-[#12352D] text-white shadow-xs'
                : 'text-[#5F675F] hover:text-[#202820]'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#D94F2B]" />
            <span>Interactive Floor Plan</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('list'); setIsDesignMode(false); }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all outline-none cursor-pointer ${
              activeTab === 'list'
                ? 'bg-[#12352D] text-white shadow-xs'
                : 'text-[#5F675F] hover:text-[#202820]'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-[#D94F2B]" />
            <span>List Catalog View</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Table */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5F675F]" />
            <input
              type="text"
              placeholder="Search table, section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#D8DDD6] bg-[#FAF8F4] text-xs font-semibold text-[#202820] outline-none focus:border-[#D94F2B]"
            />
          </div>

          {/* Section Filter */}
          <select
            value={activeSectionFilter}
            onChange={(e) => setActiveSectionFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[#D8DDD6] bg-[#FAF8F4] text-[#202820] outline-none cursor-pointer"
          >
            <option value="all">All Sections</option>
            {sections
              .filter(s => !activeFloorId || s.floorId === floors.find(f => f.name === activeFloorId)?.id)
              .map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[#D8DDD6] bg-[#FAF8F4] text-[#202820] outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Occupied">Occupied</option>
            <option value="Reserved">Reserved</option>
            <option value="Cleaning">Cleaning</option>
            <option value="Disabled">Disabled</option>
          </select>

          {/* Capacity Filter */}
          <select
            value={capacityFilter}
            onChange={(e) => setCapacityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-[#D8DDD6] bg-[#FAF8F4] text-[#202820] outline-none cursor-pointer"
          >
            <option value="all">Any Capacity</option>
            <option value="2">2+ Seats</option>
            <option value="4">4+ Seats</option>
            <option value="6">6+ Seats</option>
            <option value="8">8+ Seats</option>
          </select>
        </div>
      </div>

      {/* ── MAIN WORKSPACE ── */}
      {isLoading ? (
        <div className="h-72 flex items-center justify-center">
          <LoadingSpinner label="Loading interactive floor plan..." />
        </div>
      ) : activeTab === 'visual' ? (
        <div className="space-y-4">
          {/* Floor Navigator Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
              {floors.map(f => {
                const floorTableCount = tables.filter(t => t.floor === f.name).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        if (confirm('You have unsaved floor plan layout changes. Discard and switch floor?')) {
                          setActiveFloorId(f.name);
                          setHasUnsavedChanges(false);
                          setIsDesignMode(false);
                        }
                      } else {
                        setActiveFloorId(f.name);
                      }
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                      activeFloorId === f.name
                        ? 'bg-[#12352D] text-white border-[#12352D] shadow-xs'
                        : 'bg-white text-[#5F675F] border-[#D8DDD6] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <span>{f.name}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      activeFloorId === f.name
                        ? 'bg-[#D94F2B] text-white'
                        : 'bg-[#F0F2F0] text-[#5F675F]'
                    }`}>
                      {floorTableCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Floor Plan Editor Toolbar (Designer Mode active / trigger) */}
          <FloorPlanEditorToolbar
            isDesignMode={isDesignMode}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSavingLayout}
            unplacedTables={unplacedTables}
            gridSnap={gridSnap}
            onToggleDesignMode={() => {
              if (isDesignMode && hasUnsavedChanges) {
                if (confirm('Save changes before leaving designer mode?')) {
                  handleSaveLayout();
                  return;
                }
              }
              setIsDesignMode(!isDesignMode);
            }}
            onAddArchitecturalElement={handleAddArchitecturalElement}
            onPlaceTable={handlePlaceTable}
            onToggleGridSnap={() => setGridSnap(g => !g)}
            onSaveLayout={handleSaveLayout}
            onDiscardChanges={handleDiscardChanges}
          />

          {/* Interactive SVG Floor Plan Canvas Container (responsive margin to prevent drawer overlap) */}
          <div className={`transition-all duration-300 ease-in-out ${isDetailDrawerOpen ? 'lg:mr-[430px]' : ''}`}>
            <FloorPlanCanvas
              canvasWidth={1000}
              canvasHeight={700}
              elements={elements}
              tablePositions={tablePositions}
              tables={filteredTables}
              selectedTableId={selectedTable?.id || null}
              selectedElementId={selectedElementId}
              isDesignMode={isDesignMode}
              isDrawerOpen={isDetailDrawerOpen}
              gridSnap={gridSnap}
              gridSize={20}
              physicalWidth={floors.find(f => f.name === activeFloorId)?.physicalWidth}
              physicalHeight={floors.find(f => f.name === activeFloorId)?.physicalHeight}
              measurementUnit={floors.find(f => f.name === activeFloorId)?.measurementUnit || 'meters'}
              onSelectTable={(tId) => {
                if (tId) {
                  const found = tables.find(t => t.id === tId);
                  setSelectedTable(found || null);
                  if (!isDesignMode) setIsDetailDrawerOpen(true);
                } else {
                  setSelectedTable(null);
                }
              }}
              onSelectElement={(elId) => setSelectedElementId(elId)}
              onUpdateElement={handleUpdateElement}
              onUpdateTablePosition={handleUpdateTablePosition}
              onRemoveElement={handleRemoveElement}
              onUnplaceTable={handleUnplaceTable}
            />
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="rounded-3xl bg-white border border-[#D8DDD6] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#D8DDD6] text-[#5F675F] uppercase text-[10px] font-extrabold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Table Code & Name</th>
                  <th className="py-3.5 px-4">Capacity</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DDD6] text-[#202820]">
                {filteredTables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#5F675F]">
                      No dining tables match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredTables.map((tbl) => (
                    <tr 
                      key={tbl.id} 
                      onClick={() => { setSelectedTable(tbl); setIsDetailDrawerOpen(true); }}
                      className="hover:bg-[#FAF8F4] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="p-1 px-1.5 rounded-md bg-[#12352D] text-white font-mono font-bold text-[11px]">
                            #{tbl.tableNumber}
                          </span>
                          <span className="font-extrabold text-[#202820]">{tbl.tableName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#5F675F]">
                        {tbl.capacity} Seats ({tbl.shape})
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#202820]">{tbl.floor}</span>
                        <span className="text-[#5F675F] block text-[10px]">{tbl.section}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={
                          tbl.status === 'Available' ? 'success' :
                          tbl.status === 'Occupied' ? 'danger' :
                          tbl.status === 'Reserved' ? 'warning' :
                          tbl.status === 'Cleaning' ? 'primary' : 'neutral'
                        }>
                          {tbl.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => { setQrTable(tbl); setIsQrModalOpen(true); }}
                            className="p-1.5 rounded-lg text-[#5F675F] hover:text-[#D94F2B] hover:bg-[#FAF8F4]"
                            title="Digital Ordering QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(tbl)}
                            className="p-1.5 rounded-lg text-[#5F675F] hover:text-[#167647] hover:bg-[#FAF8F4]"
                            title="Edit Table Settings"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateTable(tbl)}
                            className="p-1.5 rounded-lg text-[#5F675F] hover:text-[#175CD3] hover:bg-[#FAF8F4]"
                            title="Duplicate Table"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => archiveTable(tbl)}
                            className="p-1.5 rounded-lg text-[#5F675F] hover:text-red-600 hover:bg-red-50"
                            title="Archive Table"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SELECTED TABLE DETAILS DRAWER ── */}
      <TableDetailsDrawer
        isOpen={isDetailDrawerOpen}
        table={selectedTable}
        tenantId={targetTenant}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedTable(null);
        }}
        onEditTable={openEditModal}
        onShowQrModal={(t) => { setQrTable(t); setIsQrModalOpen(true); }}
        onPrintQr={handlePrintQr}
        onDownloadQr={handleDownloadQr}
        onRefreshTable={() => {
          // Trigger local refresh
        }}
      />

      {/* ── FLOORS & SECTIONS CONFIGURATION MODAL ── */}
      <Modal
        isOpen={isLayoutManagerOpen}
        onClose={() => setIsLayoutManagerOpen(false)}
        title="Restaurant Floors & Sections Configuration"
        className="max-w-2xl"
      >
        <div className="grid gap-6 md:grid-cols-2 text-left p-1 select-none">
          {/* Floors column */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-[#12352D] border-b border-[#D8DDD6] pb-2">
              Restaurant Floors
            </h3>
            
            <div className="flex space-x-2">
              <input 
                type="text"
                value={newFloorName}
                onChange={(e) => setNewFloorName(e.target.value)}
                placeholder="e.g. Ground Floor, Terrace"
                className="flex-1 bg-white border border-[#D8DDD6] rounded-xl px-3 py-1.5 text-xs text-[#202820] outline-none"
              />
              <Button size="xs" onClick={handleAddFloor} className="flex items-center space-x-1 bg-[#12352D] text-white">
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </Button>
            </div>

            <div className="p-2 border border-[#D8DDD6] rounded-2xl max-h-64 overflow-y-auto space-y-1.5 bg-[#FAF8F4]">
              {floors.length === 0 ? (
                <p className="text-xs text-[#5F675F] text-center py-3">No floors configured.</p>
              ) : (
                floors.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#D8DDD6]">
                    <span className="text-xs font-bold text-[#202820]">{f.name}</span>
                    <button 
                      onClick={() => handleDeleteFloor(f.id)} 
                      className="text-[#5F675F] hover:text-red-600 transition-colors"
                      title="Delete Floor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sections column */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-[#12352D] border-b border-[#D8DDD6] pb-2">
              Floor Dining Sections
            </h3>
            
            <div className="space-y-2">
              <select
                value={selectedSectionFloor}
                onChange={(e) => setSelectedSectionFloor(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-[#D8DDD6] bg-white text-xs font-bold text-[#202820] outline-none"
              >
                <option value="">Select Floor *</option>
                {floors.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              <div className="flex space-x-2">
                <input 
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Indoor Main, Patio"
                  className="flex-1 bg-white border border-[#D8DDD6] rounded-xl px-3 py-1.5 text-xs text-[#202820] outline-none"
                />
                <Button size="xs" onClick={handleAddSection} className="flex items-center space-x-1 bg-[#12352D] text-white">
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </Button>
              </div>
            </div>

            <div className="p-2 border border-[#D8DDD6] rounded-2xl max-h-64 overflow-y-auto space-y-1.5 bg-[#FAF8F4]">
              {sections.length === 0 ? (
                <p className="text-xs text-[#5F675F] text-center py-3">No sections configured.</p>
              ) : (
                sections.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#D8DDD6]">
                    <div>
                      <p className="text-xs font-bold text-[#202820]">{s.name}</p>
                      <p className="text-[10px] text-[#5F675F]">{floors.find(f => f.id === s.floorId)?.name || 'Unknown Floor'}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteSection(s.id)} 
                      className="text-[#5F675F] hover:text-red-600 transition-colors"
                      title="Delete Section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── CREATE / EDIT TABLE MODAL ── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTable ? 'Edit Table Settings' : 'Add Seating Table'}
        className="max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 text-left p-1">
          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Table Number/Code *"
              type="text"
              placeholder="e.g. 5, Bar-2"
              error={errors.tableNumber?.message}
              disabled={isSubmitting}
              {...register('tableNumber')}
            />
            <Input 
              label="Table Name *"
              type="text"
              placeholder="e.g. Garden Table 1"
              error={errors.tableName?.message}
              disabled={isSubmitting}
              {...register('tableName')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Floor *"
              options={floors.length > 0 ? floors.map(f => ({ value: f.name, label: f.name })) : [{ value: 'Main Floor', label: 'Main Floor' }]}
              error={errors.floor?.message}
              disabled={isSubmitting}
              {...register('floor')}
            />
            <Select 
              label="Section *"
              options={(() => {
                const availableSections = sections
                  .filter(s => s.floorId === floors.find(f => f.name === watchFloor)?.id)
                  .map(s => ({ value: s.name, label: s.name }));
                return availableSections.length > 0 ? availableSections : [{ value: 'Main Dining Area', label: 'Main Dining Area' }];
              })()}
              error={errors.section?.message}
              disabled={isSubmitting}
              {...register('section')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Seating Capacity *"
              type="number"
              error={errors.capacity?.message}
              disabled={isSubmitting}
              {...register('capacity')}
            />
            <Select 
              label="Table Shape"
              options={[
                { value: 'square', label: 'Square (4-Top)' },
                { value: 'circle', label: 'Circle / Round' },
                { value: 'rectangle', label: 'Rectangle (6-8 Top)' }
              ]}
              disabled={isSubmitting}
              {...register('shape')}
            />
          </div>

          <TextArea 
            label="Internal Notes"
            placeholder="Add directions or layout details..."
            disabled={isSubmitting}
            {...register('notes')}
          />

          <div className="flex items-center space-x-3 pt-3 border-t border-[#D8DDD6]">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-[#D94F2B] hover:bg-[#C2411F] text-white font-extrabold" isLoading={isSubmitting}>
              {editingTable ? 'Save Settings' : 'Create Table'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── QR MODAL CARD VIEW ── */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title={qrTable ? `Table #${qrTable.tableNumber} Scan Code` : ''}
        className="max-w-sm"
      >
        {qrTable && (
          <div className="space-y-4 text-center p-1">
            <div className="bg-[#FAF8F4] border border-[#D8DDD6] p-5 rounded-3xl max-w-[280px] mx-auto shadow-md">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#D94F2B]">
                SpiralDine Seating Card
              </span>
              <h4 className="text-xl font-serif font-black text-[#202820] mt-1">
                Table #{qrTable.tableNumber}
              </h4>
              <div className="w-48 h-48 bg-white border border-[#D8DDD6] p-3 rounded-2xl flex items-center justify-center mx-auto my-3 shadow-inner">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/r/${targetTenant}/table/${qrTable.id}`)}`} 
                  alt="QR Code" 
                  className="w-full h-full"
                />
              </div>
              <p className="text-[10px] text-[#5F675F] font-mono select-all break-all">
                {`${window.location.origin}/r/${targetTenant}/table/${qrTable.id}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => handleDownloadQr(qrTable)} className="flex items-center justify-center space-x-1.5 font-bold border-[#D8DDD6]">
                <Download className="w-4 h-4 text-[#5F675F]" />
                <span>Download PNG</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handlePrintQr(qrTable)} className="flex items-center justify-center space-x-1.5 font-bold border-[#D8DDD6]">
                <Printer className="w-4 h-4 text-[#5F675F]" />
                <span>Print Card</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── DELETE DIALOG ── */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remove Seating Table"
        message="Are you sure you want to permanently delete this table? Direct customer portal order queues linked to this table ID will be detached."
        confirmLabel="Delete Table"
        isDangerous
      />
    </div>
  );
};

export default OwnerTablesManager;
