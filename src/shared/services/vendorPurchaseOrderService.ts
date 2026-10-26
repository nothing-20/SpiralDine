import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  runTransaction 
} from 'firebase/firestore';
import { 
  ISupplier, 
  ISupplierPrice, 
  IPurchaseOrder, 
  IPurchaseOrderItem, 
  PurchaseOrderStatus, 
  IGoodsReceipt, 
  IGoodsReceiptItem, 
  IStockIngredient, 
  IStockMovement, 
  IPurchaseSuggestion 
} from '../domain/inventory/types';
import { inventoryService } from './inventoryService';
import { logEvent } from './eventEngine';
import { formatPrice } from '../utils/format';

export const vendorPurchaseOrderService = {
  // ==========================================
  // 1. VENDOR / SUPPLIER DIRECTORY
  // ==========================================

  createSupplier: async (
    tenantId: string, 
    data: Omit<ISupplier, 'id' | 'updatedAt'>, 
    user?: any
  ): Promise<ISupplier> => {
    const supplierId = `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const userId = user?.uid || user?.id || 'system';
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    const newSupplier: ISupplier = {
      ...data,
      id: supplierId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      rating: data.rating || 5,
      deliveryTimeDays: data.deliveryTimeDays || 3,
      suppliedIngredientIds: data.suppliedIngredientIds || [],
      createdAt: timestamp,
      createdBy: userId,
      updatedAt: timestamp,
      updatedBy: userName
    };

    const docRef = doc(db, 'restaurants', tenantId, 'suppliers', supplierId);
    await setDoc(docRef, newSupplier);

    logEvent(tenantId, {
      eventType: 'Supplier Created',
      eventCategory: 'Management',
      performedBy: userName,
      performedByRole: user?.role || 'owner',
      title: `Supplier Added: ${newSupplier.name}`,
      description: `New supplier registered with ID ${supplierId}.`,
      metadata: { supplierId, name: newSupplier.name }
    });

    return newSupplier;
  },

  updateSupplier: async (
    tenantId: string, 
    supplierId: string, 
    updates: Partial<ISupplier>, 
    user?: any
  ): Promise<void> => {
    const timestamp = new Date().toISOString();
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    const docRef = doc(db, 'restaurants', tenantId, 'suppliers', supplierId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: timestamp,
      updatedBy: userName
    });

    logEvent(tenantId, {
      eventType: 'Supplier Updated',
      eventCategory: 'Management',
      performedBy: userName,
      performedByRole: user?.role || 'owner',
      title: `Supplier Updated: ${updates.name || supplierId}`,
      description: `Supplier details modified.`,
      metadata: { supplierId }
    });
  },

  toggleSupplierActive: async (
    tenantId: string, 
    supplierId: string, 
    isActive: boolean, 
    user?: any
  ): Promise<void> => {
    const timestamp = new Date().toISOString();
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    const docRef = doc(db, 'restaurants', tenantId, 'suppliers', supplierId);
    await updateDoc(docRef, {
      isActive,
      updatedAt: timestamp,
      updatedBy: userName
    });

    logEvent(tenantId, {
      eventType: 'Supplier Status Changed',
      eventCategory: 'Management',
      performedBy: userName,
      performedByRole: user?.role || 'owner',
      title: `Supplier ${isActive ? 'Activated' : 'Deactivated'}: ${supplierId}`,
      description: `Supplier status changed to ${isActive ? 'Active' : 'Inactive'}.`,
      metadata: { supplierId, isActive }
    });
  },

  deleteSupplier: async (
    tenantId: string, 
    supplierId: string, 
    user?: any
  ): Promise<{ deleted: boolean; deactivatedInstead?: boolean; reason?: string }> => {
    const poQuery = query(
      collection(db, 'restaurants', tenantId, 'purchaseOrders'),
      where('supplierId', '==', supplierId)
    );
    const poSnaps = await getDocs(poQuery);

    if (!poSnaps.empty) {
      // Historical purchases exist: soft deactivate instead of hard delete
      await vendorPurchaseOrderService.toggleSupplierActive(tenantId, supplierId, false, user);
      return { 
        deleted: false, 
        deactivatedInstead: true, 
        reason: 'Supplier has historical purchase orders and was deactivated to preserve audit records.' 
      };
    }

    const docRef = doc(db, 'restaurants', tenantId, 'suppliers', supplierId);
    const snap = await getDoc(docRef);
    const name = snap.exists() ? snap.data().name : supplierId;

    await updateDoc(docRef, {
      isDeleted: true,
      isActive: false,
      deletedAt: new Date().toISOString()
    });

    return { deleted: true };
  },

  // ==========================================
  // 2. SUPPLIER-INGREDIENT PRICING CATALOG
  // ==========================================

  setSupplierPrice: async (
    tenantId: string, 
    priceData: {
      supplierId: string;
      supplierName: string;
      ingredientId: string;
      ingredientName: string;
      unitPrice: number; // in cents
      purchaseUnit: string;
      currency?: string;
      minOrderQuantity?: number;
      leadTimeDays?: number;
      isPreferred?: boolean;
      effectiveFrom?: string;
      effectiveTo?: string;
      notes?: string;
    },
    user?: any
  ): Promise<ISupplierPrice> => {
    const priceId = `${priceData.supplierId}_${priceData.ingredientId}`;
    const timestamp = new Date().toISOString();
    const docRef = doc(db, 'restaurants', tenantId, 'supplierPrices', priceId);
    const existingSnap = await getDoc(docRef);

    let priceHistory: ISupplierPrice['priceHistory'] = [];
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as ISupplierPrice;
      priceHistory = existing.priceHistory || [];
      // If price changed, push old price to history
      if (existing.unitPrice !== priceData.unitPrice) {
        priceHistory.push({
          price: existing.unitPrice,
          effectiveFrom: existing.effectiveFrom || existing.updatedAt,
          changedAt: timestamp,
          changedBy: user?.displayName || user?.name || user?.email || 'Owner',
          reason: priceData.notes || 'Price updated'
        });
      }
    }

    const supplierPriceRecord: ISupplierPrice = {
      id: priceId,
      supplierId: priceData.supplierId,
      supplierName: priceData.supplierName,
      ingredientId: priceData.ingredientId,
      ingredientName: priceData.ingredientName,
      unitPrice: Math.max(0, priceData.unitPrice),
      purchaseUnit: priceData.purchaseUnit,
      currency: priceData.currency || 'INR',
      minOrderQuantity: priceData.minOrderQuantity || 1,
      leadTimeDays: priceData.leadTimeDays || 2,
      isPreferred: priceData.isPreferred || false,
      effectiveFrom: priceData.effectiveFrom || timestamp.split('T')[0],
      effectiveTo: priceData.effectiveTo || '',
      notes: priceData.notes || '',
      priceHistory,
      updatedAt: timestamp
    };

    await setDoc(docRef, supplierPriceRecord);

    // If marked preferred, update ingredient's primary supplier and cost
    if (priceData.isPreferred) {
      const ingRef = doc(db, 'restaurants', tenantId, 'inventory', priceData.ingredientId);
      const ingSnap = await getDoc(ingRef);
      if (ingSnap.exists()) {
        await updateDoc(ingRef, {
          supplierId: priceData.supplierId,
          supplierName: priceData.supplierName,
          purchaseCost: priceData.unitPrice,
          updatedAt: timestamp
        });
      }
    }

    return supplierPriceRecord;
  },

  getSupplierPrices: async (tenantId: string, supplierId?: string): Promise<ISupplierPrice[]> => {
    const colRef = collection(db, 'restaurants', tenantId, 'supplierPrices');
    const q = supplierId 
      ? query(colRef, where('supplierId', '==', supplierId))
      : query(colRef);
    const snaps = await getDocs(q);
    return snaps.docs.map(d => d.data() as ISupplierPrice);
  },

  // ==========================================
  // 3. PURCHASE ORDER LIFECYCLE
  // ==========================================

  generatePoNumber: async (tenantId: string): Promise<string> => {
    const today = new Date();
    const datePrefix = today.toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PO-${datePrefix}-${randomSuffix}`;
  },

  createPurchaseOrder: async (
    tenantId: string, 
    data: {
      poNumber?: string;
      supplierId: string;
      supplierName: string;
      supplierPhone?: string;
      supplierEmail?: string;
      supplierAddress?: string;
      supplierGstNumber?: string;
      branchId?: string;
      branchName?: string;
      items: Array<{
        ingredientId: string;
        ingredientName: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        taxRate?: number;
        notes?: string;
      }>;
      deliveryCharge?: number;
      expectedDeliveryDate?: string;
      deliveryAddress?: string;
      supplierInstructions?: string;
      internalNotes?: string;
      status?: PurchaseOrderStatus;
    }, 
    user?: any
  ): Promise<IPurchaseOrder> => {
    const poNumber = data.poNumber || (await vendorPurchaseOrderService.generatePoNumber(tenantId));
    const poId = `PO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const userId = user?.uid || user?.id || 'system';
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    // Calculate line totals, subtotal, and tax totals
    let subtotal = 0;
    let taxTotal = 0;

    const items: IPurchaseOrderItem[] = data.items.map(item => {
      const lineTotal = Math.round(item.quantity * item.unitPrice);
      const taxRate = item.taxRate || 0;
      const lineTax = Math.round(lineTotal * (taxRate / 100));
      subtotal += lineTotal;
      taxTotal += lineTax;

      return {
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate,
        lineTotal,
        receivedQuantity: 0,
        notes: item.notes || ''
      };
    });

    const deliveryCharge = data.deliveryCharge || 0;
    const grandTotal = subtotal + taxTotal + deliveryCharge;
    const initialStatus = data.status || 'DRAFT';

    const newPO: IPurchaseOrder = {
      id: poId,
      poNumber,
      tenantId,
      branchId: data.branchId || '',
      branchName: data.branchName || 'Main Branch',
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone || '',
      supplierEmail: data.supplierEmail || '',
      supplierAddress: data.supplierAddress || '',
      supplierGstNumber: data.supplierGstNumber || '',
      items,
      status: initialStatus,
      subtotal,
      taxTotal,
      deliveryCharge,
      grandTotal,
      expectedDeliveryDate: data.expectedDeliveryDate || '',
      deliveryAddress: data.deliveryAddress || '',
      supplierInstructions: data.supplierInstructions || '',
      internalNotes: data.internalNotes || '',
      createdAt: timestamp,
      createdBy: userId,
      createdByName: userName,
      updatedAt: timestamp,
      receiptCount: 0,
      auditLog: [
        {
          action: 'CREATED',
          timestamp,
          performedBy: userName,
          notes: `Purchase Order created with status ${initialStatus}. Total: ${formatPrice(grandTotal)}`
        }
      ]
    };

    const docRef = doc(db, 'restaurants', tenantId, 'purchaseOrders', poId);
    await setDoc(docRef, newPO);

    logEvent(tenantId, {
      eventType: 'Purchase Order Created',
      eventCategory: 'Management',
      performedBy: userName,
      performedByRole: user?.role || 'owner',
      title: `Purchase Order ${poNumber} Created`,
      description: `Draft PO for ${newPO.supplierName} created. Grand total: ${formatPrice(grandTotal)}.`,
      metadata: { poId, poNumber, supplierId: newPO.supplierId, grandTotal }
    });

    return newPO;
  },

  updateDraftPurchaseOrder: async (
    tenantId: string, 
    poId: string, 
    updates: Partial<IPurchaseOrder>, 
    user?: any
  ): Promise<void> => {
    const docRef = doc(db, 'restaurants', tenantId, 'purchaseOrders', poId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Purchase order ${poId} not found.`);
    }

    const currentPo = snap.data() as IPurchaseOrder;
    if (currentPo.status !== 'DRAFT') {
      throw new Error(`Only DRAFT purchase orders can be modified. Current status: ${currentPo.status}.`);
    }

    const timestamp = new Date().toISOString();
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    // Recalculate totals if items changed
    let subtotal = currentPo.subtotal;
    let taxTotal = currentPo.taxTotal;
    let deliveryCharge = updates.deliveryCharge !== undefined ? updates.deliveryCharge : currentPo.deliveryCharge || 0;

    let items = currentPo.items;
    if (updates.items) {
      subtotal = 0;
      taxTotal = 0;
      items = updates.items.map(item => {
        const lineTotal = Math.round(item.quantity * item.unitPrice);
        const taxRate = item.taxRate || 0;
        const lineTax = Math.round(lineTotal * (taxRate / 100));
        subtotal += lineTotal;
        taxTotal += lineTax;
        return {
          ...item,
          lineTotal,
          receivedQuantity: item.receivedQuantity || 0
        };
      });
    }

    const grandTotal = subtotal + taxTotal + deliveryCharge;
    const auditLog = currentPo.auditLog || [];
    auditLog.push({
      action: 'MODIFIED',
      timestamp,
      performedBy: userName,
      notes: `Draft updated. New total: ${formatPrice(grandTotal)}`
    });

    await updateDoc(docRef, {
      ...updates,
      items,
      subtotal,
      taxTotal,
      deliveryCharge,
      grandTotal,
      updatedAt: timestamp,
      auditLog
    });
  },

  sendPurchaseOrder: async (
    tenantId: string, 
    poId: string, 
    method: 'whatsapp' | 'email' | 'manual' | 'pdf', 
    user?: any
  ): Promise<void> => {
    const docRef = doc(db, 'restaurants', tenantId, 'purchaseOrders', poId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Purchase order not found.');

    const po = snap.data() as IPurchaseOrder;
    if (po.status === 'CANCELLED') throw new Error('Cancelled purchase orders cannot be sent.');

    const timestamp = new Date().toISOString();
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    const auditLog = po.auditLog || [];
    auditLog.push({
      action: 'SENT',
      timestamp,
      performedBy: userName,
      notes: `PO marked as SENT via ${method.toUpperCase()}.`
    });

    await updateDoc(docRef, {
      status: 'SENT',
      sentAt: timestamp,
      sentVia: method,
      updatedAt: timestamp,
      auditLog
    });

    logEvent(tenantId, {
      eventType: 'Purchase Order Sent',
      eventCategory: 'Management',
      performedBy: userName,
      performedByRole: user?.role || 'owner',
      title: `Purchase Order ${po.poNumber} Sent`,
      description: `Dispatched to ${po.supplierName} via ${method}.`,
      metadata: { poId, poNumber: po.poNumber, method }
    });
  },

  confirmPurchaseOrder: async (
    tenantId: string, 
    poId: string, 
    user?: any
  ): Promise<void> => {
    const docRef = doc(db, 'restaurants', tenantId, 'purchaseOrders', poId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Purchase order not found.');

    const po = snap.data() as IPurchaseOrder;
    const timestamp = new Date().toISOString();
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    const auditLog = po.auditLog || [];
    auditLog.push({
      action: 'CONFIRMED',
      timestamp,
      performedBy: userName,
      notes: `Supplier confirmation recorded.`
    });

    await updateDoc(docRef, {
      status: 'CONFIRMED',
      confirmedAt: timestamp,
      updatedAt: timestamp,
      auditLog
    });
  },

  cancelPurchaseOrder: async (
    tenantId: string, 
    poId: string, 
    reason: string, 
    user?: any
  ): Promise<void> => {
    const docRef = doc(db, 'restaurants', tenantId, 'purchaseOrders', poId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Purchase order not found.');

    const po = snap.data() as IPurchaseOrder;
    if (po.status === 'DELIVERED') {
      throw new Error('Fully delivered purchase orders cannot be cancelled.');
    }

    const timestamp = new Date().toISOString();
    const userName = user?.displayName || user?.name || user?.email || 'Owner';

    const auditLog = po.auditLog || [];
    auditLog.push({
      action: 'CANCELLED',
      timestamp,
      performedBy: userName,
      notes: `Order cancelled. Reason: ${reason}. (Any previously received stock remains in inventory).`
    });

    await updateDoc(docRef, {
      status: 'CANCELLED',
      cancelledAt: timestamp,
      cancellationReason: reason,
      updatedAt: timestamp,
      auditLog
    });

    logEvent(tenantId, {
      eventType: 'Purchase Order Cancelled',
      eventCategory: 'Management',
      performedBy: userName,
      performedByRole: user?.role || 'owner',
      title: `Purchase Order ${po.poNumber} Cancelled`,
      description: `Cancelled with reason: ${reason}.`,
      metadata: { poId, poNumber: po.poNumber, reason }
    });
  },

  // ==========================================
  // 4. TRANSACTION-SAFE GOODS RECEIVING
  // ==========================================

  receivePurchaseOrderGoods: async (
    tenantId: string, 
    poId: string, 
    receiptData: {
      invoiceNumber?: string;
      invoiceDate?: string;
      notes?: string;
      idempotencyKey?: string;
      items: Array<{
        ingredientId: string;
        quantityReceived: number;
        quantityRejected?: number;
        batchNumber?: string;
        expiryDate?: string;
        discrepancyReason?: string;
      }>;
    }, 
    user?: any
  ): Promise<IGoodsReceipt> => {
    const poRef = doc(db, 'restaurants', tenantId, 'purchaseOrders', poId);
    const timestamp = new Date().toISOString();
    const userId = user?.uid || user?.id || 'system';
    const userName = user?.displayName || user?.name || user?.email || 'Kitchen Staff';
    const userRole = user?.role || 'kitchen';

    // Formulate a stable receipt ID if idempotencyKey is provided
    const cleanKey = receiptData.idempotencyKey ? receiptData.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const receiptId = cleanKey ? `REC-${cleanKey}` : `REC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const receiptRef = doc(db, 'restaurants', tenantId, 'goodsReceipts', receiptId);

    return await runTransaction(db, async (transaction) => {
      // 1. Check idempotency: if this exact receipt was already created and committed, return it safely
      const existingReceiptSnap = await transaction.get(receiptRef);
      if (existingReceiptSnap.exists()) {
        console.warn(`[Idempotency Safeguard] Receipt ${receiptId} already recorded. Returning existing receipt.`);
        return existingReceiptSnap.data() as IGoodsReceipt;
      }

      const poSnap = await transaction.get(poRef);
      if (!poSnap.exists()) {
        throw new Error(`Purchase order ${poId} not found.`);
      }

      const po = poSnap.data() as IPurchaseOrder;
      if (po.status === 'CANCELLED') {
        throw new Error('Cannot receive goods against a cancelled purchase order.');
      }
      if (po.status === 'DELIVERED') {
        throw new Error('This purchase order has already been fully delivered.');
      }

      const receiptNumber = `GRN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const receiptItems: IGoodsReceiptItem[] = [];

      // Create a map of items from PO
      const updatedPoItems: IPurchaseOrderItem[] = po.items.map(i => ({ ...i }));
      let totalQtyReceivedThisShipment = 0;
      let totalReceivedValue = 0;
      const discrepancyAlerts: string[] = [];

      for (const recItem of receiptData.items) {
        if (!recItem.quantityReceived || recItem.quantityReceived <= 0) {
          continue; // Skip zero or negative items
        }

        const poItemIndex = updatedPoItems.findIndex(i => i.ingredientId === recItem.ingredientId);
        if (poItemIndex === -1) {
          throw new Error(`Item ${recItem.ingredientId} does not belong to purchase order ${po.poNumber}.`);
        }

        const poItem = updatedPoItems[poItemIndex];
        const prevReceived = poItem.receivedQuantity || 0;
        const newReceived = prevReceived + recItem.quantityReceived;

        // Check for over-delivery discrepancy
        const remainingBeforeReceipt = Math.max(0, poItem.quantity - prevReceived);
        let discrepancyNote = recItem.discrepancyReason || '';
        if (recItem.quantityReceived > remainingBeforeReceipt) {
          const excess = recItem.quantityReceived - remainingBeforeReceipt;
          const note = `Over-delivered by ${excess} ${poItem.unit} (Total received: ${newReceived}/${poItem.quantity})`;
          discrepancyNote = discrepancyNote ? `${discrepancyNote} | ${note}` : note;
          discrepancyAlerts.push(`${poItem.ingredientName}: +${excess} ${poItem.unit} excess`);
        }

        // Update PO item
        poItem.receivedQuantity = newReceived;
        totalQtyReceivedThisShipment += recItem.quantityReceived;

        const unitPrice = poItem.unitPrice || 0;
        const lineTotal = Math.round(recItem.quantityReceived * unitPrice);
        totalReceivedValue += lineTotal;

        receiptItems.push({
          ingredientId: poItem.ingredientId,
          ingredientName: poItem.ingredientName,
          unit: poItem.unit,
          quantityOrdered: poItem.quantity,
          quantityPreviouslyReceived: prevReceived,
          quantityReceived: recItem.quantityReceived,
          quantityRejected: recItem.quantityRejected || 0,
          unitPrice,
          lineTotal,
          batchNumber: recItem.batchNumber || '',
          expiryDate: recItem.expiryDate || '',
          discrepancyReason: discrepancyNote
        });

        // Read and update the ingredient stock inside the transaction
        const ingRef = doc(db, 'restaurants', tenantId, 'inventory', poItem.ingredientId);
        const ingSnap = await transaction.get(ingRef);

        if (ingSnap.exists()) {
          const ingData = ingSnap.data() as IStockIngredient;
          const prevStock = ingData.currentStock || 0;
          const targetStock = prevStock + recItem.quantityReceived;

          const newStatus = inventoryService.calculateStockStatus(
            targetStock, 
            ingData.minimumStock || 5, 
            ingData.reorderLevel
          );

          const ingUpdates: any = {
            currentStock: targetStock,
            status: newStatus,
            updatedAt: timestamp
          };

          if (poItem.unitPrice && poItem.unitPrice > 0) {
            ingUpdates.purchaseCost = poItem.unitPrice;
          }
          if (recItem.expiryDate) {
            ingUpdates.expiryDate = recItem.expiryDate;
          }

          transaction.update(ingRef, ingUpdates);

          // Log authoritative stock movement for the receipt with financial metadata
          const movementId = `MVT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const movementRef = doc(db, 'restaurants', tenantId, 'stockMovements', movementId);

          const movementRecord: IStockMovement = {
            id: movementId,
            ingredientId: poItem.ingredientId,
            ingredientName: poItem.ingredientName,
            quantity: recItem.quantityReceived,
            unit: poItem.unit,
            previousStock: prevStock,
            newStock: targetStock,
            type: 'purchase',
            unitPrice,
            totalValue: lineTotal,
            poNumber: po.poNumber,
            receiptNumber,
            reason: `PO #${po.poNumber} Goods Receipt (${receiptData.invoiceNumber ? `Invoice: ${receiptData.invoiceNumber}` : receiptNumber})`,
            submittedBy: userId,
            submittedByName: userName,
            performedByRole: userRole,
            tenantId,
            timestamp
          };

          transaction.set(movementRef, movementRecord);
        }
      }

      if (receiptItems.length === 0) {
        throw new Error('No items were checked in. Please enter valid received quantities.');
      }

      // Check if all items in the PO are fully received
      const isFullyDelivered = updatedPoItems.every(item => (item.receivedQuantity || 0) >= item.quantity);
      const newStatus: PurchaseOrderStatus = isFullyDelivered ? 'DELIVERED' : 'PARTIALLY_RECEIVED';

      const auditLog = po.auditLog || [];
      const notesDetails = discrepancyAlerts.length > 0 
        ? `Goods Receipt ${receiptNumber} logged (+${totalQtyReceivedThisShipment} items, ${formatPrice(totalReceivedValue)}). Discrepancies noted: ${discrepancyAlerts.join(', ')}. Status: ${newStatus}.`
        : `Goods Receipt ${receiptNumber} logged (+${totalQtyReceivedThisShipment} items, ${formatPrice(totalReceivedValue)}). Status: ${newStatus}.`;

      auditLog.push({
        action: 'RECEIPT',
        timestamp,
        performedBy: userName,
        notes: notesDetails
      });

      // Update PO
      transaction.update(poRef, {
        items: updatedPoItems,
        status: newStatus,
        receiptCount: (po.receiptCount || 0) + 1,
        updatedAt: timestamp,
        auditLog
      });

      // Save Goods Receipt document
      const goodsReceiptRecord: IGoodsReceipt = {
        id: receiptId,
        receiptNumber,
        poId,
        poNumber: po.poNumber,
        tenantId,
        branchId: po.branchId || '',
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        supplierInvoiceNumber: receiptData.invoiceNumber || '',
        invoiceDate: receiptData.invoiceDate || '',
        items: receiptItems,
        totalReceivedValue,
        idempotencyKey: cleanKey || receiptId,
        receivedAt: timestamp,
        receivedBy: userId,
        receivedByName: userName,
        notes: receiptData.notes || ''
      };

      transaction.set(receiptRef, goodsReceiptRecord);

      return goodsReceiptRecord;
    });
  },

  // ==========================================
  // 5. INVENTORY VALUATION & PURCHASE ANALYTICS
  // ==========================================

  /**
   * Authoritatively computes Kitchen Stock Value using validated current stock balances
   * and unit purchase cost basis, with fallback to preferred catalog price when available.
   */
  calculateKitchenStockValue: (
    ingredients: IStockIngredient[], 
    supplierPrices?: ISupplierPrice[]
  ): { 
    totalValue: number; // in cents
    valuedItemsCount: number; 
    unvaluedItemsCount: number; 
    isFullyValued: boolean;
  } => {
    let totalValue = 0;
    let valuedItemsCount = 0;
    let unvaluedItemsCount = 0;

    for (const item of ingredients) {
      const currentStock = Number(item.currentStock) || 0;
      if (currentStock <= 0) continue; // Exclude out-of-stock items from valuation value

      let unitPrice = Number(item.purchaseCost) || 0;

      // Fallback: Check if negotiated price exists in supplier pricing catalog
      if (unitPrice <= 0 && supplierPrices && supplierPrices.length > 0) {
        const catalogPrice = supplierPrices.find(p => p.ingredientId === item.id && p.isPreferred)
          || supplierPrices.find(p => p.ingredientId === item.id);
        if (catalogPrice && catalogPrice.unitPrice > 0) {
          unitPrice = catalogPrice.unitPrice;
        }
      }

      if (unitPrice > 0) {
        valuedItemsCount++;
        totalValue += Math.round(currentStock * unitPrice);
      } else {
        unvaluedItemsCount++;
      }
    }

    return {
      totalValue,
      valuedItemsCount,
      unvaluedItemsCount,
      isFullyValued: unvaluedItemsCount === 0
    };
  },

  /**
   * Returns date boundaries for standard Indian financial years (April 1 to March 31).
   * e.g., FY 2026–27 starts 2026-04-01T00:00:00 and ends 2027-03-31T23:59:59.999.
   */
  getFinancialYearBoundaries: (targetStartYear?: number): {
    startYear: number;
    endYear: number;
    label: string;
    startDate: Date;
    endDate: Date;
    prevStartYear: number;
    prevEndYear: number;
    prevLabel: string;
    prevStartDate: Date;
    prevEndDate: Date;
  } => {
    const now = new Date();
    // Default to current financial year: if month < 3 (Jan, Feb, Mar), start year is previous calendar year
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed: 0 = Jan, 3 = April
    const defaultStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

    const startYear = targetStartYear !== undefined ? targetStartYear : defaultStartYear;
    const endYear = startYear + 1;
    const label = `FY ${startYear}–${String(endYear).slice(-2)}`;

    // April 1 00:00:00 local time
    const startDate = new Date(startYear, 3, 1, 0, 0, 0, 0);
    // March 31 23:59:59.999 local time
    const endDate = new Date(endYear, 2, 31, 23, 59, 59, 999);

    const prevStartYear = startYear - 1;
    const prevEndYear = startYear;
    const prevLabel = `FY ${prevStartYear}–${String(prevEndYear).slice(-2)}`;
    const prevStartDate = new Date(prevStartYear, 3, 1, 0, 0, 0, 0);
    const prevEndDate = new Date(prevEndYear, 2, 31, 23, 59, 59, 999);

    return {
      startYear,
      endYear,
      label,
      startDate,
      endDate,
      prevStartYear,
      prevEndYear,
      prevLabel,
      prevStartDate,
      prevEndDate
    };
  },

  /**
   * Calculates total goods receipt purchasing expenditure for a specified date interval.
   * Leverages authoritative IGoodsReceipt documents or verified stockMovements.
   */
  calculatePurchasesForPeriod: (
    receipts: IGoodsReceipt[],
    movements: IStockMovement[],
    startDate: Date,
    endDate: Date
  ): {
    totalValue: number; // in cents
    receiptCount: number;
  } => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    // 1. Primary authoritative source: goodsReceipts collection
    if (receipts && receipts.length > 0) {
      const eligibleReceipts = receipts.filter(r => {
        const time = new Date(r.receivedAt).getTime();
        return !isNaN(time) && time >= startMs && time <= endMs;
      });

      const totalValue = eligibleReceipts.reduce((acc, r) => acc + (r.totalReceivedValue || 0), 0);
      return { totalValue, receiptCount: eligibleReceipts.length };
    }

    // 2. Secondary authoritative fallback: verified stock movements of type 'purchase'
    const eligibleMovements = movements.filter(m => {
      const time = new Date(m.timestamp).getTime();
      return m.type === 'purchase' && !isNaN(time) && time >= startMs && time <= endMs;
    });

    const totalValue = eligibleMovements.reduce((acc, m) => {
      const val = m.totalValue !== undefined ? m.totalValue : (Math.abs(m.quantity) * (m.unitPrice || 0));
      return acc + val;
    }, 0);

    return { totalValue, receiptCount: eligibleMovements.length };
  },

  // ==========================================
  // 5. MESSAGE & DOCUMENT SHARING FORMATTERS
  // ==========================================

  formatPoWhatsAppMessage: (po: IPurchaseOrder, restaurantName: string = 'SpiralDine Restaurant'): string => {
    let msg = `*PURCHASE ORDER: ${po.poNumber}*\n`;
    msg += `*From:* ${restaurantName}${po.branchName ? ` (${po.branchName})` : ''}\n`;
    msg += `*To:* ${po.supplierName}\n`;
    msg += `*Date:* ${new Date(po.createdAt).toLocaleDateString()}\n`;
    if (po.expectedDeliveryDate) {
      msg += `*Expected Delivery:* ${po.expectedDeliveryDate}\n`;
    }
    if (po.deliveryAddress) {
      msg += `*Delivery Address:* ${po.deliveryAddress}\n`;
    }
    msg += `------------------------------------\n`;
    msg += `*ORDERED ITEMS:*\n`;

    po.items.forEach((item, idx) => {
      msg += `${idx + 1}. *${item.ingredientName}*: ${item.quantity} ${item.unit} @ ${formatPrice(item.unitPrice)} = ${formatPrice(item.lineTotal)}\n`;
    });

    msg += `------------------------------------\n`;
    msg += `*Subtotal:* ${formatPrice(po.subtotal)}\n`;
    if (po.taxTotal > 0) {
      msg += `*Tax / GST:* ${formatPrice(po.taxTotal)}\n`;
    }
    if (po.deliveryCharge && po.deliveryCharge > 0) {
      msg += `*Delivery:* ${formatPrice(po.deliveryCharge)}\n`;
    }
    msg += `*Grand Total:* ${formatPrice(po.grandTotal)}\n`;
    msg += `------------------------------------\n`;

    if (po.supplierInstructions) {
      msg += `*Instructions:* ${po.supplierInstructions}\n`;
    }

    msg += `Please confirm receipt and expected fulfillment schedule.\nThank you!`;
    return msg;
  },

  formatPoEmailContent: (po: IPurchaseOrder, restaurantName: string = 'SpiralDine Restaurant'): { subject: string; text: string; html: string } => {
    const subject = `Purchase Order ${po.poNumber} from ${restaurantName}`;
    const text = vendorPurchaseOrderService.formatPoWhatsAppMessage(po, restaurantName);

    const itemsRows = po.items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 10px; font-weight: bold; color: #1E293B;">${idx + 1}. ${item.ingredientName}</td>
        <td style="padding: 10px; text-align: center; color: #475569;">${item.quantity} ${item.unit}</td>
        <td style="padding: 10px; text-align: right; color: #475569;">${formatPrice(item.unitPrice)}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold; color: #0F172A;">${formatPrice(item.lineTotal)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
        <div style="border-bottom: 2px solid #16845B; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #16845B;">${restaurantName}</h2>
          <h3 style="margin: 4px 0 0; color: #0F172A;">Purchase Order: ${po.poNumber}</h3>
          <p style="margin: 4px 0 0; color: #64748B; font-size: 13px;">Date: ${new Date(po.createdAt).toLocaleDateString()}</p>
        </div>

        <div style="margin-bottom: 20px; font-size: 14px; color: #334155;">
          <p style="margin: 2px 0;"><strong>Vendor:</strong> ${po.supplierName}</p>
          ${po.expectedDeliveryDate ? `<p style="margin: 2px 0;"><strong>Expected Delivery:</strong> ${po.expectedDeliveryDate}</p>` : ''}
          ${po.deliveryAddress ? `<p style="margin: 2px 0;"><strong>Delivery Address:</strong> ${po.deliveryAddress}</p>` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <thead>
            <tr style="background: #F8FAFC; border-bottom: 2px solid #CBD5E1;">
              <th style="padding: 10px; text-align: left; color: #475569;">Item</th>
              <th style="padding: 10px; text-align: center; color: #475569;">Qty</th>
              <th style="padding: 10px; text-align: right; color: #475569;">Unit Price</th>
              <th style="padding: 10px; text-align: right; color: #475569;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="text-align: right; margin-bottom: 24px; font-size: 14px; color: #334155;">
          <p style="margin: 4px 0;">Subtotal: <strong>${formatPrice(po.subtotal)}</strong></p>
          ${po.taxTotal > 0 ? `<p style="margin: 4px 0;">Tax: <strong>${formatPrice(po.taxTotal)}</strong></p>` : ''}
          ${po.deliveryCharge && po.deliveryCharge > 0 ? `<p style="margin: 4px 0;">Delivery: <strong>${formatPrice(po.deliveryCharge)}</strong></p>` : ''}
          <h3 style="margin: 8px 0; color: #16845B; font-size: 18px;">Grand Total: ${formatPrice(po.grandTotal)}</h3>
        </div>

        ${po.supplierInstructions ? `
          <div style="background: #F1F5F9; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #334155;">
            <strong>Instructions:</strong> ${po.supplierInstructions}
          </div>
        ` : ''}

        <p style="font-size: 12px; color: #94A3B8; text-align: center; margin: 0;">
          Generated automatically by SpiralDine Inventory Automation. Please reply to confirm receipt.
        </p>
      </div>
    `;

    return { subject, text, html };
  },

  // ==========================================
  // 6. CONNECT REPLENISHMENT SUGGESTIONS
  // ==========================================

  createDraftPoFromSuggestion: async (
    tenantId: string, 
    suggestion: IPurchaseSuggestion, 
    user?: any,
    preferredPrice?: number
  ): Promise<IPurchaseOrder> => {
    const unitPrice = preferredPrice !== undefined && preferredPrice > 0 
      ? preferredPrice 
      : (suggestion.estimatedCost && suggestion.recommendedQuantity 
        ? Math.round(suggestion.estimatedCost / suggestion.recommendedQuantity) 
        : 100);

    const po = await vendorPurchaseOrderService.createPurchaseOrder(tenantId, {
      supplierId: suggestion.supplierId || 'preferred-supplier',
      supplierName: suggestion.supplierName || 'Preferred Supplier',
      items: [
        {
          ingredientId: suggestion.ingredientId,
          ingredientName: suggestion.ingredientName,
          unit: suggestion.unit,
          quantity: suggestion.recommendedQuantity || suggestion.requiredQuantity || 1,
          unitPrice,
          taxRate: 5,
          notes: `Created from replenishment suggestion (${suggestion.priority} priority)`
        }
      ],
      supplierInstructions: 'Standard replenishment delivery',
      internalNotes: `Auto-generated from low-stock suggestion ID ${suggestion.id}`,
      status: 'DRAFT'
    }, user);

    // Update suggestion status to 'ordered'
    const sugRef = doc(db, 'restaurants', tenantId, 'purchaseSuggestions', suggestion.id);
    await updateDoc(sugRef, {
      status: 'ordered',
      poId: po.id,
      poNumber: po.poNumber,
      updatedAt: new Date().toISOString()
    });

    return po;
  }
};
