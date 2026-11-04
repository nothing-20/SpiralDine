import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, onSnapshot, query, limit, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Card from '../../../components/ui/Card/Card';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import { Flame, Plus, History, Check, AlertTriangle, Layers, Search, Package, User, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ILivePreparedInventoryProps {
  menuItems: any[];
  onPrepareBatch: (item: any, size: number) => Promise<void>;
}

export const LivePreparedInventory: React.FC<ILivePreparedInventoryProps> = ({
  menuItems,
  onPrepareBatch
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [batchSize, setBatchSize] = useState<number>(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refillLoadingMap, setRefillLoadingMap] = useState<Record<string, boolean>>({});

  // Filter batch items
  const rawBatchItems = menuItems.filter(
    item => item.preparationMethod === 'batch' || item.productionMode === 'Batch Production'
  );

  // Filter batch items by local search query
  const batchItems = rawBatchItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Real-time listener for prepared batches history
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'preparedBatchesHistory');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setHistoryList(list);
    }, (err) => {
      console.error('History read error:', err);
    });

    return () => unsub();
  }, [user?.tenantId]);

  const handleOpenPrepareModal = (item: any) => {
    setSelectedItem(item);
    setBatchSize(item.defaultBatchSize ?? 50);
    setIsModalOpen(true);
  };

  const handleAdjustPortions = async (item: any, amount: number, type: 'refill' | 'reduce' | 'waste') => {
    if (!user?.tenantId) return;
    const loadingKey = `${item.id}-${amount}`;
    setRefillLoadingMap(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'menu', 'default', 'items', item.id);
      const currentServings = item.availableServings ?? 0;
      let newServings = currentServings + amount;
      if (newServings < 0) newServings = 0;

      const timestamp = new Date().toISOString();
      const payload: any = {
        availableServings: newServings,
        isAvailable: newServings > 0,
        available: newServings > 0,
        updatedAt: timestamp
      };

      if (amount > 0) {
        payload.lastPreparedAt = timestamp;
        payload.lastPreparedBy = user.displayName || user.email || 'Kitchen Chef';
      }

      await updateDoc(docRef, payload);

      // Write to history log
      const histCol = collection(db, 'restaurants', user.tenantId, 'preparedBatchesHistory');
      await addDoc(histCol, {
        itemId: item.id,
        itemName: item.name,
        portionsAdded: amount > 0 ? amount : 0,
        portionsDiscarded: amount < 0 ? Math.abs(amount) : 0,
        timestamp,
        preparedBy: user.displayName || user.email || 'Kitchen Chef',
        type: type,
        reason: type === 'waste' ? 'Expired portions discarded' : amount < 0 ? 'Manual portion reduction' : 'Manual portion addition'
      });

      toast.success(
        type === 'waste'
          ? `Discarded all portions for ${item.name}`
          : `Adjusted portions: ${newServings} available.`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(`Adjustment failed: ${err.message}`);
    } finally {
      setRefillLoadingMap(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleConfirmPrepare = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await onPrepareBatch(selectedItem, batchSize);
      setIsModalOpen(false);
      setSelectedItem(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to prepare batch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDetails = (available: number, threshold: number, max: number) => {
    if (available === 0) {
      return {
        label: 'Sold Out',
        badge: 'text-red-400 bg-red-500/10 border-red-500/20',
        bar: 'bg-red-500'
      };
    }
    if (available <= threshold * 0.5) {
      return {
        label: 'Critical',
        badge: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        bar: 'bg-orange-500'
      };
    }
    if (available <= threshold) {
      return {
        label: 'Low Stock',
        badge: 'text-yellow-455 bg-yellow-500/10 border-yellow-500/20',
        bar: 'bg-yellow-500'
      };
    }
    return {
      label: 'Healthy',
      badge: 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20',
      bar: 'bg-emerald-500'
    };
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Never';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const calculateExpiryTime = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    // Expire batch portions 12 hours from cook time
    const expiry = new Date(date.getTime() + 12 * 60 * 60 * 1000);
    return expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + expiry.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-5 text-left select-none">
      {/* Search & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 border border-slate-850 rounded-2xl p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search prepared dishes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-955 border border-slate-855 rounded-xl text-textPearl outline-none focus:border-primary/50"
          />
        </div>

        <button
          onClick={() => setIsHistoryOpen(true)}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-955 border border-slate-850 text-slate-300 hover:text-textPearl hover:bg-slate-900 rounded-xl text-xs font-bold transition-all shrink-0"
        >
          <History className="w-3.5 h-3.5 text-primary" />
          <span>Prepared Batch History</span>
        </button>
      </div>

      {/* Main Grid View / Empty State */}
      {rawBatchItems.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-855 rounded-3xl p-6 bg-slate-900/10">
          <Package className="w-12 h-12 text-slate-700 mb-4" />
          <h3 className="text-sm font-extrabold text-textPearl mb-1">No batch-production menu items configured.</h3>
          <p className="text-xs text-slate-500 mb-5 max-w-sm text-center">
            Set items to "Batch Production" inside your Menu Management to enable advance portions tracking.
          </p>
          <Button 
            onClick={() => navigate('/dashboard/owner/menu')}
            className="px-6 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/25 font-bold rounded-xl text-xs py-2 transition-all uppercase tracking-wider"
          >
            Configure Batch Items
          </Button>
        </div>
      ) : batchItems.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-855 rounded-3xl bg-slate-900/10">
          <Search className="w-8 h-8 text-slate-700 mb-2" />
          <p className="text-xs font-semibold">No prepared items match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {batchItems.map(item => {
            const available = item.availableServings ?? 0;
            const threshold = item.lowStockThreshold ?? 10;
            const max = item.defaultBatchSize ?? 50;
            const percentage = max > 0 ? Math.min(100, (available / max) * 100) : 0;
            const status = getStatusDetails(available, threshold, max);
            const isSoldOut = available === 0;

            // Suggest prep quantity if stock is critical or low
            const nextSuggested = available <= threshold ? max : 0;

            return (
              <Card 
                key={item.id} 
                className={`p-4 border bg-slate-900/30 rounded-2xl flex flex-col justify-between transition-all hover:brightness-110 ${
                  isSoldOut 
                    ? 'border-red-500/30 shadow-lg shadow-red-500/5 ring-1 ring-red-500/20' 
                    : available <= threshold
                    ? 'border-yellow-500/30 ring-1 ring-yellow-500/10'
                    : 'border-slate-855'
                }`}
              >
                {/* Header Info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-left">
                      <h4 className="font-extrabold text-sm text-textPearl truncate">{item.name}</h4>
                      <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">
                        Batch Prepared Item
                      </span>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border shrink-0 ${status.badge}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Portions Level Display */}
                  <div className="flex items-baseline space-x-1 text-left">
                    <span className={`text-3xl font-mono font-black ${isSoldOut ? 'text-red-400' : 'text-primary'}`}>
                      {available}
                    </span>
                    <span className="text-xs text-slate-500 font-bold font-mono">/ {max} portions remaining</span>
                  </div>

                  {/* Progress capacity bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850/50">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${status.bar}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold font-mono">
                      <span>0%</span>
                      <span>{Math.round(percentage)}% Capacity</span>
                    </div>
                  </div>

                  {/* Low portion warning banner */}
                  {available <= threshold && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-yellow-450 p-2 rounded-xl text-[10px] font-extrabold text-center flex items-center justify-center space-x-1.5 uppercase tracking-wider animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Low portion warning</span>
                    </div>
                  )}

                  {/* Timestamp, Expiry & Chef Info */}
                  <div className="bg-slate-950/50 border border-slate-850/60 rounded-xl p-2.5 space-y-1.5 text-[10px] text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-550 font-bold uppercase tracking-wider">Last Batch Cooked:</span>
                      <span className="text-slate-355 font-mono">{formatTimestamp(item.lastPreparedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-555 font-bold uppercase tracking-wider">Estimated Expiry:</span>
                      <span className="text-red-450 font-mono font-medium">{calculateExpiryTime(item.lastPreparedAt)}</span>
                    </div>
                    {nextSuggested > 0 && (
                      <div className="flex items-center justify-between border-t border-slate-850/40 pt-1.5 mt-1.5">
                        <span className="text-primary font-bold uppercase tracking-wider">Suggested Refill:</span>
                        <span className="text-primary font-mono font-black">+{nextSuggested} portions</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Control Actions */}
                <div className="mt-4 pt-3 border-t border-slate-855 space-y-3">
                  {/* Manual portion adjustments row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block text-left">Add portions:</span>
                      <div className="flex space-x-1">
                        {[5, 10].map(amt => (
                          <button
                            key={amt}
                            onClick={() => handleAdjustPortions(item, amt, 'refill')}
                            className="flex-1 py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-bold text-primary flex items-center justify-center space-x-0.5"
                          >
                            <ArrowUp className="w-2.5 h-2.5" />
                            <span>+{amt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block text-left">Reduce stock:</span>
                      <div className="flex space-x-1">
                        {[1, 5].map(amt => (
                          <button
                            key={amt}
                            onClick={() => handleAdjustPortions(item, -amt, 'reduce')}
                            className="flex-1 py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 flex items-center justify-center space-x-0.5"
                          >
                            <ArrowDown className="w-2.5 h-2.5" />
                            <span>-{amt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {/* Discard Expired Portions Action */}
                    {available > 0 && (
                      <button
                        onClick={() => handleAdjustPortions(item, -available, 'waste')}
                        className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                        title="Discard Portions as Waste"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}

                    {/* Standard Full Cook Batch Trigger */}
                    <Button 
                      size="sm" 
                      onClick={() => handleOpenPrepareModal(item)}
                      className={`flex-1 text-xs font-extrabold py-2 flex items-center justify-center space-x-1.5 uppercase tracking-wider ${
                        isSoldOut 
                          ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                          : 'bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Prepare Batch</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Prepare Batch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedItem ? `Prepare Batch: ${selectedItem.name}` : 'Prepare Batch'}
        className="max-w-md"
      >
        <div className="space-y-4 text-left text-xs select-none">
          <p className="text-slate-400">Specify the number of ready portions cooked to add to this batch:</p>
          
          <Input 
            label="Portions to Cook"
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            placeholder="e.g. 50"
            disabled={isSubmitting}
          />

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Quick Presets</span>
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50].map(sz => (
                <button
                  key={sz}
                  onClick={() => setBatchSize(sz)}
                  disabled={isSubmitting}
                  className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    batchSize === sz
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-slate-955 border-slate-855 text-slate-400 hover:text-textPearl'
                  }`}
                >
                  +{sz}
                </button>
              ))}
              <button
                onClick={() => setBatchSize(selectedItem?.defaultBatchSize ?? 50)}
                disabled={isSubmitting}
                className="py-1.5 text-xs font-bold rounded-xl border bg-slate-955 border-slate-855 text-slate-450 hover:text-textPearl"
              >
                Default
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1 text-slate-450 text-[10px] leading-normal">
            <div className="flex items-center space-x-1.5 text-amber-400 font-bold mb-0.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Ingredient Validation</span>
            </div>
            <p>Confirming batch preparation will automatically deduct required ingredients from inventory based on recipe. Preparation will fail if stock is insufficient.</p>
          </div>

          <div className="flex items-center space-x-3 pt-3 border-t border-slate-800/40">
            <Button variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirmPrepare} isLoading={isSubmitting}>
              Cook Batch
            </Button>
          </div>
        </div>
      </Modal>

      {/* History Log Overlay Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Prepared Batch Logs"
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400 text-left">
            Showing the batch preparation events, manual adjustments, and discarded waste recorded in the kitchen.
          </p>

          <div className="border border-slate-850 rounded-2xl overflow-hidden max-h-96 overflow-y-auto scrollbar-thin">
            {historyList.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-center">
                <History className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs font-semibold">No batch preparation history logged</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-955 border-b border-slate-855 text-slate-500 font-extrabold uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="px-4 py-3">Dish Name</th>
                    <th className="px-4 py-3 text-center">Action</th>
                    <th className="px-4 py-3">Prepared/Logged By</th>
                    <th className="px-4 py-3">Log Reason</th>
                    <th className="px-4 py-3 text-right">Time & Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-855 bg-slate-900/10">
                  {historyList.map(hist => {
                    const isWaste = hist.type === 'waste';
                    const isDeduction = hist.portionsDiscarded > 0 && !isWaste;
                    return (
                      <tr key={hist.id} className="hover:bg-slate-900/35 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-textPearl">{hist.itemName}</td>
                        <td className="px-4 py-3.5 text-center font-mono font-black">
                          {isWaste ? (
                            <span className="text-red-400">Discarded {hist.portionsDiscarded}</span>
                          ) : isDeduction ? (
                            <span className="text-slate-400">Reduced {hist.portionsDiscarded}</span>
                          ) : (
                            <span className="text-emerald-450">+{hist.portionsAdded} portions</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 font-medium">{hist.preparedBy}</td>
                        <td className="px-4 py-3.5 text-slate-550 font-medium italic">{hist.reason || '—'}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-450">
                          {formatTimestamp(hist.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setIsHistoryOpen(false)}>
              Close Logs
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default LivePreparedInventory;
