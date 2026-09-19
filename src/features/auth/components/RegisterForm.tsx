import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { useToastStore } from '../../../components/ui/Toast/Toast';
import { getDashboardRoute } from '../../../utils/navigation';
import { cn } from '../../../utils/cn';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';
import { 
  SUPPORTED_COUNTRIES, 
  SUPPORTED_CURRENCIES, 
  detectDefaultCountryAndCurrency 
} from '../../../shared/utils/format';

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
  ArrowRight
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
    <SharedAuthLayout
      roleVariant="owner"
      badgeLabel="Merchant Onboarding"
      pageTitle="Create Your Restaurant"
      pageSubtitle="Join Spiral Dine and start managing your restaurant, kitchen &amp; tables."
      icon={<Store className="w-7 h-7 text-[#087B5B]" />}
      cardMaxWidth="max-w-[540px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Restaurant Name Field */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="reg-restaurant-name" className="text-xs font-bold text-[#17202A] select-none">
            Restaurant Name
          </label>
          <div className="relative flex items-center">
            <Store className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="reg-restaurant-name"
              type="text"
              placeholder="e.g. Bella Tavola Ristorante"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full pl-10 pr-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.restaurantName ? "border-red-500 focus:border-red-500" : ""
              )}
            />
          </div>
          {errors.restaurantName && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.restaurantName}</span>
          )}
        </div>

        {/* Owner's Full Name Field */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="reg-owner-name" className="text-xs font-bold text-[#17202A] select-none">
            Owner's Full Name
          </label>
          <div className="relative flex items-center">
            <User className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="reg-owner-name"
              type="text"
              placeholder="e.g. Marco Rossi"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full pl-10 pr-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.displayName ? "border-red-500 focus:border-red-500" : ""
              )}
            />
          </div>
          {errors.displayName && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.displayName}</span>
          )}
        </div>

        {/* Country & Currency Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5 text-left">
            <label htmlFor="reg-country" className="text-xs font-bold text-[#17202A] flex items-center gap-1.5 select-none">
              <Globe className="w-3.5 h-3.5 text-[#087B5B]" />
              Country
            </label>
            <select
              id="reg-country"
              value={country}
              onChange={handleCountryChange}
              disabled={isLoading}
              className="w-full bg-[#FCFAF7] border border-[#E8DED6] rounded-xl px-3.5 py-3 text-sm font-medium text-[#17202A] focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 transition-all cursor-pointer disabled:opacity-60 disabled:bg-[#F5ECE4]"
            >
              {Object.values(SUPPORTED_COUNTRIES).map((c) => (
                <option key={c.code} value={c.code} className="text-[#17202A]">
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="reg-currency" className="text-xs font-bold text-[#17202A] flex items-center gap-1.5 select-none">
              <DollarSign className="w-3.5 h-3.5 text-[#087B5B]" />
              Currency
            </label>
            <select
              id="reg-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLoading}
              className="w-full bg-[#FCFAF7] border border-[#E8DED6] rounded-xl px-3.5 py-3 text-sm font-medium text-[#17202A] focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 transition-all cursor-pointer disabled:opacity-60 disabled:bg-[#F5ECE4]"
            >
              {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                <option key={curr.code} value={curr.code} className="text-[#17202A]">
                  {curr.name} - {curr.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contact Email Field */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="reg-email" className="text-xs font-bold text-[#17202A] select-none">
            Contact Email
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="reg-email"
              type="email"
              placeholder="owner@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full pl-10 pr-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.email ? "border-red-500 focus:border-red-500" : ""
              )}
            />
          </div>
          {errors.email && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.email}</span>
          )}
        </div>

        {/* Password Field with Eye Visibility Toggle */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="reg-password" className="text-xs font-bold text-[#17202A] select-none">
            Password
          </label>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-[#8A94A3] absolute left-3.5 pointer-events-none" />
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className={cn(
                "w-full pl-10 pr-12 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#087B5B] focus:ring-2 focus:ring-[#087B5B]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.password ? "border-red-500 focus:border-red-500" : ""
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#087B5B]/40 rounded-lg transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.password}</span>
          )}
        </div>

        {/* Security Note */}
        <div className="flex items-start space-x-2.5 text-[11px] text-[#667085] bg-[#F7F0EA]/70 border border-[#E8DED6] rounded-xl p-3">
          <ShieldCheck className="w-4 h-4 text-[#087B5B] shrink-0 mt-0.5" />
          <span className="leading-snug">
            Your restaurant workspace is protected with role-based security and tenant-isolated data storage.
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 mt-3 bg-[#087B5B] hover:bg-[#066349] active:bg-[#054E3A] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Create Restaurant Account</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>

        {/* Sign In Link inside Card */}
        <div className="text-center pt-5 border-t border-[#E8DED6] text-xs">
          <p className="text-[#667085] font-medium">
            Already have a restaurant workspace?{' '}
            <Link to="/owner/login" className="text-[#087B5B] hover:text-[#066349] font-bold hover:underline">
              Owner Sign In
            </Link>
          </p>
        </div>
      </form>
    </SharedAuthLayout>
  );
};

export default RegisterForm;
