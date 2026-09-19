import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isCustomAuthLayout = 
    location.pathname === '/owner/login' || 
    location.pathname === '/login' || 
    location.pathname === '/register' ||
    location.pathname === '/staff/login';

  if (isCustomAuthLayout) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel rounded-2xl p-8 relative z-10 border border-slate-800/40">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 mb-3">
            <span className="text-primary font-display font-extrabold text-2xl">S</span>
          </div>
          <h1 className="text-xl font-display font-bold text-textPearl">Spiral Dine</h1>
          <p className="text-xs text-mutedAsh mt-1">Unified Restaurant SaaS Platform</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};
export default AuthLayout;

