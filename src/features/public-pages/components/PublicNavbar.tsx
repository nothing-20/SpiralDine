import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { getDashboardRoute } from '../../../utils/navigation';
import { Sun, Moon, Menu, X, ArrowRight, User } from 'lucide-react';

export const PublicNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Features', path: '/features' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  return (
    <header className="w-full border-b border-[#E8DED6]/80 bg-[#FCFAF7]/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Left side: Logo & Brand */}
        <Link 
          to="/" 
          onClick={handleNavClick}
          className="flex items-center space-x-3.5 group cursor-pointer select-none"
        >
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

        {/* Center Desktop Navigation */}
        <nav 
          aria-label="Public Navigation"
          className="hidden md:flex items-center space-x-8 text-xs font-bold"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `relative py-1 transition-colors cursor-pointer ${
                  isActive ? 'text-[#D65336]' : 'text-[#667085] hover:text-[#D65336]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#D65336] rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right side Desktop Controls */}
        <div className="hidden md:flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2.5 bg-[#F7F0EA] border border-[#E8DED6] rounded-xl text-[#17202A] hover:bg-[#EFE5DC] transition-all shadow-2xs cursor-pointer"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-[#D65336]" /> : <Moon className="w-4 h-4 text-[#17202A]" />}
          </button>

          {user ? (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-[#667085] font-bold hidden lg:inline max-w-[140px] truncate">
                {user.displayName || user.email}
              </span>
              <button
                onClick={() => navigate(getDashboardRoute(user.role))}
                className="px-3.5 py-2 bg-[#FCEDE7] hover:bg-[#F9DDD3] border border-[#F5CBC4] text-[#D65336] rounded-xl text-xs font-bold uppercase transition-all shadow-2xs cursor-pointer flex items-center space-x-1"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={logout}
                className="px-3.5 py-2 bg-[#F7F0EA] hover:bg-[#EFE5DC] border border-[#E8DED6] text-[#17202A] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5">
              <Link
                to="/login"
                className="px-4 py-2 border border-[#E8DED6] bg-white hover:bg-[#F5ECE4] text-[#17202A] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-[#087B5B] hover:bg-[#066349] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Create Restaurant</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger & Controls */}
        <div className="flex items-center space-x-2 md:hidden">
          <button
            onClick={toggleTheme}
            className="p-2 bg-[#F7F0EA] border border-[#E8DED6] rounded-xl text-[#17202A]"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-[#D65336]" /> : <Moon className="w-4 h-4 text-[#17202A]" />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-[#F7F0EA] border border-[#E8DED6] rounded-xl text-[#17202A] hover:bg-[#EFE5DC] transition-all cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#D65336]" /> : <Menu className="w-5 h-5 text-[#17202A]" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E8DED6] bg-[#FCFAF7] px-6 py-5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-3">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-[#FCEDE7] text-[#D65336]'
                      : 'text-[#17202A] hover:bg-[#F7F0EA]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{item.label}</span>
                    {isActive && <span className="w-2 h-2 rounded-full bg-[#D65336]" />}
                  </>
                )}
              </NavLink>
            ))}

            <div className="pt-4 mt-2 border-t border-[#E8DED6] flex flex-col space-y-2.5">
              {user ? (
                <>
                  <div className="px-3 py-1.5 text-xs text-[#8A817A] flex items-center space-x-2">
                    <User className="w-3.5 h-3.5 text-[#D65336]" />
                    <span className="truncate">{user.displayName || user.email} ({user.role})</span>
                  </div>
                  <button
                    onClick={() => {
                      handleNavClick();
                      navigate(getDashboardRoute(user.role));
                    }}
                    className="w-full py-2.5 px-4 bg-[#D65336] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      handleNavClick();
                      logout();
                    }}
                    className="w-full py-2.5 px-4 bg-[#F7F0EA] border border-[#E8DED6] text-[#17202A] font-bold text-xs rounded-xl hover:bg-[#EFE5DC] transition-all cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={handleNavClick}
                    className="w-full py-2.5 px-4 border border-[#E8DED6] bg-white text-[#17202A] font-bold text-xs rounded-xl text-center hover:bg-[#F7F0EA] transition-all"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={handleNavClick}
                    className="w-full py-2.5 px-4 bg-[#087B5B] text-white font-bold text-xs rounded-xl text-center hover:bg-[#066349] transition-all flex items-center justify-center space-x-1.5"
                  >
                    <span>Create Restaurant</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default PublicNavbar;
