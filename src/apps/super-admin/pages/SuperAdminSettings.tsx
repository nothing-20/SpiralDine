import React, { useState } from 'react';
import { Settings, ShieldCheck, ToggleLeft, ToggleRight, Save, Database, Bell, RefreshCw, Key } from 'lucide-react';
import toast from 'react-hot-toast';

export const SuperAdminSettings: React.FC = () => {
  const [settings, setSettings] = useState({
    qrOrderingEnabled: true,
    instantSettlementEnabled: true,
    maintenanceMode: false,
    requireEmailVerification: true,
    maxTablesPerTenant: 150,
    platformGstPercent: 5,
    supportNotificationEmail: 'kumbhageethakrishna143@gmail.com'
  });
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key]
    }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Global platform settings saved.');
    }, 600);
  };

  return (
    <div className="space-y-8 text-left max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-display font-extrabold text-white tracking-tight">
          Global Platform Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Multi-tenant feature flags, operational thresholds, and global platform security configuration
        </p>
      </div>

      <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-6 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Feature Toggles & Governance
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800/80">
            <div>
              <div className="text-xs font-bold text-white">QR Table Ordering Engine</div>
              <div className="text-[11px] text-slate-400">Allow diner smartphones to scan table QR codes and order directly without staff intervention.</div>
            </div>
            <button 
              onClick={() => handleToggle('qrOrderingEnabled')}
              className={`p-1 rounded-lg text-lg ${settings.qrOrderingEnabled ? 'text-primary' : 'text-slate-600'}`}
            >
              {settings.qrOrderingEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800/80">
            <div>
              <div className="text-xs font-bold text-white">Instant UPI & Online Settlement</div>
              <div className="text-[11px] text-slate-400">Permit digital payments at table checkout through integrated Razorpay/UPI gateways.</div>
            </div>
            <button 
              onClick={() => handleToggle('instantSettlementEnabled')}
              className={`p-1 rounded-lg text-lg ${settings.instantSettlementEnabled ? 'text-primary' : 'text-slate-600'}`}
            >
              {settings.instantSettlementEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800/80">
            <div>
              <div className="text-xs font-bold text-white">Require Email Verification</div>
              <div className="text-[11px] text-slate-400">Require registered diners and staff to verify their email before accessing advanced features.</div>
            </div>
            <button 
              onClick={() => handleToggle('requireEmailVerification')}
              className={`p-1 rounded-lg text-lg ${settings.requireEmailVerification ? 'text-primary' : 'text-slate-600'}`}
            >
              {settings.requireEmailVerification ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800/80">
            <div>
              <div className="text-xs font-bold text-red-400">System Maintenance Mode</div>
              <div className="text-[11px] text-slate-400">Display the maintenance page to non-administrative users during schema migrations.</div>
            </div>
            <button 
              onClick={() => handleToggle('maintenanceMode')}
              className={`p-1 rounded-lg text-lg ${settings.maintenanceMode ? 'text-red-400' : 'text-slate-600'}`}
            >
              {settings.maintenanceMode ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>
        </div>

        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3 pt-4">
          Financial & Statutory Defaults
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Default Food GST Rate (%)</label>
            <input
              type="number"
              value={settings.platformGstPercent}
              onChange={(e) => setSettings({ ...settings, platformGstPercent: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Max Tables Per Establishment</label>
            <input
              type="number"
              value={settings.maxTablesPerTenant}
              onChange={(e) => setSettings({ ...settings, maxTablesPerTenant: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-slate-300">Support Desk Notification Email</label>
            <input
              type="email"
              value={settings.supportNotificationEmail}
              onChange={(e) => setSettings({ ...settings, supportNotificationEmail: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Save Platform Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSettings;
