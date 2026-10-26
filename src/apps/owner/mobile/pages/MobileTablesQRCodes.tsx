import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Grid, 
  Map, 
  List, 
  QrCode, 
  Download, 
  Share2, 
  Users, 
  AlertCircle,
  X,
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  Layers,
  Search,
  CheckCircle2,
  RefreshCw,
  Move
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import MobileStatusBadge from '../components/MobileStatusBadge';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';

interface ITable {
  id: string;
  tableNumber: string;
  tableName?: string;
  capacity: number;
  floor?: string;
  section?: string;
  shape?: 'circle' | 'square' | 'rectangle';
  status: string;
  positionX?: number;
  positionY?: number;
  notes?: string;
  qrCodeId?: string;
  isActive?: boolean;
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

export const MobileTablesQRCodes: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // Real-time collections
  const [tables, setTables] = useState<ITable[]>([]);
  const [floors, setFloors] = useState<IFloor[]>([]);
  const [sections, setSections] = useState<ISection[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'list' or 'map'
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingTable, setEditingTable] = useState<ITable | null>(null);
  const [activeQRTable, setActiveQRTable] = useState<ITable | null>(null);
  const [showFloorsModal, setShowFloorsModal] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<ITable | null>(null);

  // Add/Edit Table Form state
  const [formNumber, setFormNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formSection, setFormSection] = useState('');
  const [formCapacity, setFormCapacity] = useState('4');
  const [formShape, setFormShape] = useState<'circle' | 'square' | 'rectangle'>('square');
  const [formStatus, setFormStatus] = useState('Available');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Floors & Sections management form states
  const [newFloorName, setNewFloorName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionFloorId, setSectionFloorId] = useState('');

