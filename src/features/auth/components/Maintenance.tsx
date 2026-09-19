import React from 'react';
import { Hammer, RefreshCw } from 'lucide-react';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';

export const Maintenance: React.FC = () => {
  return (
    <SharedAuthLayout
      roleVariant="default"
      badgeLabel="System Status"
      pageTitle="Scheduled Maintenance"
      pageSubtitle="Spiral Dine infrastructure is undergoing scheduled database and performance updates."
      icon={<Hammer className="w-7 h-7 text-[#D65336]" />}
      cardMaxWidth="max-w-[480px]"
    >
      <div className="space-y-4 text-center">
        <p className="text-xs text-[#667085] leading-relaxed">
          We will be back online shortly. All live order records and restaurant configurations remain securely preserved.
        </p>

        <button 
          type="button" 
          className="w-full h-12 bg-[#FCFAF7] hover:bg-[#F5ECE4] border border-[#E8DED6] text-[#17202A] font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow-2xs transition-colors cursor-pointer" 
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh System Status</span>
        </button>
      </div>
    </SharedAuthLayout>
  );
};

export default Maintenance;
