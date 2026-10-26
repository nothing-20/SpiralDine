import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  Grid, 
  Users, 
  Tag, 
  Boxes, 
  Receipt, 
  ChevronRight, 
  ShieldCheck, 
  TrendingUp,
  Sparkles,
  Cpu,
  Target,
  Brain
} from 'lucide-react';
import MobileOwnerHeader from '../components/MobileOwnerHeader';
import MobileCard from '../components/MobileCard';

export const MobileBusinessDashboard: React.FC = () => {
  const navigate = useNavigate();

  const businessModules = [
    {
      id: 'intelligence',
      title: 'AI Intelligence & Advisor',
      description: 'Real-time AI dining insights, revenue forecasting & recommendations',
      icon: Brain,
      badge: 'AI Core',
      color: 'bg-[#EFF6FF] text-[#2563EB]',
      path: '/owner/intelligence',
    },
    {
      id: 'automation',
      title: 'Automation Center',
      description: 'Autonomous cron schedules, alerts & daily operation briefs',
      icon: Cpu,
      badge: 'Autonomous',
      color: 'bg-[#FAF5FF] text-[#7C3AED]',
      path: '/owner/automation',
    },
    {
      id: 'strategy',
      title: 'Strategy & Business Goals',
      description: 'Revenue targets, waste reduction & strategic action playbooks',
      icon: Target,
      badge: 'Goals',
      color: 'bg-[#FFF4EE] text-[#FF7518]',
      path: '/owner/strategy',
    },
    {
      id: 'analytics',
      title: 'Analytics & Revenue',
      description: 'Sales trends, top-selling dishes, and average ticket size',
      icon: BarChart3,
      badge: 'Live',
      color: 'bg-[#FFF4EE] text-[#FF7518]',
      path: '/owner/analytics',
    },
    {
      id: 'tables',
      title: 'Tables & QR Codes',
      description: 'Floor management, real-time occupancy, and printable QR codes',
      icon: Grid,
      badge: 'Tables',
      color: 'bg-[#EFF6FF] text-[#2563EB]',
      path: '/owner/tables',
    },
    {
      id: 'staff',
      title: 'Staff Management',
      description: 'Active employees, role assignments, and team invitations',
      icon: Users,
      badge: 'Roster',
      color: 'bg-[#F0FDF4] text-[#16A34A]',
      path: '/owner/staff',
    },
    {
      id: 'promotions',
      title: 'Offers & Promotions',
      description: 'Discount codes, seasonal deals, and minimum spend rules',
      icon: Tag,
      badge: 'Marketing',
      color: 'bg-[#FAF5FF] text-[#7C3AED]',
      path: '/owner/promotions',
    },
    {
      id: 'inventory',
      title: 'Inventory & Stock',
      description: 'Real-time stock deduction, batches, and supplier records',
      icon: Boxes,
      badge: 'Inventory',
      color: 'bg-[#FFFBEB] text-[#D97706]',
      path: '/owner/inventory',
    },
    {
      id: 'billing',
      title: 'Bills & Settlement',
      description: 'Tax invoices, POS checkout registers, and payment records',
      icon: Receipt,
      badge: 'Finance',
      color: 'bg-[#F1F5F9] text-[#475569]',
      path: '/owner/billing',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7]">
      <MobileOwnerHeader />

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#63351F] to-[#FF7518] rounded-2xl p-4 text-white shadow-md shadow-[#FF7518]/20 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Operations Hub</span>
            </div>
            <h2 className="text-base font-extrabold tracking-tight">Business Command</h2>
            <p className="text-[11px] text-white/80 mt-0.5 max-w-xs">
              Complete restaurant controls for floor, team, sales, and inventory.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Modules Grid */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Core Business Management
          </h3>

          <div className="space-y-2.5">
            {businessModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className="bg-white rounded-2xl border border-[#EBEBEB] p-4 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform cursor-pointer shadow-sm hover:border-[#FF7518]/30 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${mod.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-[#202124] group-hover:text-[#FF7518] transition-colors truncate">
                          {mod.title}
                        </h4>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#F3F4F6] text-[#707070]">
                          {mod.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#707070] mt-0.5 line-clamp-1">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  <div className="w-6 h-6 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#9E9E9E] group-hover:text-[#202124] flex-shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileBusinessDashboard;
