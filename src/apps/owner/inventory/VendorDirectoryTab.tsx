import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { formatPrice } from '../../../shared/utils/format';
import { 
  ISupplier, 
  ISupplierPrice, 
  IStockIngredient, 
  IPurchaseOrder 
} from '../../../shared/domain/inventory/types';
import { vendorPurchaseOrderService } from '../../../shared/services/vendorPurchaseOrderService';

import Button from '../../../components/ui/Button/Button';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Modal from '../../../components/ui/Modal/Modal';
import Table from '../../../components/ui/Table/Table';

import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Star, 
  Eye, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  CreditCard, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Tag,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VendorDirectoryTabProps {
  suppliers: ISupplier[];
  ingredients: IStockIngredient[];
}

export const VendorDirectoryTab: React.FC<VendorDirectoryTabProps> = ({ suppliers, ingredients }) => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Supplier Prices & POs state
  const [allPrices, setAllPrices] = useState<ISupplierPrice[]>([]);
  const [allPOs, setAllPOs] = useState<IPurchaseOrder[]>([]);

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ISupplier | null>(null);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<ISupplier | null>(null);

  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [pricingSupplier, setPricingSupplier] = useState<ISupplier | null>(null);

  // Form Fields for Supplier
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formGst, setFormGst] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('Net 15');
  const [formDeliveryDays, setFormDeliveryDays] = useState('2');
  const [formDeliverySchedule, setFormDeliverySchedule] = useState('Weekly');
  const [formRating, setFormRating] = useState('5');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSuppliedIngs, setFormSuppliedIngs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields for Price Mapping
  const [priceIngId, setPriceIngId] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [pricePurchaseUnit, setPricePurchaseUnit] = useState('kg');
  const [priceMinQty, setPriceMinQty] = useState('1');
  const [priceLeadDays, setPriceLeadDays] = useState('2');
  const [priceIsPreferred, setPriceIsPreferred] = useState(false);
  const [priceNotes, setPriceNotes] = useState('');

  // Subscribe to supplier prices & purchase orders for history
  useEffect(() => {
    if (!tenantId) return;

    const pricesUnsub = onSnapshot(
      collection(db, 'restaurants', tenantId, 'supplierPrices'),
      (snap) => {
        setAllPrices(snap.docs.map(d => d.data() as ISupplierPrice));
      },
      (err) => console.error('Error fetching supplier prices:', err)
    );

    const poUnsub = onSnapshot(
      collection(db, 'restaurants', tenantId, 'purchaseOrders'),
      (snap) => {
        setAllPOs(snap.docs.map(d => d.data() as IPurchaseOrder));
      },
      (err) => console.error('Error fetching purchase orders:', err)
    );

    return () => {
      pricesUnsub();
      poUnsub();
    };
  }, [tenantId]);

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = 
      (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone || '').includes(searchTerm) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.gstNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

    const isActive = s.isActive !== false;
    if (statusFilter === 'active') return matchesSearch && isActive;
    if (statusFilter === 'inactive') return matchesSearch && !isActive;
    return matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormCompany('');
    setFormContactPerson('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormGst('');
    setFormPaymentTerms('Net 15');
    setFormDeliveryDays('2');
    setFormDeliverySchedule('Weekly');
    setFormRating('5');
    setFormNotes('');
    setFormIsActive(true);
    setFormSuppliedIngs([]);
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (sup: ISupplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name || '');
    setFormCompany(sup.companyName || '');
    setFormContactPerson(sup.contactPerson || '');
    setFormPhone(sup.phone || '');
    setFormEmail(sup.email || '');
    setFormAddress(sup.address || '');
    setFormGst(sup.gstNumber || '');
    setFormPaymentTerms(sup.paymentTerms || 'Net 15');
    setFormDeliveryDays(String(sup.deliveryTimeDays || 2));
    setFormDeliverySchedule(sup.deliverySchedule || 'Weekly');
    setFormRating(String(sup.rating || 5));
    setFormNotes(sup.notes || '');
    setFormIsActive(sup.isActive !== false);
    setFormSuppliedIngs(sup.suppliedIngredientIds || []);
    setIsAddEditOpen(true);
  };

  const handleOpenDetails = (sup: ISupplier) => {
    setViewingSupplier(sup);
    setIsDetailsOpen(true);
  };

  const handleOpenPricingModal = (sup: ISupplier) => {
    setPricingSupplier(sup);
    setPriceIngId(ingredients[0]?.id || '');
    setPriceAmount('');
    setPricePurchaseUnit(ingredients[0]?.unit || 'kg');
    setPriceMinQty('1');
    setPriceLeadDays(String(sup.deliveryTimeDays || 2));
    setPriceIsPreferred(false);
    setPriceNotes('');
    setIsPriceModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (!formName.trim()) {
      toast.error('Supplier name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await vendorPurchaseOrderService.updateSupplier(tenantId, editingSupplier.id, {
          name: formName.trim(),
          companyName: formCompany.trim(),
          contactPerson: formContactPerson.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          address: formAddress.trim(),
          gstNumber: formGst.trim(),
          paymentTerms: formPaymentTerms,
          deliveryTimeDays: parseInt(formDeliveryDays) || 2,
          deliverySchedule: formDeliverySchedule,
          rating: parseInt(formRating) || 5,
          notes: formNotes.trim(),
          isActive: formIsActive,
          suppliedIngredientIds: formSuppliedIngs
        }, user);
        toast.success('Supplier updated successfully.');
      } else {
        await vendorPurchaseOrderService.createSupplier(tenantId, {
          name: formName.trim(),
          companyName: formCompany.trim(),
          contactPerson: formContactPerson.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          address: formAddress.trim(),
          gstNumber: formGst.trim(),
          paymentTerms: formPaymentTerms,
          deliveryTimeDays: parseInt(formDeliveryDays) || 2,
          deliverySchedule: formDeliverySchedule,
          rating: parseInt(formRating) || 5,
          notes: formNotes.trim(),
          isActive: formIsActive,
          suppliedIngredientIds: formSuppliedIngs
        }, user);
        toast.success('Supplier created successfully.');
      }
      setIsAddEditOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (sup: ISupplier) => {
    if (!tenantId) return;
    const newStatus = sup.isActive === false ? true : false;
    try {
      await vendorPurchaseOrderService.toggleSupplierActive(tenantId, sup.id, newStatus, user);
      toast.success(`Supplier ${newStatus ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      toast.error('Failed to change supplier status.');
    }
  };

  const handleDeleteSupplier = async (sup: ISupplier) => {
    if (!tenantId) return;
    if (!window.confirm(`Are you sure you want to delete or deactivate "${sup.name}"?`)) return;

    try {
      const res = await vendorPurchaseOrderService.deleteSupplier(tenantId, sup.id, user);
      if (res.deactivatedInstead) {
        toast(res.reason || 'Supplier has purchase orders and was deactivated instead of deleted.', { icon: 'ℹ️' });
      } else {
        toast.success('Supplier deleted.');
      }
    } catch (err) {
      toast.error('Failed to delete supplier.');
    }
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !pricingSupplier) return;

    const ing = ingredients.find(i => i.id === priceIngId);
    if (!ing) {
      toast.error('Select a valid ingredient.');
      return;
    }

    const priceNum = Math.round(parseFloat(priceAmount) * 100);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Enter a valid negotiated unit price.');
      return;
    }

    try {
      await vendorPurchaseOrderService.setSupplierPrice(tenantId, {
        supplierId: pricingSupplier.id,
        supplierName: pricingSupplier.name,
        ingredientId: ing.id,
        ingredientName: ing.name,
        unitPrice: priceNum,
        purchaseUnit: pricePurchaseUnit || ing.unit,
        minOrderQuantity: parseFloat(priceMinQty) || 1,
        leadTimeDays: parseInt(priceLeadDays) || pricingSupplier.deliveryTimeDays || 2,
        isPreferred: priceIsPreferred,
        notes: priceNotes.trim()
      }, user);

      // Also ensure ingredient's suppliedIngredientIds includes this item
      if (!pricingSupplier.suppliedIngredientIds?.includes(ing.id)) {
        const updatedIngs = [...(pricingSupplier.suppliedIngredientIds || []), ing.id];
        await vendorPurchaseOrderService.updateSupplier(tenantId, pricingSupplier.id, {
          suppliedIngredientIds: updatedIngs
        }, user);
      }

      toast.success('Negotiated price catalog updated.');
      setIsPriceModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save price.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Search, Status Filter, Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search vendors, contacts, GSTIN..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E5E0D9] rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16845B]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#F5F2EB] p-1 rounded-xl text-xs font-bold">
            <button 
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white shadow-xs text-slate-900 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All ({suppliers.length})
            </button>
            <button 
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'active' ? 'bg-white shadow-xs text-emerald-700 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Active ({suppliers.filter(s => s.isActive !== false).length})
            </button>
            <button 
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'inactive' ? 'bg-white shadow-xs text-rose-700 font-extrabold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Inactive ({suppliers.filter(s => s.isActive === false).length})
            </button>
          </div>
        </div>

        <Button onClick={handleOpenAdd} className="text-xs font-bold py-2 px-3.5 bg-[#16845B] hover:bg-[#126B49] text-white flex items-center gap-1.5 rounded-xl shadow-xs">
          <Plus className="w-4 h-4" />
          <span>Add Vendor</span>
        </Button>
      </div>

      {/* Vendors Table */}
      {filteredSuppliers.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-[#E5E0D9] rounded-2xl bg-white shadow-xs">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 mb-1">No vendors match your search criteria</h4>
          <p className="text-xs text-slate-500 mb-4">Try clearing your filters or add a new supplier to your directory.</p>
          <Button onClick={handleOpenAdd} variant="secondary" className="text-xs font-bold py-1.5 px-3">
            Add First Vendor
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border border-[#E5E0D9] bg-white rounded-2xl shadow-xs">
          <Table
            keyExtractor={(row: ISupplier) => row?.id || Math.random().toString()}
            data={filteredSuppliers}
            columns={[
              {
                header: 'Vendor & Business',
                accessor: (row: ISupplier) => {
                  const isActive = row?.isActive !== false;
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm hover:underline cursor-pointer" onClick={() => handleOpenDetails(row)}>
                          {row?.name || 'Unnamed Vendor'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                        {row?.companyName && <span>Co: {row.companyName}</span>}
                        {row?.gstNumber && <span>• GST: <span className="font-mono font-bold text-slate-700">{row.gstNumber}</span></span>}
                      </div>
                    </div>
                  );
                }
              },
              {
                header: 'Contact Details',
                accessor: (row: ISupplier) => (
                  <div className="space-y-1 text-xs">
                    {row?.contactPerson && (
                      <span className="font-bold text-slate-800 block text-[11.5px]">{row.contactPerson}</span>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{row?.phone || 'No phone'}</span>
                    </div>
                    {row?.email && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10.5px]">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{row.email}</span>
                      </div>
                    )}
                  </div>
                )
              },
              {
                header: 'Fulfillment & Terms',
                accessor: (row: ISupplier) => (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[11.5px]">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>Lead time: <strong>{row?.deliveryTimeDays || 2} days</strong> ({row?.deliverySchedule || 'Weekly'})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10.5px]">
                      <CreditCard className="w-3 h-3 text-slate-400" />
                      <span>Terms: <strong>{row?.paymentTerms || 'Net 15'}</strong></span>
                    </div>
                  </div>
                )
              },
              {
                header: 'Catalog & POs',
                accessor: (row: ISupplier) => {
                  const supplierPrices = allPrices.filter(p => p.supplierId === row.id);
                  const supplierPOs = allPOs.filter(p => p.supplierId === row.id);
                  return (
                    <div className="space-y-1 text-xs">
                      <button 
                        type="button" 
                        onClick={() => handleOpenPricingModal(row)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold hover:bg-emerald-100 transition-colors"
                      >
                        <Tag className="w-3 h-3" />
                        <span>{supplierPrices.length} Prices Negotiated</span>
                      </button>
                      <span className="text-[10px] text-slate-500 block">
                        {supplierPOs.length} Purchase Order{supplierPOs.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  );
                }
              },
              {
                header: 'Actions',
                accessor: (row: ISupplier) => (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      title="View Vendor Details"
                      onClick={() => handleOpenDetails(row)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Manage Negotiated Prices"
                      onClick={() => handleOpenPricingModal(row)}
                      className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      <DollarSign className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Edit Vendor"
                      onClick={() => handleOpenEdit(row)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title={row.isActive !== false ? "Deactivate Vendor" : "Activate Vendor"}
                      onClick={() => handleToggleActive(row)}
                      className={`p-1.5 rounded-lg transition-colors ${row.isActive !== false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      {row.isActive !== false ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      title="Delete Vendor"
                      onClick={() => handleDeleteSupplier(row)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* MODAL 1: ADD / EDIT SUPPLIER */}
      <Modal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        title={editingSupplier ? `Edit Vendor: ${editingSupplier.name}` : 'Register New Vendor'}
        className="max-w-xl bg-white"
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Vendor / Trade Name *</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Fresh Farms Poultry Ltd." 
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Company Registered Name</label>
              <input 
                type="text" 
                placeholder="e.g. Fresh Farms Enterprises Pvt Ltd" 
                value={formCompany}
                onChange={e => setFormCompany(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Contact Person</label>
              <input 
                type="text" 
                placeholder="e.g. Rajesh Sharma" 
                value={formContactPerson}
                onChange={e => setFormContactPerson(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Phone Number *</label>
              <input 
                type="text" 
                required
                placeholder="e.g. +91 98765 43210" 
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Email Address</label>
              <input 
                type="email" 
                placeholder="vendor@freshfarms.in" 
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">GSTIN / Tax ID</label>
              <input 
                type="text" 
                placeholder="e.g. 29AAAAA0000A1Z5" 
                value={formGst}
                onChange={e => setFormGst(e.target.value.toUpperCase())}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Business Address</label>
              <input 
                type="text" 
                placeholder="e.g. Plot 45, APMC Market, Bangalore" 
                value={formAddress}
                onChange={e => setFormAddress(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Payment Terms</label>
              <select
                value={formPaymentTerms}
                onChange={e => setFormPaymentTerms(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              >
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Advance">100% Advance</option>
                <option value="Net 7">Net 7 Days</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 45">Net 45 Days</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Lead Time (Days)</label>
              <input 
                type="number" 
                min="0"
                max="60"
                value={formDeliveryDays}
                onChange={e => setFormDeliveryDays(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Delivery Frequency</label>
              <select
                value={formDeliverySchedule}
                onChange={e => setFormDeliverySchedule(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              >
                <option value="Daily">Daily</option>
                <option value="Twice Weekly">Twice Weekly</option>
                <option value="Weekly">Weekly</option>
                <option value="Bi-Weekly">Bi-Weekly</option>
                <option value="On Demand">On Demand</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Vendor Notes / Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Deliver before 10 AM, call supervisor at gate."
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
              <input 
                type="checkbox" 
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="rounded border-slate-300 text-[#16845B] focus:ring-[#16845B]"
              />
              <span>Vendor is active for procurement</span>
            </label>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsAddEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#16845B] hover:bg-[#126B49] text-white font-bold">
                {isSubmitting ? 'Saving...' : editingSupplier ? 'Update Vendor' : 'Create Vendor'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: VENDOR DETAILS & HISTORY */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={viewingSupplier ? `Vendor File: ${viewingSupplier.name}` : 'Vendor Details'}
        className="max-w-2xl bg-white"
      >
        {viewingSupplier && (
          <div className="space-y-5 text-xs text-left">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">{viewingSupplier.name}</h4>
                <p className="text-slate-500">{viewingSupplier.companyName || 'Sole Proprietorship'} • GST: <span className="font-mono font-bold">{viewingSupplier.gstNumber || 'Not specified'}</span></p>
                {viewingSupplier.contactPerson && (
                  <p className="text-slate-600 mt-1">Contact: <strong>{viewingSupplier.contactPerson}</strong></p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => { setIsDetailsOpen(false); handleOpenPricingModal(viewingSupplier); }}
                  className="bg-[#16845B] hover:bg-[#126B49] text-white text-xs font-bold py-1.5 px-3 rounded-lg"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1" />
                  <span>Set Prices</span>
                </Button>
              </div>
            </div>

            {/* Negotiated Ingredient Prices */}
            <div>
              <h5 className="font-extrabold text-slate-800 uppercase text-[11px] mb-2 flex items-center justify-between">
                <span>Negotiated Ingredient Prices</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {allPrices.filter(p => p.supplierId === viewingSupplier.id).length} items registered
                </span>
              </h5>
              {allPrices.filter(p => p.supplierId === viewingSupplier.id).length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                  No negotiated prices recorded yet. Click "Set Prices" to add item rates.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                      <tr>
                        <th className="p-2">Ingredient</th>
                        <th className="p-2">Negotiated Price</th>
                        <th className="p-2">Min Order</th>
                        <th className="p-2">Lead Time</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allPrices.filter(p => p.supplierId === viewingSupplier.id).map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-800">{p.ingredientName}</td>
                          <td className="p-2 font-mono font-bold text-emerald-700">{formatPrice(p.unitPrice)} / {p.purchaseUnit}</td>
                          <td className="p-2 text-slate-600">{p.minOrderQuantity || 1} {p.purchaseUnit}</td>
                          <td className="p-2 text-slate-600">{p.leadTimeDays || 2} days</td>
                          <td className="p-2">
                            {p.isPreferred && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9.5px] font-bold border border-emerald-200">
                                Preferred
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Historical Purchase Orders */}
            <div>
              <h5 className="font-extrabold text-slate-800 uppercase text-[11px] mb-2">Recent Purchase Orders</h5>
              {allPOs.filter(p => p.supplierId === viewingSupplier.id).length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                  No purchase orders dispatched to this vendor yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                      <tr>
                        <th className="p-2">PO Number</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Items</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allPOs.filter(p => p.supplierId === viewingSupplier.id).slice(0, 5).map(po => (
                        <tr key={po.id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-slate-800">{po.poNumber}</td>
                          <td className="p-2 text-slate-500">{new Date(po.createdAt).toLocaleDateString()}</td>
                          <td className="p-2 text-slate-600">{po.items.length} items</td>
                          <td className="p-2 font-mono font-bold text-slate-900">{formatPrice(po.grandTotal)}</td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded text-[9.5px] font-black uppercase bg-slate-100 text-slate-700">
                              {po.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: SUPPLIER-INGREDIENT PRICING */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title={pricingSupplier ? `Set Negotiated Price: ${pricingSupplier.name}` : 'Set Supplier Price'}
        className="max-w-md bg-white"
      >
        <form onSubmit={handleSavePrice} className="space-y-4 text-xs text-left">
          <div>
            <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Select Ingredient *</label>
            <select
              value={priceIngId}
              onChange={e => {
                setPriceIngId(e.target.value);
                const found = ingredients.find(i => i.id === e.target.value);
                if (found) {
                  setPricePurchaseUnit(found.unit);
                  if (found.purchaseCost) {
                    setPriceAmount((found.purchaseCost / 100).toFixed(2));
                  }
                }
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#16845B]"
            >
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit}) — Current Cost: {formatPrice(ing.purchaseCost || 0)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Negotiated Price (₹) *</label>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                required
                placeholder="e.g. 120.00" 
                value={priceAmount}
                onChange={e => setPriceAmount(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Purchase Unit</label>
              <input 
                type="text" 
                value={pricePurchaseUnit}
                onChange={e => setPricePurchaseUnit(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Min Order Qty</label>
              <input 
                type="number" 
                min="1"
                value={priceMinQty}
                onChange={e => setPriceMinQty(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Lead Time (Days)</label>
              <input 
                type="number" 
                min="0"
                value={priceLeadDays}
                onChange={e => setPriceLeadDays(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-[#16845B]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
            <input 
              type="checkbox" 
              checked={priceIsPreferred}
              onChange={e => setPriceIsPreferred(e.target.checked)}
              className="rounded border-slate-300 text-[#16845B] focus:ring-[#16845B]"
            />
            <span>Set as preferred primary vendor for this ingredient</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsPriceModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#16845B] hover:bg-[#126B49] text-white font-bold">
              Save Price to Catalog
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
