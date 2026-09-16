import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Card from '../../../components/ui/Card/Card';
import toast from 'react-hot-toast';
import {
  CheckCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  UserCheck,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Loader2,
  Building,
  Link2
} from 'lucide-react';
import { getDashboardRoute } from '../../../utils/navigation';
import { cn } from '../../../utils/cn';

// Decorative food imagery
import leftPlateImg from '../../../assets/left_food_plate.png';
import rightPlateImg from '../../../assets/right_food_plate.png';
import basilLeaf1 from '../../../assets/basil_leaf_1.png';
import basilLeaf2 from '../../../assets/basil_leaf_2.png';

// ─── Steps & Stages ───────────────────────────────────────────────────────────
type Step = 'verifying' | 'email' | 'password' | 'success' | 'error';

export type ActivationStage =
  | 'idle'
  | 'validating'
  | 'verifying-invitation'
  | 'auth-creating'
  | 'auth-signing-in'
  | 'writing-profile'
  | 'updating-employee'
  | 'refreshing-profile'
  | 'resolving-role'
  | 'navigating'
  | 'complete'
  | 'error';

export function getStageLabel(stage: ActivationStage): string {
  switch (stage) {
    case 'validating':
      return 'Checking password requirements...';
    case 'verifying-invitation':
      return 'Verifying invitation status...';
    case 'auth-creating':
      return 'Creating staff credentials...';
    case 'auth-signing-in':
      return 'Connecting existing account...';
    case 'writing-profile':
      return 'Creating your staff profile...';
    case 'updating-employee':
      return 'Activating your employee record...';
    case 'refreshing-profile':
      return 'Confirming account activation...';
    case 'resolving-role':
      return 'Preparing your dashboard...';
    case 'navigating':
      return 'Redirecting to your dashboard...';
    default:
      return '';
  }
}

// Safe async timeout wrapper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Activation timed out during ${operationName}. Please check your connection and try again.`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

interface IEmployeeInvite {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  tenantId: string;
  branchId: string;
  department?: string;
  status: string;
  activationStatus: string;
  firebaseUid?: string | null;
  userId?: string | null;
  invitationToken?: string;
  expiresAt?: string;
  restaurantName?: string;
}

// ─── Helper: Flexible Expiration Checker ───────────────────────────────────────
function isInvitationExpired(expiresAt: any): boolean {
  if (!expiresAt) return false;
  let expireTime: number | null = null;
  if (typeof expiresAt === 'string') {
    expireTime = new Date(expiresAt).getTime();
  } else if (typeof expiresAt === 'number') {
    expireTime = expiresAt;
  } else if (expiresAt && typeof expiresAt.toDate === 'function') {
    expireTime = expiresAt.toDate().getTime();
  } else if (expiresAt && typeof expiresAt.seconds === 'number') {
    expireTime = expiresAt.seconds * 1000;
  }
  return expireTime !== null && !isNaN(expireTime) && expireTime < Date.now();
}

