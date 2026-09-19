import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import PublicNavbar from '../public-pages/components/PublicNavbar';
import PublicFooter from '../public-pages/components/PublicFooter';

// Decorative food & botanical imagery
import leftPlateImg from '../../assets/left_food_plate.png';
import rightPlateImg from '../../assets/right_food_plate.png';
import basilLeaf1 from '../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../assets/basil_leaf_2.png';

// Lucide icons
import { 
  Utensils, 
  ChefHat, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  Users, 
  BarChart3, 
  Heart, 
  Shield, 
  Cloud,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showSwitcher, setShowSwitcher] = useState(false);

  useEffect(() => {
    document.title = 'SpiralDine | Smart Dining. Smarter Business.';
  }, []);

  const handleCustomerContinue = () => {
    if (user && user.role === 'customer') {
      navigate('/customer/home');
    } else {
      navigate('/customer/login');
    }
  };

  const handleOwnerContinue = () => {
    if (user && (user.role === 'owner' || user.role === 'admin')) {
      navigate('/owner/dashboard');
    } else {
      navigate('/owner/login');
    }
  };

  const handleSuperAdminContinue = () => {
    navigate('/super-admin/login');
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17202A] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm ambient glows */}
      <div 
        className="absolute top-[8%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[600px] h-[500px] md:h-[600px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" 
        aria-hidden="true"
      />
      <div 
        className="absolute bottom-[2%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[600px] h-[500px] md:h-[600px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" 
        aria-hidden="true"
      />

      {/* LEFT SIDE: Food plate entering from left edge */}
      <div 
        className="hidden sm:block absolute left-[-220px] md:left-[-200px] lg:left-[-180px] xl:left-[-130px] top-[14%] md:top-[16%] lg:top-[18%] w-[420px] md:w-[500px] lg:w-[560px] xl:w-[600px] pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <img 
          src={leftPlateImg} 
          alt="" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12 transition-transform duration-700 ease-out"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div 
        className="hidden md:block absolute left-[210px] lg:left-[260px] top-[24%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm"
        aria-hidden="true"
      >
        <img src={basilLeaf2} alt="" className="w-full h-full object-contain" />
      </div>

      {/* RIGHT SIDE: Food plate entering from right edge */}
      <div 
        className="hidden sm:block absolute right-[-220px] md:right-[-200px] lg:right-[-180px] xl:left-auto xl:right-[-130px] bottom-[6%] md:bottom-[8%] lg:bottom-[10%] w-[420px] md:w-[500px] lg:w-[560px] xl:w-[600px] pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <img 
          src={rightPlateImg} 
          alt="" 
          className="w-full h-auto drop-shadow-xl transform rotate-6 transition-transform duration-700 ease-out"
        />
      </div>

      {/* Right side: Floating basil garnish */}
      <div 
        className="hidden md:block absolute right-[220px] lg:right-[270px] bottom-[38%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm"
        aria-hidden="true"
      >
        <img src={basilLeaf1} alt="" className="w-full h-full object-contain" />
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP NAVBAR                                                             */}
      {/* ========================================================================= */}
      <PublicNavbar />

      {/* ========================================================================= */}
      {/* 3. MAIN HERO & CARDS SECTION                                              */}
      {/* ========================================================================= */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col items-center justify-center flex-1 relative z-10 space-y-10 md:space-y-12">
        
        {/* HERO HEADER */}
        <div className="text-center space-y-3 max-w-3xl">
          {/* Eyebrow badge */}
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#667085]">
            ALL YOUR RESTAURANT OPERATIONS, ONE PLATFORM
          </p>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-[56px] font-display font-extrabold tracking-tight text-[#17202A] leading-[1.12]">
            Welcome to <span className="text-[#D65336]">Spiral Dine</span>
          </h1>

          {/* Subtitles */}
          <div className="space-y-1.5 pt-1">
            <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#17202A] tracking-tight">
              One Platform. Three Experiences.
            </h2>
            <p className="text-xs sm:text-sm text-[#667085] max-w-xl mx-auto leading-relaxed">
              Delicious for your customers. Powerful for your restaurant. Secure for the platform.
              <br className="hidden sm:inline" /> Choose how you'd like to continue.
            </p>
          </div>
        </div>

        {/* THREE MAIN CARDS (CUSTOMER, OWNER, SUPER ADMIN) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7 max-w-6xl">
          
          {/* ================================================================= */}
          {/* CARD 1: CUSTOMER                                                  */}
          {/* ================================================================= */}
          <motion.div 
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="h-full flex"
          >
            <div className="h-full w-full p-7 sm:p-8 bg-white border border-[#E8DED6] hover:border-[#D65336]/40 transition-all flex flex-col justify-between rounded-[28px] shadow-sm hover:shadow-md relative overflow-hidden text-left">
              
              {/* Decorative top-right corner swoosh */}
              <div 
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#FCEDE7] via-[#FDF3EE]/60 to-transparent rounded-bl-full pointer-events-none" 
                aria-hidden="true" 
              />

              <div className="space-y-5 relative z-10">
                {/* Icon in soft orange rounded square */}
                <div className="w-13 h-13 rounded-2xl bg-[#FCEDE7] border border-[#F5CBC4]/60 flex items-center justify-center text-[#D65336] shadow-2xs">
                  <Utensils className="w-6 h-6" />
                </div>

                {/* Title and Description */}
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
                    I'm a Customer
                  </h3>
                  <p className="text-xs sm:text-sm text-[#667085] leading-relaxed">
                    Discover great restaurants, scan QR codes, order food, and enjoy a seamless dining experience.
                  </p>
                </div>

                {/* Feature Checklist */}
                <ul className="space-y-2.5 pt-2 text-xs text-[#475467] font-medium" aria-label="Customer features">
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Browse menus & specials</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Scan QR codes to order</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Track your orders in real time</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#FCEDE7] text-[#D65336] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Enjoy a contactless dining experience</span>
                  </li>
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-6 relative z-10">
                <button
                  type="button"
                  onClick={handleCustomerContinue}
                  className="w-full py-3.5 px-5 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all group cursor-pointer"
                >
                  <span>Continue as Customer</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* ================================================================= */}
          {/* CARD 2: RESTAURANT OWNER                                          */}
          {/* ================================================================= */}
          <motion.div 
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="h-full flex"
          >
            <div className="h-full w-full p-7 sm:p-8 bg-white border border-[#E8DED6] hover:border-[#087B5B]/40 transition-all flex flex-col justify-between rounded-[28px] shadow-sm hover:shadow-md relative overflow-hidden text-left">
              
              {/* Decorative top-right corner swoosh */}
              <div 
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#E8F5EF] via-[#F0F9F5]/60 to-transparent rounded-bl-full pointer-events-none" 
                aria-hidden="true" 
              />

              <div className="space-y-5 relative z-10">
                {/* Icon in soft green rounded square */}
                <div className="w-13 h-13 rounded-2xl bg-[#E8F5EF] border border-[#A3E0C8]/60 flex items-center justify-center text-[#087B5B] shadow-2xs">
                  <ChefHat className="w-6 h-6" />
                </div>

                {/* Title and Description */}
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
                    I'm a Restaurant Owner
                  </h3>
                  <p className="text-xs sm:text-sm text-[#667085] leading-relaxed">
                    Manage your restaurant with a complete operating system — from orders to analytics and beyond.
                  </p>
                </div>

                {/* Feature Checklist */}
                <ul className="space-y-2.5 pt-2 text-xs text-[#475467] font-medium" aria-label="Restaurant Owner features">
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#E8F5EF] text-[#087B5B] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Manage menus, orders and kitchen</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#E8F5EF] text-[#087B5B] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Handle staff, tables and inventory</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#E8F5EF] text-[#087B5B] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Track sales and business analytics</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#E8F5EF] text-[#087B5B] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Delight your customers and grow faster</span>
                  </li>
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-6 relative z-10">
                <button
                  type="button"
                  onClick={handleOwnerContinue}
                  className="w-full py-3.5 px-5 bg-[#087B5B] hover:bg-[#066349] text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all group cursor-pointer"
                >
                  <span>Continue as Owner</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* ================================================================= */}
          {/* CARD 3: SUPER ADMIN                                               */}
          {/* ================================================================= */}
          <motion.div 
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            className="h-full flex md:col-span-2 lg:col-span-1"
          >
            <div className="h-full w-full p-7 sm:p-8 bg-white border border-[#E8DED6] hover:border-[#1E40AF]/40 transition-all flex flex-col justify-between rounded-[28px] shadow-sm hover:shadow-md relative overflow-hidden text-left">
              
              {/* Decorative top-right corner swoosh */}
              <div 
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#EBF3FC] via-[#F1F6FD]/60 to-transparent rounded-bl-full pointer-events-none" 
                aria-hidden="true" 
              />

              <div className="space-y-5 relative z-10">
                {/* Icon in soft blue rounded square */}
                <div className="w-13 h-13 rounded-2xl bg-[#EBF3FC] border border-[#BFDBFE]/60 flex items-center justify-center text-[#1E40AF] shadow-2xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>

                {/* Title and Description */}
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-extrabold text-[#17202A] tracking-tight">
                    Super Admin Portal
                  </h3>
                  <p className="text-xs sm:text-sm text-[#667085] leading-relaxed">
                    Secure platform administration for the SpiralDine ecosystem.
                  </p>
                </div>

                {/* Feature Checklist */}
                <ul className="space-y-2.5 pt-2 text-xs text-[#475467] font-medium" aria-label="Super Admin features">
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#EBF3FC] text-[#1E40AF] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Manage all restaurants</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#EBF3FC] text-[#1E40AF] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Oversee platform users</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#EBF3FC] text-[#1E40AF] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Monitor platform activity</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <span className="w-4.5 h-4.5 rounded-full bg-[#EBF3FC] text-[#1E40AF] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span>Access analytics and system settings</span>
                  </li>
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-6 relative z-10">
                <button
                  type="button"
                  onClick={handleSuperAdminContinue}
                  className="w-full py-3.5 px-5 bg-[#1E3A5F] hover:bg-[#152B47] text-white font-bold text-xs sm:text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all group cursor-pointer"
                >
                  <span>Super Admin Login</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </motion.div>

        </div>

        {/* ========================================================================= */}
        {/* 4. COMPACT LOWER BENEFITS STRIP                                           */}
        {/* ========================================================================= */}
        <div className="w-full max-w-6xl bg-white/95 backdrop-blur-sm border border-[#E8DED6] rounded-[24px] px-6 py-5 shadow-xs">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8 text-left">
            
            {/* 5 Left Benefits Icons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 w-full lg:w-auto flex-1">
              
              {/* Benefit 1 */}
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] flex items-center justify-center text-[#17202A] shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17202A] leading-tight">Better</h4>
                  <p className="text-[11px] text-[#667085] leading-tight">Operations</p>
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] flex items-center justify-center text-[#087B5B] shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17202A] leading-tight">Higher</h4>
                  <p className="text-[11px] text-[#667085] leading-tight">Revenue</p>
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] flex items-center justify-center text-[#D65336] shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17202A] leading-tight">Happier</h4>
                  <p className="text-[11px] text-[#667085] leading-tight">Customers</p>
                </div>
              </div>

              {/* Benefit 4 */}
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] flex items-center justify-center text-[#087B5B] shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17202A] leading-tight">Secure &amp;</h4>
                  <p className="text-[11px] text-[#667085] leading-tight">Reliable</p>
                </div>
              </div>

              {/* Benefit 5 */}
              <div className="flex items-center space-x-3 col-span-2 sm:col-span-1">
                <div className="w-9 h-9 rounded-xl bg-[#FCFAF7] border border-[#E8DED6] flex items-center justify-center text-[#1E40AF] shrink-0">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#17202A] leading-tight">All in</h4>
                  <p className="text-[11px] text-[#667085] leading-tight">One Platform</p>
                </div>
              </div>

            </div>

            {/* Right Side Tagline with Orange Underline */}
            <div className="lg:border-l lg:border-[#E8DED6] lg:pl-8 flex flex-col items-center lg:items-start shrink-0 text-center lg:text-left">
              <span className="text-xs sm:text-sm font-display font-extrabold text-[#17202A] tracking-tight">
                Trusted by modern
                <br className="hidden lg:inline" /> restaurants everywhere.
              </span>
              <div className="w-10 h-0.5 bg-[#D65336] rounded-full mt-1" />
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. DEVELOPER SWITCHBOARD (Role quick access)                             */}
        {/* ========================================================================= */}
        <div className="w-full max-w-6xl pt-2 text-left">
          <button
            type="button"
            onClick={() => setShowSwitcher(!showSwitcher)}
            className="flex items-center space-x-1.5 text-[11px] text-[#8A817A] hover:text-[#17202A] transition-colors font-bold uppercase select-none cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Developer Switchboard</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
          </button>

          {showSwitcher && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 overflow-hidden text-xs"
            >
              {/* Customer QR Ordering */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E8DED6] flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[#17202A]">Customer Portal</h3>
                  <p className="text-[#667085] text-[11px] mt-0.5 mb-2.5">Simulate table-side QR ordering at Table 3.</p>
                </div>
                <Link to="/r/gourmet-palace-saas/table/3" className="w-full text-center px-2.5 py-1.5 bg-[#FCFAF7] hover:bg-[#F5ECE4] border border-[#E8DED6] text-[#17202A] font-bold rounded-lg transition-all">
                  Scan Table QR
                </Link>
              </div>

              {/* Staff Sign In */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E8DED6] flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[#17202A]">Staff Portal</h3>
                  <p className="text-[#667085] text-[11px] mt-0.5 mb-2.5">Waiter, Kitchen KDS, and Cashier access.</p>
                </div>
                <button type="button" onClick={() => navigate('/staff/login')} className="w-full px-2.5 py-1.5 bg-[#FCFAF7] hover:bg-[#F5ECE4] border border-[#E8DED6] text-[#17202A] font-bold rounded-lg transition-all cursor-pointer">
                  Staff Sign In
                </button>
              </div>

              {/* Owner Sign In */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E8DED6] flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[#17202A]">Restaurant Owner</h3>
                  <p className="text-[#667085] text-[11px] mt-0.5 mb-2.5">Owner overview, menus &amp; business metrics.</p>
                </div>
                <button type="button" onClick={() => navigate('/owner/login')} className="w-full px-2.5 py-1.5 bg-[#FCFAF7] hover:bg-[#F5ECE4] border border-[#E8DED6] text-[#17202A] font-bold rounded-lg transition-all cursor-pointer">
                  Owner Sign In
                </button>
              </div>

              {/* Super Admin */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E8DED6] flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[#17202A]">Super Admin</h3>
                  <p className="text-[#667085] text-[11px] mt-0.5 mb-2.5">Platform tenants &amp; system configuration.</p>
                </div>
                <button type="button" onClick={() => navigate('/super-admin/login')} className="w-full px-2.5 py-1.5 bg-[#FCFAF7] hover:bg-[#F5ECE4] border border-[#E8DED6] text-[#17202A] font-bold rounded-lg transition-all cursor-pointer">
                  Super Admin Login
                </button>
              </div>
            </motion.div>
          )}
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 6. MINIMALIST BRAND FOOTER                                                */}
      {/* ========================================================================= */}
      <PublicFooter />
    </div>
  );
};

export default LandingPage;
