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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-left relative overflow-hidden select-none">
      <div className="absolute top-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />

      <Card className="max-w-md w-full p-8 border-slate-850 bg-slate-900/40 relative z-10">
        <div className="space-y-2 text-center mb-6">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/5">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-display font-extrabold text-textPearl">Diner Registration</h1>
          <p className="text-xs text-mutedAsh font-semibold">Join Spiral Dine to start ordering table-side dishes.</p>
        </div>

        {errorText && (
          <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl flex items-start space-x-2 text-xs text-red-400 font-semibold mb-4">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
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

          <Button
            type="submit"
            className="w-full mt-4"
            isLoading={isSubmitting}
          >
            Create Customer Account
          </Button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-slate-850 text-xs text-slate-400 font-semibold space-y-2">
          <p>
            Already have a customer account?{' '}
            <Link to="/customer/login" className="text-primary hover:underline font-bold">
              Sign In
            </Link>
          </p>
          <p>
            <Link to="/" className="text-slate-500 hover:text-slate-350 transition-colors">
              ← Back to choosing experience
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};
export default CustomerRegister;
