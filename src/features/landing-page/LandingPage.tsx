import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import PublicNavbar from '../public-pages/components/PublicNavbar';
import PublicFooter from '../public-pages/components/PublicFooter';

// Decorative food imagery
import leftPlateImg from '../../assets/left_food_plate.png';
import rightPlateImg from '../../assets/right_food_plate.png';
import basilLeaf1 from '../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../assets/basil_leaf_2.png';

// Lucide icons
import { 
  ChefHat, 
  Utensils, 
  TrendingUp, 
  SlidersHorizontal,
  ChevronDown,
  Settings,
  Heart,
  Leaf,
  User,
  Users
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'SpiralDine | Home';
  }, []);

  const [showSwitcher, setShowSwitcher] = useState(false);

  const handlePortalNavigate = (path: string) => {
    navigate(path);
  };

  // Continue as customer handles redirection strictly for customer role
  const handleCustomerContinue = () => {
    if (user && user.role === 'customer') {
      navigate('/customer/home');
    } else {
      navigate('/customer/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17202A] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm circular background ambient backdrops */}
      <div className="absolute top-[8%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[600px] h-[500px] md:h-[600px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" />
      <div className="absolute bottom-[2%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[600px] h-[500px] md:h-[600px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" />

      {/* LEFT SIDE: Food plate entering from left edge */}
      <div className="hidden sm:block absolute left-[-220px] md:left-[-200px] lg:left-[-180px] xl:left-[-140px] top-[14%] md:top-[16%] lg:top-[18%] w-[420px] md:w-[500px] lg:w-[560px] xl:w-[600px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Gourmet Pasta Plate" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12 transition-transform duration-700 ease-out hover:scale-105"
        />
      </div>

      {/* Left side: Floating basil garnish & pepper accent */}
      <div className="hidden md:block absolute left-[220px] lg:left-[270px] top-[24%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil" className="w-full h-full object-contain" />
      </div>

      {/* Left side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute left-8 xl:left-14 bottom-24 xl:bottom-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Better Food
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Happier People
        </span>
        <div className="w-24 h-0.5 bg-[#D65336]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* RIGHT SIDE: Food plate entering from right edge */}
      <div className="hidden sm:block absolute right-[-220px] md:right-[-200px] lg:right-[-180px] xl:right-[-140px] bottom-[4%] md:bottom-[6%] lg:bottom-[8%] w-[420px] md:w-[500px] lg:w-[560px] xl:w-[600px] pointer-events-none select-none z-0">
        <img 
          src={rightPlateImg} 
          alt="Artisanal Grilled Entree" 
          className="w-full h-auto drop-shadow-xl transform rotate-6 transition-transform duration-700 ease-out hover:scale-105"
        />
      </div>

      {/* Right side: Floating basil garnish */}
      <div className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[42%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm">
        <img src={basilLeaf1} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Right side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute right-10 xl:right-16 top-24 xl:top-28 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Your Restaurant
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Your Growth
        </span>
        <div className="w-28 h-0.5 bg-[#D65336]/60 rounded-full mt-1.5 -rotate-2" />
      </div>


      {/* ========================================================================= */}
      {/* 2. HEADER & NAVIGATION                                                    */}
      {/* ========================================================================= */}
      <PublicNavbar />


      {/* ========================================================================= */}
      {/* 3. MAIN CENTRAL CONTENT AREA                                              */}
      {/* ========================================================================= */}
      <main className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14 flex flex-col items-center justify-center flex-1 relative z-10 space-y-10 md:space-y-12">
        
        {/* HERO HEADER */}
        <div className="text-center space-y-3.5 max-w-2xl">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-[#667085]">
            <span>ALL YOUR RESTAURANT OPERATIONS, ONE PLATFORM</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-[#17202A] leading-[1.12]">
            Welcome to <span className="text-[#D65336]">Spiral Dine</span>
          </h1>

          {/* Subtitle */}
          <div className="space-y-1 pt-1">
            <p className="text-base sm:text-lg font-bold text-[#17202A]">
              One Platform. Two Experiences.
            </p>
            <p className="text-sm sm:text-base text-[#667085] font-normal leading-relaxed">
              Choose how you'd like to continue.
            </p>
          </div>
        </div>

        {/* TWO MAIN EXPERIENCE CARDS */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-7 max-w-4xl pt-1">
          
          {/* Card 1: ORDER FOOD (Customer experience) */}
          <motion.div 
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <div className="h-full p-8 md:p-9 bg-white border border-[#E8DED6] hover:border-[#D65336]/40 transition-all flex flex-col justify-between space-y-6 rounded-[24px] shadow-sm hover:shadow-md relative overflow-hidden text-left">
              <div className="space-y-4">
                {/* Icon area: Soft terracotta background */}
                <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center shadow-2xs">
                  <Utensils className="w-7 h-7 text-[#D65336]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl md:text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
                    ORDER FOOD
                  </h2>
                  <p className="text-sm text-[#667085] leading-relaxed font-normal">
                    Browse restaurants, scan QR codes, explore menus, place orders, track your food, and enjoy a seamless dining experience.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#E8DED6]">
                {/* Primary button: Terracotta */}
                <button 
                  onClick={handleCustomerContinue}
                  className="w-full py-3.5 px-6 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all group cursor-pointer"
                >
                  <span>Continue as Customer</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
                
                {/* Sign In link */}
                <div className="text-center text-xs text-[#667085] font-medium pt-1">
                  Already have an account?{' '}
                  <Link to="/customer/login" className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline">
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: GROW YOUR RESTAURANT (Merchant experience) */}
          <motion.div 
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            <div className="h-full p-8 md:p-9 bg-white border border-[#E8DED6] hover:border-[#087B5B]/40 transition-all flex flex-col justify-between space-y-6 rounded-[24px] shadow-sm hover:shadow-md relative overflow-hidden text-left">
              <div className="space-y-4">
                {/* Icon area: Soft green background */}
                <div className="w-14 h-14 bg-[#E8F5EF] rounded-2xl flex items-center justify-center shadow-2xs">
                  <ChefHat className="w-7 h-7 text-[#087B5B]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl md:text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
                    GROW YOUR RESTAURANT
                  </h2>
                  <p className="text-sm text-[#667085] leading-relaxed font-normal">
                    Digitize your restaurant with Spiral Dine. Manage menus, QR ordering, kitchen operations, waiters, analytics, inventory, billing, and staff—all from one platform.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#E8DED6]">
                {/* Primary button: Natural Green */}
                <button 
                  onClick={() => navigate('/register')}
                  className="w-full py-3.5 px-6 bg-[#087B5B] hover:bg-[#066349] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all group cursor-pointer"
                >
                  <span>Create Restaurant</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
                
                {/* Already part of a restaurant block */}
                <div className="space-y-2.5 text-center pt-2">
                  <p className="text-[10px] text-[#8A817A] font-extrabold uppercase tracking-wider">
                    ALREADY PART OF A RESTAURANT?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => navigate('/owner/login')}
                      className="w-full py-2.5 px-3 border border-[#087B5B] hover:bg-[#E8F5EF] text-[#087B5B] font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Owner Sign In</span>
                    </button>
                    <button
                      onClick={() => navigate('/staff/login')}
                      className="w-full py-2.5 px-3 border border-[#17202A] hover:bg-[#F7F0EA] text-[#17202A] font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Staff Sign In</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 4. BOTTOM VALUE PROPOSITION STRIP */}
        <div className="w-full max-w-4xl bg-white border border-[#E8DED6] rounded-2xl p-6 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0 mt-0.5">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#17202A]">More Orders</h4>
                <p className="text-[11px] text-[#667085] mt-0.5">Reach more customers</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0 mt-0.5">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#17202A]">Smarter Operations</h4>
                <p className="text-[11px] text-[#667085] mt-0.5">Manage everything easily</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0 mt-0.5">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#17202A]">Happier Guests</h4>
                <p className="text-[11px] text-[#667085] mt-0.5">Better dining experiences</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0 mt-0.5">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#17202A]">Sustainable Growth</h4>
                <p className="text-[11px] text-[#667085] mt-0.5">Built for the future</p>
              </div>
            </div>
          </div>
        </div>

        {/* 5. DEVELOPER SWITCHBOARD (Role testing panel) */}
        <div className="w-full max-w-4xl pt-1 text-left">
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className="flex items-center space-x-1.5 text-xs text-[#8A817A] hover:text-[#17202A] transition-colors font-bold uppercase select-none cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Developer Switchboard</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
          </button>

          {showSwitcher && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 overflow-hidden"
            >
              {/* Customer QR Ordering */}
              <div className="bg-white p-4 rounded-xl border border-[#E8DED6] flex flex-col justify-between text-xs shadow-2xs">
                <div>
                  <h3 className="font-bold text-[#17202A]">Customer QR Order</h3>
                  <p className="text-[#667085] mt-0.5 mb-3">Simulate table-side QR ordering at Table 3.</p>
                </div>
                <Link to="/r/gourmet-palace-saas/table/3" className="w-full text-center px-3 py-2 bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A] hover:text-[#D65336] font-bold rounded-lg transition-all">
                  Scan Table QR
                </Link>
              </div>

              {/* Waiter Portal */}
              <div className="bg-white p-4 rounded-xl border border-[#E8DED6] flex flex-col justify-between text-xs shadow-2xs">
                <div>
                  <h3 className="font-bold text-[#17202A]">Waiter Dashboard</h3>
                  <p className="text-[#667085] mt-0.5 mb-3">Monitor active table matrices and diner alerts.</p>
                </div>
                <button onClick={() => handlePortalNavigate('/staff/login')} className="w-full px-3 py-2 bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A] hover:text-[#D65336] font-bold rounded-lg transition-all">
                  Staff Sign In (Waiter)
                </button>
              </div>

              {/* Kitchen Queue */}
              <div className="bg-white p-4 rounded-xl border border-[#E8DED6] flex flex-col justify-between text-xs shadow-2xs">
                <div>
                  <h3 className="font-bold text-[#17202A]">Kitchen Workspace</h3>
                  <p className="text-[#667085] mt-0.5 mb-3">Manage incoming preparation tickets.</p>
                </div>
                <button onClick={() => handlePortalNavigate('/staff/login')} className="w-full px-3 py-2 bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A] hover:text-[#D65336] font-bold rounded-lg transition-all">
                  Staff Sign In (Kitchen)
                </button>
              </div>

              {/* Owner Dashboard */}
              <div className="bg-white p-4 rounded-xl border border-[#E8DED6] flex flex-col justify-between text-xs shadow-2xs">
                <div>
                  <h3 className="font-bold text-[#17202A]">Restaurant Owner</h3>
                  <p className="text-[#667085] mt-0.5 mb-3">Check monthly revenue graphs and inventory levels.</p>
                </div>
                <button onClick={() => handlePortalNavigate('/owner/login')} className="w-full px-3 py-2 bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A] hover:text-[#D65336] font-bold rounded-lg transition-all">
                  Owner Sign In
                </button>
              </div>

              {/* Admin Portal */}
              <div className="bg-white p-4 rounded-xl border border-[#E8DED6] flex flex-col justify-between text-xs shadow-2xs">
                <div>
                  <h3 className="font-bold text-[#17202A]">Branch Manager</h3>
                  <p className="text-[#667085] mt-0.5 mb-3">Check audit trails and branches configurations.</p>
                </div>
                <button onClick={() => handlePortalNavigate('/staff/login')} className="w-full px-3 py-2 bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A] hover:text-[#D65336] font-bold rounded-lg transition-all">
                  Staff Sign In (Admin)
                </button>
              </div>

              {/* Super Admin Dashboard */}
              <div className="bg-white p-4 rounded-xl border border-[#E8DED6] flex flex-col justify-between text-xs shadow-2xs">
                <div>
                  <h3 className="font-bold text-[#17202A]">Super Admin SaaS</h3>
                  <p className="text-[#667085] mt-0.5 mb-3">Check MRR run rates and features access.</p>
                </div>
                <button onClick={() => handlePortalNavigate('/owner/login')} className="w-full px-3 py-2 bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A] hover:text-[#D65336] font-bold rounded-lg transition-all">
                  Sign In (Super Admin)
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 6. MINIMALIST FOOTER                                                      */}
      {/* ========================================================================= */}
      <PublicFooter />
    </div>
  );
};

export default LandingPage;

