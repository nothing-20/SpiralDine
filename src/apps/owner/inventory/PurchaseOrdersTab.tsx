import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { formatAddress, formatPrice } from '../../../shared/utils/format';
import { useRestaurant } from '../../../shared/services/RestaurantContext';
import { restaurantService, IBranchItem } from '../../../shared/services/restaurantService';
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
  ChevronRight,
  MapPin,
  Building2,
  Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PurchaseOrdersTabProps {
  suppliers: ISupplier[];
  ingredients: IStockIngredient[];
  onNavigateToSuppliers?: () => void;
  initialSelectedIngredients?: IStockIngredient[];
  initialCreateOpen?: boolean;
  onClearInitialCreate?: () => void;
}

export const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({ 
  suppliers, 
  ingredients,
  onNavigateToSuppliers,
  initialSelectedIngredients,
  initialCreateOpen,
  onClearInitialCreate
}) => {
  const { user } = useAuth();
  const { activeRestaurant } = useRestaurant();
  const tenantId = user?.tenantId;

  // Real-time collections
  const [purchaseOrders, setPurchaseOrders] = useState<IPurchaseOrder[]>([]);
  const [supplierPrices, setSupplierPrices] = useState<ISupplierPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Authorized Branches
  const [branches, setBranches] = useState<IBranchItem[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

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

  // Cancellation WhatsApp Notification Dialog State
  const [isCancelNotifyOpen, setIsCancelNotifyOpen] = useState(false);
  const [cancelNotifyPo, setCancelNotifyPo] = useState<IPurchaseOrder | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Edit Delivery Address Modal State (for fixing legacy/existing PO addresses)
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [editAddressPo, setEditAddressPo] = useState<IPurchaseOrder | null>(null);
  const [editDeliveryAddress, setEditDeliveryAddress] = useState('');
  const [editBranchId, setEditBranchId] = useState('');
  const [editBranchName, setEditBranchName] = useState('');
  const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);

  // Create Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedBranchName, setSelectedBranchName] = useState('');
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

  // Load authorized branches for this tenant
  useEffect(() => {
    if (!tenantId) return;
    setIsLoadingBranches(true);
    restaurantService.getAuthorizedBranches(tenantId)
      .then(bList => {
        setBranches(bList);
      })
      .catch(err => {
        console.warn('Failed to fetch branches', err);
      })
      .finally(() => {
        setIsLoadingBranches(false);
      });
  }, [tenantId]);

  // Keep selectedPo updated if real-time PO changes
  useEffect(() => {
    if (selectedPo) {
      const updated = purchaseOrders.find(p => p.id === selectedPo.id);
      if (updated) setSelectedPo(updated);
    }
  }, [purchaseOrders]);

  // Helper: Calculate suggested replenishment quantity based on current & min stock
  const calculateSuggestedQuantity = (ing: IStockIngredient): number => {
    if (ing.currentStock < ing.minimumStock) {
      // Replenishment buffer: target 2x minimum stock level minus current stock
      const deficit = (ing.minimumStock * 2) - ing.currentStock;
      return Math.max(1, Math.round(deficit));
    }
    // If healthy or at minimum limit, suggest a standard batch equal to minimumStock or 10
    return ing.minimumStock > 0 ? ing.minimumStock : 10;
  };

  // Handle Quick PO prefill from Ingredients List
  useEffect(() => {
    if (initialCreateOpen && initialSelectedIngredients && initialSelectedIngredients.length > 0) {
      // 1. Identify suppliers for the selected ingredients
      const supplierCounts = new Map<string, number>();
      initialSelectedIngredients.forEach(ing => {
        if (ing.supplierId) {
          supplierCounts.set(ing.supplierId, (supplierCounts.get(ing.supplierId) || 0) + 1);
        }
      });

      let candidateSupplierId = '';
      if (supplierCounts.size > 0) {
        let maxCount = 0;
        supplierCounts.forEach((count, supId) => {
          if (count > maxCount && suppliers.some(s => s.id === supId)) {
            maxCount = count;
            candidateSupplierId = supId;
          }
        });
      }
      if (!candidateSupplierId && suppliers.length > 0) {
        candidateSupplierId = suppliers[0].id;
      }
      if (candidateSupplierId) {
        setSelectedSupplierId(candidateSupplierId);
      }

      // 2. Prefill items with suggested quantities and prices
      const prefilledItems = initialSelectedIngredients.map(item => {
        const priceRec = supplierPrices.find(sp => 
          sp.supplierId === (candidateSupplierId || item.supplierId) && sp.ingredientId === item.id
        );
        const unitPrice = priceRec ? priceRec.unitPrice : (item.purchaseCost || 100);
        const suggestedQty = calculateSuggestedQuantity(item);

        return {
          ingredientId: item.id,
          ingredientName: item.name,
          unit: item.unit || 'kg',
          quantity: suggestedQty,
          unitPrice,
          taxRate: 5,
          notes: item.currentStock <= item.minimumStock ? 'Replenishment order (Low stock)' : 'Standard restock'
        };
      });

      setOrderItems(prefilledItems);

      // 3. Set default branch delivery address
      if (branches.length > 0) {
        const defaultBranch = branches[0];
        setSelectedBranchId(defaultBranch.id);
        setSelectedBranchName(defaultBranch.name);
        const bAddr = formatAddress(defaultBranch.address);
        const rAddr = activeRestaurant ? formatAddress(activeRestaurant.address) : '';
        setDeliveryAddress(bAddr || rAddr || '');
      } else if (activeRestaurant?.address) {
        setDeliveryAddress(formatAddress(activeRestaurant.address));
      }

      setIsCreateOpen(true);
      onClearInitialCreate?.();
    }
  }, [initialCreateOpen, initialSelectedIngredients, suppliers, supplierPrices, branches, activeRestaurant]);

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

  // Switch Delivery Branch in Create Modal
  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    const foundBranch = branches.find(b => b.id === branchId);
    const bName = foundBranch?.name || 'Main Branch';
    setSelectedBranchName(bName);

    const branchAddr = foundBranch ? formatAddress(foundBranch.address) : '';
    const restaurantAddr = activeRestaurant ? formatAddress(activeRestaurant.address) : '';
    setDeliveryAddress(branchAddr || restaurantAddr || '');
  };

  // Open Create PO modal
  const handleOpenCreate = () => {
    const firstSupplier = suppliers.find(s => s.isActive !== false) || suppliers[0];
    if (!firstSupplier) {
      toast.error('Please create at least one active vendor in the Vendor Directory first.');
      return;
    }
    setSelectedSupplierId(firstSupplier?.id || '');

    // Resolve initial branch and delivery address - strictly separated from vendor address
    const initialBranch = branches.length > 0 ? branches[0] : null;
    const branchId = initialBranch?.id || 'main';
    const branchName = initialBranch?.name || 'Main Branch';
    setSelectedBranchId(branchId);
    setSelectedBranchName(branchName);

    const branchAddr = initialBranch ? formatAddress(initialBranch.address) : '';
    const restaurantAddr = activeRestaurant ? formatAddress(activeRestaurant.address) : '';
    const defaultDeliveryAddr = branchAddr || restaurantAddr || '';
    setDeliveryAddress(defaultDeliveryAddr);

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
        restaurantName: activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant',
        branchId: selectedBranchId,
        branchName: selectedBranchName,
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
    const reason = cancelReason.trim();

    try {
      await vendorPurchaseOrderService.cancelPurchaseOrder(tenantId, cancelPo.id, reason, user);
      toast.success(`Purchase Order ${cancelPo.poNumber} cancelled.`);

      const updatedPo: IPurchaseOrder = {
        ...cancelPo,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
        updatedAt: new Date().toISOString()
      };

      setPurchaseOrders(prev => prev.map(p => p.id === cancelPo.id ? updatedPo : p));
      if (selectedPo?.id === cancelPo.id) {
        setSelectedPo(updatedPo);
      }

      setIsCancelOpen(false);
      // Immediately open supplier cancellation notification modal
      setCancelNotifyPo(updatedPo);
      setIsCancelNotifyOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order.');
    }
  };

  // WhatsApp Cancellation Dispatch
  const handleDispatchCancellationWhatsApp = (po: IPurchaseOrder) => {
    if (!tenantId) return;
    const restName = po.restaurantName || activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant';
    const msg = vendorPurchaseOrderService.formatPoCancellationWhatsAppMessage(po, restName, po.cancellationReason || cancelReason);
    const phone = (po.supplierPhone || '').replace(/[^0-9]/g, '');

    // Record audit event
    vendorPurchaseOrderService.recordCancellationNotificationDispatched(tenantId, po.id, 'whatsapp', user);

    const url = phone 
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
    toast.success('WhatsApp cancellation notice opened. (Does not confirm supplier delivery or acknowledgement).');
  };

  // Copy Cancellation Notice to Clipboard
  const handleCopyCancellationNotice = (po: IPurchaseOrder) => {
    if (!tenantId) return;
    const restName = po.restaurantName || activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant';
    const msg = vendorPurchaseOrderService.formatPoCancellationWhatsAppMessage(po, restName, po.cancellationReason || cancelReason);

    navigator.clipboard.writeText(msg);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 3000);

    vendorPurchaseOrderService.recordCancellationNotificationDispatched(tenantId, po.id, 'copied', user);
    toast.success('Cancellation notice copied to clipboard.');
  };

  // Edit Delivery Address for Existing PO (allows correcting legacy orders)
  const handleOpenEditAddress = (po: IPurchaseOrder) => {
    setEditAddressPo(po);
    setEditDeliveryAddress(po.deliveryAddress || '');
    setEditBranchId(po.branchId || '');
    setEditBranchName(po.branchName || 'Main Branch');
    setIsEditAddressOpen(true);
  };

  const handleSaveEditedAddress = async () => {
    if (!tenantId || !editAddressPo) return;
    if (!editDeliveryAddress.trim()) {
      toast.error('Please enter a valid delivery address.');
      return;
    }
    setIsUpdatingAddress(true);
    try {
      await vendorPurchaseOrderService.updatePurchaseOrderDeliveryAddress(
        tenantId,
        editAddressPo.id,
        editDeliveryAddress.trim(),
        editBranchId,
        editBranchName,
        user
      );
      toast.success(`Delivery address updated for ${editAddressPo.poNumber}.`);

      const updatedPo: IPurchaseOrder = {
        ...editAddressPo,
        deliveryAddress: editDeliveryAddress.trim(),
        branchId: editBranchId,
        branchName: editBranchName,
        updatedAt: new Date().toISOString()
      };

      if (selectedPo?.id === editAddressPo.id) {
        setSelectedPo(updatedPo);
      }
      setPurchaseOrders(prev => prev.map(p => p.id === editAddressPo.id ? updatedPo : p));
      setIsEditAddressOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update delivery address.');
    } finally {
      setIsUpdatingAddress(false);
    }
  };

  // WhatsApp Dispatch with authorized restaurant and delivery details
  const handleDispatchWhatsApp = (po: IPurchaseOrder) => {
    if (!tenantId) return;
    const restName = po.restaurantName || activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant';
    const msg = vendorPurchaseOrderService.formatPoWhatsAppMessage(po, restName);
    const phone = (po.supplierPhone || '').replace(/[^0-9]/g, '');

    // Record audit
    vendorPurchaseOrderService.sendPurchaseOrder(tenantId, po.id, 'whatsapp', user);

    const url = phone 
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
    toast.success('WhatsApp dispatch initiated and logged.');
  };

  // Email Dispatch with authorized restaurant and delivery details
  const handleDispatchEmail = (po: IPurchaseOrder) => {
    if (!tenantId) return;
    const restName = po.restaurantName || activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant';
    const { subject, text } = vendorPurchaseOrderService.formatPoEmailContent(po, restName);

    vendorPurchaseOrderService.sendPurchaseOrder(tenantId, po.id, 'email', user);

    const mailto = `mailto:${po.supplierEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
    toast.success('Email dispatch initiated and logged.');
  };

  // Print / PDF Preview Dispatch
  const handlePrintPo = (po: IPurchaseOrder) => {
    const restName = po.restaurantName || activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant';
    const { html } = vendorPurchaseOrderService.formatPoEmailContent(po, restName);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Purchase Order ${po.poNumber}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${html}
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
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

                    {/* Share Cancellation Notice via WhatsApp if cancelled */}
                    {row.status === 'CANCELLED' && (
                      <button
                        type="button"
                        title="Share Cancellation Notice via WhatsApp"
                        onClick={() => { setCancelNotifyPo(row); setIsCancelNotifyOpen(true); }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
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
          {/* Section 1: Vendor Selection & Supplier Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 font-extrabold uppercase text-[10.5px] text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>1. Supplier / Vendor Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Select Vendor *</label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#16845B]"
                >
                  {suppliers.filter(s => s.isActive !== false).map(sup => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} {sup.companyName ? `(${sup.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor business address display - explicitly labeled as supplier premises */}
              {(() => {
                const sup = suppliers.find(s => s.id === selectedSupplierId);
                return (
                  <div className="p-2 bg-white border border-slate-200 rounded-xl text-[11px] flex flex-col justify-center">
                    <p className="font-bold text-slate-800">
                      Vendor Business Location:
                    </p>
                    <p className="text-slate-600 truncate mt-0.5">
                      {sup?.address || <span className="italic text-slate-400">No registered address</span>}
                    </p>
                    <span className="text-[9.5px] text-slate-400 italic">
                      (Supplier's business location — not used as delivery destination)
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Supplier Matching Notice for Items */}
            {orderItems.length > 0 && (() => {
              const selectedIngs = ingredients.filter(i => orderItems.some(oi => oi.ingredientId === i.id));
              const differingSuppliers = Array.from(new Set(selectedIngs.map(i => i.supplierName || 'None'))).filter(Boolean);
              const noSupplierIngs = selectedIngs.filter(i => !i.supplierId && !i.supplierName);

              if (differingSuppliers.length > 1) {
                return (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-[11px] space-y-1 mt-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Multiple Preferred Suppliers ({differingSuppliers.join(', ')})</span>
                    </div>
                    <p className="text-[10.5px] text-amber-800 leading-relaxed">
                      The selected ingredients have different preferred vendors. Because a purchase order binds to a single supplier, please verify that the vendor selected above is appropriate for all items in this order.
                    </p>
                  </div>
                );
              }

              if (noSupplierIngs.length > 0) {
                return (
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 text-[11px] space-y-1 mt-2">
                    <p className="font-bold text-[10.5px] text-slate-700">Notice:</p>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      {noSupplierIngs.map(i => i.name).join(', ')} do not have a preferred supplier record. They will be ordered from the vendor chosen above.
                    </p>
                  </div>
                );
              }

              return null;
            })()}
          </div>

          {/* Section 2: Delivery Destination (Ship To) */}
          <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-extrabold uppercase text-[10.5px] text-[#16845B]">
                <MapPin className="w-3.5 h-3.5 text-[#16845B]" />
                <span>2. Delivery Destination (Ship To)</span>
              </div>
              <span className="text-[10px] text-slate-500">
                Restaurant: <strong>{activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">
                  Receiving Branch *
                </label>
                <select
                  value={selectedBranchId}
                  onChange={e => handleBranchChange(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#16845B]"
                >
                  {branches.length > 0 ? (
                    branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.city ? `(${b.city})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="main">Main Branch</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">
                  Expected Delivery Date
                </label>
                <input 
                  type="date" 
                  value={expectedDate}
                  onChange={e => setExpectedDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-extrabold uppercase text-slate-600">
                  Delivery Address (Where vendor must deliver) *
                </label>
                {(branches.length > 0 || activeRestaurant?.address) && (
                  <button
                    type="button"
                    onClick={() => {
                      const foundBranch = branches.find(b => b.id === selectedBranchId);
                      const branchAddr = foundBranch ? formatAddress(foundBranch.address) : '';
                      const restAddr = activeRestaurant ? formatAddress(activeRestaurant.address) : '';
                      setDeliveryAddress(branchAddr || restAddr || '');
                      toast.success('Reset to saved branch address.');
                    }}
                    className="text-[10px] text-[#16845B] hover:underline font-bold"
                  >
                    Reset to Branch Address
                  </button>
                )}
              </div>
              <textarea 
                rows={2}
                placeholder="Enter destination delivery address..." 
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className={`w-full p-2 bg-white border rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B] ${
                  !deliveryAddress.trim() ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200'
                }`}
              />
              {!deliveryAddress.trim() && (
                <p className="text-[10px] font-bold text-amber-700 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  No saved address found for this branch. Please enter the delivery address so the vendor knows where to fulfill.
                </p>
              )}
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

          {/* Delivery Charge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Estimated Delivery / Freight Charge (₹)</label>
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              value={deliveryCharge}
              onChange={e => setDeliveryCharge(e.target.value)}
              className="w-full sm:w-1/2 p-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-[#16845B]"
              placeholder="0.00"
            />
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
                <p className="text-slate-500">
                  Vendor: <strong>{selectedPo.supplierName}</strong> • {new Date(selectedPo.createdAt).toLocaleDateString()}
                </p>
                {selectedPo.expectedDeliveryDate && (
                  <p className="text-emerald-700 font-bold mt-0.5">Expected Delivery: {selectedPo.expectedDeliveryDate}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => handlePrintPo(selectedPo)} 
                  variant="secondary"
                  className="text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </Button>
                {selectedPo.status === 'CANCELLED' ? (
                  <Button 
                    onClick={() => { setCancelNotifyPo(selectedPo); setIsCancelNotifyOpen(true); }}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Cancellation Notice</span>
                  </Button>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Address Comparison & Details Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Delivery Destination (Ship To) */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[#16845B] uppercase text-[10.5px]">
                    <MapPin className="w-3.5 h-3.5 text-[#16845B]" />
                    <span>Delivery Location (Ship To)</span>
                  </div>
                  {selectedPo.status !== 'CANCELLED' && selectedPo.status !== 'DELIVERED' && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditAddress(selectedPo)}
                      className="text-[10px] text-[#16845B] hover:underline font-bold flex items-center gap-0.5"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                <p className="font-semibold text-slate-900">
                  {selectedPo.restaurantName || activeRestaurant?.name || 'SpiralDine Restaurant'} 
                  {selectedPo.branchName ? ` — ${selectedPo.branchName}` : ''}
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {selectedPo.deliveryAddress || (
                    <span className="italic text-amber-700">No delivery address specified</span>
                  )}
                </p>
              </div>

              {/* Vendor Information */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase text-[10.5px]">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Vendor (Supplier Premises)</span>
                </div>
                <p className="font-semibold text-slate-900">{selectedPo.supplierName}</p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {selectedPo.supplierAddress || <span className="italic text-slate-400">No registered address</span>}
                </p>
                {selectedPo.supplierPhone && (
                  <p className="text-slate-500 text-[10.5px]">Ph: {selectedPo.supplierPhone}</p>
                )}
              </div>
            </div>

            {/* Warning if delivery address matches supplier address (legacy copy issue) */}
            {selectedPo.deliveryAddress && selectedPo.supplierAddress && 
             selectedPo.deliveryAddress.trim().toLowerCase() === selectedPo.supplierAddress.trim().toLowerCase() && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-3 text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-[11px]">Notice: Delivery Address matches Vendor Business Address</p>
                    <p className="text-[10.5px] text-amber-800">
                      This purchase order has the supplier's address listed as the delivery location. You can update it to your restaurant branch delivery address.
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleOpenEditAddress(selectedPo)}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                >
                  Correct Address
                </Button>
              </div>
            )}

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

              <div className="flex items-center gap-2">
                {selectedPo.status !== 'DELIVERED' && selectedPo.status !== 'CANCELLED' && (
                  <Button 
                    onClick={() => { setCancelPo(selectedPo); setCancelReason(''); setIsCancelOpen(true); }}
                    className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold"
                  >
                    <XCircle className="w-4 h-4 mr-1.5 text-rose-600" />
                    <span>Cancel Order</span>
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setIsDetailsOpen(false)}>
                  Close
                </Button>
              </div>
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

      {/* MODAL 4: CANCEL PURCHASE ORDER CONFIRMATION */}
      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title={cancelPo ? `Cancel Purchase Order: ${cancelPo.poNumber}` : 'Cancel Order'}
        className="max-w-md bg-white"
      >
        {cancelPo && (
          <div className="space-y-4 text-xs text-left">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 space-y-1.5">
              <p className="font-extrabold text-sm text-rose-900">Are you sure you want to cancel this purchase order?</p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Are you sure you want to cancel this purchase order? This action will update the order status and may affect the supplier's expectations. You can notify the supplier through WhatsApp after cancellation.
              </p>
            </div>

            {/* PO Summary Card */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="font-mono font-extrabold text-slate-900 text-sm">{cancelPo.poNumber}</span>
                {renderStatusBadge(cancelPo.status)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Vendor</span>
                  <strong className="text-slate-800">{cancelPo.supplierName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Order Date</span>
                  <strong className="text-slate-800">{new Date(cancelPo.createdAt).toLocaleDateString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Order Total</span>
                  <strong className="text-[#16845B] font-mono font-extrabold">{formatPrice(cancelPo.grandTotal)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Items Count</span>
                  <strong className="text-slate-800">{cancelPo.items.length} item(s)</strong>
                </div>
              </div>

              {/* Partial Receiving Details */}
              {cancelPo.status === 'PARTIALLY_RECEIVED' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 space-y-1">
                  <p className="font-bold text-[10.5px] text-amber-900">Partial Receiving Safeguard:</p>
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    Stock already checked in from this order remains safely in kitchen inventory. Only the unreceived remainder will be cancelled.
                  </p>
                  <div className="space-y-1 mt-1.5 pt-1.5 border-t border-amber-200/60">
                    {cancelPo.items.map((it, idx) => {
                      const received = it.receivedQuantity || 0;
                      const remaining = Math.max(0, it.quantity - received);
                      return (
                        <div key={idx} className="flex justify-between text-[10px]">
                          <span className="font-medium text-slate-800">{it.ingredientName}:</span>
                          <span>
                            <strong className="text-emerald-700">{received}</strong> / {it.quantity} {it.unit} received 
                            ({remaining} {it.unit} unreceived will be cancelled)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                Reason for Cancellation (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Supplier unable to fulfill, cancelled by mutual consent..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setIsCancelOpen(false)}>
                Keep Order
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
        )}
      </Modal>

      {/* MODAL 6: NOTIFY SUPPLIER VIA WHATSAPP ON CANCELLATION */}
      <Modal
        isOpen={isCancelNotifyOpen}
        onClose={() => setIsCancelNotifyOpen(false)}
        title={cancelNotifyPo ? `Supplier Cancellation Notice: ${cancelNotifyPo.poNumber}` : 'Cancellation Notice'}
        className="max-w-lg bg-white"
      >
        {cancelNotifyPo && (() => {
          const restName = cancelNotifyPo.restaurantName || activeRestaurant?.name || activeRestaurant?.restaurantName || 'SpiralDine Restaurant';
          const msg = vendorPurchaseOrderService.formatPoCancellationWhatsAppMessage(cancelNotifyPo, restName, cancelNotifyPo.cancellationReason || cancelReason);
          const rawPhone = cancelNotifyPo.supplierPhone || '';
          const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
          const hasValidPhone = digitsOnly.length >= 7;

          return (
            <div className="space-y-4 text-xs text-left max-h-[80vh] overflow-y-auto pr-1">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                <p className="font-bold text-sm text-emerald-900">Purchase order has been cancelled.</p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  You can now notify <strong>{cancelNotifyPo.supplierName}</strong> through WhatsApp so they do not fulfill or ship this order.
                </p>
              </div>

              {/* Contact info or missing phone warning */}
              {hasValidPhone ? (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier Contact Phone</span>
                    <strong className="text-slate-900 font-mono text-xs">{cancelNotifyPo.supplierPhone}</strong>
                  </div>
                  <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-1 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Direct WhatsApp Ready
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Missing or Invalid Supplier Phone Number</span>
                  </div>
                  <p className="text-[10.5px] text-amber-800 leading-relaxed">
                    No phone number is registered for <strong>{cancelNotifyPo.supplierName}</strong> in your Vendor Directory. You can copy the complete cancellation message below and forward it to your supplier through SMS, Email, or another messaging channel.
                  </p>
                </div>
              )}

              {/* Message Preview */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500">
                    Formatted Cancellation Notice
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyCancellationNotice(cancelNotifyPo)}
                    className="text-[10.5px] text-[#16845B] hover:underline font-bold flex items-center gap-1"
                  >
                    {copiedNotice ? <Check className="w-3 h-3 text-emerald-600" /> : null}
                    <span>{copiedNotice ? 'Copied to Clipboard!' : 'Copy Notice'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-sans text-slate-800 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                  {msg}
                </pre>
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  * Note: Opening WhatsApp launches the message for sending, but does not constitute verified proof of supplier delivery or acknowledgement.
                </p>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsCancelNotifyOpen(false)}>
                  Done
                </Button>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={() => handleCopyCancellationNotice(cancelNotifyPo)}
                    className="font-bold flex items-center gap-1.5"
                  >
                    <span>{copiedNotice ? 'Copied' : 'Copy Notice'}</span>
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => handleDispatchCancellationWhatsApp(cancelNotifyPo)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open in WhatsApp</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* MODAL 5: EDIT DELIVERY ADDRESS FOR EXISTING PO */}
      <Modal
        isOpen={isEditAddressOpen}
        onClose={() => setIsEditAddressOpen(false)}
        title={editAddressPo ? `Edit Delivery Address: ${editAddressPo.poNumber}` : 'Edit Delivery Address'}
        className="max-w-md bg-white"
      >
        <div className="space-y-4 text-xs text-left">
          <p className="text-slate-600">
            Update the destination branch or delivery address for this purchase order. This address will be used for supplier WhatsApp messages, emails, and purchase order documents.
          </p>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
              Receiving Branch
            </label>
            <select
              value={editBranchId}
              onChange={e => {
                const bId = e.target.value;
                setEditBranchId(bId);
                const b = branches.find(br => br.id === bId);
                const bName = b?.name || 'Main Branch';
                setEditBranchName(bName);
                const bAddr = b ? formatAddress(b.address) : '';
                const rAddr = activeRestaurant ? formatAddress(activeRestaurant.address) : '';
                setEditDeliveryAddress(bAddr || rAddr || '');
              }}
              className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#16845B]"
            >
              {branches.length > 0 ? (
                branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.city ? `(${b.city})` : ''}
                  </option>
                ))
              ) : (
                <option value="main">Main Branch</option>
              )}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-extrabold uppercase text-slate-500">
                Delivery Address *
              </label>
              {(branches.length > 0 || activeRestaurant?.address) && (
                <button
                  type="button"
                  onClick={() => {
                    const b = branches.find(br => br.id === editBranchId);
                    const bAddr = b ? formatAddress(b.address) : '';
                    const rAddr = activeRestaurant ? formatAddress(activeRestaurant.address) : '';
                    setEditDeliveryAddress(bAddr || rAddr || '');
                    toast.success('Reset to branch address.');
                  }}
                  className="text-[10px] text-[#16845B] hover:underline font-bold"
                >
                  Use Branch Address
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={editDeliveryAddress}
              onChange={e => setEditDeliveryAddress(e.target.value)}
              placeholder="Enter complete delivery address..."
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsEditAddressOpen(false)}>
              Cancel
            </Button>
            <Button 
              disabled={isUpdatingAddress || !editDeliveryAddress.trim()}
              onClick={handleSaveEditedAddress}
              className="bg-[#16845B] hover:bg-[#126B49] text-white font-bold"
            >
              {isUpdatingAddress ? 'Saving...' : 'Save Address'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
