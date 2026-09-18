import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export const PublicFooter: React.FC = () => {
  const handleScrollTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="w-full border-t border-[#E8DED6] bg-[#F7F0EA]/80 relative z-20 text-left">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: Brand */}
          <div className="space-y-3 md:col-span-1">
            <Link 
              to="/" 
              onClick={handleScrollTop}
              className="flex items-center space-x-2.5"
            >
              <div className="w-8 h-8 bg-[#D65336] rounded-lg flex items-center justify-center shadow-xs">
                <span className="text-white font-extrabold text-base font-display">S</span>
              </div>
              <span className="font-display font-extrabold text-lg tracking-tight text-[#17202A]">
                Spiral <span className="text-[#D65336]">Dine</span>
              </span>
            </Link>
            <p className="text-xs text-[#667085] leading-relaxed">
              One connected operating system for modern restaurants. Unifying guest ordering, kitchen display, waiter workflows, and owner intelligence.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#17202A]">Navigation</h4>
            <ul className="space-y-2 text-xs text-[#667085]">
              <li>
                <Link to="/" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/features" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/pricing" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link to="/about" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  About SpiralDine
                </Link>
              </li>
              <li>
                <Link to="/contact" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Contact Sales & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Portals */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#17202A]">Portals</h4>
            <ul className="space-y-2 text-xs text-[#667085]">
              <li>
                <Link to="/customer/login" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Customer Dining Sign In
                </Link>
              </li>
              <li>
                <Link to="/owner/login" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Restaurant Owner Portal
                </Link>
              </li>
              <li>
                <Link to="/staff/login" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Staff Workspace (Kitchen & Waiter)
                </Link>
              </li>
              <li>
                <Link to="/register" onClick={handleScrollTop} className="hover:text-[#D65336] transition-colors">
                  Create Restaurant Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Support */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#17202A]">Direct Support</h4>
            <p className="text-xs text-[#667085]">
              Have questions or need assistance with your restaurant setup?
            </p>
            <a 
              href="mailto:support@restaurantos.com" 
              className="inline-flex items-center space-x-2 text-xs font-semibold text-[#D65336] hover:underline"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>support@restaurantos.com</span>
            </a>
            <div className="pt-2">
              <Link 
                to="/contact" 
                onClick={handleScrollTop}
                className="inline-block px-3.5 py-1.5 bg-white border border-[#E8DED6] hover:border-[#D65336] text-[#17202A] text-xs font-bold rounded-lg transition-all shadow-2xs"
              >
                Send an Enquiry
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom copyright bar */}
        <div className="pt-6 border-t border-[#E8DED6] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-[#8A817A]">
          <div>
            <span>&copy; {new Date().getFullYear()} Spiral Dine. All rights reserved.</span>
          </div>
          <div className="flex space-x-6">
            <Link to="/about" onClick={handleScrollTop} className="hover:text-[#17202A] transition-colors">
              About
            </Link>
            <Link to="/contact" onClick={handleScrollTop} className="hover:text-[#17202A] transition-colors">
              Support Desk
            </Link>
            <Link to="/contact" onClick={handleScrollTop} className="hover:text-[#17202A] transition-colors">
              Contact Us
            </Link>
          </div>
          <div>
            <span className="text-[11px] text-[#8A817A]">Build Version: v1.3.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
