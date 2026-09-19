import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../../services/authService';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import { useToastStore } from '../../../components/ui/Toast/Toast';

export const ForgotPasswordForm: React.FC = () => {
  const { addToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!email) {
      setError('Email address is required');
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email format is invalid');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authService.resetPassword(email);
      addToast('Password reset email sent successfully!', 'success');
      setEmail('');
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to send reset email. Verify user email.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-left mb-2">
        <p className="text-xs text-mutedAsh">
          Enter your registered email address and we'll send you instructions to reset your password.
        </p>
      </div>

      <Input
        label="Email Address"
        type="email"
        placeholder="you@restaurant.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        disabled={isLoading}
      />

      <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
        Send Reset Link
      </Button>

      <div className="text-center mt-6 pt-4 border-t border-slate-800/40 text-xs text-mutedAsh">
        Remember your credentials?{' '}
        <Link to="/login" className="text-primary hover:underline font-bold">
          Sign In
        </Link>
      </div>
    </form>
  );
};
export default ForgotPasswordForm;
