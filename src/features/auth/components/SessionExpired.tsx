import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import Button from '../../../components/ui/Button/Button';

export const SessionExpired: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 text-center">
      <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
        <Clock className="w-5 h-5" />
      </div>
      
      <div className="space-y-1">
        <h2 className="text-lg font-display font-bold text-textPearl">Session Expired</h2>
        <p className="text-xs text-mutedAsh">
          You have been signed out due to inactivity or token expiration. Please login again to restore workspace sync.
        </p>
      </div>

      <Button 
        type="button" 
        className="w-full" 
        onClick={() => navigate('/login')}
      >
        Sign Back In
      </Button>
    </div>
  );
};
export default SessionExpired;
