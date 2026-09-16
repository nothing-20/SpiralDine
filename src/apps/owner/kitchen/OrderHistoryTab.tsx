import React, { useState, useMemo } from 'react';
import Card from '../../../components/ui/Card/Card';
import Select from '../../../components/ui/Select/Select';
import { Search, Calendar, User, LayoutGrid, CheckCircle } from 'lucide-react';
import { filterKitchenStaff } from '../../../shared/services/kitchenService';

interface IOrderHistoryTabProps {
  orders: any[];
  employees: any[];
}

export const OrderHistoryTab: React.FC<IOrderHistoryTabProps> = ({ orders, employees }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChef, setSelectedChef] = useState('all');
  const [selectedWaiter, setSelectedWaiter] = useState('all');
  const [selectedTable, setSelectedTable] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // all, today, week, month
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Derive unique lists for filters
  const waiters = useMemo(() => {
    const list = new Set<string>();
    orders.forEach(o => { if (o.waiterName) list.add(o.waiterName); });
    return Array.from(list).sort();
  }, [orders]);

  const tables = useMemo(() => {
    const list = new Set<string>();
    orders.forEach(o => { if (o.tableNumber) list.add(String(o.tableNumber)); });
    return Array.from(list).sort((a, b) => Number(a) - Number(b));
  }, [orders]);

  const statuses = useMemo(() => {
    const list = new Set<string>();
    orders.forEach(o => { if (o.status) list.add(o.status); });
    return Array.from(list).sort();
  }, [orders]);

  // Filter logic
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = 
        (o.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.items?.some((i: any) => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesChef = selectedChef === 'all' || o.assignedChefName === selectedChef;
      const matchesWaiter = selectedWaiter === 'all' || o.waiterName === selectedWaiter;
      const matchesTable = selectedTable === 'all' || String(o.tableNumber) === selectedTable;
      const matchesStatus = selectedStatus === 'all' || o.status === selectedStatus;

      // Date filtering
      if (dateRange === 'all') return matchesSearch && matchesChef && matchesWaiter && matchesTable && matchesStatus;
      
      const orderDate = new Date(o.createdAt);
      const now = new Date();
      let matchesDate = false;

      if (dateRange === 'today') {
        matchesDate = orderDate.toDateString() === now.toDateString();
      } else if (dateRange === 'week') {
        const diffTime = Math.abs(now.getTime() - orderDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        matchesDate = diffDays <= 7;
      } else if (dateRange === 'month') {
        matchesDate = orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }

      return matchesSearch && matchesChef && matchesWaiter && matchesTable && matchesStatus && matchesDate;
    });
  }, [orders, searchTerm, selectedChef, selectedWaiter, selectedTable, selectedStatus, dateRange]);

  // Sort orders descending by creation timestamp
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filteredOrders]);

  // Pagination logic
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedOrders.slice(start, start + itemsPerPage);
  }, [sortedOrders, currentPage]);

  const calculateKitchenDuration = (order: any) => {
    if (!order.createdAt || !order.readyAt) return '—';
    const start = new Date(order.createdAt).getTime();
    const end = new Date(order.readyAt).getTime();
    const diffMs = end - start;
    if (diffMs < 0) return '—';
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4 text-left select-none font-sans">
      {/* Search & Multi Filter Bar */}
      <div className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6F746F]" />
            <input
              type="text"
              placeholder="Search Order ID or item..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-[#F7F4EE] border border-[#E3DED5] rounded-lg text-[#18201D] placeholder:text-[#6F746F]/70 outline-none focus:border-[#13241F]"
            />
          </div>

          <Select
            value={selectedChef}
            onChange={e => { setSelectedChef(e.target.value); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'All Chefs' },
              ...filterKitchenStaff(employees).map(emp => ({ value: emp.fullName, label: emp.fullName }))
            ]}
          />

          <Select
            value={selectedWaiter}
            onChange={e => { setSelectedWaiter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'All Waiters' },
              ...waiters.map(w => ({ value: w, label: w }))
            ]}
          />

          <Select
            value={selectedTable}
            onChange={e => { setSelectedTable(e.target.value); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'All Tables' },
              ...tables.map(t => ({ value: t, label: `Table ${t}` }))
            ]}
          />

          <Select
            value={selectedStatus}
            onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'All Statuses' },
              ...statuses.map(s => ({ value: s, label: s }))
            ]}
          />
        </div>

        <div className="flex items-center space-x-2 border-t border-[#E3DED5] pt-3">
          <span className="text-[10px] text-[#6F746F] font-bold uppercase tracking-wider">Date range:</span>
          {['all', 'today', 'week', 'month'].map(r => (
            <button
              key={r}
              onClick={() => { setDateRange(r); setCurrentPage(1); }}
              className={`px-3 py-1 text-[10px] font-bold rounded-md border transition-all uppercase tracking-wider ${
                dateRange === r
                  ? 'bg-[#13241F] border-[#13241F] text-white'
                  : 'bg-white border-[#E3DED5] text-[#6F746F] hover:text-[#18201D]'
              }`}
            >
              {r}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-[#6F746F] font-medium">{sortedOrders.length} records found</span>
        </div>
      </div>

      {/* Results Table */}
      <div className="border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F4EE] border-b border-[#E3DED5] text-[#6F746F] font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5">Order ID</th>
                <th className="px-4 py-3.5 text-center">Table</th>
                <th className="px-4 py-3.5">Waiter</th>
                <th className="px-4 py-3.5">Assigned Chef</th>
                <th className="px-4 py-3.5">Items</th>
                <th className="px-4 py-3.5 text-center">Qty</th>
                <th className="px-4 py-3.5 text-center">Kitchen Duration</th>
                <th className="px-4 py-3.5">Created At</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DED5]">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#6F746F] font-semibold">
                    No matching order history records found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(o => (
                  <tr key={o.orderId} className="hover:bg-[#F7F4EE]/60 transition-colors">
                    <td className="px-4 py-4 font-mono font-bold text-[#18201D]">
                      {o.orderId}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-[#18201D]">T{o.tableNumber}</td>
                    <td className="px-4 py-4 text-[#18201D] font-medium">{o.waiterName || '—'}</td>
                    <td className="px-4 py-4 text-[#18201D] font-medium">{o.assignedChefName || 'Unassigned'}</td>
                    <td className="px-4 py-4 text-[#6F746F] font-medium max-w-[200px] truncate" title={o.items?.map((i: any) => `${i.count}x ${i.name}`).join(', ')}>
                      {o.items?.map((i: any) => `${i.count}x ${i.name}`).join(', ')}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-[#18201D]">
                      {o.items?.reduce((acc: number, i: any) => acc + i.count, 0) || 0}
                    </td>
                    <td className="px-4 py-4 text-center font-mono font-bold text-[#287A55]">{calculateKitchenDuration(o)}</td>
                    <td className="px-4 py-4 font-mono text-[11px] text-[#6F746F]">{formatTimestamp(o.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        o.status === 'COMPLETED' || o.status === 'PAID' ? 'bg-[#EBF7EE] border-[#287A55]/30 text-[#287A55]' :
                        o.status === 'CANCELLED' ? 'bg-[#FDEEEC] border-[#C7463A]/30 text-[#C7463A]' :
                        'bg-[#FEF5E7] border-[#D79A24]/30 text-[#D79A24]'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center bg-[#F7F4EE] p-4 border-t border-[#E3DED5]">
            <span className="text-[11px] text-[#6F746F] font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-[#E3DED5] rounded-lg text-xs font-bold text-[#18201D] hover:bg-[#F7F4EE] transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-[#E3DED5] rounded-lg text-xs font-bold text-[#18201D] hover:bg-[#F7F4EE] transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default OrderHistoryTab;
