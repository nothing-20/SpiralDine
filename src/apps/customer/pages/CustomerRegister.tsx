import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { zodResolver } from '../../../utils/zodResolver';
import { cn } from '../../../utils/cn';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { UserPlus, ShieldAlert, ArrowRight, Eye, EyeOff } from 'lucide-react';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password confirmation must be at least 6 characters'),
  phoneNumber: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

type TRegisterForm = z.infer<typeof registerSchema>;

export const CustomerRegister: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<TRegisterForm>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: TRegisterForm) => {
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await authService.signUpCustomer(data.email, data.password, data.fullName, data.phoneNumber);
      toast.success('Account created successfully! Welcome to Spiral Dine.');
      navigate('/customer/home');
    } catch (e: any) {
      console.error(e);
      let msg = e.message || 'Registration failed. Please try again.';
      if (e.code === 'auth/email-already-in-use') {
        msg = 'Email already exists. If you have an account, please sign in.';
      } else if (e.code === 'auth/weak-password') {
        msg = 'Password is too weak.';
      } else if (e.code === 'auth/network-request-failed') {
        msg = 'Network error. Please check your internet connection.';
      }
      setErrorText(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SharedAuthLayout
      roleVariant="customer"
      badgeLabel="Customer Account"
      pageTitle="Diner Registration"
      pageSubtitle="Create your Spiral Dine diner account to order food &amp; save favorite tables."
      icon={<UserPlus className="w-7 h-7 text-[#D65336]" />}
      cardMaxWidth="max-w-[500px]"
    >
      {errorText && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700 font-semibold mb-5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{errorText}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="cust-fullname" className="text-xs font-bold text-[#17202A]">
            Full Name
          </label>
          <input
            id="cust-fullname"
            type="text"
            placeholder="Jane Doe"
            disabled={isSubmitting}
            className={cn(
              "w-full px-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
              errors.fullName ? "border-red-500 focus:border-red-500" : ""
            )}
            {...register('fullName')}
          />
          {errors.fullName?.message && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.fullName.message}</span>
          )}
        </div>

        {/* Email */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="cust-reg-email" className="text-xs font-bold text-[#17202A]">
            Email Address
          </label>
          <input
            id="cust-reg-email"
            type="email"
            placeholder="jane@example.com"
            disabled={isSubmitting}
            className={cn(
              "w-full px-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
              errors.email ? "border-red-500 focus:border-red-500" : ""
            )}
            {...register('email')}
          />
          {errors.email?.message && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.email.message}</span>
          )}
        </div>

        {/* Phone */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="cust-phone" className="text-xs font-bold text-[#17202A]">
            Phone Number (Optional)
          </label>
          <input
            id="cust-phone"
            type="tel"
            placeholder="+1 555-0199"
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]"
            {...register('phoneNumber')}
          />
        </div>

        {/* Password */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="cust-reg-pass" className="text-xs font-bold text-[#17202A]">
            Password
          </label>
          <div className="relative flex items-center">
            <input
              id="cust-reg-pass"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isSubmitting}
              className={cn(
                "w-full pl-4 pr-12 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.password ? "border-red-500 focus:border-red-500" : ""
              )}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17202A] rounded-lg transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password?.message && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.password.message}</span>
          )}
        </div>

        {/* Confirm Password */}
        <div className="w-full flex flex-col space-y-1.5 text-left">
          <label htmlFor="cust-reg-confirm" className="text-xs font-bold text-[#17202A]">
            Confirm Password
          </label>
          <div className="relative flex items-center">
            <input
              id="cust-reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              disabled={isSubmitting}
              className={cn(
                "w-full pl-4 pr-12 py-3 bg-[#FCFAF7] border border-[#E8DED6] text-[#17202A] rounded-xl text-sm placeholder-[#8A94A3] transition-all focus:outline-none focus:border-[#D65336] focus:ring-2 focus:ring-[#D65336]/20 disabled:opacity-60 disabled:bg-[#F5ECE4]",
                errors.confirmPassword ? "border-red-500 focus:border-red-500" : ""
              )}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#8A94A3] hover:text-[#17202A] rounded-lg transition-colors cursor-pointer"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword?.message && (
            <span className="text-xs font-semibold text-red-600 pl-1">{errors.confirmPassword.message}</span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 mt-3 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Create Customer Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-6 pt-5 border-t border-[#E8DED6] text-xs text-[#667085] space-y-2">
        <p>
          Already have a customer account?{' '}
          <Link to="/customer/login" className="text-[#D65336] hover:text-[#B9432D] font-bold hover:underline">
            Sign In
          </Link>
        </p>
        <p>
          <Link to="/" className="text-[#8A817A] hover:text-[#17202A] transition-colors">
            ← Back to Home
          </Link>
        </p>
      </div>
    </SharedAuthLayout>
  );
};

export default CustomerRegister;
