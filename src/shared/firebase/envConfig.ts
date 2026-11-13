export const PRODUCTION_FIREBASE_PROJECT_ID = 'spiral-restaurant-saas-v1';

export interface WebFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const PLACEHOLDER_PATTERN = /^(your_|<|replace[-_]|obtain_from_|placeholder|changeme|example)/i;

/**
 * Validates that an environment variable value is a real, non-placeholder string.
 */
export function isValidFirebaseEnvValue(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed === '[SENSITIVE]' || trimmed.includes('undefined')) return false;
  if (PLACEHOLDER_PATTERN.test(trimmed) || trimmed.includes('your_project_id')) {
    return false;
  }
  return true;
}

/**
 * Normalizes the active web application environment ('development' | 'staging' | 'production' | ...).
 */
export function resolveWebEnvironment(env: Record<string, unknown>): string {
  const raw = (env.VITE_APP_ENV ?? env.MODE ?? 'development');
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : 'development';
  if (normalized === 'prod' || normalized === 'production') return 'production';
  if (normalized === 'stage' || normalized === 'staging') return 'staging';
  if (normalized === 'dev' || normalized === 'development') return 'development';
  return normalized || 'development';
}

function referencesProductionProject(config: Pick<WebFirebaseConfig, 'projectId' | 'authDomain' | 'storageBucket'>): boolean {
  const pid = config.projectId.trim().toLowerCase();
  const domain = config.authDomain.trim().toLowerCase();
  const bucket = config.storageBucket.trim().toLowerCase();
  return (
    pid === PRODUCTION_FIREBASE_PROJECT_ID ||
    domain.includes(PRODUCTION_FIREBASE_PROJECT_ID) ||
    bucket.includes(PRODUCTION_FIREBASE_PROJECT_ID)
  );
}

/**
 * Resolves and strictly validates the web Firebase SDK config from Vite environment variables.
 * Never falls back silently to production credentials. Blocks non-production environments from
 * targeting the confirmed production Firebase project `spiral-restaurant-saas-v1`.
 */
export function resolveWebFirebaseConfig(env: Record<string, unknown>): WebFirebaseConfig {
  const appEnv = resolveWebEnvironment(env);
  const useEmulator = String(env.VITE_USE_FIREBASE_EMULATOR ?? '').trim().toLowerCase() === 'true';

  const requiredKeys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ] as const;

  if (useEmulator && appEnv !== 'production') {
    const rawProjectId = isValidFirebaseEnvValue(env.VITE_FIREBASE_PROJECT_ID)
      ? env.VITE_FIREBASE_PROJECT_ID.trim()
      : 'demo-spiraldine-emulator';

    if (rawProjectId.toLowerCase() === PRODUCTION_FIREBASE_PROJECT_ID) {
      throw new Error(
        `[FirebaseConfig] Environment "${appEnv}" with emulator mode cannot use production project "${PRODUCTION_FIREBASE_PROJECT_ID}". Use a demo-* project ID instead.`
      );
    }

    return {
      apiKey: isValidFirebaseEnvValue(env.VITE_FIREBASE_API_KEY)
        ? env.VITE_FIREBASE_API_KEY.trim()
        : 'emulator-only-api-key',
      authDomain: isValidFirebaseEnvValue(env.VITE_FIREBASE_AUTH_DOMAIN)
        ? env.VITE_FIREBASE_AUTH_DOMAIN.trim()
        : `${rawProjectId}.firebaseapp.com`,
      projectId: rawProjectId,
      storageBucket: isValidFirebaseEnvValue(env.VITE_FIREBASE_STORAGE_BUCKET)
        ? env.VITE_FIREBASE_STORAGE_BUCKET.trim()
        : `${rawProjectId}.firebasestorage.app`,
      messagingSenderId: isValidFirebaseEnvValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID)
        ? env.VITE_FIREBASE_MESSAGING_SENDER_ID.trim()
        : '000000000000',
      appId: isValidFirebaseEnvValue(env.VITE_FIREBASE_APP_ID)
        ? env.VITE_FIREBASE_APP_ID.trim()
        : '1:000000000000:web:emulator',
    };
  }

  const invalidKeys = requiredKeys.filter((key) => !isValidFirebaseEnvValue(env[key]));
  if (invalidKeys.length > 0) {
    throw new Error(
      `[FirebaseConfig] Missing or invalid required Firebase environment variable(s) for "${appEnv}": ${invalidKeys.join(', ')}. Configure an isolated .env.${appEnv}.local file using .env.${appEnv}.example.`
    );
  }

  const config: WebFirebaseConfig = {
    apiKey: (env.VITE_FIREBASE_API_KEY as string).trim(),
    authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string).trim(),
    projectId: (env.VITE_FIREBASE_PROJECT_ID as string).trim(),
    storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string).trim(),
    messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string).trim(),
    appId: (env.VITE_FIREBASE_APP_ID as string).trim(),
  };

  if (appEnv !== 'production' && referencesProductionProject(config)) {
    throw new Error(
      `[FirebaseConfig] Environment isolation violation: "${appEnv}" environment is forbidden from connecting to production Firebase project "${PRODUCTION_FIREBASE_PROJECT_ID}". Configure an isolated ${appEnv} Firebase project or enable VITE_USE_FIREBASE_EMULATOR=true with a demo-* project.`
    );
  }

  return config;
}

