import React from 'react';
import { Clock } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
}

export const SuperAdminComingSoon: React.FC<Props> = ({ title, description }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 select-none">
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-primary mb-4 shadow-inner">
        <Clock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold font-display text-white">{title}</h2>
      <div className="mt-2 inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-primary text-xs font-semibold uppercase tracking-wider">
        Coming Soon
      </div>
      <p className="mt-3 text-sm text-slate-400 max-w-md">
        {description || 'This administrative module is scheduled for future platform release. No fake or placeholder data is generated.'}
      </p>
    </div>
  );
};

export default SuperAdminComingSoon;
