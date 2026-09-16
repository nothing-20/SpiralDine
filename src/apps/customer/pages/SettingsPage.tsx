import React, { useState } from 'react';
import Card from '../../../components/ui/Card/Card';
import Button from '../../../components/ui/Button/Button';
import { Settings, ShieldCheck, Bell, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const [notifications, setNotifications] = useState({
    smsAlerts: true,
    emailReceipts: true,
    promoOffers: false
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast.success('Diner settings saved successfully!');
  };

  return (
    <div className="max-w-md mx-auto space-y-6 text-left select-none bg-slate-900/30 border border-slate-900 p-6 rounded-3xl backdrop-blur-md">
      <div className="space-y-1">
        <h2 className="text-xl font-display font-extrabold text-white flex items-center gap-1.5">
          Diner Settings <Settings className="w-5 h-5 text-primary" />
        </h2>
        <p className="text-xs text-slate-400">Configure notifications preferences and system configurations.</p>
      </div>

      <hr className="border-slate-900" />

      {/* Notifications toggles list */}
      <div className="space-y-4">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Communication Alerts</h3>
        
        <div className="space-y-3">
          {[
            { key: 'smsAlerts', title: 'SMS Booking Alerts', desc: 'Get reservation and seated confirmations sent to phone.' },
            { key: 'emailReceipts', title: 'Email Receipts', desc: 'Get printable PDF invoices sent to email.' },
            { key: 'promoOffers', title: 'Promo & Vouchers', desc: 'Get notified about double points events.' }
          ].map((item) => (
            <div key={item.key} className="flex justify-between items-center p-3 bg-slate-950/40 border border-slate-900 rounded-xl gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                <p className="text-[10px] text-slate-500 font-semibold">{item.desc}</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifications[item.key as keyof typeof notifications]}
                onChange={() => handleToggle(item.key as keyof typeof notifications)}
                className="rounded bg-slate-900 border-slate-800 text-primary w-4.5 h-4.5 cursor-pointer focus:ring-primary focus:ring-offset-slate-950"
              />
            </div>
          ))}
        </div>
      </div>

      <hr className="border-slate-900" />

      {/* Security Info */}
      <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-2xl flex items-center space-x-3 text-xs text-slate-400 leading-normal">
        <ShieldCheck className="w-8 h-8 text-primary shrink-0" />
        <div>
          <span className="text-[9px] text-slate-500 font-extrabold uppercase">Diner Privacy Shield</span>
          <p className="text-[10.5px] font-semibold text-slate-350 mt-0.5">Your preferences are saved locally and fully encrypted under Spiral Dine data policies.</p>
        </div>
      </div>

      <Button
        onClick={handleSave}
        className="w-full bg-primary text-slate-950 font-bold py-3 rounded-xl text-xs mt-4"
      >
        Save Settings
      </Button>

    </div>
  );
};

export default SettingsPage;
