import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { getDashboardRoute } from '../../../utils/navigation';
import { cn } from '../../../utils/cn';
import { 
  SUPPORTED_COUNTRIES, 
  SUPPORTED_CURRENCIES, 
  detectDefaultCountryAndCurrency 
} from '../../../shared/utils/format';

// Decorative food imagery
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

// Lucide icons
import { 
  Store, 
  User,
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Globe,
  DollarSign,
  ShieldCheck,
  TrendingUp, 
  Settings, 
  Heart, 
  Leaf 
} from 'lucide-react';

export const RegisterForm: React.FC = () => {
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const detected = detectDefaultCountryAndCurrency();
  const [restaurantName, setRestaurantName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState(detected.country);
  const [currency, setCurrency] = useState(detected.currency);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    restaurantName?: string;
    displayName?: string;
    email?: string;
    password?: string;
  }>({});

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCountry = e.target.value;
    setCountry(nextCountry);
    const countryConfig = SUPPORTED_COUNTRIES[nextCountry];
    if (countryConfig) {
      setCurrency(countryConfig.defaultCurrency);
    }
  };

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!restaurantName.trim()) {
      nextErrors.restaurantName = 'Restaurant name is required';
    }
    if (!displayName.trim()) {
      nextErrors.displayName = 'Full name is required';
    }
    if (!email) {
      nextErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      nextErrors.email = 'Email format is invalid';
    }
    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Register owner credentials with localized country, currency, and locale
      const locale = SUPPORTED_CURRENCIES[currency]?.locale || 'en-IN';
      await authService.signUpOwner(
        email, 
        password, 
        displayName, 
        restaurantName, 
        country, 
        currency, 
        locale
      );
      
      addToast('Restaurant registered successfully!', 'success');
      
      // Direct route to dashboard
      const destination = getDashboardRoute('owner');
      navigate(destination, { replace: true });
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Registration failed. Please check parameters.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17233D] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm circular background ambient backdrops */}
      <div className="absolute top-[16%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3E8DF]/80 blur-[2px] pointer-events-none z-0" />
      <div className="absolute bottom-[6%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3E8DF]/80 blur-[2px] pointer-events-none z-0" />

      {/* LEFT SIDE: Food plate entering from left edge */}
      <div className="hidden sm:block absolute left-[-240px] md:left-[-220px] lg:left-[-190px] xl:left-[-150px] top-[20%] md:top-[22%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Artisanal Dining Dish" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div className="hidden md:block absolute left-[220px] lg:left-[270px] top-[30%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Left side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute left-8 xl:left-14 bottom-24 xl:bottom-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Great Restaurants
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Build Great Stories
        </span>
        <div className="w-24 h-0.5 bg-[#C94F3D]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* RIGHT SIDE: Food plate entering from right edge */}
      <div className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[10%] md:bottom-[12%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={rightPlateImg} 
          alt="Artisanal Entree Dish" 
          className="w-full h-auto drop-shadow-xl transform rotate-6"
        />
      </div>

      {/* Right side: Floating basil garnish */}
      <div className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[42%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm">
        <img src={basilLeaf1} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Right side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute right-10 xl:right-16 top-24 xl:top-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Your Restaurant
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Your Growth
        </span>
        <div className="w-28 h-0.5 bg-[#C94F3D]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP BRANDING HEADER                                                    */}
      {/* ========================================================================= */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center space-x-3.5 group">
          <div className="w-10 h-10 bg-[#C94F3D] rounded-xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <span className="text-white font-extrabold text-xl font-display leading-none">S</span>
          </div>
          <div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#17233D]">
              Spiral <span className="text-[#C94F3D]">Dine</span>
            </span>
            <p className="text-[10px] font-semibold text-[#667085] hidden sm:block leading-none mt-0.5">
              Smart Dining. Smarter Business.
            </p>
          </div>
        </Link>

        <Link 
          to="/" 
          className="inline-flex items-center space-x-1 text-xs font-bold text-[#667085] hover:text-[#17233D] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F3E8DF]"
        >
          <span>← Back to Home</span>
        </Link>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: CENTERED REGISTRATION CARD (~520–560px)                  */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-6 py-6 md:py-8 flex flex-col items-center justify-center flex-1 relative z-10 space-y-8">
        
        {/* Centered White Card */}
        <div className="max-w-[540px] w-full p-8 sm:p-10 bg-white border border-[#E5E1DC] rounded-[24px] shadow-md relative overflow-hidden text-left">
          
          {/* Card Icon & Header */}
          <div className="space-y-3 text-center mb-7">
            <div className="w-14 h-14 bg-[#F8E8E2] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
              <Store className="w-7 h-7 text-[#C94F3D]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#17233D] tracking-tight">
              Create Your Restaurant Account
            </h1>
            <p className="text-sm text-[#667085] font-normal leading-relaxed max-w-sm mx-auto">
              Join Spiral Dine and start managing your restaurant with ease.
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Restaurant Name Field */}
            <div className="w-full flex flex-col space-y-1.5 text-left">
              <label htmlFor="reg-restaurant-name" className="text-xs font-bold text-[#17233D] select-none">
                Restaurant Name
              </label>
              <div className="relative flex items-center">
                <Store className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-restaurant-name"
                  type="text"
                  placeholder="e.g. Bella Tavola Ristorante"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  disabled={isLoading}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                    errors.restaurantName ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  )}
                />
              </div>
              {errors.restaurantName && (
                <span className="text-xs font-semibold text-red-600 pl-1">{errors.restaurantName}</span>
              )}
            </div>

            {/* Owner's Full Name Field */}
            <div className="w-full flex flex-col space-y-1.5 text-left">
              <label htmlFor="reg-owner-name" className="text-xs font-bold text-[#17233D] select-none">
                Owner's Full Name
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-owner-name"
                  type="text"
                  placeholder="e.g. Marco Rossi"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                    errors.displayName ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  )}
                />
              </div>
              {errors.displayName && (
                <span className="text-xs font-semibold text-red-600 pl-1">{errors.displayName}</span>
              )}
            </div>

            {/* Country & Currency Selection (Side by Side on Desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5 text-left">
                <label htmlFor="reg-country" className="text-xs font-bold text-[#17233D] flex items-center gap-1.5 select-none">
                  <Globe className="w-3.5 h-3.5 text-[#C94F3D]" />
                  Country
                </label>
                <div className="relative flex items-center">
                  <select
                    id="reg-country"
                    value={country}
                    onChange={handleCountryChange}
                    disabled={isLoading}
                    className="w-full bg-white border border-[#E5E1DC] rounded-xl px-3.5 py-3 text-sm font-medium text-[#17233D] focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 transition-all cursor-pointer disabled:opacity-60 disabled:bg-[#F3E8DF]"
                  >
                    {Object.values(SUPPORTED_COUNTRIES).map((c) => (
                      <option key={c.code} value={c.code} className="text-[#17233D]">
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label htmlFor="reg-currency" className="text-xs font-bold text-[#17233D] flex items-center gap-1.5 select-none">
                  <DollarSign className="w-3.5 h-3.5 text-[#C94F3D]" />
                  Currency
                </label>
                <div className="relative flex items-center">
                  <select
                    id="reg-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    disabled={isLoading}
                    className="w-full bg-white border border-[#E5E1DC] rounded-xl px-3.5 py-3 text-sm font-medium text-[#17233D] focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 transition-all cursor-pointer disabled:opacity-60 disabled:bg-[#F3E8DF]"
                  >
                    {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                      <option key={curr.code} value={curr.code} className="text-[#17233D]">
                        {curr.name} - {curr.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Email Field */}
            <div className="w-full flex flex-col space-y-1.5 text-left">
              <label htmlFor="reg-email" className="text-xs font-bold text-[#17233D] select-none">
                Contact Email
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-email"
                  type="email"
                  placeholder="owner@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                    errors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  )}
                />
              </div>
              {errors.email && (
                <span className="text-xs font-semibold text-red-600 pl-1">{errors.email}</span>
              )}
            </div>

            {/* Password Field with Functional Eye Visibility Toggle */}
            <div className="w-full flex flex-col space-y-1.5 text-left">
              <label htmlFor="reg-password" className="text-xs font-bold text-[#17233D] select-none">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className={cn(
                    "w-full pl-10 pr-12 py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                    errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#667085] hover:text-[#17233D] focus:outline-none focus:ring-2 focus:ring-[#C94F3D]/40 rounded-lg transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="text-xs font-semibold text-red-600 pl-1">{errors.password}</span>
              )}
            </div>

            {/* Security Note */}
            <div className="flex items-start space-x-2.5 text-[11px] text-[#667085] bg-[#FCFAF7] border border-[#E5E1DC] rounded-xl p-3">
              <ShieldCheck className="w-4 h-4 text-[#16866D] shrink-0 mt-0.5" />
              <span className="leading-snug">
                Your information is secure and will only be used for setting up your restaurant account.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-13 mt-3 bg-[#C94F3D] hover:bg-[#A93E30] active:bg-[#923326] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account & Onboard</span>
                  <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                </>
              )}
            </button>
          </form>

          {/* Sign In Link inside Card */}
          <div className="text-center mt-6 pt-5 border-t border-[#E5E1DC] text-xs">
            <p className="text-[#667085] font-medium">
              Already have a merchant workspace?{' '}
              <Link to="/login" className="text-[#C94F3D] hover:text-[#A93E30] font-bold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Subtle Bottom Value Strip on Desktop & Tablet */}
        <div className="w-full max-w-4xl hidden md:block pt-2">
          <div className="grid grid-cols-4 gap-4 text-left">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F8E8E2] text-[#C94F3D] flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">More Revenue</h4>
                <p className="text-[10px] text-[#667085]">Reach more customers</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E7F5EF] text-[#16866D] flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">Smarter Operations</h4>
                <p className="text-[10px] text-[#667085]">Manage everything easily</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F8E8E2] text-[#C94F3D] flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">Happier Guests</h4>
                <p className="text-[10px] text-[#667085]">Better dining experiences</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E7F5EF] text-[#16866D] flex items-center justify-center shrink-0">
                <Leaf className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#17233D]">Sustainable Growth</h4>
                <p className="text-[10px] text-[#667085]">Built for the future</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. MINIMALIST FOOTER                                                      */}
      {/* ========================================================================= */}
      <footer className="w-full border-t border-[#E5E1DC] bg-[#F3E8DF]/60 relative z-20">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-[#667085]">
          <div>
            <span>&copy; {new Date().getFullYear()} Spiral Dine. All rights reserved.</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-[#17233D] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Support Desk</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Contact Us</a>
          </div>
          <div>
            <span className="text-[11px] text-[#667085]">Owner Registration • Direct Onboard</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RegisterForm;
