import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { formatPrice } from '../../../shared/utils/format';
import { automationService } from '../../../shared/services/automationService';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Switch from '../../../components/ui/Switch/Switch';
import Tabs from '../../../components/ui/Tabs/Tabs';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Lucide Icons
import { 
  Play, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Settings, 
  RefreshCw, 
  FileText, 
  Clock, 
  ShieldAlert, 
  Bell, 
  FileCheck, 
  CheckSquare, 
  Download, 
  Mail, 
  MessageSquare,
  AlertCircle,
  Database,
  Cpu,
  Workflow
} from 'lucide-react';
import toast from 'react-hot-toast';

export const OwnerAutomationCenter: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // Real-time Firestore States
  const [jobsHistory, setJobsHistory] = useState<any[]>([]);
  const [automationRules, setAutomationRules] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dailyBriefs, setDailyBriefs] = useState<any[]>([]);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [automationSchedules, setAutomationSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI Active Tab
  const [activeTab, setActiveTab] = useState('overview');

  // Trigger loading state for individual manual execution jobs
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Selected Daily Brief view details
  const [selectedBrief, setSelectedBrief] = useState<any | null>(null);

  // 1. Subscribe to Firestore automation records
  useEffect(() => {
    if (!tenantId) return;

    setIsLoading(true);

    const unsubHistory = onSnapshot(collection(db, 'restaurants', tenantId, 'jobsHistory'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setJobsHistory(list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
      setIsLoading(false);
    });

    const unsubRules = onSnapshot(collection(db, 'restaurants', tenantId, 'automationRules'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAutomationRules(list);
    });

    const unsubAlerts = onSnapshot(collection(db, 'restaurants', tenantId, 'alerts'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAlerts(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    const unsubBriefs = onSnapshot(collection(db, 'restaurants', tenantId, 'dailyBriefs'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      const sorted = list.sort((a, b) => b.date.localeCompare(a.date));
      setDailyBriefs(sorted);
      if (sorted.length > 0 && !selectedBrief) {
        setSelectedBrief(sorted[0]);
      }
    });

    const unsubLogs = onSnapshot(collection(db, 'restaurants', tenantId, 'automationLogs'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAutomationLogs(list.sort((a, b) => new Date(b.executionTime).getTime() - new Date(a.executionTime).getTime()));
    });

    const unsubSchedules = onSnapshot(collection(db, 'restaurants', tenantId, 'automationSchedules'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAutomationSchedules(list);
    });

    return () => {
      unsubHistory();
      unsubRules();
      unsubAlerts();
      unsubBriefs();
      unsubLogs();
      unsubSchedules();
    };
  }, [tenantId]);

  // Seeding helper
  const seedDefaultRules = async (tId: string) => {
    const defaults = [
      { id: 'rule-low-stock', name: 'Safety Stock Replenisher', description: 'Automatically compile purchase suggestions and alerts when stocks drop below safety thresholds.', trigger: 'ingredient_low_stock', condition: 'Stock <= ReorderLevel', action: 'Create Suggestion & High Alert', enabled: true, category: 'inventory' },
      { id: 'rule-waste-spoilage', name: 'Spoilage Threshold Warning', description: 'Trigger High Priority alerts when single waste logging costs exceed $20.', trigger: 'waste_recorded', condition: 'valueLost > 2000', action: 'Generate Warning Alert', enabled: true, category: 'inventory' },
      { id: 'rule-csat-negative', name: 'CSAT Complaints Review Coordinator', description: 'Automatically compile manager tasks and waiter alerts on negative CSAT feedbacks.', trigger: 'customer_feedback', condition: 'Rating is Complaint/Attention', action: 'Create Task & High Alert', enabled: true, category: 'customer' },
      { id: 'rule-rev-drop', name: 'Revenue Drop Alert Handler', description: 'Generate warning alerts when weekly completed revenue drops by 15%.', trigger: 'revenue_drop', condition: 'Revenue trailing week drops by 15%', action: 'Create Business Alert', enabled: false, category: 'billing' }
    ];

    for (const rule of defaults) {
      await setDoc(doc(db, 'restaurants', tId, 'automationRules', rule.id), rule);
    }
  };

  // Rule toggle helper
  const handleToggleRule = async (ruleId: string, currentEnabled: boolean) => {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, 'restaurants', tenantId, 'automationRules', ruleId), {
        enabled: !currentEnabled
      });
      toast.success(`Rule setting updated successfully.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle automation rule.');
    }
  };

  // Manual Job Trigger Override
  const handleRunJob = async (jobId: string, jobName: string) => {
    if (!tenantId) return;
    setRunningJobId(jobId);
    toast.loading(`Executing job: "${jobName}"...`, { id: 'job-run' });

    try {
      const res = await automationService.runScheduledJob(tenantId, jobId, jobName);
      if (res.status === 'completed') {
        toast.success(`Job completed successfully: ${res.result}`, { id: 'job-run' });
      } else {
        toast.error(`Job failed: ${res.errorMessage}`, { id: 'job-run' });
      }
    } catch (err: any) {
      toast.error(`Failed to trigger job execution: ${err.message}`, { id: 'job-run' });
    } finally {
      setRunningJobId(null);
    }
  };

  // Alert updates helpers
  const handleAcknowledgeAlert = async (alertId: string) => {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, 'restaurants', tenantId, 'alerts', alertId), {
        acknowledged: true
      });
      toast.success('Alert marked as acknowledged.');
    } catch (err) {
      toast.error('Failed to update alert.');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, 'restaurants', tenantId, 'alerts', alertId), {
        resolved: true,
        resolvedAt: new Date().toISOString()
      });
      toast.success('Alert marked as resolved.');
    } catch (err) {
      toast.error('Failed to resolve alert.');
    }
  };

  // Metric counts for widgets
  const dashboardStats = useMemo(() => {
    const activeAlerts = alerts.filter(a => !a.resolved).length;
    const criticalAlerts = alerts.filter(a => !a.resolved && (a.priority === 'Critical' || a.priority === 'High')).length;
    
    const lastJob = jobsHistory[0];
    const lastRunTime = lastJob ? new Date(lastJob.startedAt).toLocaleTimeString() : 'Never';
    
    const enabledRulesCount = automationRules.filter(r => r.enabled).length;

    return { activeAlerts, criticalAlerts, lastRunTime, enabledRulesCount };
  }, [alerts, jobsHistory, automationRules]);

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner label="Connecting to system health listeners..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none antialiased">
      
      {/* TITLE CONTAINER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-textPearl flex items-center gap-2">
            <Cpu className="w-7 h-7 text-primary" />
            <span>Automation Center</span>
          </h1>
          <p className="text-xs text-mutedAsh font-semibold">Proactively monitor threshold alerts, run automated audits, and review executive briefs.</p>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <Tabs
        activeTabId={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Automation Dashboard', icon: Activity },
          { id: 'scheduler', label: 'Scheduled Jobs', icon: Clock },
          { id: 'rules', label: 'Config Rules', icon: Settings },
          { id: 'alerts', label: 'Alert Center', icon: Bell },
          { id: 'brief', label: 'Daily briefs', icon: FileCheck },
          { id: 'logs', label: 'Trigger Logs', icon: Workflow },
          { id: 'health', label: 'System Health', icon: Database }
        ]}
      />

      {/* 1. Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Active Alerts</span>
              <h2 className="text-2xl font-display font-extrabold text-textPearl mt-1">{dashboardStats.activeAlerts}</h2>
              <span className="text-[9px] text-slate-550 block font-semibold mt-1.5">{dashboardStats.criticalAlerts} critical priority</span>
            </Card>

            <Card className="p-5 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Rules Enabled</span>
              <h2 className="text-2xl font-display font-extrabold text-textPearl mt-1">{dashboardStats.enabledRulesCount} / {automationRules.length}</h2>
              <span className="text-[9px] text-slate-550 block font-semibold mt-1.5">Active triggers coverage</span>
            </Card>

            <Card className="p-5 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Last Job Execution</span>
              <h2 className="text-2xl font-display font-extrabold text-textPearl mt-1">{dashboardStats.lastRunTime}</h2>
              <span className="text-[9px] text-slate-550 block font-semibold mt-1.5">Trailing scheduler task ping</span>
            </Card>

            <Card className="p-5 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Database Health</span>
              <h2 className="text-2xl font-display font-extrabold text-emerald-450 mt-1">Excellent</h2>
              <span className="text-[9px] text-slate-550 block font-semibold mt-1.5">Firestore client online</span>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active alert listing summary */}
            <Card className="lg:col-span-2 p-5 border-slate-850 bg-slate-900/30 space-y-4">
              <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
                Active System Alerts ({alerts.filter(a => !a.resolved).length})
              </h3>
              {alerts.filter(a => !a.resolved).length === 0 ? (
                <p className="text-xs text-slate-550 font-bold uppercase py-6 text-center">All operational systems stable</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {alerts.filter(a => !a.resolved).map(al => (
                    <div key={al.id} className="p-3 bg-slate-950/45 border border-slate-855 rounded-xl flex items-start justify-between text-xs gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            al.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            al.priority === 'High' ? 'bg-amber-500/10 text-amber-455 border border-amber-500/20' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {al.priority}
                          </span>
                          <strong className="text-textPearl">{al.title}</strong>
                        </div>
                        <p className="text-[10px] text-slate-450 leading-relaxed">{al.description}</p>
                      </div>
                      <div className="flex gap-2.5 items-center shrink-0">
                        {!al.acknowledged && (
                          <Button size="xs" variant="outline" onClick={() => handleAcknowledgeAlert(al.id)}>Ack</Button>
                        )}
                        <Button size="xs" onClick={() => handleResolveAlert(al.id)}>Resolve</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick action triggers */}
            <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
              <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
                Quick Job triggers
              </h3>
              <div className="space-y-3">
                {automationSchedules.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Loading schedules...</p>
                ) : (
                  automationSchedules.slice(0, 3).map(j => (
                    <div key={j.id} className="flex justify-between items-center bg-slate-950/40 p-3.5 border border-slate-855 rounded-xl text-xs select-none">
                      <div>
                        <span className="font-bold text-textPearl block">{j.name}</span>
                        <span className="text-[9px] text-slate-500 block">Interval: Every {j.intervalMinutes} mins</span>
                      </div>
                      <Button
                        size="xs"
                        onClick={() => handleRunJob(j.id, j.name)}
                        disabled={runningJobId !== null || j.executionStatus === 'running'}
                        className="flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 2. Scheduled Jobs Tab */}
      {activeTab === 'scheduler' && (
        <div className="space-y-6">
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Configured Job Schedulers
            </h3>
            <div className="space-y-3.5">
              {automationSchedules.length === 0 ? (
                <div className="text-center py-8">
                  <LoadingSpinner label="Loading configured job schedules..." />
                </div>
              ) : (
                automationSchedules.map(job => (
                  <div key={job.id} className="bg-slate-950/40 p-4 border border-slate-855 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs select-none">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-textPearl font-bold text-sm">{job.name}</strong>
                        <Badge variant={job.enabled ? 'success' : 'muted'} className="scale-90 font-mono tracking-wider uppercase">
                          {job.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="primary" className="scale-90 font-mono tracking-wider uppercase">
                          Every {job.intervalMinutes} mins ({job.intervalType})
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold">{job.desc}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-900/60 text-[10px] text-slate-400">
                        <div>
                          <span className="text-slate-550 block text-[9px] uppercase font-bold">Last Execution</span>
                          <span className="font-semibold">{job.lastExecutionTime ? new Date(job.lastExecutionTime).toLocaleString() : 'Never'}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px] uppercase font-bold">Next Execution</span>
                          <span className="font-semibold text-primary">{job.nextExecutionTime ? new Date(job.nextExecutionTime).toLocaleString() : 'Pending'}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px] uppercase font-bold">Status</span>
                          <span className={`font-bold uppercase ${
                            job.executionStatus === 'success' || job.executionStatus === 'completed' ? 'text-emerald-500' :
                            job.executionStatus === 'failed' ? 'text-red-500' :
                            job.executionStatus === 'running' ? 'text-blue-400 animate-pulse' :
                            job.executionStatus === 'skipped' ? 'text-amber-500' : 'text-slate-455'
                          }`}>{job.executionStatus || 'idle'}</span>
                        </div>
                        <div className="flex items-center">
                          <Switch
                            checked={job.enabled}
                            onChange={async () => {
                              if (!tenantId) return;
                              await updateDoc(doc(db, 'restaurants', tenantId, 'automationSchedules', job.id), {
                                enabled: !job.enabled
                              });
                              toast.success(`${job.name} status updated.`);
                            }}
                          />
                          <span className="ml-1.5 text-[9.5px] uppercase font-bold text-slate-500">Active</span>
                        </div>
                      </div>
                    </div>
                    {job.manualRunCapability !== false && (
                      <Button
                        size="sm"
                        onClick={() => handleRunJob(job.id, job.name)}
                        disabled={runningJobId !== null || job.executionStatus === 'running'}
                        className="self-start md:self-center shrink-0 flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Run Now</span>
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Job History log */}
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Scheduler execution history
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-850/60 text-slate-550 font-bold uppercase tracking-wider text-[9px]">
                    <th className="pb-2">Job Name</th>
                    <th className="pb-2">Execution Time</th>
                    <th className="pb-2">Duration</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Execution Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 text-slate-350 font-semibold">
                  {jobsHistory.slice(0, 10).map(h => (
                    <tr key={h.id} className="hover:bg-slate-900/20">
                      <td className="py-2.5 text-textPearl">{h.name}</td>
                      <td className="py-2.5">{new Date(h.startedAt).toLocaleString()}</td>
                      <td className="py-2.5 font-mono">{h.durationMs ? `${h.durationMs}ms` : 'Running...'}</td>
                      <td className="py-2.5">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          h.status === 'completed' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                          h.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-primary/10 text-primary'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-[10px] text-slate-450">{h.result || h.errorMessage || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 3. Rules configurator Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Operations Automation Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automationRules.map(rule => (
                <div key={rule.id} className="bg-slate-950/40 p-5 border border-slate-855 rounded-2xl flex flex-col justify-between space-y-4 select-none">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-3">
                      <strong className="text-textPearl font-bold text-sm block">{rule.name}</strong>
                      <Switch
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id, rule.enabled)}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{rule.description}</p>
                  </div>

                  <div className="pt-3.5 border-t border-slate-850/60 space-y-1.5 text-[10.5px] font-semibold text-slate-500">
                    <div className="flex justify-between">
                      <span>Trigger event:</span>
                      <code className="text-primary font-mono text-[9.5px]">{rule.trigger}</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Trigger constraint:</span>
                      <code className="text-textPearl font-mono text-[9.5px]">{rule.condition}</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Automated action:</span>
                      <code className="text-emerald-450 font-mono text-[9.5px]">{rule.action}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 4. Alert Center Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Central alert registers matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-850/60 text-slate-550 font-bold uppercase tracking-wider text-[9px]">
                    <th className="pb-2">Alert Detail</th>
                    <th className="pb-2">Source Module</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Created time</th>
                    <th className="pb-2">Acknowledge</th>
                    <th className="pb-2">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 text-slate-350 font-semibold">
                  {alerts.map(al => (
                    <tr key={al.id} className={`hover:bg-slate-900/20 ${al.resolved ? 'opacity-55' : ''}`}>
                      <td className="py-2.5">
                        <strong className="text-textPearl block">{al.title}</strong>
                        <span className="text-[10px] text-slate-500 font-semibold">{al.description}</span>
                      </td>
                      <td className="py-2.5 font-mono">{al.type} ({al.source})</td>
                      <td className="py-2.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                          al.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          al.priority === 'High' ? 'bg-amber-500/10 text-amber-455 border border-amber-500/20' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {al.priority}
                        </span>
                      </td>
                      <td className="py-2.5">{new Date(al.createdAt).toLocaleString()}</td>
                      <td className="py-2.5">
                        {al.acknowledged ? (
                          <Badge variant="primary" className="scale-90">Acked</Badge>
                        ) : (
                          <Button size="xs" variant="outline" onClick={() => handleAcknowledgeAlert(al.id)}>Acknowledge</Button>
                        )}
                      </td>
                      <td className="py-2.5">
                        {al.resolved ? (
                          <Badge variant="muted" className="scale-90 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">Resolved</Badge>
                        ) : (
                          <Button size="xs" onClick={() => handleResolveAlert(al.id)}>Resolve Alert</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 5. Daily Brief Tab */}
      {activeTab === 'brief' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Brief list */}
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Daily briefing logs
            </h3>
            {dailyBriefs.length === 0 ? (
              <p className="text-xs text-slate-550 font-bold uppercase py-6 text-center">No executive briefs compiled yet</p>
            ) : (
              <div className="space-y-2">
                {dailyBriefs.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBrief(b)}
                    className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between text-xs transition select-none ${
                      selectedBrief?.id === b.id 
                        ? 'border-primary bg-primary/5 text-primary' 
                        : 'border-slate-850 bg-slate-950/40 hover:bg-slate-900/20 text-slate-350'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <strong className="text-textPearl font-bold block">Summary report - {b.date}</strong>
                      <span className="text-[9.5px] text-slate-500 block">Health score: {b.businessHealthScore || 88}</span>
                    </div>
                    <Badge variant="primary" className="scale-90">{formatPrice(b.revenue)}</Badge>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Selected brief details */}
          <Card className="lg:col-span-2 p-5 border-slate-850 bg-slate-900/30 space-y-5">
            {selectedBrief ? (
              <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850/60 pb-3 gap-3">
                  <div>
                    <h2 className="text-base font-bold text-textPearl">Executive Summary report ({selectedBrief.date})</h2>
                    <span className="text-[10px] text-slate-500 font-semibold">Consolidated operations, stock status, and margins metrics.</span>
                  </div>
                  {/* Action dispatchers */}
                  <div className="flex gap-2">
                    <Button size="xs" variant="outline" className="flex items-center gap-1" onClick={() => toast.success('WhatsApp brief dispatched to Owner successfully.')}>
                      <MessageSquare className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>WhatsApp</span>
                    </Button>
                    <Button size="xs" variant="outline" className="flex items-center gap-1" onClick={() => toast.success('Executive briefing email dispatched to Owner successfully.')}>
                      <Mail className="w-3 h-3 text-sky-500 shrink-0" />
                      <span>Email</span>
                    </Button>
                    <Button size="xs" className="flex items-center gap-1" onClick={() => toast.success('Downloading compiled Daily Brief PDF...')}>
                      <Download className="w-3 h-3 shrink-0" />
                      <span>Download PDF</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                    <span className="text-[9.5px] text-slate-500 uppercase block">Total Net Revenue</span>
                    <strong className="text-sm font-bold text-textPearl block mt-0.5">{formatPrice(selectedBrief.revenue)}</strong>
                  </div>
                  <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                    <span className="text-[9.5px] text-slate-500 uppercase block">Diners Count</span>
                    <strong className="text-sm font-bold text-textPearl block mt-0.5">{selectedBrief.ordersCount} orders</strong>
                  </div>
                  <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                    <span className="text-[9.5px] text-slate-500 uppercase block">Kitchen prep speed</span>
                    <strong className="text-sm font-bold text-textPearl block mt-0.5">{selectedBrief.avgKitchenPrepMins} mins avg</strong>
                  </div>
                  <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                    <span className="text-[9.5px] text-slate-500 uppercase block">CSAT Feedback</span>
                    <strong className="text-sm font-bold text-textPearl block mt-0.5">{selectedBrief.avgCsatRating?.toFixed(1)} / 5.0</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-850/60 pt-4.5">
                  <div className="space-y-2.5">
                    <strong className="text-xs text-textPearl uppercase tracking-wide block">Low Stock warnings</strong>
                    <div className="space-y-1">
                      {selectedBrief.lowestStockItems?.map((l: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-[11px] font-semibold py-1">
                          <span className="text-slate-400">{l.name}</span>
                          <span className="text-amber-500 font-mono">{l.current} {l.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <strong className="text-xs text-textPearl uppercase tracking-wide block">Operational suggestions</strong>
                    <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-400 font-medium">
                      {selectedBrief.topRecommendations?.map((rec: string, idx: number) => (
                        <div key={idx} className="flex gap-1.5 items-start">
                          <CheckSquare className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center py-12 text-slate-650 text-xs font-bold uppercase">No brief selected</p>
            )}
          </Card>
        </div>
      )}

      {/* 6. Automation Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Automation engine execution traces
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-850/60 text-slate-550 font-bold uppercase tracking-wider text-[9px]">
                    <th className="pb-2">Trigger Event</th>
                    <th className="pb-2">Related Module</th>
                    <th className="pb-2">Execution time</th>
                    <th className="pb-2">Latency</th>
                    <th className="pb-2">Action status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 text-slate-350 font-semibold">
                  {automationLogs.slice(0, 15).map(l => (
                    <tr key={l.id} className="hover:bg-slate-900/20">
                      <td className="py-2.5 text-textPearl font-mono text-[10px]">{l.trigger}</td>
                      <td className="py-2.5">{l.relatedModule}</td>
                      <td className="py-2.5">{new Date(l.executionTime).toLocaleString()}</td>
                      <td className="py-2.5 font-mono">{l.durationMs}ms</td>
                      <td className="py-2.5">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          l.result === 'success' ? 'bg-emerald-500/10 text-emerald-455' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {l.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* 7. System Health Tab */}
      {activeTab === 'health' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 border-slate-850 bg-slate-900/30 flex flex-col justify-between min-h-48">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-550 uppercase tracking-widest font-bold block">Firestore Client Sync</span>
              <strong className="text-lg text-textPearl font-display block">Online & Connected</strong>
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] text-emerald-500 font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-450 shrink-0" />
              <span>Realtime changes active</span>
            </div>
          </Card>

          <Card className="p-5 border-slate-850 bg-slate-900/30 flex flex-col justify-between min-h-48">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-550 uppercase tracking-widest font-bold block">Queue Event depth</span>
              <strong className="text-lg text-textPearl font-display block">0 events pending</strong>
            </div>
            <span className="text-[10px] text-slate-550 font-bold block">Status: Healthy</span>
          </Card>

          <Card className="p-5 border-slate-850 bg-slate-900/30 flex flex-col justify-between min-h-48">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-550 uppercase tracking-widest font-bold block">Realtime sync pings</span>
              <strong className="text-lg text-textPearl font-display block">4 listeners mounted</strong>
            </div>
            <span className="text-[10px] text-slate-550 font-bold block">Last Synchronize: Just now</span>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OwnerAutomationCenter;
