import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { MessageSquare, CheckCircle, Clock, AlertCircle, Filter, Search, User, Mail, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ISupportTicket {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  category: string;
  orderId?: string;
  bookingId?: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  adminNote?: string;
}

export const SuperAdminSupport: React.FC = () => {
  const [tickets, setTickets] = useState<ISupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<ISupportTicket | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: ISupportTicket[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as ISupportTicket);
      });
      setTickets(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching support tickets:', err);
      toast.error('Failed to stream support tickets.');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleUpdateStatus = async (ticketId: string, newStatus: ISupportTicket['status']) => {
    setIsUpdating(true);
    try {
      const nowIso = new Date().toISOString();
      const payload: any = {
        status: newStatus,
        updatedAt: nowIso
      };
      if (newStatus === 'RESOLVED' || newStatus === 'CLOSED') {
        payload.resolvedAt = nowIso;
      }
      if (adminNote.trim()) {
        payload.adminNote = adminNote.trim();
      }

      await updateDoc(doc(db, 'supportTickets', ticketId), payload);
      toast.success(`Ticket marked as ${newStatus}`);
      setSelectedTicket(prev => prev ? { ...prev, ...payload } : null);
      setAdminNote('');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update ticket status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const queryLower = searchQuery.toLowerCase();
    const matchesQuery = !searchQuery || 
      (t.subject && t.subject.toLowerCase().includes(queryLower)) ||
      (t.message && t.message.toLowerCase().includes(queryLower)) ||
      (t.customerName && t.customerName.toLowerCase().includes(queryLower)) ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(queryLower)) ||
      t.id.toLowerCase().includes(queryLower);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-white tracking-tight">
            Customer Support Tickets
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-tenant diner inquiries, order complaints, and booking dispute desk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
            Total Tickets: <span className="text-white">{tickets.length}</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400">
            Open: <span className="text-amber-300">{tickets.filter(t => t.status === 'OPEN').length}</span>
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, name, email, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-primary text-slate-950 font-extrabold shadow-sm'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Ticket List + Selected Ticket Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs font-semibold">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-primary" />
              Loading support requests...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-300">No support tickets found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Adjust your search query or filter category.</p>
            </div>
          ) : (
            filteredTickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-primary shadow-sm'
                      : 'bg-slate-900/50 border-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800">
                          {t.id.slice(0, 8)}...
                        </span>
                        <span className="text-xs font-bold text-white line-clamp-1">
                          {t.subject || 'Support Request'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {t.message}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 uppercase tracking-wider ${
                      t.status === 'OPEN'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : t.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-slate-500" />
                      <span>{t.customerName || 'Diner'}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500">{t.category}</span>
                    </div>
                    <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Ticket Drawer / Detail Panel */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 h-fit sticky top-6 space-y-5">
          {selectedTicket ? (
            <>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-slate-400">Ticket #{selectedTicket.id}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    selectedTicket.status === 'OPEN' ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
                  }`}>
                    {selectedTicket.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white font-display leading-snug">
                  {selectedTicket.subject}
                </h3>
              </div>

              {/* Customer Metadata */}
              <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold">{selectedTicket.customerName || 'Anonymous'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-[11px]">{selectedTicket.customerEmail || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-500">Category:</span>
                  <span className="capitalize">{selectedTicket.category}</span>
                </div>
                {selectedTicket.orderId && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Order ID:</span>
                    <span className="font-mono text-primary">{selectedTicket.orderId}</span>
                  </div>
                )}
                {selectedTicket.bookingId && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Booking ID:</span>
                    <span className="font-mono text-primary">{selectedTicket.bookingId}</span>
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer Message</span>
                <p className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/60 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.message}
                </p>
              </div>

              {/* Admin Note if already present */}
              {selectedTicket.adminNote && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Resolution Note</span>
                  <p className="p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-xl text-xs text-emerald-200">
                    {selectedTicket.adminNote}
                  </p>
                </div>
              )}

              {/* Status Update Form */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Add Resolution Note & Update Status
                </label>
                <textarea
                  placeholder="Optional resolution notes sent to customer..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-primary resize-none"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'IN_PROGRESS')}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                  >
                    In Progress
                  </button>
                  <button
                    disabled={isUpdating}
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                  >
                    Resolve Ticket
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Select a support ticket from the list to view full customer details and update its resolution status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSupport;
