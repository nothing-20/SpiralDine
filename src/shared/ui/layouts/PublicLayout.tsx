import React from 'react';
import { Outlet } from 'react-router-dom';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />
      
      <header className="h-16 border-b border-slate-800/40 bg-slate-950/20 backdrop-blur-md flex items-center justify-between px-6 md:px-12 z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-primary font-display font-extrabold text-lg">S</span>
          </div>
          <span className="font-display font-bold text-base text-textPearl">Spiral Dine</span>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <Outlet />
      </main>

      <footer className="py-6 border-t border-slate-800/40 text-center text-xs text-slate-500 bg-slate-950/10">
        <span>© 2026 Spiral Dine Inc. All rights reserved.</span>
      </footer>
    </div>
  );
};
export default PublicLayout;
