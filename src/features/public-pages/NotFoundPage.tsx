import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout from './components/PublicPageLayout';
import { ArrowLeft, Home, HelpCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Page Not Found';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  return (
    <PublicPageLayout>
      <div className="w-full max-w-3xl mx-auto px-6 py-20 md:py-28 text-center flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-3xl bg-[#FCEDE7] border border-[#F5CBC4] flex items-center justify-center text-[#D65336] mb-6 shadow-sm">
          <span className="text-3xl font-extrabold font-display">404</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#17202A] tracking-tight mb-3">
          Page Not Found
        </h1>

        <p className="text-sm text-[#667085] leading-relaxed max-w-md mb-8">
          The page or route you are looking for doesn't exist, has been removed, or is temporarily unavailable.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="px-6 py-3 bg-[#D65336] hover:bg-[#B9432D] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-2"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
          <Link
            to="/contact"
            className="px-6 py-3 bg-white hover:bg-[#F7F0EA] border border-[#E8DED6] text-[#17202A] text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center space-x-2"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#8A817A]" />
            <span>Contact Support</span>
          </Link>
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default NotFoundPage;
