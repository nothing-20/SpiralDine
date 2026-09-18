import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout from './components/PublicPageLayout';
import { 
  QrCode, 
  UtensilsCrossed, 
  ChefHat, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  LayoutGrid,
  Bell,
  Building2
} from 'lucide-react';

export const FeaturesPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Features';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const featureCategories = [
    {
      id: 'customer-ordering',
      badge: 'Customer Experience',
      title: 'Customer Ordering',
      description: 'Effortless dining from seat to checkout without waiting for paper menus or manual order slips.',
      icon: <QrCode className="w-6 h-6 text-[#D65336]" />,
      iconBg: 'bg-[#FCEDE7]',
      capabilities: [
        {
          name: 'QR / Table-Based Ordering',
          desc: 'Diners scan table-specific QR codes to immediately access the live menu for their exact table.',
        },
        {
          name: 'Digital Interactive Menu',
          desc: 'Rich dietary tags, item descriptions, spice indicators, combos, and availability toggles.',
        },
        {
          name: 'Cart & Order Placement',
          desc: 'Seamless diner cart management with real-time price calculations, item addons, and special requests.',
        },
        {
          name: 'Live Order Tracking',
          desc: 'Real-time order lifecycle updates from placed, kitchen preparing, to ready and served.',
        },
        {
          name: 'Bill & Payment Workflow',
          desc: 'Diners can view itemized active session tabs, request split bills, and complete payment on their device.',
        },
        {
          name: 'Call Waiter & Assistance Requests',
          desc: 'One-tap waiter paging directly from the diner screen notifying floor staff instantaneously.',
        },
      ],
    },
    {
      id: 'kitchen-operations',
      badge: 'Back of House',
      title: 'Kitchen Operations',
      description: 'Real-time kitchen coordination eliminating lost paper tickets and delayed prep times.',
      icon: <ChefHat className="w-6 h-6 text-[#087B5B]" />,
      iconBg: 'bg-[#E8F5EF]',
      capabilities: [
        {
          name: 'Kitchen Display System (KDS)',
          desc: 'Digital, high-contrast ticket queue updated instantly as guests or waiters place orders.',
        },
        {
          name: 'Live Order Queue',
          desc: 'Clear visual status transitions across New, Preparing, Ready to Serve, and Completed.',
        },
        {
          name: 'Kitchen Order Status & Priority',
          desc: 'Visual indicators for elapsed order times, course sequencing, and critical delays.',
        },
        {
          name: 'Chef & Station Assignment',
          desc: 'Assign specific orders or menu items to dedicated cook stations and lead kitchen staff.',
        },
        {
          name: 'Category-Based Preparation Workflow',
          desc: 'Auto-filter preparation batches by grill, appetizers, mains, and beverage stations.',
        },
        {
          name: 'Kitchen Performance Visibility',
          desc: 'Track ticket turnaround times, preparation velocity, and order completion metrics.',
        },
      ],
    },
    {
      id: 'waiter-operations',
      badge: 'Floor Service',
      title: 'Waiter Operations',
      description: 'Equip floor staff with live table status matrices, service alerts, and payment verification tools.',
      icon: <Users className="w-6 h-6 text-[#D65336]" />,
      iconBg: 'bg-[#FCEDE7]',
      capabilities: [
        {
          name: 'Live Table Matrix',
          desc: 'Color-coded visual layout showing occupied, reserved, dining, and billing table states.',
        },
        {
          name: 'Table / Service Workflow',
          desc: 'Manage multiple assigned tables simultaneously with instant order notifications.',
        },
        {
          name: 'Food Served Confirmation',
          desc: 'Confirm order delivery from the pass to the guest table in one tap, notifying the KDS and billing ledger.',
        },
        {
          name: 'Cash Payment Confirmation',
          desc: 'Accept cash settlements table-side and securely confirm receipts for the cashier desk.',
        },
        {
          name: 'Customer Assistance Alerts',
          desc: 'Receive immediate alerts when guests request water, cutlery, assistance, or their check.',
        },
      ],
    },
    {
      id: 'owner-operations',
      badge: 'Management & Control',
      title: 'Owner Operations',
      description: 'Comprehensive business analytics, inventory controls, and staff administration from a centralized workspace.',
      icon: <TrendingUp className="w-6 h-6 text-[#087B5B]" />,
      iconBg: 'bg-[#E8F5EF]',
      capabilities: [
        {
          name: 'Revenue Dashboard',
          desc: 'Authoritative financial overviews tracking daily, weekly, monthly, and annual sales in real time.',
        },
        {
          name: 'Sales & Item Performance Reports',
          desc: 'Detailed item-level popularity rankings, revenue contributions, and category distribution.',
        },
        {
          name: 'Customer Reports & History',
          desc: 'Diner visiting trends, order histories, total spends, and guest engagement insights.',
        },
        {
          name: 'Inventory & Stock Management',
          desc: 'Monitor ingredient quantities, configure reorder thresholds, and prevent menu stock-outs.',
        },
        {
          name: 'Staff Management & Invitations',
          desc: 'Invite, activate, and manage employee profiles across roles with fine-grained access.',
        },
        {
          name: 'Reservations & Feedback',
          desc: 'Manage upcoming table reservations, seating allocations, and verified customer dining reviews.',
        },
      ],
    },
    {
      id: 'multi-tenant',
      badge: 'Architecture & Security',
      title: 'Multi-Tenant Management',
      description: 'Enterprise-grade isolation ensuring complete data privacy across restaurant organizations and branch locations.',
      icon: <ShieldCheck className="w-6 h-6 text-[#17202A]" />,
      iconBg: 'bg-[#F7F0EA]',
      capabilities: [
        {
          name: 'Complete Restaurant Data Isolation',
          desc: 'Tenant-scoped Firestore collections and strict security rules prevent cross-restaurant data leakage.',
        },
        {
          name: 'Branch Support',
          desc: 'Manage single-location restaurants or switch between multiple branch locations under one business.',
        },
        {
          name: 'Role-Based Access Control (RBAC)',
          desc: 'Dedicated portals and permissions for Owners, Branch Admins, Managers, Kitchen Chefs, Waiters, and Cashiers.',
        },
        {
          name: 'Owner Portal',
          desc: 'Full operational control including menus, tables, staff, inventory, and restaurant settings.',
        },
        {
          name: 'Super Admin Portal',
          desc: 'Platform-level governance for SaaS administration, tenant health, plan tiers, and system monitoring.',
        },
      ],
    },
    {
      id: 'payments',
      badge: 'Financial Flow',
      title: 'Payments & Settlement',
      description: 'Flexible payment settlement handling digital transactions and cash workflows with automated accounting reconciliation.',
      icon: <CreditCard className="w-6 h-6 text-[#D65336]" />,
      iconBg: 'bg-[#FCEDE7]',
      capabilities: [
        {
          name: 'Online Payment Integration',
          desc: 'Secure digital checkout integration (via Razorpay) for cards, UPI, net banking, and digital wallets.',
        },
        {
          name: 'Cash Payment Workflow',
          desc: 'Seamless cash payment collection and cashier shift reconciliation with drawer reporting.',
        },
        {
          name: 'Payment Status Tracking',
          desc: 'Real-time synchronization of payment states (Pending, Processing, Paid, Refunded) across customer, waiter, and owner dashboards.',
        },
        {
          name: 'Itemized & Split Billing',
          desc: 'Generate clear, itemized bills with tax breakdowns, service charges, and discount allowances.',
        },
      ],
    },
  ];

  return (
    <PublicPageLayout>
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-16 text-left">
        
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FCEDE7] border border-[#F5CBC4] text-[11px] font-bold uppercase tracking-wider text-[#D65336]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Platform Capabilities</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-[#17202A] leading-[1.15]">
            SpiralDine
            <span className="block text-[#D65336] mt-1">Restaurant Operations, Connected.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#667085] leading-relaxed max-w-2xl mx-auto pt-2">
            SpiralDine connects restaurant customers, kitchen staff, waiters, owners, and operations into one platform. Replace disconnected spreadsheets, paper tickets, and fragmented tools with a single operational ecosystem.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
            <Link
              to="/pricing"
              className="px-6 py-3 bg-[#D65336] hover:bg-[#B9432D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-2"
            >
              <span>View Pricing Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/contact"
              className="px-6 py-3 bg-white hover:bg-[#F7F0EA] border border-[#E8DED6] text-[#17202A] text-xs font-bold rounded-xl transition-all shadow-2xs"
            >
              Contact Sales
            </Link>
          </div>
        </div>

        {/* FEATURE CATEGORIES GRID */}
        <div className="space-y-16">
          {featureCategories.map((category, idx) => (
            <div 
              key={category.id} 
              id={category.id}
              className="bg-white border border-[#E8DED6] rounded-[24px] p-8 md:p-10 shadow-xs hover:shadow-sm transition-shadow"
            >
              {/* Category Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8DED6]">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-2xl ${category.iconBg} flex items-center justify-center shadow-2xs shrink-0`}>
                    {category.icon}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A817A]">
                      {category.badge}
                    </span>
                    <h2 className="text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
                      {category.title}
                    </h2>
                  </div>
                </div>
                <p className="text-xs text-[#667085] max-w-md">
                  {category.description}
                </p>
              </div>

              {/* Capabilities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                {category.capabilities.map((cap, capIdx) => (
                  <div 
                    key={capIdx} 
                    className="p-5 rounded-xl bg-[#FCFAF7] border border-[#E8DED6]/70 hover:border-[#D65336]/30 transition-all space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#087B5B] shrink-0" />
                      <h3 className="text-sm font-bold text-[#17202A]">
                        {cap.name}
                      </h3>
                    </div>
                    <p className="text-xs text-[#667085] leading-relaxed pl-6">
                      {cap.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* BOTTOM CTA STRIP */}
        <div className="mt-16 md:mt-24 p-8 md:p-12 rounded-[24px] bg-[#17202A] text-white flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight">
              Ready to modernize your restaurant operations?
            </h3>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Experience the power of real-time restaurant synchronization. Set up your digital menu and QR dining tables today.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              to="/register"
              className="w-full sm:w-auto px-6 py-3.5 bg-[#D65336] hover:bg-[#B9432D] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/contact"
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all border border-slate-700 text-center"
            >
              Talk to Our Team
            </Link>
          </div>
        </div>

      </div>
    </PublicPageLayout>
  );
};

export default FeaturesPage;
