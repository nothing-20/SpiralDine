import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout from './components/PublicPageLayout';
import { 
  ArrowRight, 
  Sparkles, 
  Layers, 
  Workflow, 
  CheckCircle, 
  ArrowDown, 
  Utensils, 
  ChefHat, 
  Users, 
  CreditCard, 
  TrendingUp, 
  LineChart,
  Globe2,
  ShieldCheck
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | About';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  const workflowSteps = [
    {
      step: '01',
      title: 'Customer',
      subtitle: 'Arrives at Table',
      description: 'The guest sits at their assigned table and scans the physical QR code with their phone, without requiring any app download.',
      icon: <Utensils className="w-5 h-5 text-[#D65336]" />,
      iconBg: 'bg-[#FCEDE7]',
    },
    {
      step: '02',
      title: 'Ordering',
      subtitle: 'Real-Time Menu & Cart',
      description: 'Diners explore the live digital menu, select customizations, specify dietary requirements, and place orders directly to the cloud.',
      icon: <Layers className="w-5 h-5 text-[#087B5B]" />,
      iconBg: 'bg-[#E8F5EF]',
    },
    {
      step: '03',
      title: 'Kitchen',
      subtitle: 'Kitchen Display System (KDS)',
      description: 'The ticket appears instantly on the KDS monitor. Chefs view item breakdown, station routing, and update status from Preparing to Ready.',
      icon: <ChefHat className="w-5 h-5 text-[#D65336]" />,
      iconBg: 'bg-[#FCEDE7]',
    },
    {
      step: '04',
      title: 'Waiter',
      subtitle: 'Service & Table Matrix',
      description: 'Floor staff receive alerts as food is marked Ready. They pick up the order, serve the table, and confirm delivery on their floor matrix.',
      icon: <Users className="w-5 h-5 text-[#087B5B]" />,
      iconBg: 'bg-[#E8F5EF]',
    },
    {
      step: '05',
      title: 'Payment',
      subtitle: 'Online or Cash Settlement',
      description: 'Guests settle their check using online digital checkout (UPI/cards) or hand cash to the waiter with instant cashier reconciliation.',
      icon: <CreditCard className="w-5 h-5 text-[#D65336]" />,
      iconBg: 'bg-[#FCEDE7]',
    },
    {
      step: '06',
      title: 'Owner',
      subtitle: 'Authoritative Business Controls',
      description: 'Real-time financial ledgers update immediately. Owners monitor live table status, staff attendance, stock levels, and daily revenue.',
      icon: <TrendingUp className="w-5 h-5 text-[#087B5B]" />,
      iconBg: 'bg-[#E8F5EF]',
    },
    {
      step: '07',
      title: 'Analytics',
      subtitle: 'Continuous Growth Insights',
      description: 'Automated item-level popularity analysis, revenue reporting, and diner return patterns power smarter restaurant decisions.',
      icon: <LineChart className="w-5 h-5 text-[#17202A]" />,
      iconBg: 'bg-[#F7F0EA]',
    },
  ];

  return (
    <PublicPageLayout>
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-16 text-left">
        
        {/* HERO SECTION */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FCEDE7] border border-[#F5CBC4] text-[11px] font-bold uppercase tracking-wider text-[#D65336]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>About SpiralDine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-[#17202A] leading-[1.15]">
            One connected operating system
            <span className="block text-[#D65336] mt-1">for modern restaurants.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#667085] leading-relaxed max-w-2xl mx-auto pt-2">
            SpiralDine was engineered to replace disjointed restaurant tools with a single, synchronized platform connecting guests, front-of-house staff, kitchen crews, and owners.
          </p>
        </div>

        {/* WHY SPIRALDINE EXISTS / THE PROBLEM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-20">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D65336]">The Challenge</span>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17202A] tracking-tight leading-snug">
              Why traditional restaurant operations create daily friction.
            </h2>
            <p className="text-sm text-[#667085] leading-relaxed">
              In most dining establishments, front-of-house service and kitchen preparation rely on disconnected tools: handwritten paper slips, physical menus that need constant reprints, verbal communication between waiters and chefs, and end-of-day spreadsheet reconciliation.
            </p>
            <p className="text-sm text-[#667085] leading-relaxed">
              This fragmentation causes order delays, lost modification notes, slow table turnover, and blind spots in inventory and daily financial reporting.
            </p>
          </div>

          <div className="bg-white border border-[#E8DED6] rounded-[24px] p-8 shadow-xs space-y-4">
            <h3 className="text-lg font-display font-extrabold text-[#17202A]">
              The SpiralDine Solution
            </h3>
            <ul className="space-y-3.5 text-xs text-[#17202A]">
              <li className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-[#087B5B] shrink-0 mt-0.5" />
                <span><strong>Zero Paper Delays:</strong> Orders placed by guests or floor staff route straight to the digital Kitchen Display System in milliseconds.</span>
              </li>
              <li className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-[#087B5B] shrink-0 mt-0.5" />
                <span><strong>Unified Table State:</strong> Waiters, cashiers, and managers share one synchronized live matrix of active dining sessions.</span>
              </li>
              <li className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-[#087B5B] shrink-0 mt-0.5" />
                <span><strong>Instant Financial Clarity:</strong> Every transaction, whether paid online or in cash, reconciles directly into the owner's revenue dashboard.</span>
              </li>
              <li className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-[#087B5B] shrink-0 mt-0.5" />
                <span><strong>Multi-Tenant Architecture:</strong> Complete data isolation ensuring branch independence and enterprise security.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* CONNECTED LIFECYCLE WORKFLOW PIPELINE */}
        <div className="mb-20">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#087B5B]">Synchronized Architecture</span>
            <h2 className="text-3xl font-display font-extrabold text-[#17202A] tracking-tight">
              How the platform connects every step.
            </h2>
            <p className="text-xs text-[#667085]">
              Follow an order from customer arrival through the kitchen, floor service, payment, and analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflowSteps.slice(0, 4).map((item, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-[#E8DED6] rounded-2xl p-6 shadow-xs relative flex flex-col justify-between space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shadow-2xs`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-extrabold text-[#8A817A] tracking-wider">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17202A]">
                    {item.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#D65336] mb-2">
                    {item.subtitle}
                  </p>
                  <p className="text-xs text-[#667085] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {workflowSteps.slice(4).map((item, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-[#E8DED6] rounded-2xl p-6 shadow-xs relative flex flex-col justify-between space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shadow-2xs`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-extrabold text-[#8A817A] tracking-wider">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17202A]">
                    {item.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#D65336] mb-2">
                    {item.subtitle}
                  </p>
                  <p className="text-xs text-[#667085] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* THE SPIRAL ECOSYSTEM */}
        <div className="bg-white border border-[#E8DED6] rounded-[24px] p-8 md:p-12 shadow-xs mb-16">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#17202A] rounded-xl flex items-center justify-center text-white font-bold">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-display font-extrabold text-[#17202A]">
                  Part of the Spiral World Ecosystem
                </h3>
                <p className="text-xs text-[#667085]">Dedicated to modernizing operational software.</p>
              </div>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">
              SpiralDine is part of the broader Spiral ecosystem of business platforms, dedicated to bringing modern, connected operational systems to industries with demanding workflows. By focusing on real-time synchronization, rigorous multi-tenant security, and intuitive human-centered design, SpiralDine delivers reliable technology that lets restaurant teams focus on hospitality and culinary excellence.
            </p>
          </div>
        </div>

        {/* BOTTOM CTA */}
        <div className="text-center max-w-xl mx-auto space-y-4">
          <h3 className="text-2xl font-display font-extrabold text-[#17202A]">
            Discover what connected dining can do for your business.
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/features"
              className="px-6 py-3 bg-[#D65336] hover:bg-[#B9432D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-2"
            >
              <span>Explore Features</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/contact"
              className="px-6 py-3 bg-white hover:bg-[#F7F0EA] border border-[#E8DED6] text-[#17202A] text-xs font-bold rounded-xl transition-all"
            >
              Contact Our Team
            </Link>
          </div>
        </div>

      </div>
    </PublicPageLayout>
  );
};

export default AboutPage;
