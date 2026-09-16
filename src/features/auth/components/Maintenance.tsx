import React from 'react';
import { Hammer } from 'lucide-react';
import Button from '../../../components/ui/Button/Button';

export const Maintenance: React.FC = () => {
  return (
    <div className="space-y-6 text-center">
      <div className="w-12 h-12 bg-primary/10 border border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto animate-bounce">
        <Hammer className="w-5 h-5" />
      </div>
      
      <div className="space-y-1">
        <h2 className="text-lg font-display font-bold text-textPearl font-bold">Scheduled Maintenance</h2>
        <p className="text-xs text-mutedAsh">
          Spiral Dine is upgrading databases. We will be back online shortly. Thank you for your patience.
        </p>
      </div>

      <Button 
        type="button" 
        className="w-full" 
        onClick={() => window.location.reload()}
      >
        Refresh Status
      </Button>
    </div>
  );
};
export default Maintenance;
