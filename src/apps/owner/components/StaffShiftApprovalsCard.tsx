import React, { useState } from 'react';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Modal from '../../../components/ui/Modal/Modal';
import { formatPrice } from '../../../utils/format';
import toast from 'react-hot-toast';
import { 
  ClipboardCheck, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Printer, 
  Download, 
  User, 
  Wallet, 
  RotateCcw, 
  ShieldCheck, 
  X,
  CreditCard,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { shiftService } from '../../../shared/services/shiftService';
import { IShiftClosingRequest } from '../../../shared/domain/staff/types';
import { useAuth } from '../../../context/AuthContext';

interface StaffShiftApprovalsCardProps {
  requests: IShiftClosingRequest[];
  tenantId: string;
}

export const StaffShiftApprovalsCard: React.FC<StaffShiftApprovalsCardProps> = ({
  requests,
  tenantId,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<IShiftClosingRequest | null>(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detailModalReq, setDetailModalReq] = useState<IShiftClosingRequest | null>(null);

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved' || r.status === 'closed');
  
  const displayList = 
    activeTab === 'pending' 
      ? pendingRequests 
      : activeTab === 'approved' 
      ? approvedRequests 
      : requests;

  const handleApprove = async (req: IShiftClosingRequest) => {
    if (!tenantId || !req.id) return;
    setIsProcessing(true);
    const toastId = toast.loading(`Approving shift for ${req.staffName}...`);
    try {
      const reviewerName = user?.displayName || user?.email?.split('@')[0] || 'Manager';
      await shiftService.approveShiftClosing(tenantId, req.id, reviewerName, 'Shift closing verified and cash collection signed off.');
      toast.success(`Shift closing approved for ${req.staffName}! Cash handover: ${formatPrice(req.report.cashTotal)}.`, { id: toastId });
    } catch (e: any) {
      console.error('Error approving shift:', e);
      toast.error('Failed to approve shift: ' + (e?.message || 'Error'), { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenRevision = (req: IShiftClosingRequest) => {
    setSelectedReq(req);
    setRevisionReason('');
    setRevisionModalOpen(true);
  };

  const handleConfirmRevision = async () => {
    if (!selectedReq || !tenantId) return;
    if (!revisionReason.trim()) {
      toast.error('Please provide a reason or instruction for the staff member.');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Sending revision request to staff member...');
    try {
      const reviewerName = user?.displayName || user?.email?.split('@')[0] || 'Manager';
      await shiftService.rejectShiftClosing(tenantId, selectedReq.id, reviewerName, revisionReason);
      toast.success(`Revision note sent to ${selectedReq.staffName}.`, { id: toastId });
      setRevisionModalOpen(false);
      setSelectedReq(null);
    } catch (e: any) {
      console.error('Error requesting revision:', e);
      toast.error('Failed to request revision: ' + (e?.message || 'Error'), { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceClose = async (req: IShiftClosingRequest) => {
    if (!tenantId || !req.id) return;
    setIsProcessing(true);
    const toastId = toast.loading('Archiving shift closing record...');
    try {
      await shiftService.closeAndArchiveShift(tenantId, req.id, req.staffId);
      toast.success(`Shift for ${req.staffName} archived successfully.`, { id: toastId });
    } catch (e: any) {
      toast.error('Failed to archive: ' + (e?.message || 'Error'), { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const printBreakdown = (req: IShiftClosingRequest) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Shift Closing Audit - ${req.staffName}</title>
            <style>
              body { font-family: monospace; padding: 25px; text-align: left; }
              .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 15px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
              .cash-box { border: 2px dashed #000; padding: 12px; margin: 15px 0; background: #fafafa; }
              .divider { border-bottom: 1px dashed #777; margin: 15px 0; }
              .sig { margin-top: 50px; display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>MANAGER SHIFT CLOSING AUDIT</h2>
              <p>Staff: <strong>${req.staffName}</strong> (${req.role.toUpperCase()})</p>
              <p>Email: ${req.staffEmail}</p>
              <p>Requested: ${new Date(req.createdAt).toLocaleString()}</p>
              <p>Status: <strong>${req.status.toUpperCase()}</strong></p>
            </div>
            <div class="row"><span>Tables Served:</span> <span>${req.report.tablesServed}</span></div>
            <div class="row"><span>Orders Delivered:</span> <span>${req.report.ordersDelivered}</span></div>
            <div class="row"><span>Average Service Duration:</span> <span>${req.report.avgServiceTime}</span></div>
            <div class="row"><span>Completed Tasks:</span> <span>${req.report.completedTasks}</span></div>
            <div class="row"><span>Reported Incidents:</span> <span>${req.report.incidents}</span></div>
            <div class="divider"></div>
            <div class="row"><span>Total Gross Sales:</span> <span>${formatPrice(req.report.revenue)}</span></div>
            <div class="row"><span>Card Receipts:</span> <span>${formatPrice(req.report.cardTotal)}</span></div>
            <div class="row"><span>UPI Receipts:</span> <span>${formatPrice(req.report.upiTotal)}</span></div>
            <div class="row"><span>Estimated Tips:</span> <span>${formatPrice(req.report.tips)}</span></div>
            <div class="cash-box">
              <div class="row" style="font-weight: bold; font-size: 16px;">
                <span>CASH TO COLLECT / DRAWER HANDOVER:</span>
                <span>${formatPrice(req.report.cashTotal)}</span>
              </div>
            </div>
            ${req.reviewedBy ? `
              <div class="row"><span>Approved By:</span> <span>${req.reviewedBy}</span></div>
              <div class="row"><span>Approval Time:</span> <span>${req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : ''}</span></div>
              <div class="row"><span>Manager Note:</span> <span>${req.reviewNotes || 'None'}</span></div>
            ` : ''}
            <div class="sig">
              <div>Staff Signature: __________________</div>
              <div>Manager Signature: __________________</div>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <Card className="p-6 border border-[#E5E0D9] bg-white rounded-2xl shadow-sm text-left space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E0D9] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-display font-extrabold text-[#17202A]">
                Staff Shift Closing & Cash Handover Approvals
              </h2>
              {pendingRequests.length > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                  {pendingRequests.length} Pending Approval
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  All Shifts Balanced
                </span>
              )}
            </div>
            <p className="text-xs text-[#7B8794] mt-0.5">
              Review waiter shift sign-off summaries, collect physical cash drawer handovers, and approve end-of-shift checkouts.
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-[#F8F9FA] p-1 rounded-xl border border-[#E5E0D9] self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-[#17202A] shadow-xs'
                : 'text-[#7B8794] hover:text-[#17202A]'
            }`}
          >
            Pending ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'approved'
                ? 'bg-white text-[#17202A] shadow-xs'
                : 'text-[#7B8794] hover:text-[#17202A]'
            }`}
          >
            Approved ({approvedRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'all'
                ? 'bg-white text-[#17202A] shadow-xs'
                : 'text-[#7B8794] hover:text-[#17202A]'
            }`}
          >
            All ({requests.length})
          </button>
        </div>
      </div>

      {/* List of Requests */}
      {displayList.length === 0 ? (
        <div className="py-10 text-center space-y-2 bg-[#FAFAF8] rounded-xl border border-dashed border-[#E5E0D9]">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-[#17202A]">No shift closing requests in this view</h4>
          <p className="text-xs text-[#7B8794] max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'No staff members are currently waiting for shift sign-off. When a waiter submits their daily report, it will appear here in real time.'
              : 'No past shift closing logs found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayList.map((req) => {
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';
            const isClosed = req.status === 'closed';

            return (
              <div
                key={req.id}
                className={`p-4 md:p-5 rounded-2xl border transition-all ${
                  isPending
                    ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-200'
                    : isApproved
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isRejected
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-[#E5E0D9] bg-[#FAFAF8]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Staff info and Request metadata */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
                        {req.staffName?.slice(0, 2).toUpperCase() || 'ST'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#17202A]">{req.staffName}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 uppercase">
                            {req.role}
                          </span>
                          {isPending && (
                            <Badge variant="warning" className="text-[10px] font-bold flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3" />
                              Awaiting Sign-off
                            </Badge>
                          )}
                          {isApproved && (
                            <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Approved by Manager
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="danger" className="text-[10px] font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Revision Requested
                            </Badge>
                          )}
                          {isClosed && (
                            <Badge variant="muted" className="text-[10px] font-bold">
                              Shift Archived
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-[#7B8794]">
                          {req.staffEmail} • Submitted {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(req.createdAt).toLocaleDateString()})
                        </span>
                      </div>
                    </div>

                    {req.reviewNotes && (
                      <div className="text-xs text-[#5F6875] bg-white/80 p-2.5 rounded-xl border border-[#E5E0D9] max-w-xl">
                        <strong className="text-[#17202A]">Manager Note:</strong> {req.reviewNotes}
                      </div>
                    )}
                  </div>

                  {/* Middle: Financial & Cash Handover Callout */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Primary Cash Drawer Collection Box */}
                    <div className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl shadow-xs flex items-center gap-3 min-w-[200px]">
                      <div className="p-2 bg-emerald-700/60 rounded-lg">
                        <Wallet className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-100">
                          Cash to Collect
                        </span>
                        <span className="text-base font-mono font-black block">
                          {formatPrice(req.report?.cashTotal || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-semibold bg-white p-2.5 rounded-xl border border-[#E5E0D9]">
                      <div>
                        <span className="text-[10px] text-[#7B8794] block">Total Shift Sales</span>
                        <span className="font-extrabold text-[#17202A] font-mono">
                          {formatPrice(req.report?.revenue || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#7B8794] block">Tables / Deliveries</span>
                        <span className="font-extrabold text-[#17202A]">
                          {req.report?.tablesServed || 0} tbls · {req.report?.ordersDelivered || 0} ord
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approve Shift</span>
                        </button>
                        <button
                          onClick={() => handleOpenRevision(req)}
                          disabled={isProcessing}
                          className="px-3 py-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Revision</span>
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handleForceClose(req)}
                        disabled={isProcessing}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all"
                        title="Archive and lock shift immediately"
                      >
                        Force Archive
                      </button>
                    )}

                    <button
                      onClick={() => printBreakdown(req)}
                      className="p-2 bg-white border border-[#E5E0D9] text-[#17202A] hover:bg-[#F8F9FA] rounded-xl shadow-2xs transition-all"
                      title="Print Shift Receipt"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDetailModalReq(req)}
                      className="p-2 bg-white border border-[#E5E0D9] text-[#17202A] hover:bg-[#F8F9FA] rounded-xl shadow-2xs transition-all text-xs font-bold"
                      title="View Full Shift Breakdown"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Revision Request Modal */}
      <Modal
        isOpen={revisionModalOpen}
        onClose={() => setRevisionModalOpen(false)}
        title={`Request Shift Revision: ${selectedReq?.staffName || 'Staff'}`}
      >
        <div className="space-y-4 text-left text-xs">
          <p className="text-[#5F6875]">
            Specify the discrepancy or reason requiring staff action before shift sign-off (e.g., cash drawer shortage, unserved open orders, or unassigned tables):
          </p>
          <textarea
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            rows={3}
            placeholder="e.g. Please verify Table 3 cash bill payment and re-count cash drawer (short by ₹50)..."
            className="w-full p-3 border border-[#E5E0D9] rounded-xl text-xs text-[#17202A] focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevisionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRevision}
              disabled={isProcessing}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Send Revision Notice
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detailed Report Modal */}
      {detailModalReq && (
        <Modal
          isOpen={!!detailModalReq}
          onClose={() => setDetailModalReq(null)}
          title={`Shift Audit Breakdown: ${detailModalReq.staffName}`}
        >
          <div className="space-y-4 text-left text-xs">
            <div className="p-3 bg-[#FAFAF8] rounded-xl border border-[#E5E0D9] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#7B8794]">Staff Member:</span>
                <span className="font-bold text-[#17202A]">{detailModalReq.staffName} ({detailModalReq.role})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7B8794]">Requested At:</span>
                <span className="font-bold text-[#17202A]">{new Date(detailModalReq.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7B8794]">Current Status:</span>
                <Badge variant={detailModalReq.status === 'approved' ? 'success' : detailModalReq.status === 'pending' ? 'warning' : 'muted'}>
                  {detailModalReq.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="border border-[#E5E0D9] rounded-xl p-4 space-y-2.5">
              <h4 className="font-extrabold text-xs text-[#17202A] uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Financial & Payment Details</span>
              </h4>
              <div className="flex justify-between border-b border-[#E5E0D9] pb-1.5">
                <span className="text-[#5F6875]">Total Gross Revenue:</span>
                <span className="font-extrabold text-[#17202A] font-mono">{formatPrice(detailModalReq.report?.revenue || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-[#E5E0D9] pb-1.5 bg-emerald-50/50 p-1.5 rounded-lg">
                <span className="font-bold text-emerald-900">Physical Cash Handover:</span>
                <span className="font-black text-emerald-700 font-mono text-sm">{formatPrice(detailModalReq.report?.cashTotal || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-[#E5E0D9] pb-1.5">
                <span className="text-[#5F6875]">Card Payments:</span>
                <span className="font-mono text-[#17202A]">{formatPrice(detailModalReq.report?.cardTotal || 0)}</span>
              </div>
              <div className="flex justify-between border-b border-[#E5E0D9] pb-1.5">
                <span className="text-[#5F6875]">UPI / QR Payments:</span>
                <span className="font-mono text-[#17202A]">{formatPrice(detailModalReq.report?.upiTotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F6875]">Tips Logged:</span>
                <span className="font-mono text-[#17202A]">{formatPrice(detailModalReq.report?.tips || 0)}</span>
              </div>
            </div>

            {/* Operational metrics */}
            <div className="border border-[#E5E0D9] rounded-xl p-4 space-y-2">
              <h4 className="font-extrabold text-xs text-[#17202A] uppercase tracking-wider">Operational Volume</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-[#FAFAF8] rounded-lg">
                  <span className="text-[10px] text-[#7B8794] block">Tables Served</span>
                  <span className="font-bold text-[#17202A]">{detailModalReq.report?.tablesServed || 0}</span>
                </div>
                <div className="p-2 bg-[#FAFAF8] rounded-lg">
                  <span className="text-[10px] text-[#7B8794] block">Orders Delivered</span>
                  <span className="font-bold text-[#17202A]">{detailModalReq.report?.ordersDelivered || 0}</span>
                </div>
                <div className="p-2 bg-[#FAFAF8] rounded-lg">
                  <span className="text-[10px] text-[#7B8794] block">Tasks Resolved</span>
                  <span className="font-bold text-[#17202A]">{detailModalReq.report?.completedTasks || 0}</span>
                </div>
                <div className="p-2 bg-[#FAFAF8] rounded-lg">
                  <span className="text-[10px] text-[#7B8794] block">Incidents</span>
                  <span className="font-bold text-red-700">{detailModalReq.report?.incidents || 0}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => printBreakdown(detailModalReq)}
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print Audit Slip
              </Button>
              <Button
                size="sm"
                onClick={() => setDetailModalReq(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
};

export default StaffShiftApprovalsCard;

