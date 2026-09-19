import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../../config/firebase';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Card from '../../../components/ui/Card/Card';
import toast from 'react-hot-toast';
import { 
  ShieldAlert, 
  Clock, 
  Building2, 
  AlertTriangle, 
  Search, 
  HelpCircle, 
  LogOut, 
  Mail 
} from 'lucide-react';

export const WorkspaceError: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const errorType = searchParams.get('type') || 'unauthorized';

  // Logout action
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully.');
      navigate('/staff/login');
    } catch (e) {
      console.error(e);
      toast.error('Failed to log out.');
    }
  };

  // Configure UI based on error type
  let errorConfig = {
    title: 'Access Denied',
    description: 'Your permissions do not grant access to this workspace dashboard.',
    icon: AlertTriangle,
    iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
  };

  switch (errorType) {
    case 'user-suspended':
      errorConfig = {
        title: 'Account Suspended',
        description: 'Your employee user account has been suspended or deactivated. Please contact your restaurant administrator to restore your access.',
        icon: ShieldAlert,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20'
      };
      break;
    case 'tenant-suspended':
      errorConfig = {
        title: 'Restaurant Suspended',
        description: 'This restaurant tenant workspace has been deactivated or suspended. Please contact the restaurant owner or system support to resolve billing status.',
        icon: Building2,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20'
      };
      break;
    case 'subscription-expired':
      errorConfig = {
        title: 'Subscription Expired',
        description: 'The restaurant SaaS subscription has expired or was cancelled. The workspace billing profile must be updated by the owner to restore platform features.',
        icon: Clock,
        iconColor: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
      };
      break;
    case 'branch-disabled':
      errorConfig = {
        title: 'Branch Disabled',
        description: 'This branch workspace is currently disabled or unavailable. Please verify the branch configuration with your manager.',
        icon: Building2,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      };
      break;
    case 'branch-not-found':
      errorConfig = {
        title: 'Branch Not Found',
        description: 'The assigned restaurant branch could not be found. Please verify the branch configuration with your manager.',
        icon: Search,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      };
      break;
    case 'workspace-unavailable':
      errorConfig = {
        title: 'Workspace Unavailable',
        description: 'Your restaurant tenant workspace is currently unavailable or unconfigured. Please contact your restaurant administrator.',
        icon: Building2,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      };
      break;
    case 'staff-not-assigned':
      errorConfig = {
        title: 'Staff Workspace Assignment Required',
        description: 'Your staff profile is not yet assigned to an active restaurant workspace. Please contact your restaurant manager.',
        icon: Search,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20'
      };
      break;
    case 'user-not-found':
      errorConfig = {
        title: 'Staff Record Missing',
        description: 'Your profile document was not found in the restaurant registry. Please ask your administrator to send you a staff invitation.',
        icon: Search,
        iconColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20'
      };
      break;
    default:
      errorConfig = {
        title: 'Unauthorized Action',
        description: 'Workspace validation failed. You do not hold permissions to view this resource.',
        icon: AlertTriangle,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      };
      break;
  }

  const IconComponent = errorConfig.icon;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-left relative overflow-hidden select-none">
      {/* Background accents */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        
        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5">
            <span className="text-primary font-display font-extrabold text-2xl">S</span>
          </div>
          <div className="space-y-0.5">
            <h1 className="text-sm font-display font-extrabold text-slate-500 tracking-wider uppercase">Spiral Dine</h1>
            <span className="text-xs font-semibold text-slate-400">Workspace Verification Error</span>
          </div>
        </div>

        <Card className="p-8 border-slate-850 bg-slate-900/40 backdrop-blur-md rounded-3xl shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Error Icon */}
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shadow-xl ${errorConfig.iconColor}`}>
              <IconComponent className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-display font-extrabold text-textPearl tracking-wide">{errorConfig.title}</h2>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                {errorConfig.description}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3 pt-4 border-t border-slate-850/60">
            <Button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout & Sign In</span>
            </Button>

            <a 
              href="mailto:support@restaurantos.com?subject=Workspace%20Suspension%20Inquiry"
              className="w-full border border-slate-850 hover:border-slate-800 bg-slate-950/45 hover:bg-slate-900/60 text-slate-350 hover:text-textPearl py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 outline-none"
            >
              <Mail className="w-4 h-4" />
              <span>Contact System Administrator</span>
            </a>
          </div>
        </Card>

        {/* Back Link */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="text-[11px] text-slate-500 hover:text-textPearl transition-colors font-bold uppercase tracking-wider outline-none"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceError;
