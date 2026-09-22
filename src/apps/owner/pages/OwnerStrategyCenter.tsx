import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { logEvent } from '../../../shared/services/eventEngine';
import { useAuth } from '../../../context/AuthContext';
import { formatPrice } from '../../../shared/utils/format';
import { strategyService } from '../../../shared/intelligence/strategy/strategyService';
import { intelligenceService } from '../../../shared/intelligence/services/intelligenceService';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Card from '../../../components/ui/Card/Card';
import Tabs from '../../../components/ui/Tabs/Tabs';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Lucide Icons
import { 
  Target, 
  DollarSign, 
  Percent, 
  Flame, 
  Award, 
  Plus, 
  Workflow,
  BrainCircuit
} from 'lucide-react';
import toast from 'react-hot-toast';

export const OwnerStrategyCenter: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  // Real-time Firestore States
  const [businessGoals, setBusinessGoals] = useState<any[]>([]);
  const [strategyPlans, setStrategyPlans] = useState<any[]>([]);
  const [intelData, setIntelData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'goals';
  });

  // Form states for creating a goal
  const [newGoalType, setNewGoalType] = useState<'revenue' | 'waste' | 'csat' | 'prep_time'>('revenue');
  const [newGoalTarget, setNewGoalTarget] = useState<string>('');

  // 1. Subscribe to Firestore databases
  useEffect(() => {
    if (!tenantId) return;

    setIsLoading(true);
    let goalsSnap: (() => void) | null = null;
    let plansSnap: (() => void) | null = null;

    // Initial compile of intelligence context first
    const loadIntel = async () => {
      try {
        const payload = await intelligenceService.compileIntelligence(tenantId);
        setIntelData(payload);

        // Listen to business goals
        goalsSnap = onSnapshot(collection(db, 'restaurants', tenantId, 'businessGoals'), (snap) => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          setBusinessGoals(list);
          setIsLoading(false);
        });

        // Listen to strategy plans
        plansSnap = onSnapshot(collection(db, 'restaurants', tenantId, 'strategyPlans'), (snap) => {
          const list: any[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() }));
          setStrategyPlans(list);
        });

      } catch (err) {
        console.error(err);
        toast.error('Failed to compile context params.');
        setIsLoading(false);
      }
    };

    loadIntel();

    return () => {
      if (goalsSnap) goalsSnap();
      if (plansSnap) plansSnap();
    };
  }, [tenantId]);

  // Seeding helpers
  const seedDefaultGoals = async (tId: string, contextObj: any) => {
    const defaults = [
      { id: 'goal-revenue', type: 'revenue', targetValue: 200000, currentValue: contextObj.revenueToday, unit: 'cents', status: 'active', createdAt: new Date().toISOString() },
      { id: 'goal-csat', type: 'csat', targetValue: 4.9, currentValue: contextObj.avgCsatRating, unit: 'stars', status: 'active', createdAt: new Date().toISOString() },
      { id: 'goal-prep', type: 'prep_time', targetValue: 10, currentValue: contextObj.avgPrepTimeMins, unit: 'mins', status: 'active', createdAt: new Date().toISOString() }
    ];
    for (const goal of defaults) {
      await setDoc(doc(db, 'restaurants', tId, 'businessGoals', goal.id), goal);
    }
  };

  const seedDefaultStrategies = async (tId: string, payload: any) => {
    const list = await strategyService.generateStrategies(tId, payload.context, { lunchPeakHourRange: [13, 14], busiestDayOfWeek: 'Friday' });
    for (const plan of list) {
      await setDoc(doc(db, 'restaurants', tId, 'strategyPlans', plan.id), plan);
    }
  };

  // Add Goal handler
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newGoalTarget) return;

    const val = Number(newGoalTarget);
    if (isNaN(val) || val <= 0) {
      toast.error('Please input a valid target value.');
      return;
    }

    const id = `goal-${Date.now()}`;
    let unit = 'units';
    let startVal = 0;
    if (newGoalType === 'revenue') {
      unit = 'cents';
      startVal = intelData?.context?.revenueToday || 0;
    } else if (newGoalType === 'csat') {
      unit = 'stars';
      startVal = intelData?.context?.avgCsatRating || 4.8;
    } else if (newGoalType === 'prep_time') {
      unit = 'mins';
      startVal = intelData?.context?.avgPrepTimeMins || 12;
    } else if (newGoalType === 'waste') {
      unit = 'cents';
      startVal = intelData?.context?.totalWasteCost || 0;
    }

    const newGoal = {
      id,
      type: newGoalType,
      targetValue: newGoalType === 'revenue' || newGoalType === 'waste' ? val * 100 : val, // Convert to cents if revenue/waste
      currentValue: startVal,
      unit,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'restaurants', tenantId, 'businessGoals', id), newGoal);
      toast.success('New business target goal added successfully.');
      setNewGoalTarget('');
    } catch (err) {
      toast.error('Failed to create goal target.');
    }
  };

  // Evaluate goal progress manually
  const handleTrackProgress = async (goal: any) => {
    if (!tenantId || !intelData) return;
    try {
      const res = await strategyService.evaluateGoalProgress(tenantId, goal, intelData.context);
      if (res.status === 'achieved') {
        toast.success(`Goal Achieved! Target of ${res.targetValue} reached.`);
      } else {
        toast.success(`Progress evaluated. Current: ${res.currentValue.toFixed(1)} ${res.unit}.`);
      }
    } catch (err) {
      toast.error('Failed to evaluate goal progress.');
    }
  };

  // Strategy status transitions handlers
  const handleUpdateStrategyStatus = async (planId: string, nextStatus: 'accepted' | 'in_progress' | 'completed' | 'rejected') => {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, 'restaurants', tenantId, 'strategyPlans', planId), {
        status: nextStatus
      });

      const eventType = nextStatus === 'accepted' ? 'Strategy Accepted' : 
                        nextStatus === 'completed' ? 'Strategy Completed' : 'Strategy Updated';
      
      const desc = nextStatus === 'accepted' ? 'Owner accepted the proposed strategy.' :
                   nextStatus === 'completed' ? 'Operations Strategy completed successfully.' : 'Strategy updated.';

      logEvent(tenantId, {
        tenantId,
        eventType,
        eventCategory: 'Management',
        performedBy: user?.displayName || user?.email || 'Owner',
        performedByRole: 'owner',
        title: eventType,
        description: desc,
        metadata: { planId }
      });

      toast.success(`Strategy status updated to ${nextStatus}.`);
    } catch (err) {
      toast.error('Failed to update strategy status.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner label="Compiling strategic opportunities..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none antialiased">
      
      {/* HEADER CONTAINER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-textPearl flex items-center gap-2">
            <Target className="w-7 h-7 text-primary" />
            <span>Strategy Center</span>
          </h1>
          <p className="text-xs text-mutedAsh font-semibold">Generate growth strategies, track business goal parameters, and check return-on-investment (ROI).</p>
        </div>
      </div>

      {/* TABS MENU */}
      <Tabs
        activeTabId={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          { id: 'goals', label: 'Business Goals', icon: Target },
          { id: 'revenue', label: 'Revenue Growth', icon: DollarSign },
          { id: 'cost', label: 'Cost Optimization', icon: Percent },
          { id: 'marketing', label: 'Marketing Campaigns', icon: Flame },
          { id: 'retention', label: 'Customer Retention', icon: Award },
          { id: 'timeline', label: 'Execution timeline', icon: Workflow }
        ]}
      />

      {/* 1. Goals Tab */}
      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Goals Progress bars */}
          <Card className="lg:col-span-2 p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Active Business Goals
            </h3>
            <div className="space-y-4">
              {businessGoals.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                  <Target className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-semibold">No business goals configured yet.</p>
                  <p className="text-[10px] text-slate-500 mt-1">Define your first target goal using the form on the right.</p>
                </div>
              ) : (
                businessGoals.map(goal => {
                const labelMap = {
                  revenue: 'Increase Revenue Target',
                  csat: 'Boost Customer Satisfaction (CSAT)',
                  prep_time: 'Reduce KDS prep time',
                  waste: 'Reduce Spoilage waste cost'
                };
                
                const valTarget = goal.type === 'revenue' || goal.type === 'waste' ? goal.targetValue / 100 : goal.targetValue;
                const valCurrent = goal.type === 'revenue' || goal.type === 'waste' ? goal.currentValue / 100 : goal.currentValue;

                // progress percent
                let percent = 0;
                if (goal.type === 'prep_time' || goal.type === 'waste') {
                  // lower is better, calculate reverse percent
                  percent = valCurrent <= valTarget ? 100 : Math.round((valTarget / valCurrent) * 100);
                } else {
                  percent = Math.min(Math.round((valCurrent / valTarget) * 100), 100);
                }

                return (
                  <div key={goal.id} className="bg-slate-950/40 p-4 border border-slate-855 rounded-xl space-y-3.5 select-none">
                    <div className="flex justify-between items-start text-xs gap-3">
                      <div>
                        <strong className="text-textPearl font-bold block">{labelMap[goal.type as keyof typeof labelMap] || goal.type}</strong>
                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                          Target: {goal.type === 'revenue' || goal.type === 'waste' ? formatPrice(goal.targetValue) : `${goal.targetValue} ${goal.unit}`}
                          {' • '}
                          Current: {goal.type === 'revenue' || goal.type === 'waste' ? formatPrice(goal.currentValue) : `${goal.currentValue.toFixed(1)} ${goal.unit}`}
                        </span>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 border rounded uppercase ${
                          goal.status === 'achieved' 
                            ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' 
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {goal.status}
                        </span>
                        <Button size="xs" variant="outline" onClick={() => handleTrackProgress(goal)}>Sync Progress</Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-850">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            goal.status === 'achieved' ? 'bg-emerald-500' : 'bg-primary'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[9.5px] font-bold text-slate-650 block text-right">{percent}% completed</span>
                    </div>
                  </div>
                );
              }))}
            </div>
          </Card>

          {/* Goal Builder Form */}
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4 h-fit">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Define target goals
            </h3>
            <form onSubmit={handleAddGoal} className="space-y-4.5 text-xs select-none">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase block tracking-wider text-[9px]">Goal Metric Type</label>
                <select
                  value={newGoalType}
                  onChange={(e: any) => setNewGoalType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
                >
                  <option value="revenue">Completed Daily Revenue</option>
                  <option value="csat">Average Customer satisfaction (Stars)</option>
                  <option value="prep_time">Kitchen preparation time target (Mins)</option>
                  <option value="waste">Total Spoilage Waste Cost</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-500 uppercase block tracking-wider text-[9px]">Target Threshold value</label>
                <input
                  type="text"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  placeholder={newGoalType === 'revenue' || newGoalType === 'waste' ? 'e.g. 2000' : newGoalType === 'csat' ? 'e.g. 4.9' : 'e.g. 10'}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-primary rounded-xl p-3 text-xs font-semibold text-textPearl outline-none"
                />
              </div>

              <Button type="submit" className="w-full flex items-center justify-center gap-1.5 pt-3">
                <Plus className="w-4 h-4" />
                <span>Activate Target Goal</span>
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Categories Tabs Filter layouts */}
      {activeTab !== 'goals' && activeTab !== 'timeline' && (
        <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
          <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
            Suggested Strategic Action Plans ({strategyPlans.filter(p => p.category === activeTab).length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategyPlans.filter(p => p.category === activeTab).length === 0 ? (
              <div className="col-span-full py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                <BrainCircuit className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold">No strategy plans in this category yet.</p>
                <p className="text-[10px] text-slate-500 mt-1">Compile operational intelligence to generate customized consulting action plans.</p>
              </div>
            ) : (
              strategyPlans.filter(p => p.category === activeTab).map((plan: any) => (
              <div key={plan.id} className="bg-slate-950/40 p-5 border border-slate-855 rounded-2xl flex flex-col justify-between space-y-4 select-none">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-3">
                    <strong className="text-textPearl font-bold text-sm block leading-tight">{plan.title}</strong>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${
                      plan.status === 'completed' ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' :
                      plan.status === 'in_progress' ? 'bg-primary/10 text-primary border-primary/20' :
                      plan.status === 'accepted' ? 'bg-sky-500/10 text-sky-450 border-sky-500/20' :
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {plan.status}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">{plan.objective}</p>
                  
                  <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850/40 text-[10px] leading-relaxed text-slate-400 font-medium">
                    <strong className="text-textPearl block mb-0.5">Consultant reasoning:</strong>
                    {plan.reason}
                  </div>
                </div>

                {/* Plan Metrics ROI info */}
                <div className="grid grid-cols-3 gap-2 border-t border-slate-850/60 pt-3.5 text-center text-xs">
                  <div>
                    <span className="text-[8.5px] text-slate-550 block font-bold uppercase">Estimated Cost</span>
                    <strong className="text-textPearl block mt-0.5">{plan.estimatedCost > 0 ? formatPrice(plan.estimatedCost) : 'Free'}</strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-550 block font-bold uppercase">Expected ROI</span>
                    <strong className="text-emerald-450 block mt-0.5">+{plan.expectedRoiPercent}% ROI</strong>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-550 block font-bold uppercase">Difficulty / Time</span>
                    <strong className="text-textPearl block mt-0.5">{plan.difficulty} ({plan.timelineDays}d)</strong>
                  </div>
                </div>

                {/* Strategy transitions controllers */}
                <div className="pt-2 flex gap-2">
                  {plan.status === 'recommended' && (
                    <>
                      <Button size="xs" variant="outline" className="flex-1" onClick={() => handleUpdateStrategyStatus(plan.id, 'rejected')}>Reject</Button>
                      <Button size="xs" className="flex-1" onClick={() => handleUpdateStrategyStatus(plan.id, 'accepted')}>Accept Strategy</Button>
                    </>
                  )}
                  {plan.status === 'accepted' && (
                    <Button size="xs" className="w-full" onClick={() => handleUpdateStrategyStatus(plan.id, 'in_progress')}>Start Execution</Button>
                  )}
                  {plan.status === 'in_progress' && (
                    <Button size="xs" className="w-full" onClick={() => handleUpdateStrategyStatus(plan.id, 'completed')}>Mark Completed</Button>
                  )}
                  {plan.status === 'completed' && (
                    <div className="w-full p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center text-[10.5px] font-bold text-emerald-450">
                      ✅ Strategic objectives met successfully
                    </div>
                  )}
                </div>
              </div>
            )))}
          </div>
        </Card>
      )}

      {/* 6. Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
            <h3 className="text-xs font-bold text-textPearl uppercase tracking-wider pb-2 border-b border-slate-850/60">
              Strategy execution timeline
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-850/60 text-slate-550 font-bold uppercase tracking-wider text-[9px]">
                    <th className="pb-2">Strategic Action Plan</th>
                    <th className="pb-2">Objective</th>
                    <th className="pb-2">Expected ROI</th>
                    <th className="pb-2">Cost / Timeline</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 text-slate-350 font-semibold">
                  {strategyPlans.map(plan => (
                    <tr key={plan.id} className="hover:bg-slate-900/20">
                      <td className="py-3 text-textPearl">{plan.title}</td>
                      <td className="py-3 text-[10px] text-slate-450">{plan.objective}</td>
                      <td className="py-3 font-bold text-emerald-500">+{plan.expectedRoiPercent}%</td>
                      <td className="py-3">{plan.estimatedCost > 0 ? formatPrice(plan.estimatedCost) : 'Free'} ({plan.timelineDays} days)</td>
                      <td className="py-3">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          plan.status === 'completed' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                          plan.status === 'in_progress' ? 'bg-primary/10 text-primary border-primary/20' :
                          plan.status === 'accepted' ? 'bg-sky-500/10 text-sky-450 border-sky-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {plan.status}
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
    </div>
  );
};

export default OwnerStrategyCenter;
