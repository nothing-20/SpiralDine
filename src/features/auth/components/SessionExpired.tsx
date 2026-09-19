import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

export const SessionExpired: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SharedAuthLayout
      roleVariant="default"
      badgeLabel="Session Security"
      pageTitle="Session Expired"
      pageSubtitle="You have been signed out due to inactivity or expired authorization tokens."
      icon={<Clock className="w-7 h-7 text-[#D65336]" />}
      cardMaxWidth="max-w-[460px]"
    >
      <div className="space-y-4 text-center">
        <p className="text-xs text-[#667085] leading-relaxed">
          Please sign back in to continue accessing your restaurant or diner workspace.
        </p>

        <button 
          type="button" 
          className="w-full h-12 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-colors cursor-pointer" 
          onClick={() => navigate('/login')}
        >
          <span>Sign Back In</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </SharedAuthLayout>
  );
};

export default SessionExpired;
