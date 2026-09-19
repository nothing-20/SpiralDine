import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft, Shield, Sparkles } from 'lucide-react';

// Decorative food & botanical assets
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

export type TAuthRoleVariant = 'customer' | 'owner' | 'super-admin' | 'staff' | 'default';

export interface SharedAuthLayoutProps {
  children?: React.ReactNode;
  roleVariant?: TAuthRoleVariant;
  badgeLabel?: string;
  pageTitle?: string;
  pageSubtitle?: string;
  icon?: React.ReactNode;
  cardMaxWidth?: string; // e.g. 'max-w-md', 'max-w-[540px]', 'max-w-lg'
  showBackHome?: boolean;
}

export const SharedAuthLayout: React.FC<SharedAuthLayoutProps> = ({
  children,
  roleVariant = 'default',
  badgeLabel,
  pageTitle,
  pageSubtitle,
  icon,
  cardMaxWidth = 'max-w-md',
  showBackHome = true,
}) => {
  // Role-specific aesthetic indicators
  const getRoleTheme = () => {
    switch (roleVariant) {
      case 'customer':
        return {
          badgeBg: 'bg-[#FCEDE7]',
          badgeText: 'text-[#D65336]',
          badgeBorder: 'border-[#F5CBC4]',
          accentColor: '#D65336',
          iconBg: 'bg-[#FCEDE7]',
          iconColor: 'text-[#D65336]',
          footerTag: 'Customer Portal • Secure Dining Experience',
        };
      case 'owner':
        return {
          badgeBg: 'bg-[#E8F5EF]',
          badgeText: 'text-[#087B5B]',
          badgeBorder: 'border-[#A3E0C8]',
          accentColor: '#087B5B',
          iconBg: 'bg-[#E8F5EF]',
          iconColor: 'text-[#087B5B]',
          footerTag: 'Restaurant Owner Portal • Enterprise Management',
        };
      case 'super-admin':
        return {
          badgeBg: 'bg-[#EBF3FC]',
          badgeText: 'text-[#1E40AF]',
          badgeBorder: 'border-[#BFDBFE]',
          accentColor: '#1E3A8A',
          iconBg: 'bg-[#1E3A5F]',
          iconColor: 'text-white',
          footerTag: 'Super Admin Portal • Privileged Platform Administration',
        };
      case 'staff':
        return {
          badgeBg: 'bg-[#E8F5EF]',
          badgeText: 'text-[#087B5B]',
          badgeBorder: 'border-[#A3E0C8]',
          accentColor: '#087B5B',
          iconBg: 'bg-[#E8F5EF]',
          iconColor: 'text-[#087B5B]',
          footerTag: 'Staff Operations • Real-Time Kitchen & Floor Portal',
        };
      default:
        return {
          badgeBg: 'bg-[#FCEDE7]',
          badgeText: 'text-[#D65336]',
          badgeBorder: 'border-[#F5CBC4]',
          accentColor: '#D65336',
          iconBg: 'bg-[#FCEDE7]',
          iconColor: 'text-[#D65336]',
          footerTag: 'SpiralDine • One Platform. Three Experiences.',
        };
    }
  };

  const theme = getRoleTheme();

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17202A] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm circular background ambient glows */}
      <div 
        className="absolute top-[12%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" 
        aria-hidden="true"
      />
      <div 
        className="absolute bottom-[6%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F5ECE4]/80 blur-[2px] pointer-events-none z-0" 
        aria-hidden="true"
      />

      {/* LEFT SIDE: Decorative food plate entering from left edge */}
      <div 
        className="hidden sm:block absolute left-[-240px] md:left-[-220px] lg:left-[-190px] xl:left-[-150px] top-[20%] md:top-[22%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <img 
          src={leftPlateImg} 
          alt="" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12 pointer-events-none"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div 
        className="hidden md:block absolute left-[220px] lg:left-[270px] top-[30%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm"
        aria-hidden="true"
      >
        <img src={basilLeaf2} alt="" className="w-full h-full object-contain pointer-events-none" />
      </div>

      {/* RIGHT SIDE: Decorative food plate entering from right edge */}
      <div 
        className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[10%] md:bottom-[12%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <img 
          src={rightPlateImg} 
          alt="" 
          className="w-full h-auto drop-shadow-xl transform rotate-6 pointer-events-none"
        />
      </div>

      {/* Right side: Floating basil garnish */}
      <div 
        className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[42%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm"
        aria-hidden="true"
      >
        <img src={basilLeaf1} alt="" className="w-full h-full object-contain pointer-events-none" />
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP BRANDING HEADER                                                    */}
      {/* ========================================================================= */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center space-x-3.5 group cursor-pointer select-none">
          <div className="w-10 h-10 bg-[#D65336] group-hover:bg-[#B9432D] transition-colors rounded-xl flex items-center justify-center shadow-xs">
            <span className="text-white font-extrabold text-xl font-display leading-none">S</span>
          </div>
          <div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#17202A]">
              Spiral <span className="text-[#D65336]">Dine</span>
            </span>
            <p className="text-[10px] font-semibold text-[#8A817A] hidden sm:block leading-none mt-0.5">
              Smart Dining. Smarter Business.
            </p>
          </div>
        </Link>

        {showBackHome && (
          <Link 
            to="/" 
            className="inline-flex items-center space-x-1 text-xs font-bold text-[#667085] hover:text-[#17202A] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F5ECE4]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CENTERED CONTENT CONTAINER                                        */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-10 flex flex-col items-center justify-center flex-1 relative z-10">
        <div className={`w-full ${cardMaxWidth}`}>
          {/* Card Container */}
          <div className="w-full p-6 sm:p-8 md:p-10 bg-white border border-[#E8DED6] rounded-[28px] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden text-left">
            
            {/* Top right decorative shape corner */}
            {roleVariant === 'customer' && (
              <div 
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#FCEDE7] via-[#FDF3EE]/60 to-transparent rounded-bl-full pointer-events-none" 
                aria-hidden="true" 
              />
            )}
            {roleVariant === 'owner' && (
              <div 
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#E8F5EF] via-[#F0F9F5]/60 to-transparent rounded-bl-full pointer-events-none" 
                aria-hidden="true" 
              />
            )}
            {roleVariant === 'super-admin' && (
              <div 
                className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#EBF3FC] via-[#F1F6FD]/60 to-transparent rounded-bl-full pointer-events-none" 
                aria-hidden="true" 
              />
            )}

            {/* Optional Card Header with Icon / Badge / Titles */}
            {(icon || badgeLabel || pageTitle || pageSubtitle) && (
              <div className="space-y-3 text-center mb-7 relative z-10">
                {icon && (
                  <div className={`w-14 h-14 ${theme.iconBg} rounded-2xl flex items-center justify-center mx-auto shadow-2xs`}>
                    {icon}
                  </div>
                )}
                {badgeLabel && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase border mt-1 select-none"
                    style={{
                      backgroundColor: theme.badgeBg.replace('bg-', ''),
                    }}
                  >
                    <span className={theme.badgeText}>{badgeLabel}</span>
                  </div>
                )}
                {pageTitle && (
                  <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17202A] tracking-tight">
                    {pageTitle}
                  </h1>
                )}
                {pageSubtitle && (
                  <p className="text-xs sm:text-sm text-[#667085] font-normal leading-relaxed max-w-sm mx-auto">
                    {pageSubtitle}
                  </p>
                )}
              </div>
            )}

            {/* Form / Page Content */}
            <div className="relative z-10">
              {children || <Outlet />}
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. MINIMALIST BRAND FOOTER                                                */}
      {/* ========================================================================= */}
      <footer className="w-full border-t border-[#E8DED6] bg-[#F7F0EA]/70 relative z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-[#8A817A]">
          <div>
            <span>&copy; {new Date().getFullYear()} Spiral Dine. All rights reserved.</span>
          </div>
          <div className="flex space-x-5">
            <Link to="/about" className="hover:text-[#17202A] transition-colors">About</Link>
            <Link to="/features" className="hover:text-[#17202A] transition-colors">Features</Link>
            <Link to="/pricing" className="hover:text-[#17202A] transition-colors">Pricing</Link>
            <Link to="/contact" className="hover:text-[#17202A] transition-colors">Contact</Link>
          </div>
          <div className="text-[11px] text-[#8A817A] flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#087B5B]" />
            <span>{theme.footerTag}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SharedAuthLayout;