// ─── Component ─────────────────────────────────────────────────────────────────
export const StaffActivate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tokenParam = (searchParams.get('token') || '').trim();
  const emailParam = (searchParams.get('email') || '').trim().toLowerCase();
  const idParam = (searchParams.get('id') || '').trim();

  // If id is provided in URL, go straight to auto-verification; otherwise show link/ID input
  const hasDirectId = Boolean(idParam);
  const [step, setStep] = useState<Step>(hasDirectId ? 'verifying' : 'email');

  const [pastedInput, setPastedInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [stage, setStage] = useState<ActivationStage>('idle');
  const [invite, setInvite] = useState<IEmployeeInvite | null>(null);
  const [errors, setErrors] = useState<{ input?: string; email?: string; password?: string; confirm?: string }>({});

  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const verificationAttemptedRef = useRef(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  // ── Direct O(1) Firestore Document Verification ──────────────────────────────
  const verifyByEmployeeId = useCallback(
    async (targetId: string, targetToken?: string, targetEmail?: string) => {
      setIsLoading(true);
      setErrors({});
      setErrorCode(null);
      setErrorMessage('');

      const cleanId = (targetId || '').trim();
      const cleanToken = (targetToken ?? tokenParam).trim().toLowerCase();
      let cleanEmail = '';
      try {
        cleanEmail = decodeURIComponent((targetEmail ?? emailParam).trim()).toLowerCase();
      } catch {
        cleanEmail = (targetEmail ?? emailParam).trim().toLowerCase();
      }

      console.log('[StaffActivate] Verifying employee invitation directly from Firestore:', {
        id: cleanId,
        hasToken: Boolean(cleanToken),
        hasEmail: Boolean(cleanEmail),
      });

      if (!cleanId) {
        setErrorCode('NOT_FOUND');
        setErrorMessage('Invitation ID is required. Please check your activation link or contact your restaurant manager.');
        setStep('error');
        setIsLoading(false);
        return;
      }

      try {
        const empDocRef = doc(db, 'employees', cleanId);
        const empSnap = await getDoc(empDocRef);

        if (!empSnap.exists()) {
          console.warn('[StaffActivate] Firestore document does not exist for ID:', cleanId);
          setErrorCode('NOT_FOUND');
          setErrorMessage('This invitation record was not found. Please check your activation link or contact your restaurant manager.');
          setStep('error');
          setIsLoading(false);
          return;
        }

        const data = empSnap.data() as Omit<IEmployeeInvite, 'id'>;

        // 1. Check if already activated
        if (data.activationStatus === 'activated' || data.status === 'active') {
          console.log('[StaffActivate] Invitation status: already activated');
          setErrorCode('ALREADY_ACTIVATED');
          setErrorMessage('This invitation has already been activated. Please sign in to your staff account.');
          setStep('error');
          setIsLoading(false);
          return;
        }

        // 2. Check if status is invalid or revoked
        if (data.status !== 'pending' || data.activationStatus !== 'invited') {
          console.log('[StaffActivate] Invitation status invalid:', data.status, data.activationStatus);
          setErrorCode('INVALID_STATUS');
          setErrorMessage('This invitation is no longer active or has been revoked.');
          setStep('error');
          setIsLoading(false);
          return;
        }

        // 3. Check expiration
        if (isInvitationExpired(data.expiresAt)) {
          console.log('[StaffActivate] Invitation expired at:', data.expiresAt);
          setErrorCode('EXPIRED');
          setErrorMessage('This invitation link has expired. Ask your restaurant owner to send a new invitation.');
          setStep('error');
          setIsLoading(false);
          return;
        }

        // 4. Verify token match if token provided
        const storedToken = (data.invitationToken || '').trim().toLowerCase();
        if (cleanToken && storedToken && cleanToken !== storedToken) {
          console.warn('[StaffActivate] Invitation token mismatch');
          setErrorCode('INVALID_TOKEN');
          setErrorMessage('This invitation link is invalid. The security token does not match.');
          setStep('error');
          setIsLoading(false);
          return;
        }

        // 5. Verify email match if email provided
        const storedEmail = (data.email || '').trim().toLowerCase();
        if (cleanEmail && storedEmail && cleanEmail !== storedEmail) {
          console.warn('[StaffActivate] Email mismatch:', { cleanEmail, storedEmail });
          setErrorCode('EMAIL_MISMATCH');
          setErrorMessage(`The email address in the link (${cleanEmail}) does not match this invitation record.`);
          setStep('error');
          setIsLoading(false);
          return;
        }

        // 6. Valid invitation! Fetch restaurant name for UI context (non-blocking)
        let restaurantName = '';
        if (data.tenantId) {
          try {
            const restSnap = await getDoc(doc(db, 'restaurants', data.tenantId));
            if (restSnap.exists()) {
              restaurantName = restSnap.data()?.name || '';
            }
          } catch {
            // Non-blocking
          }
        }

        console.log('[StaffActivate] Verification successful:', {
          id: empSnap.id,
          fullName: data.fullName,
          role: data.role,
          tenantId: data.tenantId,
        });

        setInvite({ id: empSnap.id, ...data, restaurantName });
        setEmail(data.email);
        setStep('password');
        toast.success(`Invitation verified! Welcome, ${data.fullName}. Set your password to continue.`);
      } catch (directErr: any) {
        console.error('[StaffActivate] Direct getDoc error:', directErr?.code, directErr?.message);
        if (directErr?.code === 'permission-denied') {
          // Firestore security rules evaluate resource data; if doc is absent or uninvited, permission-denied is returned
          setErrorCode('PERMISSION_DENIED');
          setErrorMessage('Unable to access this invitation. The link may have expired, already been activated, or does not exist.');
        } else if (directErr?.code === 'unavailable' || directErr?.message?.includes('network')) {
          setErrorCode('NETWORK_ERROR');
          setErrorMessage('Unable to connect to the database. Please check your internet connection and try again.');
        } else {
          setErrorCode('LOOKUP_FAILED');
          setErrorMessage(directErr?.message || 'Unable to verify invitation. Please contact your manager.');
        }
        setStep('error');
      } finally {
        setIsLoading(false);
      }
    },
    [tokenParam, emailParam]
  );

  // Auto-verify on mount if idParam is present in URL
  useEffect(() => {
    if (!verificationAttemptedRef.current && idParam) {
      verificationAttemptedRef.current = true;
      verifyByEmployeeId(idParam, tokenParam, emailParam);
    }
  }, [idParam, tokenParam, emailParam, verifyByEmployeeId]);

  // Handle manual input of link or ID
  const handleManualInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = pastedInput.trim();
    if (!raw) {
      setErrors({ input: 'Please enter an activation link or Invitation ID.' });
      return;
    }

    let parsedId = raw;
    let parsedToken = '';
    let parsedEmail = '';

    // Check if user pasted a full URL
    if (raw.includes('?') || raw.includes('/staff/activate')) {
      try {
        const urlObj = raw.startsWith('http') ? new URL(raw) : new URL(`https://dummy.internal/${raw.replace(/^\/+/, '')}`);
        parsedId = urlObj.searchParams.get('id') || '';
        parsedToken = urlObj.searchParams.get('token') || '';
        parsedEmail = urlObj.searchParams.get('email') || '';
      } catch {
        // Fallback simple regex extraction
        const idMatch = raw.match(/[?&]id=([^&]+)/);
        if (idMatch) parsedId = idMatch[1];
        const tokenMatch = raw.match(/[?&]token=([^&]+)/);
        if (tokenMatch) parsedToken = tokenMatch[1];
        const emailMatch = raw.match(/[?&]email=([^&]+)/);
        if (emailMatch) parsedEmail = emailMatch[1];
      }
    }

    if (!parsedId) {
      if (raw.includes('token=') || raw.includes('email=')) {
        setErrors({
          input: 'This activation link is missing the Invitation ID parameter (&id=...). Please ask your restaurant manager to use "Copy Link" or "Resend Invite" in the Staff Manager to provide the complete link, or enter your Invitation ID directly.'
        });
      } else {
        setErrors({ input: 'Could not find a valid Invitation ID. Please paste the complete link provided by your manager or enter your Invitation ID.' });
      }
      return;
    }

    // Update search params in URL so refresh works
    const newParams: Record<string, string> = { id: parsedId };
    if (parsedToken) newParams.token = parsedToken;
    if (parsedEmail) newParams.email = parsedEmail;
    setSearchParams(newParams);

    setStep('verifying');
    await verifyByEmployeeId(parsedId, parsedToken, parsedEmail);
  };

  // ── Step 2: create Firebase account + link records ─────────────────────────
  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    console.info('[StaffActivation] START');
    console.info('[StaffActivation] Button clicked');

    if (isActivating) {
      console.info('[StaffActivation] Activation already in progress, ignoring duplicate submit');
      return;
    }

    setIsActivating(true);
    setErrors({});
    setStage('validating');
    console.info('[StaffActivation] Stage: validating');

    // 30-second hard timeout for the entire activation operation
    let isTimeoutAborted = false;
    const globalTimeout = setTimeout(() => {
      isTimeoutAborted = true;
      setIsActivating(false);
      setStage('error');
      const timeoutMsg = 'Activation took longer than expected. Please check your network connection and try again.';
      setErrorMessage(timeoutMsg);
      toast.error(timeoutMsg);
      console.error('[StaffActivation] Global 30s timeout triggered');
    }, 30000);

    try {
      // Autofill fallback: extract from DOM ref if state was not populated by browser autofill
      const pass = (password || passwordInputRef.current?.value || '').trim();
      const confirmPass = (confirmPassword || confirmInputRef.current?.value || '').trim();

      const nextErrors: typeof errors = {};
      if (!pass) {
        nextErrors.password = 'Password is required.';
        toast.error('Please enter a password.');
      } else if (pass.length < 6) {
        nextErrors.password = 'Password must be at least 6 characters.';
        toast.error('Password must be at least 6 characters.');
      }

      if (!confirmPass) {
        nextErrors.confirm = 'Please confirm your password.';
        toast.error('Please confirm your password.');
      } else if (pass && confirmPass && pass !== confirmPass) {
        nextErrors.confirm = 'Passwords do not match.';
        toast.error('Passwords do not match.');
      }

      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        clearTimeout(globalTimeout);
        setIsActivating(false);
        setStage('idle');
        return;
      }

      console.info('[StaffActivation] Invitation state', {
        hasInvitation: Boolean(invite),
        hasEmployeeId: Boolean(invite?.id),
        emailPresent: Boolean(invite?.email),
        tokenPresent: Boolean(tokenParam || invite?.invitationToken),
      });

      if (!invite) {
        toast.error('Invitation record is missing. Please refresh the page.');
        clearTimeout(globalTimeout);
        setIsActivating(false);
        setStage('idle');
        return;
      }

      // Step A: Re-verify invitation document exists & valid in Firestore before creating Auth
      setStage('verifying-invitation');
      console.info('[StaffActivation] Stage: verifying-invitation');
      console.info('[StaffActivation] Re-verifying invitation before Auth creation', { employeeId: invite.id });

      let freshSnap: any = null;
      try {
        freshSnap = await withTimeout(
          getDoc(doc(db, 'employees', invite.id)),
          12000,
          'invitation verification'
        );
      } catch (checkErr: any) {
        console.error('[StaffActivation] Error checking employee document:', checkErr);
        throw checkErr;
      }

      if (!freshSnap || !freshSnap.exists()) {
        const msg = 'This invitation record was not found or was replaced by a newer invitation. Please ask your manager for the latest link.';
        setErrorMessage(msg);
        toast.error(msg);
        clearTimeout(globalTimeout);
        setIsActivating(false);
        setStage('idle');
        return;
      }

      const freshData = freshSnap.data();
      if (freshData.activationStatus === 'activated' || freshData.status === 'active') {
        const msg = 'This account has already been activated. Redirecting to login...';
        toast.error(msg);
        setErrorCode('ALREADY_ACTIVATED');
        setErrorMessage(msg);
        setStep('error');
        clearTimeout(globalTimeout);
        setIsActivating(false);
        setStage('idle');
        return;
      }

      if (isInvitationExpired(freshData.expiresAt)) {
        const msg = 'This invitation link has expired. Ask your restaurant owner to send a new invitation.';
        setErrorCode('EXPIRED');
        setErrorMessage(msg);
        setStep('error');
        toast.error(msg);
        clearTimeout(globalTimeout);
        setIsActivating(false);
        setStage('idle');
        return;
      }

      // Step B: Create Firebase Authentication account or reconcile existing
      setStage('auth-creating');
      console.info('[StaffActivation] Stage: auth-creating');
      const verifiedEmail = invite.email.trim().toLowerCase();
      let fUser: any = null;

      try {
        const credentials = await withTimeout(
          createUserWithEmailAndPassword(auth, verifiedEmail, pass),
          15000,
          'account credential creation'
        );
        fUser = credentials.user;
        console.info('[StaffActivation] Auth account created', { uid: fUser.uid });
      } catch (authErr: any) {
        console.error('[StaffActivation] Auth creation error:', authErr?.code || authErr?.message);
        if (authErr?.code === 'auth/email-already-in-use') {
          // Email already registered in Firebase Auth: attempt sign-in to reconcile profile
          setStage('auth-signing-in');
          console.info('[StaffActivation] Stage: auth-signing-in');
          console.info('[StaffActivation] Existing Auth account detected. Attempting existing-account sign in');

          try {
            const signinCred = await withTimeout(
              signInWithEmailAndPassword(auth, verifiedEmail, pass),
              15000,
              'existing account sign-in'
            );
            fUser = signinCred.user;
            console.info('[StaffActivation] Existing Auth account reconciled via sign-in', { uid: fUser.uid });
          } catch (signinErr: any) {
            console.error('[StaffActivation] Sign-in reconciliation failed:', signinErr?.code || signinErr?.message);
            const errDetail =
              signinErr?.code === 'auth/invalid-credential' || signinErr?.code === 'auth/wrong-password'
                ? 'The password entered does not match the existing Spiral Dine account for this email. Please enter your existing account password, or use Staff Login.'
                : 'An existing account was found for this email, but could not be connected. Please sign in via Staff Login.';
            setErrorMessage(errDetail);
            toast.error(errDetail);
            clearTimeout(globalTimeout);
            setIsActivating(false);
            setStage('idle');
            return;
          }
        } else if (authErr?.code === 'auth/weak-password') {
          toast.error('Password is too weak. Please choose a stronger password.');
          setErrors({ password: 'Password is too weak. Choose a stronger password.' });
          clearTimeout(globalTimeout);
          setIsActivating(false);
          setStage('idle');
          return;
        } else {
          toast.error(authErr?.message || 'Unable to create staff account. Please try again.');
          clearTimeout(globalTimeout);
          setIsActivating(false);
          setStage('idle');
          return;
        }
      }

      if (isTimeoutAborted) return;

      const now = new Date().toISOString();

      // Step C: Create users/{uid} document — the authoritative profile record
      setStage('writing-profile');
      console.info('[StaffActivation] Stage: writing-profile');
      console.info('[StaffActivation] Writing user profile for UID:', fUser.uid);
      const userRef = doc(db, 'users', fUser.uid);
      await withTimeout(
        setDoc(userRef, {
          uid: fUser.uid,
          fullName: invite.fullName,
          displayName: invite.fullName,
          email: verifiedEmail,
          phone: invite.phone || '',
          phoneNumber: invite.phone || '',
          role: invite.role,
          tenantId: invite.tenantId,
          branchId: invite.branchId || 'main',
          department: invite.department || '',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        }),
        10000,
        'staff profile write'
      );

      // Verify user profile confirmed written
      const profileSnap = await withTimeout(
        getDoc(userRef),
        8000,
        'staff profile write verification'
      );
      if (!profileSnap.exists()) {
        throw new Error('Staff profile document could not be verified in Firestore.');
      }

      if (isTimeoutAborted) return;

      // Step D: Update employees/{id} — link Firebase UID, mark activated
      setStage('updating-employee');
      console.info('[StaffActivation] Stage: updating-employee');
      console.info('[StaffActivation] Updating employee record:', invite.id);
      const employeeRef = doc(db, 'employees', invite.id);
      await withTimeout(
        updateDoc(employeeRef, {
          firebaseUid: fUser.uid,
          userId: fUser.uid,
          status: 'active',
          activationStatus: 'activated',
          activatedAt: now,
          updatedAt: now,
          invitationToken: null,
        }),
        10000,
        'employee activation update'
      );

      // Verify employee record confirmed updated
      const employeeSnap = await withTimeout(
        getDoc(employeeRef),
        8000,
        'employee activation update verification'
      );
      if (!employeeSnap.exists() || employeeSnap.data()?.activationStatus !== 'activated') {
        throw new Error('Employee record activation could not be verified in Firestore.');
      }

      if (isTimeoutAborted) return;

      // Step E: Auth/Profile refresh stage
      setStage('refreshing-profile');
      console.info('[StaffActivation] Stage: refreshing-profile');

      // Step F: Role resolution
      setStage('resolving-role');
      console.info('[StaffActivation] Stage: resolving-role');
      const resolvedRole = (invite.role || freshData?.role || 'kitchen').toLowerCase();
      console.info('[StaffActivation] Role resolved', { role: resolvedRole });
      const targetDestination = getDashboardRoute(resolvedRole);

      // Step G: Navigation
      setStage('navigating');
      console.info('[StaffActivation] Stage: navigating');
      console.info('[StaffActivation] COMPLETE');
      clearTimeout(globalTimeout);

      setStep('success');
      setStage('complete');
      toast.success('Account activated successfully! Redirecting to your dashboard...');

      // Auto-redirect to canonical role dashboard after 1.5 seconds
      setTimeout(() => {
        navigate(targetDestination, { replace: true });
      }, 1500);
    } catch (err: any) {
      clearTimeout(globalTimeout);
      console.error('[StaffActivation] Activation error:', err);
      setStage('error');
      const errMessage = err?.message || 'Unable to activate your account. Please try again.';
      setErrorMessage(errMessage);
      toast.error(errMessage);
      setIsActivating(false);
    }
  };

  // ── Step indicators ────────────────────────────────────────────────────────
  const STEPS = [
    { label: 'Verify Invite', icon: Mail },
    { label: 'Set Password', icon: Lock },
    { label: 'Activated',    icon: CheckCircle },
  ];

  let stepIndex = 0;
  if (step === 'password') stepIndex = 1;
  else if (step === 'success') stepIndex = 2;

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#17233D] flex flex-col justify-between relative overflow-x-hidden select-none font-sans">
      {/* ========================================================================= */}
      {/* 1. DECORATIVE BACKGROUND TREATMENT (Z-INDEX 0, POINTER-EVENTS NONE)       */}
      {/* ========================================================================= */}

      {/* Subtle warm circular background ambient backdrops */}
      <div className="absolute top-[14%] left-[-160px] md:left-[-120px] lg:left-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3E8DF]/80 blur-[2px] pointer-events-none z-0" />
      <div className="absolute bottom-[6%] right-[-160px] md:right-[-120px] lg:right-[-80px] w-[500px] md:w-[580px] h-[500px] md:h-[580px] rounded-full bg-[#F3E8DF]/80 blur-[2px] pointer-events-none z-0" />

      {/* LEFT SIDE: Food plate entering from left edge */}
      <div className="hidden sm:block absolute left-[-240px] md:left-[-220px] lg:left-[-190px] xl:left-[-150px] top-[18%] md:top-[20%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={leftPlateImg} 
          alt="Artisanal Dining Dish" 
          className="w-full h-auto drop-shadow-xl transform -rotate-12"
        />
      </div>

      {/* Left side: Floating basil garnish */}
      <div className="hidden md:block absolute left-[220px] lg:left-[270px] top-[28%] w-10 h-10 pointer-events-none select-none z-0 transform rotate-45 opacity-90 drop-shadow-sm">
        <img src={basilLeaf2} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Left side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute left-8 xl:left-14 bottom-20 xl:bottom-28 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Fresh Beginnings
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Exceptional Service
        </span>
        <div className="w-24 h-0.5 bg-[#C94F3D]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* RIGHT SIDE: Food plate entering from right edge */}
      <div className="hidden sm:block absolute right-[-240px] md:right-[-220px] lg:right-[-190px] xl:right-[-150px] bottom-[8%] md:bottom-[10%] w-[420px] md:w-[480px] lg:w-[540px] pointer-events-none select-none z-0">
        <img 
          src={rightPlateImg} 
          alt="Artisanal Entree Dish" 
          className="w-full h-auto drop-shadow-xl transform rotate-6"
        />
      </div>

      {/* Right side: Floating basil garnish */}
      <div className="hidden md:block absolute right-[230px] lg:right-[280px] bottom-[38%] w-11 h-11 pointer-events-none select-none z-0 transform -rotate-12 opacity-90 drop-shadow-sm">
        <img src={basilLeaf1} alt="Fresh Basil Leaf" className="w-full h-full object-contain" />
      </div>

      {/* Right side: Handwritten style decorative brand phrase */}
      <div className="hidden lg:flex flex-col items-start absolute right-10 xl:right-16 top-24 xl:top-32 pointer-events-none select-none z-0 -rotate-6">
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Team Work
        </span>
        <span className="font-serif italic text-2xl xl:text-3xl text-[#7E746A] tracking-tight leading-tight">
          Shared Success
        </span>
        <div className="w-28 h-0.5 bg-[#C94F3D]/60 rounded-full mt-1.5 -rotate-2" />
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP BRANDING HEADER                                                    */}
      {/* ========================================================================= */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between relative z-20">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-[#C94F3D] rounded-xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <span className="text-white font-extrabold text-xl font-display leading-none">S</span>
          </div>
          <div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[#17233D]">
              Spiral <span className="text-[#C94F3D]">Dine</span>
            </span>
            <p className="text-[10px] font-semibold text-[#667085] hidden sm:block leading-none mt-0.5">
              Smart Dining. Smarter Business.
            </p>
          </div>
        </Link>

        <Link 
          to="/" 
          className="inline-flex items-center space-x-1 text-xs font-bold text-[#667085] hover:text-[#17233D] transition-colors py-2 px-3.5 rounded-xl hover:bg-[#F3E8DF]"
        >
          <span>← Back to Home</span>
        </Link>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: CENTERED CARD WITH STEP INDICATORS                       */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-6 py-4 sm:py-6 flex flex-col items-center justify-center flex-1 relative z-10 space-y-4">
        
        {/* Brand & Heading */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 bg-[#F8E8E2] rounded-2xl flex items-center justify-center shadow-2xs">
            <UserCheck className="w-6 h-6 text-[#C94F3D]" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-[26px] font-display font-extrabold text-[#17233D] tracking-tight">
              Staff Account Activation
            </h1>
            <p className="text-xs text-[#667085]">
              Securely set up your credentials to access your staff portal
            </p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center space-x-2 pb-1">
          {STEPS.map((s, i) => {
            const isDone = i < stepIndex;
            const isCurrent = i === stepIndex && step !== 'error';
            const Icon = s.icon;
            return (
              <React.Fragment key={s.label}>
                <div className="flex flex-col items-center space-y-1">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300",
                    isDone
                      ? "bg-[#16866D] border-[#16866D] text-white shadow-xs"
                      : isCurrent
                      ? "bg-[#F8E8E2] border-[#C94F3D] text-[#C94F3D] ring-2 ring-[#C94F3D]/20"
                      : "bg-white border-[#E5E1DC] text-[#667085]"
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold tracking-wide",
                    isCurrent ? "text-[#17233D]" : isDone ? "text-[#16866D]" : "text-[#667085]"
                  )}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "h-0.5 w-10 sm:w-14 mb-4 transition-colors duration-300 rounded-full",
                    i < stepIndex ? "bg-[#16866D]" : "bg-[#E5E1DC]"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Main White Activation Card */}
        <div className="max-w-[480px] w-full p-6 sm:p-8 bg-white border border-[#E5E1DC] rounded-[24px] shadow-md relative overflow-hidden text-left">

          {/* ── State: Verifying ── */}
          {step === 'verifying' && (
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-[#F8E8E2] flex items-center justify-center shadow-2xs">
                <Loader2 className="w-7 h-7 text-[#C94F3D] animate-spin" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#17233D]">Verifying Your Invitation</h2>
                <p className="text-xs text-[#667085]">
                  Checking invitation token and credentials...
                </p>
              </div>
            </div>
          )}

          {/* ── State: Error ── */}
          {step === 'error' && (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F8E8E2] flex items-center justify-center shadow-2xs">
                {errorCode === 'ALREADY_ACTIVATED' || errorCode === 'PERMISSION_DENIED' ? (
                  <ShieldAlert className="w-7 h-7 text-[#C94F3D]" />
                ) : errorCode === 'EXPIRED' ? (
                  <Clock className="w-7 h-7 text-[#C94F3D]" />
                ) : (
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                )}
              </div>

              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-[#17233D]">
                  {errorCode === 'ALREADY_ACTIVATED'
                    ? 'Account Already Activated'
                    : errorCode === 'EXPIRED'
                    ? 'Invitation Has Expired'
                    : errorCode === 'INVALID_TOKEN'
                    ? 'Invalid Security Token'
                    : errorCode === 'EMAIL_MISMATCH'
                    ? 'Email Address Mismatch'
                    : errorCode === 'NOT_FOUND'
                    ? 'Invitation Not Found'
                    : errorCode === 'PERMISSION_DENIED'
                    ? 'Invitation Not Accessible'
                    : 'Invalid Invitation'}
                </h2>
                <p className="text-xs text-[#667085] leading-relaxed max-w-xs mx-auto">
                  {errorMessage || 'This invitation link could not be verified.'}
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                {errorCode === 'ALREADY_ACTIVATED' || errorCode === 'PERMISSION_DENIED' ? (
                  <Link to="/staff/login" className="block w-full">
                    <button className="w-full h-12 bg-[#C94F3D] hover:bg-[#A93E30] text-white font-bold text-sm rounded-xl transition-colors cursor-pointer">
                      Proceed to Staff Login
                    </button>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="w-full h-12 bg-[#FCFAF7] hover:bg-[#F3E8DF] border border-[#E5E1DC] text-[#17233D] font-bold text-sm rounded-xl transition-colors cursor-pointer"
                    onClick={() => {
                      setStep('email');
                      setErrorCode(null);
                      setErrorMessage('');
                    }}
                  >
                    Enter Link or ID Manually
                  </button>
                )}

                <Link
                  to="/"
                  className="block text-center text-xs font-semibold text-[#667085] hover:text-[#17233D] transition-colors pt-1"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          )}

          {/* ── State: Manual Link / ID Fallback ── */}
          {step === 'email' && (
            <form onSubmit={handleManualInputSubmit} className="space-y-4">
              <div className="space-y-1 text-center pb-1">
                <h2 className="text-xl font-display font-extrabold text-[#17233D]">Activate Staff Account</h2>
                <p className="text-xs text-[#667085] leading-relaxed max-w-xs mx-auto">
                  Enter the secure activation link sent to you by your restaurant manager or in your invitation email.
                </p>
              </div>

              {tokenParam && emailParam && !idParam && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left space-y-1">
                  <p className="text-xs font-bold text-amber-800">Missing Invitation ID Parameter</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    This link has your token and email but is missing the document ID (<code>&id=...</code>). Ask your restaurant manager to click <strong>"Copy Link"</strong> or <strong>"Resend Invite"</strong> in the Staff Manager, or enter your Invitation ID below.
                  </p>
                </div>
              )}

              <div className="w-full flex flex-col space-y-1.5 text-left">
                <label htmlFor="pasted-input" className="text-xs font-bold text-[#17233D] select-none">
                  Activation Link or Invitation ID
                </label>
                <div className="relative flex items-center">
                  <Link2 className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                  <input
                    id="pasted-input"
                    type="text"
                    placeholder="https://.../staff/activate?token=...&id=..."
                    value={pastedInput}
                    onChange={(e) => setPastedInput(e.target.value)}
                    disabled={isLoading}
                    required
                    className={cn(
                      "w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                      errors.input ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                    )}
                  />
                </div>
                {errors.input && (
                  <span className="text-xs font-semibold text-red-600 pl-1">{errors.input}</span>
                )}
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-12 bg-[#C94F3D] hover:bg-[#A93E30] active:bg-[#923326] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center border-t border-[#E5E1DC]/60 mt-4">
                <Link
                  to="/staff/login"
                  className="text-xs text-[#667085] hover:text-[#17233D] transition-colors"
                >
                  Already activated? <strong className="text-[#C94F3D] hover:underline font-bold">Staff Login</strong>
                </Link>
              </div>
            </form>
          )}

          {/* ── State: Password Creation ── */}
          {step === 'password' && invite && (
            <form onSubmit={handleActivation} noValidate className="space-y-4">
              <div className="space-y-1 text-center pb-1">
                <h2 className="text-xl font-display font-extrabold text-[#17233D]">Welcome, {invite.fullName}!</h2>
                <p className="text-xs text-[#667085] leading-relaxed max-w-xs mx-auto">
                  You've been invited as <strong className="text-[#17233D] capitalize">{invite.role}</strong>. Set a secure password to activate your account.
                </p>
              </div>

              {/* Invite summary chip */}
              <div className="bg-[#E7F5EF] border border-[#16866D]/20 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-[#16866D] shrink-0" />
                  <span className="text-xs font-semibold text-[#16866D] truncate">{invite.email}</span>
                </div>
                {invite.restaurantName && (
                  <div className="flex items-center space-x-2 pt-1 border-t border-[#16866D]/15">
                    <Building className="w-3.5 h-3.5 text-[#667085] shrink-0" />
                    <span className="text-xs text-[#667085] truncate">{invite.restaurantName}</span>
                  </div>
                )}
              </div>

              {/* Password Field */}
              <div className="w-full flex flex-col space-y-1 text-left">
                <label htmlFor="staff-create-password" className="text-xs font-bold text-[#17233D] select-none">
                  Choose a Password *
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                  <input
                    ref={passwordInputRef}
                    id="staff-create-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isActivating || isLoading}
                    required
                    className={cn(
                      "w-full pl-10 pr-12 py-2.5 sm:py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                      errors.password ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#667085] hover:text-[#17233D] focus:outline-none focus:ring-2 focus:ring-[#C94F3D]/40 rounded-lg transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-xs font-semibold text-red-600 pl-1">{errors.password}</span>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="w-full flex flex-col space-y-1 text-left">
                <label htmlFor="staff-confirm-password" className="text-xs font-bold text-[#17233D] select-none">
                  Confirm Password *
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#667085] absolute left-3.5 pointer-events-none" />
                  <input
                    ref={confirmInputRef}
                    id="staff-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isActivating || isLoading}
                    required
                    className={cn(
                      "w-full pl-10 pr-12 py-2.5 sm:py-3 bg-white border border-[#E5E1DC] text-[#17233D] rounded-xl text-sm placeholder-[#98A2B3] transition-all focus:outline-none focus:border-[#C94F3D] focus:ring-2 focus:ring-[#C94F3D]/20 disabled:opacity-60 disabled:bg-[#F3E8DF]",
                      errors.confirm ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#667085] hover:text-[#17233D] focus:outline-none focus:ring-2 focus:ring-[#C94F3D]/40 rounded-lg transition-colors cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirm && (
                  <span className="text-xs font-semibold text-red-600 pl-1">{errors.confirm}</span>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-left">
                  <p className="text-xs font-semibold text-red-600">{errorMessage}</p>
                </div>
              )}

              <button
                id="staff-activate-submit-button"
                type="submit"
                disabled={isActivating || isLoading}
                className="w-full h-12 mt-2 bg-[#C94F3D] hover:bg-[#A93E30] active:bg-[#923326] text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Activate Account &amp; Join</span>
                  </>
                )}
              </button>

              {isActivating && stage !== 'idle' && (
                <div className="flex items-center justify-center space-x-2 text-xs text-[#16866D] font-medium animate-pulse py-1.5 bg-[#E7F5EF] border border-[#16866D]/20 rounded-xl">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#16866D]" />
                  <span>{getStageLabel(stage)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setInvite(null);
                  setPassword('');
                  setConfirmPassword('');
                  setErrorMessage('');
                  setErrors({});
                }}
                className="w-full text-center text-xs font-semibold text-[#667085] hover:text-[#17233D] transition-colors pt-1 cursor-pointer"
              >
                ← Use a Different Link or ID
              </button>
            </form>
          )}

          {/* ── State: Success ── */}
          {step === 'success' && invite && (
            <div className="flex flex-col items-center text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-[#E7F5EF] border border-[#16866D]/30 flex items-center justify-center shadow-md animate-bounce">
                <CheckCircle className="w-8 h-8 text-[#16866D]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-display font-extrabold text-[#16866D]">Account Activated!</h2>
                <p className="text-xs text-[#667085] leading-relaxed">
                  Welcome to the team, <span className="font-bold text-[#17233D]">{invite.fullName}</span>.<br />
                  Redirecting you to your <span className="font-bold text-[#C94F3D] capitalize">{invite.role}</span> dashboard...
                </p>
              </div>
              <div className="w-full bg-[#F3E8DF] rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-[#16866D] rounded-full animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Footer links below card */}
        {step !== 'success' && (
          <div className="text-center space-y-1.5 pt-1">
            <p className="text-xs text-[#667085] font-medium">
              Already have an account?{' '}
              <Link to="/staff/login" className="text-[#C94F3D] hover:text-[#A93E30] hover:underline font-bold">
                Sign In
              </Link>
            </p>
            <Link
              to="/"
              className="block text-[11px] text-[#667085] hover:text-[#17233D] transition-colors font-semibold"
            >
              ← Back to Home
            </Link>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 4. MINIMALIST FOOTER                                                      */}
      {/* ========================================================================= */}
      <footer className="w-full border-t border-[#E5E1DC] bg-[#F3E8DF]/60 relative z-20">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-[#667085]">
          <div>
            <span>&copy; {new Date().getFullYear()} Spiral Dine. All rights reserved.</span>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-[#17233D] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Support Desk</a>
            <a href="#" className="hover:text-[#17233D] transition-colors">Contact Us</a>
          </div>
          <div>
            <span className="text-[11px] text-[#667085]">Staff Activation • Secure Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StaffActivate;
