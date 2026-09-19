import React from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import toast from 'react-hot-toast';
import SharedAuthLayout from '../../../shared/ui/auth/SharedAuthLayout';
import { 
  ShieldAlert, 
  Clock, 
  Building2, 
  AlertTriangle, 
  Search, 
  LogOut, 
  Mail,
  ArrowRight
} from 'lucide-react';

export const WorkspaceError: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const errorType = searchParams.get('type') || 'unauthorized';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Signed out successfully.');
      navigate('/login');
    } catch (e) {
      console.error(e);
      toast.error('Failed to log out.');
    }
  };

  let errorConfig = {
    title: 'Access Denied',
    description: 'Your permissions do not grant access to this workspace dashboard.',
    icon: AlertTriangle,
  };

  switch (errorType) {
    case 'user-suspended':
      errorConfig = {
        title: 'Account Suspended',
        description: 'Your employee account has been suspended or deactivated. Please contact your restaurant administrator to restore your access.',
        icon: ShieldAlert,
      };
      break;
    case 'tenant-suspended':
      errorConfig = {
        title: 'Restaurant Suspended',
        description: 'This restaurant tenant workspace has been deactivated or suspended. Please contact the restaurant owner or system support to resolve billing status.',
        icon: Building2,
      };
      break;
    case 'subscription-expired':
      errorConfig = {
        title: 'Subscription Expired',
        description: 'The restaurant SaaS subscription has expired or was cancelled. The workspace billing profile must be updated by the owner to restore platform features.',
        icon: Clock,
      };
      break;
    case 'branch-disabled':
      errorConfig = {
        title: 'Branch Disabled',
        description: 'This branch workspace is currently disabled or unavailable. Please verify the branch configuration with your manager.',
        icon: Building2,
      };
      break;
    case 'branch-not-found':
      errorConfig = {
        title: 'Branch Not Found',
        description: 'The assigned restaurant branch could not be found. Please verify the branch configuration with your manager.',
        icon: Search,
      };
      break;
    case 'workspace-unavailable':
      errorConfig = {
        title: 'Workspace Unavailable',
        description: 'Your restaurant tenant workspace is currently unavailable or unconfigured. Please contact your restaurant administrator.',
        icon: Building2,
      };
      break;
    case 'staff-not-assigned':
      errorConfig = {
        title: 'Staff Workspace Assignment Required',
        description: 'Your staff profile is not yet assigned to an active restaurant workspace. Please contact your restaurant manager.',
        icon: Search,
      };
      break;
    case 'user-not-found':
      errorConfig = {
        title: 'Staff Record Missing',
        description: 'Your profile document was not found in the restaurant registry. Please ask your administrator to send you a staff invitation.',
        icon: Search,
      };
      break;
    default:
      errorConfig = {
        title: 'Unauthorized Action',
        description: 'Workspace validation failed. You do not hold permissions to view this resource.',
        icon: AlertTriangle,
      };
      break;
  }

  const IconComponent = errorConfig.icon;

  return (
    <SharedAuthLayout
      roleVariant="default"
      badgeLabel="Security Notice"
      pageTitle={errorConfig.title}
      pageSubtitle={errorConfig.description}
      icon={<IconComponent className="w-7 h-7 text-[#D65336]" />}
      cardMaxWidth="max-w-[480px]"
    >
      <div className="space-y-4 pt-2">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-12 bg-[#D65336] hover:bg-[#B9432D] text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out &amp; Switch Account</span>
        </button>

        <a 
          href="mailto:support@spiraldine.internal?subject=Workspace%20Suspension%20Inquiry"
          className="w-full h-12 border border-[#E8DED6] bg-[#FCFAF7] hover:bg-[#F5ECE4] text-[#17202A] rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Mail className="w-4 h-4 text-[#667085]" />
          <span>Contact Administrator</span>
        </a>

        <div className="text-center pt-3 border-t border-[#E8DED6]">
          <Link
            to="/"
            className="text-xs text-[#8A817A] hover:text-[#17202A] font-medium transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </SharedAuthLayout>
  );
};

export default WorkspaceError;
