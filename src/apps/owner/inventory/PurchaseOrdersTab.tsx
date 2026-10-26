import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { formatPrice } from '../../../shared/utils/format';
import { 
  IPurchaseOrder, 
  IPurchaseOrderItem, 
  PurchaseOrderStatus, 
  ISupplier, 
  ISupplierPrice, 
  IStockIngredient, 
  IGoodsReceipt 
} from '../../../shared/domain/inventory/types';
import { vendorPurchaseOrderService } from '../../../shared/services/vendorPurchaseOrderService';

import Button from '../../../components/ui/Button/Button';
import Card from '../../../components/ui/Card/Card';
import Modal from '../../../components/ui/Modal/Modal';
import Table from '../../../components/ui/Table/Table';

import { 
  Plus, 
  Search, 
  Eye, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  MessageSquare, 
  Mail, 
  FileText, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  Package, 
  Check, 
  Trash2,
  Share2,
  Printer,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PurchaseOrdersTabProps {
  suppliers: ISupplier[];
  ingredients: IStockIngredient[];
  onNavigateToSuppliers?: () => void;
}

export const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({ 
  suppliers, 
  ingredients,
  onNavigateToSuppliers 
}) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // Real-time collections
  const [purchaseOrders, setPurchaseOrders] = useState<IPurchaseOrder[]>([]);
  const [supplierPrices, setSupplierPrices] = useState<ISupplierPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseOrderStatus>('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<IPurchaseOrder | null>(null);

  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receivePo, setReceivePo] = useState<IPurchaseOrder | null>(null);

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelPo, setCancelPo] = useState<IPurchaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Create Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderItems, setOrderItems] = useState<Array<{
    ingredientId: string;
    ingredientName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    notes: string;
  }>>([]);
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [expectedDate, setExpectedDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [supplierInstructions, setSupplierInstructions] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Goods Receiving Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receivingItems, setReceivingItems] = useState<Array<{
    ingredientId: string;
    quantityReceived: number;
    quantityRejected: number;
    batchNumber: string;
    expiryDate: string;
    discrepancyReason: string;
  }>>([]);

  // Subscribe to purchase orders and prices
  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    const poUnsub = onSnapshot(
      collection(db, 'restaurants', tenantId, 'purchaseOrders'),
      (snap) => {
        const pos = snap.docs.map(d => d.data() as IPurchaseOrder);
        // Sort descending by creation date
        pos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPurchaseOrders(pos);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching purchase orders:', err);
        setIsLoading(false);
      }
    );

    const priceUnsub = onSnapshot(
      collection(db, 'restaurants', tenantId, 'supplierPrices'),
      (snap) => {
        setSupplierPrices(snap.docs.map(d => d.data() as ISupplierPrice));
      },
      (err) => console.error('Error fetching prices:', err)
    );

    return () => {
      poUnsub();
      priceUnsub();
    };
  }, [tenantId]);

  // Keep selectedPo updated if real-time PO changes
  useEffect(() => {
    if (selectedPo) {
      const updated = purchaseOrders.find(p => p.id === selectedPo.id);
      if (updated) setSelectedPo(updated);
    }
  }, [purchaseOrders]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = purchaseOrders.length;
    const active = purchaseOrders.filter(p => ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(p.status)).length;
    const delivered = purchaseOrders.filter(p => p.status === 'DELIVERED').length;
    const totalSpend = purchaseOrders
      .filter(p => p.status !== 'CANCELLED')
      .reduce((acc, p) => acc + (p.grandTotal || 0), 0);

    return { total, active, delivered, totalSpend };
  }, [purchaseOrders]);

  // Filtered POs
  const filteredOrders = purchaseOrders.filter(po => {
    const matchesSearch = 
      (po.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (po.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.items.some(i => i.ingredientName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && po.status === statusFilter;
  });

  // Open Create PO modal
  const handleOpenCreate = () => {
    const firstSupplier = suppliers.find(s => s.isActive !== false) || suppliers[0];
    setSelectedSupplierId(firstSupplier?.id || '');

    // Default item
    const firstIng = ingredients[0];
    let defaultPrice = 100;
    if (firstSupplier && firstIng) {
      const matchPrice = supplierPrices.find(p => p.supplierId === firstSupplier.id && p.ingredientId === firstIng.id);
      defaultPrice = matchPrice?.unitPrice || firstIng.purchaseCost || 100;
    }

    if (firstIng) {
      setOrderItems([{
        ingredientId: firstIng.id,
        ingredientName: firstIng.name,
        unit: firstIng.unit,
        quantity: 10,
        unitPrice: defaultPrice,
        taxRate: 5,
        notes: ''
      }]);
    } else {
      setOrderItems([]);
    }

    setDeliveryCharge('0');
    setExpectedDate('');
    setDeliveryAddress(firstSupplier?.address || '');
    setSupplierInstructions('');
    setInternalNotes('');
    setIsCreateOpen(true);
  };

  // Add Item row to PO
  const handleAddItemRow = () => {
    const unusedIng = ingredients.find(ing => !orderItems.some(item => item.ingredientId === ing.id)) || ingredients[0];
    if (!unusedIng) return;

    const matchedPrice = supplierPrices.find(p => p.supplierId === selectedSupplierId && p.ingredientId === unusedIng.id);
    const price = matchedPrice?.unitPrice || unusedIng.purchaseCost || 100;

    setOrderItems([...orderItems, {
      ingredientId: unusedIng.id,
      ingredientName: unusedIng.name,
      unit: unusedIng.unit,
      quantity: 5,
      unitPrice: price,
      taxRate: 5,
      notes: ''
    }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (orderItems.length <= 1) {
      toast.error('A purchase order must have at least one line item.');
      return;
    }
    setOrderItems(orderItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...orderItems];
    const current = updated[index];

    if (field === 'ingredientId') {
      const found = ingredients.find(i => i.id === value);
      if (found) {
        current.ingredientId = found.id;
        current.ingredientName = found.name;
        current.unit = found.unit;
        // Lookup price
        const matchedPrice = supplierPrices.find(p => p.supplierId === selectedSupplierId && p.ingredientId === found.id);
        current.unitPrice = matchedPrice?.unitPrice || found.purchaseCost || 100;
      }
    } else if (field === 'quantity') {
      current.quantity = Math.max(0.1, parseFloat(value) || 0);
    } else if (field === 'unitPrice') {
      current.unitPrice = Math.max(0, Math.round(parseFloat(value) * 100) || 0);
    } else if (field === 'taxRate') {
      current.taxRate = parseFloat(value) || 0;
    } else if (field === 'notes') {
      current.notes = value;
    }

    setOrderItems(updated);
  };

  // Create Purchase Order Submit
  const handleSavePurchaseOrder = async (sendImmediately: boolean = false) => {
    if (!tenantId) return;

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) {
      toast.error('Select an active vendor.');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Add at least one item to the order.');
      return;
    }

    setIsSubmitting(true);
    try {
      const po = await vendorPurchaseOrderService.createPurchaseOrder(tenantId, {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierPhone: supplier.phone,
        supplierEmail: supplier.email,
        supplierAddress: supplier.address,
        supplierGstNumber: supplier.gstNumber,
        items: orderItems,
        deliveryCharge: Math.round(parseFloat(deliveryCharge) * 100) || 0,
        expectedDeliveryDate: expectedDate,
        deliveryAddress: deliveryAddress.trim(),
        supplierInstructions: supplierInstructions.trim(),
        internalNotes: internalNotes.trim(),
        status: sendImmediately ? 'SENT' : 'DRAFT'
      }, user);

      if (sendImmediately) {
        toast.success(`Purchase Order ${po.poNumber} created and marked as SENT!`);
      } else {
        toast.success(`Purchase Order ${po.poNumber} saved as DRAFT.`);
      }

      setIsCreateOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create purchase order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Receive Goods Modal
  const handleOpenReceive = (po: IPurchaseOrder) => {
    setReceivePo(po);
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setReceiptNotes('');

    // Pre-populate receiving items with remaining quantities
    const items = po.items.map(item => {
      const remaining = Math.max(0, item.quantity - (item.receivedQuantity || 0));
      return {
        ingredientId: item.ingredientId,
        quantityReceived: remaining,
        quantityRejected: 0,
        batchNumber: `BATCH-${Date.now().toString(36).toUpperCase()}`,
        expiryDate: '',
        discrepancyReason: ''
      };
    });

    setReceivingItems(items);
    setIsReceiveOpen(true);
  };

  // Submit Goods Receipt
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !receivePo || isSubmitting) return;

    const validItems = receivingItems.filter(i => i.quantityReceived > 0);
    if (validItems.length === 0) {
      toast.error('Enter at least one item quantity to receive.');
      return;
    }

    setIsSubmitting(true);
    // Generate durable idempotency key per check-in action
    const idempotencyKey = `po-${receivePo.id}-${Date.now()}`;

    try {
      const receipt = await vendorPurchaseOrderService.receivePurchaseOrderGoods(tenantId, receivePo.id, {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        notes: receiptNotes.trim(),
        idempotencyKey,
        items: validItems
      }, user);

      toast.success(`Shipment received! Goods Receipt ${receipt.receiptNumber} logged and stock updated.`);
      setIsReceiveOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to process goods receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel PO
  const handleCancelPo = async () => {
    if (!tenantId || !cancelPo) return;
    if (!cancelReason.trim()) {
      toast.error('Please enter a cancellation reason.');
      return;
    }

    try {
      await vendorPurchaseOrderService.cancelPurchaseOrder(tenantId, cancelPo.id, cancelReason.trim(), user);
      toast.success(`Purchase Order ${cancelPo.poNumber} cancelled.`);
      setIsCancelOpen(false);
      if (selectedPo?.id === cancelPo.id) {
        setIsDetailsOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order.');
    }
  };

  // WhatsApp Dispatch
  const handleDispatchWhatsApp = (po: IPurchaseOrder) => {
    if (!tenantId) return;
    const msg = vendorPurchaseOrderService.formatPoWhatsAppMessage(po);
    const phone = (po.supplierPhone || '').replace(/[^0-9]/g, '');

    // Record audit
    vendorPurchaseOrderService.sendPurchaseOrder(tenantId, po.id, 'whatsapp', user);

    const url = phone 
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
    toast.success('WhatsApp dispatch initiated and logged.');
  };

  // Email Dispatch
  const handleDispatchEmail = (po: IPurchaseOrder) => {
    if (!tenantId) return;
    const { subject, text } = vendorPurchaseOrderService.formatPoEmailContent(po);

    vendorPurchaseOrderService.sendPurchaseOrder(tenantId, po.id, 'email', user);

    const mailto = `mailto:${po.supplierEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
    toast.success('Email dispatch initiated and logged.');
  };

  // Confirm PO
  const handleConfirmPo = async (po: IPurchaseOrder) => {
    if (!tenantId) return;
    try {
      await vendorPurchaseOrderService.confirmPurchaseOrder(tenantId, po.id, user);
      toast.success(`Supplier confirmation logged for ${po.poNumber}.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm order.');
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">DRAFT</span>;
      case 'SENT':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">SENT</span>;
      case 'CONFIRMED':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">CONFIRMED</span>;
      case 'PARTIALLY_RECEIVED':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">PARTIAL RECEIPT</span>;
      case 'DELIVERED':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">DELIVERED</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">CANCELLED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-[#E5E0D9] bg-white rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Total POs</span>
            <strong className="text-xl font-mono text-slate-900 font-extrabold">{metrics.total}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            <FileText className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 border-[#E5E0D9] bg-white rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Active Orders</span>
            <strong className="text-xl font-mono text-amber-600 font-extrabold">{metrics.active}</strong>
          </div>
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 border-[#E5E0D9] bg-white rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Delivered</span>
            <strong className="text-xl font-mono text-emerald-700 font-extrabold">{metrics.delivered}</strong>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 border-[#E5E0D9] bg-white rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Procurement Spend</span>
            <strong className="text-xl font-mono text-slate-900 font-extrabold">{formatPrice(metrics.totalSpend)}</strong>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* 2. Top Controls: Search, Status Filters, Create Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search PO #, vendor, ingredient..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E5E0D9] rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16845B]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F5F2EB] p-1 rounded-xl text-xs font-bold overflow-x-auto max-w-full">
            {(['ALL', 'DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'DELIVERED', 'CANCELLED'] as const).map(st => (
              <button 
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition-all text-[11px] whitespace-nowrap ${statusFilter === st ? 'bg-white shadow-xs text-slate-900 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleOpenCreate} className="text-xs font-bold py-2 px-3.5 bg-[#16845B] hover:bg-[#126B49] text-white flex items-center gap-1.5 rounded-xl shadow-xs">
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </Button>
      </div>

      {/* 3. Purchase Orders Table */}
      {filteredOrders.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-[#E5E0D9] rounded-2xl bg-white shadow-xs">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 mb-1">No purchase orders found</h4>
          <p className="text-xs text-slate-500 mb-4">Create your first purchase order to procure ingredients from authorized vendors.</p>
          <Button onClick={handleOpenCreate} variant="secondary" className="text-xs font-bold py-1.5 px-3">
            Create Purchase Order
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border border-[#E5E0D9] bg-white rounded-2xl shadow-xs">
          <Table
            keyExtractor={(row: IPurchaseOrder) => row?.id || Math.random().toString()}
            data={filteredOrders}
            columns={[
              {
                header: 'PO Number & Date',
                accessor: (row: IPurchaseOrder) => (
                  <div className="space-y-1">
                    <span 
                      onClick={() => { setSelectedPo(row); setIsDetailsOpen(true); }}
                      className="font-mono font-extrabold text-sm text-[#16845B] hover:underline cursor-pointer block"
                    >
                      {row.poNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {new Date(row.createdAt).toLocaleDateString()} by {row.createdByName}
                    </span>
                  </div>
                )
              },
              {
                header: 'Vendor Details',
                accessor: (row: IPurchaseOrder) => (
                  <div className="space-y-0.5 text-xs">
                    <span className="font-extrabold text-slate-900 block">{row.supplierName}</span>
                    <span className="text-[11px] text-slate-500 block">{row.supplierPhone || 'No phone'}</span>
                  </div>
                )
              },
              {
                header: 'Items & Fulfillment',
                accessor: (row: IPurchaseOrder) => {
                  const totalItems = row.items.length;
                  const totalQty = row.items.reduce((acc, i) => acc + i.quantity, 0);
                  const receivedQty = row.items.reduce((acc, i) => acc + (i.receivedQuantity || 0), 0);
                  const isOverReceived = totalQty > 0 && receivedQty > totalQty;
                  const percent = totalQty > 0 ? Math.round((receivedQty / totalQty) * 100) : 0;
                  const progressBarWidth = Math.min(100, percent);

                  return (
                    <div className="space-y-1.5 text-xs min-w-[150px]">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-700">{totalItems} item{totalItems === 1 ? '' : 's'}</span>
                        {isOverReceived ? (
                          <span className="text-amber-800 font-extrabold flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3 text-amber-600 inline shrink-0" />
                            {percent}% (Over-received)
                          </span>
                        ) : (
                          <span className={percent === 100 ? 'text-emerald-700 font-extrabold' : 'text-slate-700'}>
                            {percent}% received
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${isOverReceived ? 'bg-amber-500' : percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: `${progressBarWidth}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500">
                          {receivedQty} / {totalQty} units
                        </span>
                        {isOverReceived && (
                          <span className="text-amber-700 font-bold">
                            +{(receivedQty - totalQty).toFixed(1)} excess
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
              },
              {
                header: 'Order Total',
                accessor: (row: IPurchaseOrder) => (
                  <div className="space-y-0.5 text-xs">
                    <span className="font-mono font-extrabold text-slate-900 text-sm block">
                      {formatPrice(row.grandTotal)}
                    </span>
                    {row.taxTotal > 0 && (
                      <span className="text-[10px] text-slate-400 block">Incl. Tax: {formatPrice(row.taxTotal)}</span>
                    )}
                  </div>
                )
              },
              {
                header: 'Status',
                accessor: (row: IPurchaseOrder) => renderStatusBadge(row.status)
              },
              {
                header: 'Actions',
                accessor: (row: IPurchaseOrder) => (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      title="View Details"
                      onClick={() => { setSelectedPo(row); setIsDetailsOpen(true); }}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Receive Goods Action */}
                    {['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(row.status) && (
                      <button
                        type="button"
                        title="Receive Goods Shipment"
                        onClick={() => handleOpenReceive(row)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Receive</span>
                      </button>
                    )}

                    {/* WhatsApp share */}
                    <button
                      type="button"
                      title="Share via WhatsApp"
                      onClick={() => handleDispatchWhatsApp(row)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    {/* Cancel Action */}
                    {row.status !== 'DELIVERED' && row.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        title="Cancel Order"
                        onClick={() => { setCancelPo(row); setCancelReason(''); setIsCancelOpen(true); }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* MODAL 1: CREATE NEW PURCHASE ORDER */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Purchase Order"
        className="max-w-3xl bg-white"
      >
        <div className="space-y-4 text-xs text-left max-h-[80vh] overflow-y-auto pr-1">
          {/* Vendor Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Select Vendor *</label>
              <select
                value={selectedSupplierId}
                onChange={e => {
                  setSelectedSupplierId(e.target.value);
                  const sup = suppliers.find(s => s.id === e.target.value);
                  if (sup?.address) setDeliveryAddress(sup.address);
                }}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#16845B]"
              >
                {suppliers.filter(s => s.isActive !== false).map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} {sup.companyName ? `(${sup.companyName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Expected Delivery Date</label>
              <input 
                type="date" 
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
          </div>

          {/* Dynamic Order Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-extrabold uppercase text-slate-500">Ordered Ingredients</label>
              <Button type="button" onClick={handleAddItemRow} variant="secondary" className="text-xs font-bold py-1 px-2.5">
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add Item</span>
              </Button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                  <tr>
                    <th className="p-2">Ingredient</th>
                    <th className="p-2 w-20">Qty</th>
                    <th className="p-2 w-20">Unit</th>
                    <th className="p-2 w-28">Unit Price (₹)</th>
                    <th className="p-2 w-20">Tax %</th>
                    <th className="p-2 w-28">Total</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderItems.map((item, idx) => {
                    const lineTotal = Math.round(item.quantity * item.unitPrice);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2">
                          <select
                            value={item.ingredientId}
                            onChange={e => handleItemChange(idx, 'ingredientId', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800"
                          >
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-center font-bold"
                          />
                        </td>
                        <td className="p-2 text-slate-500 font-medium">
                          {item.unit}
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={(item.unitPrice / 100).toFixed(2)}
                            onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={item.taxRate}
                            onChange={e => handleItemChange(idx, 'taxRate', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-center"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                          </select>
                        </td>
                        <td className="p-2 font-mono font-bold text-slate-900 text-right">
                          {formatPrice(lineTotal)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Delivery Address</label>
              <input 
                type="text" 
                placeholder="Restaurant Receiving Dock, Gate 2" 
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Delivery / Freight Charge (₹)</label>
              <input 
                type="number" 
                min="0" 
                step="0.01"
                value={deliveryCharge}
                onChange={e => setDeliveryCharge(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Supplier Instructions (Included in PO)</label>
              <textarea 
                rows={2}
                placeholder="e.g. Please send freshly harvested crates before 10 AM."
                value={supplierInstructions}
                onChange={e => setSupplierInstructions(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Internal Notes (Private)</label>
              <textarea 
                rows={2}
                placeholder="e.g. Budget approved for weekend event restocking."
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* Calculated Totals Summary */}
          {(() => {
            const subtotal = orderItems.reduce((acc, i) => acc + Math.round(i.quantity * i.unitPrice), 0);
            const taxTotal = orderItems.reduce((acc, i) => {
              const line = Math.round(i.quantity * i.unitPrice);
              return acc + Math.round(line * (i.taxRate / 100));
            }, 0);
            const delivery = Math.round(parseFloat(deliveryCharge) * 100) || 0;
            const grandTotal = subtotal + taxTotal + delivery;

            return (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">Subtotal: <strong>{formatPrice(subtotal)}</strong></span>
                  <span className="text-slate-500 ml-3">Tax: <strong>{formatPrice(taxTotal)}</strong></span>
                  {delivery > 0 && <span className="text-slate-500 ml-3">Delivery: <strong>{formatPrice(delivery)}</strong></span>}
                </div>
                <div>
                  <span className="text-slate-600 mr-2">Grand Total:</span>
                  <strong className="text-base font-mono text-[#16845B] font-extrabold">{formatPrice(grandTotal)}</strong>
                </div>
              </div>
            );
          })()}

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="secondary" 
                disabled={isSubmitting}
                onClick={() => handleSavePurchaseOrder(false)}
                className="font-bold"
              >
                Save as Draft
              </Button>
              <Button 
                type="button" 
                disabled={isSubmitting}
                onClick={() => handleSavePurchaseOrder(true)}
                className="bg-[#16845B] hover:bg-[#126B49] text-white font-bold"
              >
                {isSubmitting ? 'Processing...' : 'Create & Send PO'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: PURCHASE ORDER INVOICE & DETAILS */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedPo ? `Purchase Order ${selectedPo.poNumber}` : 'Purchase Order Details'}
        className="max-w-2xl bg-white"
      >
        {selectedPo && (
          <div className="space-y-5 text-xs text-left max-h-[80vh] overflow-y-auto pr-1">
            {/* Header info bar */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-lg font-mono font-extrabold text-slate-900">{selectedPo.poNumber}</h4>
                  {renderStatusBadge(selectedPo.status)}
                </div>
                <p className="text-slate-500">Vendor: <strong>{selectedPo.supplierName}</strong> • {new Date(selectedPo.createdAt).toLocaleDateString()}</p>
                {selectedPo.expectedDeliveryDate && (
                  <p className="text-emerald-700 font-bold mt-0.5">Expected Delivery: {selectedPo.expectedDeliveryDate}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => handleDispatchWhatsApp(selectedPo)} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </Button>
                <Button 
                  onClick={() => handleDispatchEmail(selectedPo)} 
                  variant="secondary"
                  className="text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </Button>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h5 className="font-extrabold text-slate-800 uppercase text-[11px] mb-2">Line Items</h5>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Ordered</th>
                      <th className="p-2 text-center">Received</th>
                      <th className="p-2 text-right">Unit Price</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPo.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-800">{item.ingredientName}</td>
                        <td className="p-2 text-center text-slate-700">{item.quantity} {item.unit}</td>
                        <td className="p-2 text-center">
                          <span className={`font-bold ${(item.receivedQuantity || 0) > item.quantity ? 'text-amber-700' : (item.receivedQuantity || 0) >= item.quantity ? 'text-emerald-700' : 'text-amber-600'}`}>
                            {item.receivedQuantity || 0} {item.unit}
                          </span>
                          {(item.receivedQuantity || 0) > item.quantity && (
                            <span className="text-[9.5px] font-bold text-amber-700 block">
                              (+{((item.receivedQuantity || 0) - item.quantity).toFixed(1)} excess)
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600">{formatPrice(item.unitPrice)}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{formatPrice(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right space-y-1">
              <p className="text-slate-600">Subtotal: <strong>{formatPrice(selectedPo.subtotal)}</strong></p>
              {selectedPo.taxTotal > 0 && <p className="text-slate-600">Tax / GST: <strong>{formatPrice(selectedPo.taxTotal)}</strong></p>}
              {selectedPo.deliveryCharge && selectedPo.deliveryCharge > 0 && (
                <p className="text-slate-600">Delivery: <strong>{formatPrice(selectedPo.deliveryCharge)}</strong></p>
              )}
              <h4 className="text-base font-mono text-[#16845B] font-extrabold">
                Grand Total: {formatPrice(selectedPo.grandTotal)}
              </h4>
            </div>

            {/* Audit Log */}
            {selectedPo.auditLog && selectedPo.auditLog.length > 0 && (
              <div>
                <h5 className="font-extrabold text-slate-800 uppercase text-[11px] mb-2">Audit History</h5>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  {selectedPo.auditLog.map((log, idx) => (
                    <div key={idx} className="flex items-start justify-between text-[11px]">
                      <div>
                        <span className="font-bold text-slate-800 uppercase">{log.action}: </span>
                        <span className="text-slate-600">{log.notes}</span>
                      </div>
                      <span className="text-slate-400 text-[10px] whitespace-nowrap ml-2">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {log.performedBy}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              {['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(selectedPo.status) && (
                <Button 
                  onClick={() => { setIsDetailsOpen(false); handleOpenReceive(selectedPo); }}
                  className="bg-[#16845B] hover:bg-[#126B49] text-white font-bold"
                >
                  <Package className="w-4 h-4 mr-1.5" />
                  <span>Receive Goods</span>
                </Button>
              )}

              {selectedPo.status === 'SENT' && (
                <Button 
                  onClick={() => handleConfirmPo(selectedPo)}
                  variant="secondary"
                  className="font-bold"
                >
                  <Check className="w-4 h-4 mr-1.5 text-indigo-600" />
                  <span>Record Confirmation</span>
                </Button>
              )}

              <Button variant="secondary" onClick={() => setIsDetailsOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: GOODS RECEIVING */}
      <Modal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title={receivePo ? `Receive Goods: ${receivePo.poNumber}` : 'Receive Goods'}
        className="max-w-2xl bg-white"
      >
        {receivePo && (
          <form onSubmit={handleSubmitReceipt} className="space-y-4 text-xs text-left max-h-[80vh] overflow-y-auto pr-1">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <p className="font-bold">Checking in shipment for {receivePo.supplierName}</p>
              <p className="text-[11px] text-emerald-700">Received quantities will immediately update inventory stock balances and generate verified purchase movements.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Vendor Invoice # (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. INV-2026-9921"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Invoice Date</label>
                <input 
                  type="date" 
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            {/* Check-in table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                  <tr>
                    <th className="p-2">Ingredient</th>
                    <th className="p-2 text-center">Ordered</th>
                    <th className="p-2 text-center">Already Recv</th>
                    <th className="p-2 w-28 text-center">Qty Received Now</th>
                    <th className="p-2 w-28 text-center">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receivePo.items.map((item, idx) => {
                    const rec = receivingItems.find(r => r.ingredientId === item.ingredientId);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-800">{item.ingredientName}</td>
                        <td className="p-2 text-center text-slate-600">{item.quantity} {item.unit}</td>
                        <td className="p-2 text-center text-slate-600">{item.receivedQuantity || 0} {item.unit}</td>
                        <td className="p-2">
                          <input 
                            type="number"
                            min="0"
                            max={item.quantity * 2} // Allow reasonable excess if vendor over-delivered
                            step="0.1"
                            value={rec?.quantityReceived || 0}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setReceivingItems(receivingItems.map(r => 
                                r.ingredientId === item.ingredientId ? { ...r, quantityReceived: val } : r
                              ));
                            }}
                            className="w-full p-1.5 bg-white border border-emerald-300 rounded-lg text-center font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="date"
                            value={rec?.expiryDate || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setReceivingItems(receivingItems.map(r => 
                                r.ingredientId === item.ingredientId ? { ...r, expiryDate: val } : r
                              ));
                            }}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Receiving & Quality Notes</label>
              <textarea 
                rows={2}
                placeholder="e.g. All cartons inspected, temperature OK, seal intact."
                value={receiptNotes}
                onChange={e => setReceiptNotes(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setIsReceiveOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-[#16845B] hover:bg-[#126B49] text-white font-bold"
              >
                {isSubmitting ? 'Updating Stock...' : 'Confirm Stock Check-In'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 4: CANCEL PURCHASE ORDER */}
      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title={cancelPo ? `Cancel Purchase Order ${cancelPo.poNumber}` : 'Cancel Order'}
        className="max-w-md bg-white"
      >
        <div className="space-y-4 text-xs text-left">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
            <p className="font-bold">Are you sure you want to cancel this purchase order?</p>
            <p className="text-[11px] text-rose-600 mt-1">Note: Any stock already checked in via previous receipts will remain safely in inventory.</p>
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Reason for Cancellation *</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Supplier out of stock, cancelled by mutual consent."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsCancelOpen(false)}>
              Back
            </Button>
            <Button 
              type="button" 
              onClick={handleCancelPo}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
