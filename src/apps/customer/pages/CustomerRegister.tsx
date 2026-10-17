import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import { zodResolver } from '../../../utils/zodResolver';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Input from '../../../components/ui/Input/Input';
import Button from '../../../components/ui/Button/Button';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { UserPlus, ShieldAlert } from 'lucide-react';

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
      navigate('/customer/restaurants');
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
    <div className="min-h-screen bg-[#FCFAF7] flex items-center justify-center p-4 sm:p-6 text-left relative overflow-hidden select-none">
      <Card className="max-w-md w-full p-6 sm:p-8 md:p-10 bg-white border border-[#E9DED6] rounded-[24px] shadow-md relative z-10">
        <div className="space-y-2 text-center mb-6">
          <div className="w-14 h-14 bg-[#FCEDE7] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
            <UserPlus className="w-7 h-7 text-[#D65336]" />
          </div>
          <h1 className="text-2xl font-display font-extrabold text-[#17202A] tracking-tight">Diner Registration</h1>
          <p className="text-xs text-[#667085] font-normal leading-relaxed">Join Spiral Dine to start ordering table-side dishes and save your dining history.</p>
        </div>

        {errorText && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-600 font-semibold mb-4">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            error={errors.fullName?.message}
            disabled={isSubmitting}
            {...register('fullName')}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="john@example.com"
            error={errors.email?.message}
            disabled={isSubmitting}
            {...register('email')}
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            placeholder="+1 555-0199"
            error={errors.phoneNumber?.message}
            disabled={isSubmitting}
            {...register('phoneNumber')}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            disabled={isSubmitting}
            {...register('password')}
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            disabled={isSubmitting}
            {...register('confirmPassword')}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 mt-4 bg-[#D65336] hover:bg-[#B9432D] active:bg-[#A83C27] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating Account...</span>
              </div>
            ) : (
              <span>Create Customer Account</span>
            )}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-[#E9DED6] text-xs text-[#667085] font-semibold space-y-2">
          <p>
            Already have a customer account?{' '}
            <Link to="/customer/login" className="text-[#D65336] hover:underline font-bold">
              Sign In
            </Link>
          </p>
          <p>
            <Link to="/" className="text-[#8A817A] hover:text-[#17202A] transition-colors">
              ← Back to choosing experience
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};
export default CustomerRegister;
