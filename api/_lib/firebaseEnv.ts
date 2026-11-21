export const PRODUCTION_FIREBASE_PROJECT_ID = 'spiral-restaurant-saas-v1';

export interface ServerFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface ServerAuthCredentials {
  email: string;
  password: string;
}

const PLACEHOLDER_PATTERN = /^(your_|<|replace[-_]|obtain_from_|placeholder|changeme|example)/i;

export function isValidServerEnvValue(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed === '[SENSITIVE]' || trimmed.includes('undefined')) return false;
  if (PLACEHOLDER_PATTERN.test(trimmed) || trimmed.includes('your_project_id')) {
    return false;
  }
  return true;
}

export function resolveServerEnvironment(
  env: Record<string, string | undefined>
): string {
  const raw = env.APP_ENV || env.VITE_APP_ENV || env.NODE_ENV || '';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'production' || normalized === 'prod') return 'production';
  if (normalized === 'staging' || normalized === 'stage') return 'staging';
  if (normalized === 'development' || normalized === 'dev' || normalized === 'test') return 'development';
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return 'production';
  return normalized || 'production';
}

export function assertServerProjectSafe(
  projectId: string,
  authDomain: string,
  storageBucket: string,
  env: Record<string, string | undefined>
): void {
  const serverEnv = resolveServerEnvironment(env);
  const useEmulator = String(env.USE_FIREBASE_EMULATOR || env.VITE_USE_FIREBASE_EMULATOR || '')
    .trim()
    .toLowerCase() === 'true';

  const targetsProduction =
    projectId.trim().toLowerCase() === PRODUCTION_FIREBASE_PROJECT_ID ||
    authDomain.trim().toLowerCase().includes(PRODUCTION_FIREBASE_PROJECT_ID) ||
    storageBucket.trim().toLowerCase().includes(PRODUCTION_FIREBASE_PROJECT_ID);

  if (useEmulator && projectId.trim().toLowerCase() === PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error(
      `[firebaseEnv] Emulator mode cannot target production project "${PRODUCTION_FIREBASE_PROJECT_ID}".`
    );
  }

  // Prevent accidental project switching in production:
  if (serverEnv === 'production' && projectId && projectId.trim().toLowerCase() !== PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error(
      `[firebaseEnv] Accidental project switching prevented: production environment strictly requires "${PRODUCTION_FIREBASE_PROJECT_ID}". Detected unauthorized project "${projectId}".`
    );
  }

  if (serverEnv === 'staging' && targetsProduction) {
    throw new Error(
      `[firebaseEnv] Server environment "${serverEnv}" refuses to connect to production Firebase project "${PRODUCTION_FIREBASE_PROJECT_ID}". Configure an isolated ${serverEnv} Firebase project.`
    );
  }
}

export function resolveOptionalServerProjectId(
  env: Record<string, string | undefined>
): string | null {
  const raw = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  if (!isValidServerEnvValue(raw)) return null;
  const trimmed = raw.trim();
  assertServerProjectSafe(trimmed, '', '', env);
  return trimmed;
}

export function resolveServerFirebaseConfig(
  env: Record<string, string | undefined>
): ServerFirebaseConfig {
  const fieldMappings: Array<{ field: keyof ServerFirebaseConfig; keys: string[] }> = [
    { field: 'apiKey', keys: ['FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'] },
    { field: 'authDomain', keys: ['FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN'] },
    { field: 'projectId', keys: ['FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'] },
    { field: 'storageBucket', keys: ['FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET'] },
    { field: 'messagingSenderId', keys: ['FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'] },
    { field: 'appId', keys: ['FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID'] },
  ];

  const resolved: Partial<ServerFirebaseConfig> = {};
  const missing: string[] = [];

  for (const { field, keys } of fieldMappings) {
    const val = keys.map((k) => env[k]).find((candidate) => isValidServerEnvValue(candidate));
    if (!val) {
      missing.push(keys.join(' or '));
    } else {
      resolved[field] = val.trim();
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[firebaseEnv] Missing or invalid server Firebase configuration: ${missing.join(', ')}. Silent production fallback is disabled.`
    );
  }

  const config = resolved as ServerFirebaseConfig;
  assertServerProjectSafe(config.projectId, config.authDomain, config.storageBucket, env);
  return config;
}

export function resolveServerAuthCredentials(
  env: Record<string, string | undefined>
): ServerAuthCredentials {
  const email = env.FIREBASE_SERVER_EMAIL;
  const password = env.FIREBASE_SERVER_PASSWORD;

  if (!isValidServerEnvValue(email) || !isValidServerEnvValue(password)) {
    throw new Error(
      '[firebaseEnv] Missing FIREBASE_SERVER_EMAIL or FIREBASE_SERVER_PASSWORD. Hardcoded development credentials have been removed; configure dedicated server credentials or Firebase Admin service account credentials.'
    );
  }

  if (email.trim().toLowerCase().includes('dev-admin-reset')) {
    throw new Error(
      '[firebaseEnv] Deprecated internal dev-admin-reset credentials are forbidden in server configuration.'
    );
  }

  return {
    email: email.trim(),
    password: password.trim(),
  };
}

