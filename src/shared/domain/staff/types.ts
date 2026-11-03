export interface IHandoverDoc {
  id?: string;
  handoverBy: string;
  handoverByName: string;
  handoverTo: string;
  handoverToName: string;
  handoverTime: string;
  handoverReason: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  tablesCount: number;
  ordersCount: number;
  requestsCount: number;
  tableIds: string[];
  orderIds: string[];
  requestIds: string[];
}

export type ShiftClosingStatus = 'pending' | 'approved' | 'rejected' | 'closed';

export interface IShiftClosingReport {
  tablesServed: number;
  ordersDelivered: number;
  revenue: number;
  cashTotal: number;
  cardTotal: number;
  upiTotal: number;
  tips: number;
  completedTasks: number;
  pendingTasks: number;
  incidents: number;
  avgServiceTime: string;
}

export interface IShiftClosingRequest {
  id: string;
  tenantId: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  role: string;
  status: ShiftClosingStatus;
  createdAt: string;
  notes?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string;
  closedAt?: string | null;
  report: IShiftClosingReport;
}