  // Table repositioning state for Map View
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);

  // Listen to Firestore
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const tablesCol = collection(db, 'restaurants', tenantId, 'tables');
    const unsubTables = onSnapshot(tablesCol, (snap) => {
      const list: ITable[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          tableNumber: String(data.tableNumber || data.number || d.id),
          tableName: data.tableName || data.name || '',
          capacity: Number(data.capacity || data.seatingCapacity || 4),
          floor: data.floor || 'Main Floor',
          section: data.section || 'General',
          shape: data.shape || 'square',
          status: data.status || 'Available',
          positionX: Number(data.positionX || 50),
          positionY: Number(data.positionY || 50),
          notes: data.notes || '',
          qrCodeId: data.qrCodeId || d.id,
          isActive: data.isActive !== false,
        });
      });
      list.sort((a, b) => {
        const numA = parseInt(String(a.tableNumber).replace(/\D/g, '')) || 0;
        const numB = parseInt(String(b.tableNumber).replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setTables(list);
      setLoading(false);
    }, (err) => {
      console.warn('[MobileTablesQRCodes] Snapshot error:', err);
      setLoading(false);
    });

    const floorsCol = collection(db, 'restaurants', tenantId, 'floors');
    const unsubFloors = onSnapshot(floorsCol, (snap) => {
      const list: IFloor[] = [];
      snap.forEach((d) => list.push({ id: d.id, name: d.data().name || d.id }));
      setFloors(list);
    });

    const sectionsCol = collection(db, 'restaurants', tenantId, 'sections');
    const unsubSections = onSnapshot(sectionsCol, (snap) => {
      const list: ISection[] = [];
      snap.forEach((d) => list.push({ id: d.id, floorId: d.data().floorId || '', name: d.data().name || d.id }));
      setSections(list);
    });

    return () => {
      unsubTables();
      unsubFloors();
      unsubSections();
    };
  }, [tenantId]);

  // Status Metrics
  const statusCounts = useMemo(() => {
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let cleaning = 0;

    tables.forEach((t) => {
      const st = (t.status || '').toUpperCase();
      if (st === 'AVAILABLE') available++;
      else if (st === 'OCCUPIED' || st === 'ORDERING' || st === 'PREPARING' || st === 'DINING' || st === 'BILL REQUESTED') occupied++;
      else if (st === 'RESERVED') reserved++;
      else if (st === 'CLEANING') cleaning++;
      else available++;
    });

    return { total: tables.length, available, occupied, reserved, cleaning };
  }, [tables]);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (selectedFloor !== 'all' && t.floor !== selectedFloor) return false;
      if (selectedSection !== 'all' && t.section !== selectedSection) return false;
      if (selectedStatus !== 'all') {
        const st = (t.status || '').toUpperCase();
        if (selectedStatus === 'AVAILABLE' && st !== 'AVAILABLE') return false;
        if (selectedStatus === 'OCCUPIED' && !['OCCUPIED', 'ORDERING', 'PREPARING', 'DINING', 'BILL REQUESTED'].includes(st)) return false;
        if (selectedStatus === 'RESERVED' && st !== 'RESERVED') return false;
        if (selectedStatus === 'CLEANING' && st !== 'CLEANING') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = t.tableNumber.toLowerCase().includes(q);
        const matchName = (t.tableName || '').toLowerCase().includes(q);
        const matchFloor = (t.floor || '').toLowerCase().includes(q);
        const matchSection = (t.section || '').toLowerCase().includes(q);
        if (!matchNum && !matchName && !matchFloor && !matchSection) return false;
      }
      return true;
    });
  }, [tables, selectedFloor, selectedSection, selectedStatus, searchQuery]);

  const openAddModal = () => {
    setEditingTable(null);
    setFormNumber(String(tables.length + 1));
    setFormName(`Table ${tables.length + 1}`);
    setFormFloor(floors[0]?.name || 'Main Floor');
    setFormSection(sections[0]?.name || 'General');
    setFormCapacity('4');
    setFormShape('square');
    setFormStatus('Available');
    setFormNotes('');
    setFormError(null);
    setShowAddEditModal(true);
  };

  const openEditModal = (t: ITable) => {
    setEditingTable(t);
    setFormNumber(t.tableNumber);
    setFormName(t.tableName || `Table ${t.tableNumber}`);
    setFormFloor(t.floor || floors[0]?.name || 'Main Floor');
    setFormSection(t.section || sections[0]?.name || 'General');
    setFormCapacity(String(t.capacity || 4));
    setFormShape(t.shape || 'square');
    setFormStatus(t.status || 'Available');
    setFormNotes(t.notes || '');
    setFormError(null);
    setShowAddEditModal(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !formNumber.trim()) {
      setFormError('Table number is required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const docId = editingTable ? editingTable.id : `T-${formNumber.trim().toUpperCase()}`;
      const docRef = doc(db, 'restaurants', tenantId, 'tables', docId);

      const payload = {
        tableNumber: formNumber.trim(),
        number: formNumber.trim(),
        tableName: formName.trim() || `Table ${formNumber.trim()}`,
        name: formName.trim() || `Table ${formNumber.trim()}`,
        capacity: Math.max(1, Number(formCapacity) || 4),
        floor: formFloor || 'Main Floor',
        section: formSection || 'General',
        shape: formShape,
        status: formStatus,
        notes: formNotes.trim(),
        tenantId,
        updatedAt: new Date().toISOString(),
      };

      if (!editingTable) {
        (payload as any).createdAt = new Date().toISOString();
        (payload as any).positionX = ((tables.length % 3) * 28 + 6);
        (payload as any).positionY = (Math.floor(tables.length / 3) * 22 + 6);
        (payload as any).isActive = true;
      }

      await setDoc(docRef, payload, { merge: true });
      setShowAddEditModal(false);
    } catch (err: any) {
      console.error('[MobileTablesQRCodes] Save error:', err);
      setFormError(err.message || 'Failed to save table.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!tenantId || !tableToDelete) return;
    try {
      await deleteDoc(doc(db, 'restaurants', tenantId, 'tables', tableToDelete.id));
      setTableToDelete(null);
    } catch (err) {
      console.error('[MobileTablesQRCodes] Delete error:', err);
    }
  };

  const handleQuickStatusChange = async (t: ITable, newStatus: string) => {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, 'restaurants', tenantId, 'tables', t.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[MobileTablesQRCodes] Update status error:', err);
    }
  };

  // Floor management
  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newFloorName.trim()) return;
    try {
      const fId = `floor-${Date.now()}`;
      await setDoc(doc(db, 'restaurants', tenantId, 'floors', fId), {
        name: newFloorName.trim(),
        createdAt: new Date().toISOString(),
      });
      setNewFloorName('');
    } catch (err) {
      console.error('[MobileTablesQRCodes] Add floor error:', err);
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    if (!tenantId) return;
    try {
      await deleteDoc(doc(db, 'restaurants', tenantId, 'floors', floorId));
    } catch (err) {
      console.error('[MobileTablesQRCodes] Delete floor error:', err);
    }
  };

  // Section management
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newSectionName.trim()) return;
    try {
      const sId = `sec-${Date.now()}`;
      await setDoc(doc(db, 'restaurants', tenantId, 'sections', sId), {
        name: newSectionName.trim(),
        floorId: sectionFloorId || (floors[0]?.id || ''),
        createdAt: new Date().toISOString(),
      });
      setNewSectionName('');
    } catch (err) {
      console.error('[MobileTablesQRCodes] Add section error:', err);
    }
  };

  const handleDeleteSection = async (secId: string) => {
    if (!tenantId) return;
    try {
      await deleteDoc(doc(db, 'restaurants', tenantId, 'sections', secId));
    } catch (err) {
      console.error('[MobileTablesQRCodes] Delete section error:', err);
    }
  };

  // QR URLs
  const getQRUrl = (t: ITable) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://spiral-dine.vercel.app';
    const tableParam = t.tableNumber || t.id;
    return `${origin}/r/${tenantId}/table/${tableParam}`;
  };

  const getQRImageUrl = (text: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(text)}&color=20-20-20`;
  };

  const handleShareQR = async (t: ITable) => {
    const url = getQRUrl(t);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SpiralDine Table ${t.tableNumber}`,
          text: `Scan or open to view the menu for Table ${t.tableNumber}`,
          url,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('QR ordering link copied to clipboard!');
    }
  };

  // Update visual position in map view (supports click and touch)
  const handleMapTapReposition = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isRepositioning || !draggedTableId || !tenantId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'changedTouches' in e && e.changedTouches.length > 0 
      ? e.changedTouches[0].clientX 
      : 'touches' in e && e.touches.length > 0 
      ? e.touches[0].clientX 
      : 'clientX' in e ? (e as React.MouseEvent).clientX : rect.left + rect.width / 2;
    const clientY = 'changedTouches' in e && e.changedTouches.length > 0 
      ? e.changedTouches[0].clientY 
      : 'touches' in e && e.touches.length > 0 
      ? e.touches[0].clientY 
      : 'clientY' in e ? (e as React.MouseEvent).clientY : rect.top + rect.height / 2;

    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const pctX = Math.max(0, Math.min(85, Math.round(((relX - 25) / rect.width) * 100)));
    const pctY = Math.max(0, Math.min(85, Math.round(((relY - 25) / rect.height) * 100)));

    try {
      await updateDoc(doc(db, 'restaurants', tenantId, 'tables', draggedTableId), {
        positionX: pctX,
        positionY: pctY,
        updatedAt: new Date().toISOString(),
      });
      setDraggedTableId(null);
    } catch (err) {
      console.error('[MobileTablesQRCodes] Reposition error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/business')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="font-extrabold text-sm text-[#202124]">Tables & Seating</h1>
          <p className="text-[11px] text-[#707070]">{tables.length} tables registered</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFloorsModal(true)}
            className="w-8 h-8 rounded-full bg-[#F7F7F7] text-[#202124] flex items-center justify-center hover:bg-[#EBEBEB]"
            title="Manage Floors & Sections"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openAddModal}
            className="w-9 h-9 rounded-full bg-[#FF7518] text-white flex items-center justify-center shadow-sm shadow-[#FF7518]/25"
            aria-label="Add table"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* KPI Status Chips */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-[#EBEBEB] overflow-x-auto no-scrollbar flex items-center gap-2">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            selectedStatus === 'all'
              ? 'bg-[#202124] text-white'
              : 'bg-[#F7F7F7] text-[#707070] hover:bg-[#EBEBEB]'
          }`}
        >
          All ({statusCounts.total})
        </button>
        <button
          onClick={() => setSelectedStatus('AVAILABLE')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            selectedStatus === 'AVAILABLE'
              ? 'bg-[#16A34A] text-white'
              : 'bg-[#DCFCE7] text-[#16A34A]'
          }`}
        >
          Available ({statusCounts.available})
        </button>
        <button
          onClick={() => setSelectedStatus('OCCUPIED')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            selectedStatus === 'OCCUPIED'
              ? 'bg-[#DC2626] text-white'
              : 'bg-[#FEE2E2] text-[#DC2626]'
          }`}
        >
          Occupied ({statusCounts.occupied})
        </button>
        <button
          onClick={() => setSelectedStatus('RESERVED')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            selectedStatus === 'RESERVED'
              ? 'bg-[#2563EB] text-white'
              : 'bg-[#EFF6FF] text-[#2563EB]'
          }`}
        >
          Reserved ({statusCounts.reserved})
        </button>
        <button
          onClick={() => setSelectedStatus('CLEANING')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            selectedStatus === 'CLEANING'
              ? 'bg-[#D97706] text-white'
              : 'bg-[#FEF3C7] text-[#D97706]'
          }`}
        >
          Cleaning ({statusCounts.cleaning})
        </button>
      </div>

      {/* Control Bar: View Mode Switcher & Search */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table, floor, section..."
              className="w-full h-9 pl-8 pr-3 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] focus:outline-none focus:border-[#FF7518]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9E9E9E]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#EBEBEB]">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-[#FF7518] text-white' : 'text-[#707070] hover:text-[#202124]'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'map' ? 'bg-[#FF7518] text-white' : 'text-[#707070] hover:text-[#202124]'
              }`}
              title="Visual Map View"
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floor and Section Filter Dropdowns */}
        {(floors.length > 0 || sections.length > 0) && (
          <div className="flex items-center gap-2">
            {floors.length > 0 && (
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="flex-1 h-8 px-2.5 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] font-medium"
              >
                <option value="all">All Floors</option>
                {floors.map((f) => (
                  <option key={f.id} value={f.name}>{f.name}</option>
                ))}
              </select>
            )}

            {sections.length > 0 && (
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="flex-1 h-8 px-2.5 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] font-medium"
              >
                <option value="all">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          <MobileLoadingSkeleton count={4} />
        ) : filteredTables.length === 0 ? (
          <MobileEmptyState
            icon={Grid}
            title={searchQuery ? 'No Matching Tables' : 'No Tables Configured'}
            description={
              searchQuery
                ? 'Try adjusting your search query or status filter.'
                : 'Add dining tables to configure your restaurant floor plan and generate smart QR codes.'
            }
            actionLabel={searchQuery ? 'Clear Filters' : 'Add First Table'}
            onAction={() => {
              if (searchQuery) {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedFloor('all');
                setSelectedSection('all');
              } else {
                openAddModal();
              }
            }}
          />
        ) : viewMode === 'list' ? (
          /* List Catalog View */
          <div className="grid grid-cols-1 gap-3">
            {filteredTables.map((table) => {
              const status = table.status || 'Available';
              const shapeLabel = table.shape === 'circle' ? 'Round' : table.shape === 'rectangle' ? 'Rectangular' : 'Square';

              return (
                <div
                  key={table.id}
                  className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm text-[#202124]">
                          {table.tableName || `Table ${table.tableNumber}`}
                        </h3>
                        <span className="text-[10px] font-bold text-[#FF7518] bg-[#FFF4EE] px-2 py-0.5 rounded-full">
                          #{table.tableNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#707070] mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#9E9E9E]" />
                          {table.capacity} Seats
                        </span>
                        <span>•</span>
                        <span>{table.floor || 'Main'} - {table.section || 'General'}</span>
                        <span>•</span>
                        <span className="capitalize">{shapeLabel}</span>
                      </div>
                      {table.notes && (
                        <p className="text-[10px] text-[#9E9E9E] italic mt-1">{table.notes}</p>
                      )}
                    </div>

                    {/* Quick Status Dropdown */}
                    <select
                      value={status}
                      onChange={(e) => handleQuickStatusChange(table, e.target.value)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer outline-none ${
                        status.toUpperCase() === 'AVAILABLE'
                          ? 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]'
                          : status.toUpperCase() === 'RESERVED'
                          ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                          : status.toUpperCase() === 'CLEANING'
                          ? 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]'
                          : 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]'
                      }`}
                    >
                      <option value="Available">Available</option>
                      <option value="Occupied">Occupied</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActiveQRTable(table)}
                      className="flex-1 py-1.5 px-2 bg-[#FFF4EE] hover:bg-[#FFE0CE] text-[#FF7518] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Smart QR</span>
                    </button>

                    <button
                      onClick={() => openEditModal(table)}
                      className="p-2 bg-[#F7F7F7] text-[#202124] rounded-xl hover:bg-[#EBEBEB] transition-colors"
                      title="Edit Table"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setTableToDelete(table)}
                      className="p-2 bg-[#FEE2E2] text-[#DC2626] rounded-xl hover:bg-[#FECACA] transition-colors"
                      title="Delete Table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Visual Floor Map View */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#707070] px-1">
              <span>{isRepositioning ? (draggedTableId ? 'Tap on canvas to place selected table' : 'Tap a table then tap canvas to move') : 'Visual Layout Preview'}</span>
              <button
                onClick={() => {
                  setIsRepositioning(!isRepositioning);
                  setDraggedTableId(null);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 ${
                  isRepositioning ? 'bg-[#FF7518] text-white' : 'bg-white border border-[#EBEBEB] text-[#202124]'
                }`}
              >
                <Move className="w-3 h-3" />
                <span>{isRepositioning ? 'Done Rearranging' : 'Rearrange'}</span>
              </button>
            </div>

            <div
              onClick={handleMapTapReposition}
              onTouchEnd={handleMapTapReposition}
              className="relative w-full h-[360px] bg-white rounded-2xl border-2 border-dashed border-[#D1D5DB] overflow-hidden p-2 select-none shadow-inner"
              style={{
                backgroundImage: 'radial-gradient(#E5E7EB 1.5px, transparent 1.5px)',
                backgroundSize: '20px 20px',
              }}
            >
              {filteredTables.map((t, idx) => {
                const hasPos = t.positionX !== undefined && t.positionY !== undefined && (t.positionX > 0 || t.positionY > 0);
                const pctX = hasPos
                  ? Math.min(85, Math.max(0, t.positionX ?? 10))
                  : ((idx % 3) * 28 + 6);
                const pctY = hasPos
                  ? Math.min(85, Math.max(0, t.positionY ?? 10))
                  : (Math.floor(idx / 3) * 22 + 6);
                const isSelected = draggedTableId === t.id;
                const status = (t.status || '').toUpperCase();

                const borderColor = 
                  status === 'AVAILABLE' ? 'border-[#16A34A] bg-[#DCFCE7]/60' :
                  status === 'RESERVED' ? 'border-[#2563EB] bg-[#EFF6FF]/60' :
                  status === 'CLEANING' ? 'border-[#D97706] bg-[#FEF3C7]/60' :
                  'border-[#DC2626] bg-[#FEE2E2]/60';

                const shapeClass = 
                  t.shape === 'circle' ? 'rounded-full' :
                  t.shape === 'rectangle' ? 'rounded-xl w-16 h-12' :
                  'rounded-xl w-14 h-14';

                return (
                  <div
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isRepositioning) {
                        setDraggedTableId(t.id);
                      } else {
                        setActiveQRTable(t);
                      }
                    }}
                    style={{
                      left: `${pctX}%`,
                      top: `${pctY}%`,
                      position: 'absolute',
                    }}
                    className={`border-2 flex flex-col items-center justify-center cursor-pointer transition-transform ${shapeClass} ${borderColor} ${
                      isSelected ? 'ring-2 ring-[#FF7518] scale-110 shadow-lg' : 'shadow-xs'
                    }`}
                  >
                    <span className="font-extrabold text-[11px] text-[#202124] leading-none">
                      {t.tableNumber}
                    </span>
                    <span className="text-[9px] text-[#707070] mt-0.5 font-medium leading-none">
                      {t.capacity}p
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {activeQRTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveQRTable(null)}
              className="absolute top-4 right-4 text-[#9E9E9E] hover:text-[#202124]"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-[#FFF4EE] text-[#FF7518] text-xs font-bold mb-1">
                SpiralDine Smart QR
              </div>
              <h3 className="font-extrabold text-lg text-[#202124]">
                {activeQRTable.tableName || `Table ${activeQRTable.tableNumber}`}
              </h3>
              <p className="text-[11px] text-[#707070]">
                {activeQRTable.floor} • {activeQRTable.section} • {activeQRTable.capacity} Seats
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border-2 border-[#EBEBEB] inline-block shadow-inner mx-auto">
              <img
                src={getQRImageUrl(getQRUrl(activeQRTable))}
                alt={`QR Code Table ${activeQRTable.tableNumber}`}
                className="w-48 h-48 object-contain rounded-lg"
              />
            </div>

            <div className="text-[10px] text-[#9E9E9E] break-all px-2">
              {getQRUrl(activeQRTable)}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleShareQR(activeQRTable)}
                className="flex-1 py-2.5 bg-[#FF7518] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-[#FF7518]/25"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share QR</span>
              </button>

              <a
                href={getQRImageUrl(getQRUrl(activeQRTable))}
                download={`SpiralDine-Table-${activeQRTable.tableNumber}.png`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 bg-[#F7F7F7] text-[#202124] text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-[#EBEBEB]"
                title="Download PNG"
              >
                <Download className="w-3.5 h-3.5" />
              </a>

              <a
                href={getQRUrl(activeQRTable)}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 bg-[#F7F7F7] text-[#202124] text-xs font-bold rounded-xl flex items-center justify-center gap-1 border border-[#EBEBEB]"
                title="Open Web Menu"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#202124]">
              {editingTable ? 'Edit Dining Table' : 'Add Dining Table'}
            </h3>

            {formError && (
              <div className="p-3 rounded-xl bg-[#FEE2E2] text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTable} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Table Number / Code *</label>
                <input
                  type="text"
                  required
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="e.g. 5, 10, T-01"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Table Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Window Booth, VIP Corner"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Floor</label>
                  {floors.length > 0 ? (
                    <select
                      value={formFloor}
                      onChange={(e) => {
                        const newFl = e.target.value;
                        setFormFloor(newFl);
                        const matched = floors.find((f) => f.name === newFl);
                        if (matched) {
                          const matchedSecs = sections.filter((s) => s.floorId === matched.id);
                          if (matchedSecs.length > 0) {
                            setFormSection(matchedSecs[0].name);
                          }
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                    >
                      {floors.map((f) => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formFloor}
                      onChange={(e) => setFormFloor(e.target.value)}
                      placeholder="Main Floor"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Section</label>
                  {sections.length > 0 ? (
                    <select
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                    >
                      {(() => {
                        const matchedFloor = floors.find((f) => f.name === formFloor);
                        const relevantSections = matchedFloor 
                          ? sections.filter((s) => s.floorId === matchedFloor.id) 
                          : sections;
                        const displaySecs = relevantSections.length > 0 ? relevantSections : sections;
                        return displaySecs.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ));
                      })()}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      placeholder="General"
                      className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#202124] mb-1">Shape</label>
                  <select
                    value={formShape}
                    onChange={(e) => setFormShape(e.target.value as any)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                  >
                    <option value="square">Square</option>
                    <option value="circle">Round / Circle</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none font-medium"
                >
                  <option value="Available">Available</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Internal Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Near AC, power outlet available"
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF7518] text-white text-xs font-bold shadow-sm"
                >
                  {saving ? 'Saving...' : editingTable ? 'Update Table' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {tableToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-[#202124]">Delete Table {tableToDelete.tableNumber}?</h3>
            <p className="text-xs text-[#707070]">
              This will permanently delete table records and QR associations.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setTableToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTable}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Floors & Sections Modal */}
      {showFloorsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#202124]">Floors & Sections</h3>
              <button onClick={() => setShowFloorsModal(false)} className="text-[#9E9E9E]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Floors Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-[#707070] uppercase">Floors</h4>
              <form onSubmit={handleAddFloor} className="flex gap-2">
                <input
                  type="text"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  placeholder="New floor name..."
                  className="flex-1 h-9 px-3 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none"
                />
                <button
                  type="submit"
                  className="px-3 bg-[#FF7518] text-white text-xs font-bold rounded-xl"
                >
                  Add
                </button>
              </form>
              <div className="space-y-1 pt-1">
                {floors.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded-xl bg-[#F7F7F7] text-xs">
                    <span className="font-medium text-[#202124]">{f.name}</span>
                    <button onClick={() => handleDeleteFloor(f.id)} className="text-[#DC2626] p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sections Section */}
            <div className="space-y-2 pt-2 border-t border-[#EBEBEB]">
              <h4 className="text-xs font-extrabold text-[#707070] uppercase">Sections</h4>
              <form onSubmit={handleAddSection} className="flex gap-2">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="New section name..."
                  className="flex-1 h-9 px-3 rounded-xl bg-[#F7F7F7] text-xs text-[#202124] outline-none"
                />
                <button
                  type="submit"
                  className="px-3 bg-[#FF7518] text-white text-xs font-bold rounded-xl"
                >
                  Add
                </button>
              </form>
              <div className="space-y-1 pt-1">
                {sections.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-xl bg-[#F7F7F7] text-xs">
                    <span className="font-medium text-[#202124]">{s.name}</span>
                    <button onClick={() => handleDeleteSection(s.id)} className="text-[#DC2626] p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowFloorsModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#202124] text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileTablesQRCodes;
