import React from 'react';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

interface PublicPageLayoutProps {
  children: React.ReactNode;
}

export const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17202A] flex flex-col justify-between relative overflow-x-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-[5%] left-[-150px] w-[500px] h-[500px] rounded-full bg-[#F5ECE4]/70 blur-[3px] pointer-events-none z-0" />
      <div className="absolute bottom-[5%] right-[-150px] w-[500px] h-[500px] rounded-full bg-[#F5ECE4]/70 blur-[3px] pointer-events-none z-0" />

      {/* Top sticky navbar */}
      <PublicNavbar />

      {/* Main page content */}
      <main className="flex-1 relative z-10 w-full">
        {children}
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default PublicPageLayout;
