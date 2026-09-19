import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Utensils, Store, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

export const LoginSelection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SharedAuthLayout
      roleVariant="default"
      badgeLabel="Choose Portal"
      pageTitle="Sign in to SpiralDine"
      pageSubtitle="Select your role to continue to your dedicated workspace."
      cardMaxWidth="max-w-lg"
    >
      <div className="space-y-6">
        <div className="space-y-3.5">
          {/* Option 1: Customer */}
          <button
            type="button"
            onClick={() => navigate('/customer/login')}
            className="w-full p-4.5 rounded-2xl border border-[#E8DED6] hover:border-[#D65336] bg-[#FCFAF7] hover:bg-white text-left transition-all group shadow-2xs hover:shadow-sm cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#FCEDE7] flex items-center justify-center text-[#D65336] shrink-0 group-hover:scale-105 transition-transform">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-display font-extrabold text-[#17202A] tracking-tight">
                    Customer Sign In
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#FCEDE7] text-[#D65336]">
                    Diner
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5">
                  Scan QR menus, place food orders &amp; track dining sessions
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#8A817A] group-hover:text-[#D65336] group-hover:translate-x-1 transition-all shrink-0 ml-3" />
          </button>

          {/* Option 2: Restaurant Owner */}
          <button
            type="button"
            onClick={() => navigate('/owner/login')}
            className="w-full p-4.5 rounded-2xl border border-[#E8DED6] hover:border-[#087B5B] bg-[#FCFAF7] hover:bg-white text-left transition-all group shadow-2xs hover:shadow-sm cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#E8F5EF] flex items-center justify-center text-[#087B5B] shrink-0 group-hover:scale-105 transition-transform">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-display font-extrabold text-[#17202A] tracking-tight">
                    Restaurant Owner Sign In
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#E8F5EF] text-[#087B5B]">
                    Owner
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5">
                  Manage menus, tables, staff, inventory, billing &amp; analytics
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#8A817A] group-hover:text-[#087B5B] group-hover:translate-x-1 transition-all shrink-0 ml-3" />
          </button>

          {/* Option 3: Super Admin */}
          <button
            type="button"
            onClick={() => navigate('/super-admin/login')}
            className="w-full p-4.5 rounded-2xl border border-[#E8DED6] hover:border-[#1E40AF] bg-[#FCFAF7] hover:bg-white text-left transition-all group shadow-2xs hover:shadow-sm cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#EBF3FC] flex items-center justify-center text-[#1E40AF] shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-display font-extrabold text-[#17202A] tracking-tight">
                    Super Admin Sign In
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#EBF3FC] text-[#1E40AF]">
                    Platform
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5">
                  Authorized platform governance &amp; global administration
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#8A817A] group-hover:text-[#1E40AF] group-hover:translate-x-1 transition-all shrink-0 ml-3" />
          </button>
        </div>

        {/* Operational Staff Portal link & Create Restaurant */}
        <div className="pt-3 text-center border-t border-[#E8DED6] text-xs text-[#667085] space-y-2">
          <p>
            Restaurant staff member?{' '}
            <Link to="/staff/login" className="text-[#087B5B] hover:text-[#066349] font-bold hover:underline inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 inline" />
              <span>Sign In to Staff Portal</span>
            </Link>
          </p>
          <p>
            Looking to register a new restaurant?{' '}
            <Link to="/register" className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline">
              Create Restaurant →
            </Link>
          </p>
        </div>
      </div>
    </SharedAuthLayout>
  );
};

export default LoginSelection;
