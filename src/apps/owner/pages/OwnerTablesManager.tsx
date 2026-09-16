import React, { useEffect, useState, useRef } from 'react';
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
import { zodResolver } from '../../../utils/zodResolver';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';
import TextArea from '../../../components/ui/TextArea/TextArea';
import Switch from '../../../components/ui/Switch/Switch';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

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
  Copy
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

interface ITableItem {
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
  qrCodeId: string;
  branchId: string;
  isActive: boolean;
  isArchived?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface IFloor {
  id: string;
  name: string;
}

interface ISection {
  id: string;
  floorId: string;
  name: string;
}

export const OwnerTablesManager: React.FC = () => {
  const { user } = useAuth();
  
  // Real-time collections
  const [tables, setTables] = useState<ITableItem[]>([]);
  const [floors, setFloors] = useState<IFloor[]>([]);
  const [sections, setSections] = useState<ISection[]>([]);
  
  // App States
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'list'>('visual');
  const [activeFloorFilter, setActiveFloorFilter] = useState<string>('all');
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [capacityFilter, setCapacityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive Design Mode State
  const [isDesignMode, setIsDesignMode] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);

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

  // 1. Subscribe to Floor Settings and Tables
  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);

    const layoutDocRef = doc(db, 'restaurants', user.tenantId, 'settings', 'layout');
    const unsubLayout = onSnapshot(layoutDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFloors(data.floors || []);
        setSections(data.sections || []);
      } else {
        setFloors([]);
        setSections([]);
      }
    }, (err) => {
      console.warn('[OwnerTablesManager] Layout settings listener error:', err);
    });

    const tablesColRef = collection(db, 'restaurants', user.tenantId, 'tables');
    const unsubTables = onSnapshot(tablesColRef, (querySnap) => {
      const list: ITableItem[] = [];
      querySnap.forEach((doc) => {
        const item = doc.data() as ITableItem;
        if (!item.isArchived) {
          list.push({ id: doc.id, ...(item as any) } as ITableItem);
        }
      });
      list.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
      setTables(list);
      setIsLoading(false);
    });

    return () => {
      unsubLayout();
      unsubTables();
    };
  }, [user?.tenantId]);

  // ----------------------------------------------------
  // LAYOUT CONFIG OPERATIONS
  // ----------------------------------------------------
  const handleSaveLayout = async (updatedFloors: IFloor[], updatedSections: ISection[]) => {
    if (!user?.tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'settings', 'layout');
      await setDoc(docRef, { floors: updatedFloors, sections: updatedSections });
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
    handleSaveLayout(updated, sections);
    setNewFloorName('');
  };

  const handleDeleteFloor = (floorId: string) => {
    const updatedFloors = floors.filter(f => f.id !== floorId);
    const updatedSections = sections.filter(s => s.floorId !== floorId);
    setFloors(updatedFloors);
    setSections(updatedSections);
    handleSaveLayout(updatedFloors, updatedSections);
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
    handleSaveLayout(floors, updated);
    setNewSectionName('');
  };

  const handleDeleteSection = (secId: string) => {
    const updated = sections.filter(s => s.id !== secId);
    setSections(updated);
    handleSaveLayout(floors, updated);
  };

  // ----------------------------------------------------
  // TABLE CRUD OPERATIONS
  // ----------------------------------------------------
  const openAddModal = () => {
    setEditingTable(null);
    const defaultFloor = floors[0]?.name || 'Main Floor';
    const defaultSection = sections.filter(s => s.floorId === floors[0]?.id)[0]?.name || 'Main Dining Area';
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
      tableNumber: tbl.tableNumber,
      tableName: tbl.tableName,
      capacity: tbl.capacity,
      floor: tbl.floor,
      section: tbl.section,
      shape: tbl.shape,
      notes: tbl.notes || '',
      status: tbl.status,
      isActive: tbl.isActive
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: TTableForm) => {
    if (!user?.tenantId) return;

    const hasDuplicateNumber = tables.some(
      (t) => t.tableNumber.trim().toLowerCase() === data.tableNumber.trim().toLowerCase() && t.id !== editingTable?.id
    );
    const hasDuplicateName = tables.some(
      (t) => t.tableName.trim().toLowerCase() === data.tableName.trim().toLowerCase() && t.id !== editingTable?.id
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
      const docRef = doc(db, 'restaurants', user.tenantId, 'tables', tableId);

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
        positionX: editingTable ? editingTable.positionX : 10 + (tables.length % 5) * 15,
        positionY: editingTable ? editingTable.positionY : 10 + Math.floor(tables.length / 5) * 15,
        qrCodeId: editingTable ? editingTable.qrCodeId : `QR-${tableId}`,
        branchId: 'main',
        isActive: data.status !== 'Disabled',
        notes: data.notes || '',
        createdAt: editingTable ? editingTable.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.displayName || user.email || 'owner'
      };

      await setDoc(docRef, tableData);
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
    if (!user?.tenantId) return;
    try {
      const newId = `TBL-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const docRef = doc(db, 'restaurants', user.tenantId, 'tables', newId);
      
      const duplicateData = {
        ...tbl,
        id: newId,
        tableId: newId,
        tableNumber: `${tbl.tableNumber}-Copy`,
        tableName: `${tbl.tableName} - Copy`,
        number: `${tbl.tableNumber}-Copy`,
        qrCodeId: `QR-${newId}`,
        positionX: Math.min(tbl.positionX + 5, 90),
        positionY: Math.min(tbl.positionY + 5, 90),
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
    if (!user?.tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'tables', tbl.id);
      await updateDoc(docRef, { isArchived: true });
      toast.success(`Archived table: ${tbl.tableName}`);
      if (selectedTable?.id === tbl.id) setSelectedTable(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to archive table.');
    }
  };

  const handleQuickStatusChange = async (tbl: ITableItem, nextStatus: ITableItem['status']) => {
    if (!user?.tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'tables', tbl.id);
      await updateDoc(docRef, { 
        status: nextStatus,
        tableStatus: nextStatus,
        isActive: nextStatus !== 'Disabled'
      });
      toast.success(`${tbl.tableName} is now ${nextStatus}`);
      setSelectedTable(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to change status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!user?.tenantId || !deletingTableId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'tables', deletingTableId);
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
  // INTERACTIVE FLOOR DRAG LOGIC
  // ----------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (!isDesignMode) return;
    e.preventDefault();
    setDraggingTableId(tableId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingTableId || !mapContainerRef.current) return;
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let positionX = Math.round((x / rect.width) * 100);
    let positionY = Math.round((y / rect.height) * 100);

    positionX = Math.max(0, Math.min(positionX, 90));
    positionY = Math.max(0, Math.min(positionY, 90));

    setTables((prev) => 
      prev.map((t) => (t.id === draggingTableId ? { ...t, positionX, positionY } : t))
    );
  };

  const handleMouseUp = async () => {
    if (!draggingTableId || !user?.tenantId) return;
    
    const draggedTable = tables.find((t) => t.id === draggingTableId);
    if (draggedTable) {
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'tables', draggingTableId);
        await updateDoc(docRef, {
          positionX: draggedTable.positionX,
          positionY: draggedTable.positionY
        });
      } catch (err) {
        console.error('Failed to save coordinates', err);
      }
    }
    setDraggingTableId(null);
  };

  // ----------------------------------------------------
  // SEARCH & FILTERING LOGIC
  // ----------------------------------------------------
  const getFilteredTables = () => {
    return tables.filter((tbl) => {
      if (activeFloorFilter !== 'all' && tbl.floor !== activeFloorFilter) return false;
      if (activeSectionFilter !== 'all' && tbl.section !== activeSectionFilter) return false;
      if (statusFilter !== 'all' && tbl.status !== statusFilter) return false;
      if (capacityFilter !== 'all') {
        const filterVal = Number(capacityFilter);
        if (tbl.capacity < filterVal) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = tbl.tableNumber.toLowerCase().includes(q);
        const matchesName = tbl.tableName.toLowerCase().includes(q);
        const matchesFloor = tbl.floor.toLowerCase().includes(q);
        const matchesSec = tbl.section.toLowerCase().includes(q);
        if (!matchesNum && !matchesName && !matchesFloor && !matchesSec) return false;
      }
      return true;
    });
  };

  const getStatusColor = (status: ITableItem['status']) => {
    switch (status) {
      case 'Available': return 'success';
      case 'Occupied': return 'danger';
      case 'Reserved': return 'warning';
      case 'Cleaning': return 'primary';
      case 'Disabled': return 'secondary';
      default: return 'info';
    }
  };

  const getStatusColorHex = (status: ITableItem['status']) => {
    switch (status) {
      case 'Available': return 'border-[#C6E7D8] bg-[#E8F5EF] text-[#16845B] shadow-sm';
      case 'Occupied': return 'border-[#F5CBC4] bg-[#FBEAE5] text-[#C9533B] shadow-sm';
      case 'Reserved': return 'border-[#FDE6B0] bg-[#FFF4DC] text-[#9A6200] shadow-sm';
      case 'Cleaning': return 'border-[#CBE0F7] bg-[#EAF2FB] text-[#1D5D9B] shadow-sm';
      case 'Disabled': return 'border-[#E5E0D9] bg-[#F8F6F2] text-[#7B8794] shadow-sm';
      default: return 'border-[#CBE0F7] bg-[#EAF2FB] text-[#1D5D9B] shadow-sm';
    }
  };

  // ----------------------------------------------------
  // QR EXPORTER & CANVAS GENERATION
  // ----------------------------------------------------
  const handlePrintQr = (tbl: ITableItem) => {
    const qrData = `${window.location.origin}/r/${user?.tenantId}/table/${tbl.id}`;
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
    const qrData = `${window.location.origin}/r/${user?.tenantId}/table/${tbl.id}`;
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

  const handleRegenerateQr = async (tbl: ITableItem) => {
    if (!user?.tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'tables', tbl.id);
      await updateDoc(docRef, { 
        qrCodeId: `QR-${tbl.tableId}-${Math.floor(Math.random() * 1000)}`,
        updatedAt: new Date().toISOString()
      });
      toast.success('QR Code signature regenerated.');
      setIsQrModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 select-none text-left">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-textPearl">Seating & Layouts</h1>
          <p className="text-xs text-mutedAsh">Create visual floor plans, configure tables arrangement, and export table QR ordering codes.</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="secondary" onClick={() => setIsLayoutManagerOpen(true)} className="flex items-center space-x-1.5" size="sm">
            <FolderPlus className="w-4 h-4" />
            <span>Manage Floors</span>
          </Button>
          <Button onClick={openAddModal} className="flex items-center space-x-1.5" size="sm">
            <Plus className="w-4 h-4" />
            <span>Add Seating Table</span>
          </Button>
        </div>
      </div>

      {/* Seating Stats Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Tables', count: tables.length, color: 'text-[#17202A] bg-white border-[#E5E0D9]' },
          { label: 'Available', count: tables.filter(t => t.status === 'Available').length, color: 'text-[#16845B] bg-[#E8F5EF] border-[#C6E7D8]' },
          { label: 'Occupied', count: tables.filter(t => t.status === 'Occupied').length, color: 'text-[#C9533B] bg-[#FBEAE5] border-[#F5CBC4]' },
          { label: 'Reserved', count: tables.filter(t => t.status === 'Reserved').length, color: 'text-[#9A6200] bg-[#FFF4DC] border-[#FDE6B0]' },
          { label: 'Cleaning', count: tables.filter(t => t.status === 'Cleaning').length, color: 'text-[#1D5D9B] bg-[#EAF2FB] border-[#CBE0F7]' }
        ].map((stat, idx) => (
          <Card key={idx} className={`p-4 border ${stat.color} flex flex-col justify-between rounded-2xl shadow-xs`}>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">{stat.label}</span>
            <span className="text-2xl font-extrabold mt-1">{stat.count}</span>
          </Card>
        ))}
      </div>

      {/* Tabs list & View Configs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#E5E0D9] pb-px gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('visual'); setIsDesignMode(false); }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border outline-none ${
              activeTab === 'visual'
                ? 'bg-[#C9533B] text-white border-[#C9533B] shadow-sm'
                : 'bg-white text-[#52606D] border-[#E5E0D9] hover:text-[#17202A] hover:bg-[#F8F6F2]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Visual Map View</span>
          </button>
          <button
            onClick={() => { setActiveTab('list'); setIsDesignMode(false); }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border outline-none ${
              activeTab === 'list'
                ? 'bg-[#C9533B] text-white border-[#C9533B] shadow-sm'
                : 'bg-white text-[#52606D] border-[#E5E0D9] hover:text-[#17202A] hover:bg-[#F8F6F2]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>List Catalog View</span>
          </button>
        </div>

        <div className="flex items-center space-x-1 text-slate-500 font-semibold text-[10px] tracking-wide uppercase px-2 py-1 rounded bg-slate-900/30 self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
          <span>Realtime Firestore Live</span>
        </div>
      </div>

      {/* Filter panel */}
      <Card className="p-3.5 border-slate-850 bg-slate-900/20 sticky top-0 z-20">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <Input 
            placeholder="Search by code, floor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            value={activeFloorFilter}
            onChange={(e) => {
              setActiveFloorFilter(e.target.value);
              setActiveSectionFilter('all');
            }}
            options={[{ value: 'all', label: 'All Floors' }, ...floors.map(f => ({ value: f.name, label: f.name }))]}
          />
          <Select
            value={activeSectionFilter}
            onChange={(e) => setActiveSectionFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Sections' },
              ...sections
                .filter(s => activeFloorFilter === 'all' || s.floorId === floors.find(f => f.name === activeFloorFilter)?.id)
                .map(s => ({ value: s.name, label: s.name }))
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'Available', label: 'Available' },
              { value: 'Occupied', label: 'Occupied' },
              { value: 'Reserved', label: 'Reserved' },
              { value: 'Cleaning', label: 'Cleaning' },
              { value: 'Disabled', label: 'Disabled' }
            ]}
          />
          <Select
            value={capacityFilter}
            onChange={(e) => setCapacityFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Any Seating Capacity' },
              { value: '2', label: '2+ People' },
              { value: '4', label: '4+ People' },
              { value: '6', label: '6+ People' },
              { value: '8', label: '8+ People' }
            ]}
          />
        </div>
      </Card>

      {/* Main Area */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner label="Synching Dining Seating Grid..." />
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* VISUAL MAP VIEW */}
          {activeTab === 'visual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-900/10 border border-slate-850 p-3 rounded-2xl">
                <div className="text-left">
                  <span className="text-xs font-extrabold text-slate-350">
                    {isDesignMode ? '📐 Designer Mode Active' : '📍 Operational View'}
                  </span>
                  <p className="text-[10px] text-slate-500">
                    {isDesignMode ? 'Drag and drop dining tables to rearrange floor plan coordinates.' : 'Click any table card to manage order statuses and generate scan codes.'}
                  </p>
                </div>
                <Button 
                  size="xs" 
                  variant={isDesignMode ? 'primary' : 'secondary'} 
                  onClick={() => setIsDesignMode(!isDesignMode)}
                >
                  {isDesignMode ? 'Save Layout' : 'Rearrange Tables'}
                </Button>
              </div>

              {/* Floors selection filter inline */}
              <div className="flex space-x-1 flex-wrap gap-1">
                <button
                  onClick={() => setActiveFloorFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    activeFloorFilter === 'all'
                      ? 'bg-slate-800 text-textPearl border-slate-700'
                      : 'bg-slate-950/20 text-slate-450 border-slate-900 hover:text-textPearl'
                  }`}
                >
                  All Floors
                </button>
                {floors.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFloorFilter(f.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      activeFloorFilter === f.name
                        ? 'bg-slate-800 text-textPearl border-slate-700'
                        : 'bg-slate-950/20 text-slate-450 border-slate-900 hover:text-textPearl'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>

              <div 
                ref={mapContainerRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`w-full h-[600px] border border-[#E5E0D9] rounded-2xl relative overflow-hidden bg-white pattern-grid select-none shadow-xs ${
                  isDesignMode ? 'cursor-crosshair border-dashed border-[#C9533B]' : ''
                }`}
              >
                {tables.length === 0 ? (
                  <div className="h-full flex items-center justify-center flex-col text-slate-500 py-12">
                    <Sliders className="w-12 h-12 text-slate-700 mb-3" />
                    <h3 className="text-base font-bold text-textPearl">No tables created yet</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
                      Create your first table to start accepting dine-in orders.
                    </p>
                    <Button onClick={openAddModal} className="mt-4 flex items-center space-x-1.5" size="sm">
                      <Plus className="w-4 h-4" />
                      <span>Add Table</span>
                    </Button>
                  </div>
                ) : getFilteredTables().length === 0 ? (
                  <div className="h-full flex items-center justify-center flex-col text-slate-500">
                    <Sliders className="w-12 h-12 text-slate-700 mb-2" />
                    <p className="text-sm font-semibold">No seating tables match filters.</p>
                  </div>
                ) : (
                  getFilteredTables().map((tbl) => {
                    const statusColor = getStatusColorHex(tbl.status);
                    const isShapeCircle = tbl.shape === 'circle';
                    const isRectangle = tbl.shape === 'rectangle';

                    return (
                      <div
                        key={tbl.id}
                        onMouseDown={(e) => handleMouseDown(e, tbl.id)}
                        onClick={() => {
                          if (!isDesignMode) {
                            setSelectedTable(tbl);
                            setIsDetailDrawerOpen(true);
                          }
                        }}
                        style={{
                          left: `${tbl.positionX}%`,
                          top: `${tbl.positionY}%`,
                          zIndex: draggingTableId === tbl.id ? 50 : 10
                        }}
                        className={`absolute border transition-shadow shadow-md hover:shadow-lg flex flex-col items-center justify-center cursor-pointer ${statusColor} ${
                          isShapeCircle ? 'rounded-full w-24 h-24' : isRectangle ? 'rounded-xl w-36 h-20' : 'rounded-2xl w-24 h-24'
                        } ${isDesignMode ? 'border-primary/60 cursor-grab active:cursor-grabbing border-2' : ''}`}
                      >
                        <span className="font-extrabold text-sm tracking-tight text-textPearl">#{tbl.tableNumber}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider opacity-60 mt-0.5">{tbl.status}</span>
                        <div className="flex items-center space-x-0.5 mt-1 opacity-70">
                          <Users className="w-2.5 h-2.5" />
                          <span className="text-[10px] font-bold">{tbl.capacity}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* LIST VIEW */}
          {activeTab === 'list' && (
            tables.length === 0 ? (
              <Card className="p-12 text-center border-slate-850 bg-slate-900/10">
                <Sliders className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-base font-bold text-textPearl">No tables created yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Create your first table to start accepting dine-in orders.
                </p>
                <Button onClick={openAddModal} className="mt-4 mx-auto flex items-center space-x-1.5" size="sm">
                  <Plus className="w-4 h-4" />
                  <span>Add Table</span>
                </Button>
              </Card>
            ) : (
            <Card className="p-0 overflow-hidden border-slate-850">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 bg-slate-900/30 text-xs font-bold text-slate-400 uppercase">
                      <th className="p-4">Table Code/Name</th>
                      <th className="p-4">Capacity</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40 text-xs">
                    {getFilteredTables().map((tbl) => (
                      <tr key={tbl.id} className="hover:bg-slate-900/25 transition-all">
                        <td className="p-4">
                          <div className="font-bold text-textPearl text-sm">Table #{tbl.tableNumber}</div>
                          <div className="text-[10px] text-slate-500">{tbl.tableName}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-1 font-bold text-slate-355">
                            <Users className="w-3.5 h-3.5" />
                            <span>{tbl.capacity} Seats</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-400">{tbl.floor}</div>
                          <div className="text-[10px] text-slate-500">{tbl.section}</div>
                        </td>
                        <td className="p-4">
                          <Badge variant={getStatusColor(tbl.status)}>{tbl.status}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-1.5">
                            <Button 
                              variant="ghost" 
                              size="xs" 
                              className="p-1 text-slate-400 hover:text-primary"
                              onClick={() => { setQrTable(tbl); setIsQrModalOpen(true); }}
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="xs" 
                              className="p-1 text-slate-400 hover:text-primary"
                              onClick={() => openEditModal(tbl)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="xs" 
                              className="p-1 text-slate-400 hover:text-emerald-400"
                              onClick={() => duplicateTable(tbl)}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="xs" 
                              className="p-1 text-slate-550 hover:text-red-400"
                              onClick={() => archiveTable(tbl)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

        </div>
      )}

      {/* FLOORS & SECTIONS MANAGER MODAL */}
      <Modal
        isOpen={isLayoutManagerOpen}
        onClose={() => setIsLayoutManagerOpen(false)}
        title="Restaurant Floors & Sections Config"
        className="max-w-2xl"
      >
        <div className="grid gap-6 md:grid-cols-2 text-left">
          
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-primary border-b border-slate-850 pb-2">Configure Floors</h3>
            
            <div className="flex space-x-2">
              <input 
                type="text"
                value={newFloorName}
                onChange={(e) => setNewFloorName(e.target.value)}
                placeholder="e.g. Ground Floor"
                className="flex-1 bg-slate-950/40 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-textPearl outline-none"
              />
              <Button size="xs" onClick={handleAddFloor} className="flex items-center space-x-1">
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </Button>
            </div>

            <Card className="p-3 border-slate-850 max-h-64 overflow-y-auto space-y-2 bg-slate-900/10">
              {floors.length === 0 ? (
                <p className="text-xs text-slate-500 text-center">No floors configured.</p>
              ) : (
                floors.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded bg-slate-950/30 border border-slate-900">
                    <span className="text-xs font-bold text-slate-350">{f.name}</span>
                    <button onClick={() => handleDeleteFloor(f.id)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-primary border-b border-slate-850 pb-2">Configure Floor Sections</h3>
            
            <div className="space-y-2">
              <Select 
                value={selectedSectionFloor}
                onChange={(e) => setSelectedSectionFloor(e.target.value)}
                options={[{ value: '', label: 'Select Floor *' }, ...floors.map(f => ({ value: f.id, label: f.name }))]}
              />
              <div className="flex space-x-2">
                <input 
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Indoor Main"
                  className="flex-1 bg-slate-950/40 border border-slate-850 rounded-xl px-3 py-1.5 text-xs text-textPearl outline-none"
                />
                <Button size="xs" onClick={handleAddSection} className="flex items-center space-x-1">
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </Button>
              </div>
            </div>

            <Card className="p-3 border-slate-850 max-h-64 overflow-y-auto space-y-2 bg-slate-900/10">
              {sections.length === 0 ? (
                <p className="text-xs text-slate-500 text-center">No sections configured.</p>
              ) : (
                sections.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded bg-slate-950/30 border border-slate-900">
                    <div>
                      <p className="text-xs font-bold text-slate-350">{s.name}</p>
                      <p className="text-[9px] text-slate-500">{floors.find(f => f.id === s.floorId)?.name || 'Unknown Floor'}</p>
                    </div>
                    <button onClick={() => handleDeleteSection(s.id)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </Card>
          </div>

        </div>
      </Modal>

      {/* TABLE CRUD FORM MODAL */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTable ? 'Edit Table Settings' : 'Add Seating Table'}
        className="max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
                { value: 'square', label: 'Square' },
                { value: 'circle', label: 'Circle' },
                { value: 'rectangle', label: 'Rectangle' }
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

          <div className="flex items-center space-x-3 pt-4 border-t border-slate-800/40">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting}>
              {editingTable ? 'Save Settings' : 'Create Table'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QUICK TABLE DRAWER CARD */}
      <Modal
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={selectedTable ? `Table #${selectedTable.tableNumber} Operations` : ''}
        className="max-w-md"
      >
        {selectedTable && (
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between bg-slate-950/30 p-3 rounded-2xl border border-slate-850">
              <div>
                <h4 className="font-extrabold text-sm text-textPearl">{selectedTable.tableName}</h4>
                <p className="text-[10px] text-slate-500">{selectedTable.floor} — {selectedTable.section} ({selectedTable.capacity} seats)</p>
              </div>
              <Badge variant={getStatusColor(selectedTable.status)}>{selectedTable.status}</Badge>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mark Status As</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Available', label: 'Available', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' },
                  { id: 'Occupied', label: 'Occupied', color: 'border-red-500/30 text-red-400 bg-red-500/5' },
                  { id: 'Reserved', label: 'Reserved', color: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5' },
                  { id: 'Cleaning', label: 'Cleaning', color: 'border-blue-500/30 text-blue-400 bg-blue-500/5' },
                  { id: 'Disabled', label: 'Disabled', color: 'border-slate-800 text-slate-500 bg-slate-800/10' }
                ].map((act) => (
                  <button
                    key={act.id}
                    onClick={() => handleQuickStatusChange(selectedTable, act.id as any)}
                    className={`border px-3 py-2 rounded-xl text-xs font-bold transition-all outline-none ${act.color} hover:brightness-125`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-850/60 pt-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">QR Code Actions</span>
              <div className="flex space-x-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="flex-1 flex items-center justify-center space-x-1.5"
                  onClick={() => { setQrTable(selectedTable); setIsQrModalOpen(true); setIsDetailDrawerOpen(false); }}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR Card</span>
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="flex-1 flex items-center justify-center space-x-1.5"
                  onClick={() => handlePrintQr(selectedTable)}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print QR</span>
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="flex-1 flex items-center justify-center space-x-1.5"
                  onClick={() => handleDownloadQr(selectedTable)}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </Button>
              </div>
            </div>

            <div className="flex space-x-2 border-t border-slate-850/60 pt-4">
              <Button 
                variant="secondary" 
                size="sm" 
                className="flex-1"
                onClick={() => { openEditModal(selectedTable); setIsDetailDrawerOpen(false); }}
              >
                Edit Table
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                className="flex-1 text-red-400 hover:bg-red-500/10"
                onClick={() => { archiveTable(selectedTable); setIsDetailDrawerOpen(false); }}
              >
                Archive Table
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* QR MODAL CARD VIEW */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title={qrTable ? `Table #${qrTable.tableNumber} Scan Code` : ''}
        className="max-w-sm"
      >
        {qrTable && (
          <div className="space-y-4 text-center">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-[280px] mx-auto shadow-xl relative overflow-hidden text-left">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Table Scan Card</span>
                <h4 className="text-2xl font-extrabold text-textPearl mt-1">Table {qrTable.tableNumber}</h4>
              </div>
              <div className="w-48 h-48 bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-center mx-auto my-4 shadow-inner">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/r/${user?.tenantId}/table/${qrTable.id}`)}`} 
                  alt="QR Code" 
                  className="w-full h-full"
                />
              </div>
              <p className="text-[10px] text-slate-500 text-center select-all break-all max-w-[220px] mx-auto font-mono">
                {`${window.location.origin}/r/${user?.tenantId}/table/${qrTable.id}`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => handleDownloadQr(qrTable)} className="flex flex-col items-center justify-center p-2 text-slate-300">
                <Download className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Download</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handlePrintQr(qrTable)} className="flex flex-col items-center justify-center p-2 text-slate-300">
                <Printer className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Print</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleRegenerateQr(qrTable)} className="flex flex-col items-center justify-center p-2 text-slate-400">
                <RefreshCw className="w-4 h-4 mb-1" />
                <span className="text-[9px]">Regen</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
