import crypto from 'node:crypto';
import {
  App,
  ServiceAccount,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import {
  FieldValue,
  Firestore,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';
import {
  assertServerProjectSafe,
  isValidServerEnvValue,
  resolveOptionalServerProjectId,
  resolveServerEnvironment,
} from './firebaseEnv.js';

export type FirebaseAdminErrorCode =
  | 'MISSING_CREDENTIALS'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_ENVIRONMENT'
  | 'PROJECT_MISMATCH'
  | 'INIT_FAILED';

export class FirebaseAdminInitError extends Error {
  public readonly code: FirebaseAdminErrorCode;
  public readonly statusCode: number;

  constructor(code: FirebaseAdminErrorCode, message: string, statusCode = 500) {
    super(message);
    this.name = 'FirebaseAdminInitError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ResolvedAdminConfig {
  mode: 'service_account' | 'emulator';
  projectId: string;
  environment: string;
  serviceAccount?: ServiceAccount;
}

export interface FirebaseAdminBundle {
  app: App;
  auth?: Auth;
  db: Firestore;
  FieldValue: typeof FieldValue;
  Timestamp: typeof Timestamp;
  projectId: string;
  environment: string;
  isEmulator: boolean;
}

/**
 * Constant-time string comparison using SHA-256 digests so lengths and contents
 * are never leaked via timing side channels.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function assertSafeProjectWithAdminError(
  projectId: string,
  env: Record<string, string | undefined>
): void {
  try {
    assertServerProjectSafe(projectId, '', '', env);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FirebaseAdminInitError('INVALID_ENVIRONMENT', message, 500);
  }
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

/**
 * Validates and resolves Firebase Admin SDK credentials and target project.
 * Never falls back silently to production or hardcoded defaults.
 */
export function resolveAdminCredentials(
  env: Record<string, string | undefined> = process.env
): ResolvedAdminConfig {
  const environment = resolveServerEnvironment(env);
  const hasEmulatorHost = Boolean(
    isValidServerEnvValue(env.FIRESTORE_EMULATOR_HOST) ||
      isValidServerEnvValue(env.FIREBASE_AUTH_EMULATOR_HOST)
  );

  if (environment === 'production' && hasEmulatorHost) {
    throw new FirebaseAdminInitError(
      'INVALID_ENVIRONMENT',
      '[firebaseAdmin] Firebase emulator host variables must not be set in production.'
    );
  }

  let configuredProjectId: string | null;
  try {
    configuredProjectId = resolveOptionalServerProjectId(env);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FirebaseAdminInitError('INVALID_ENVIRONMENT', message, 500);
  }

  if (isValidServerEnvValue(env.FIREBASE_SERVICE_ACCOUNT)) {
    const raw = env.FIREBASE_SERVICE_ACCOUNT.trim();
    let parsed: Record<string, unknown>;

    try {
      const jsonText = raw.startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf8');
      parsed = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      throw new FirebaseAdminInitError(
        'INVALID_CREDENTIALS',
        '[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64-encoded JSON.'
      );
    }

    const saProjectId = parsed.project_id;
    const saClientEmail = parsed.client_email;
    const saPrivateKey = parsed.private_key;

    if (!isValidServerEnvValue(saClientEmail) || !isValidServerEnvValue(saPrivateKey)) {
      throw new FirebaseAdminInitError(
        'INVALID_CREDENTIALS',
        '[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT must contain non-empty client_email and private_key.'
      );
    }

    const resolvedSaProjectId = isValidServerEnvValue(saProjectId)
      ? saProjectId.trim()
      : null;

    if (configuredProjectId && resolvedSaProjectId && configuredProjectId !== resolvedSaProjectId) {
      throw new FirebaseAdminInitError(
        'PROJECT_MISMATCH',
        `[firebaseAdmin] Service account project_id ("${resolvedSaProjectId}") does not match configured project ID ("${configuredProjectId}").`
      );
    }

    const projectId = resolvedSaProjectId || configuredProjectId;
    if (!projectId) {
      throw new FirebaseAdminInitError(
        'MISSING_CREDENTIALS',
        '[firebaseAdmin] Service account lacks project_id and no FIREBASE_PROJECT_ID is configured.'
      );
    }

    assertSafeProjectWithAdminError(projectId, env);

    return {
      mode: 'service_account',
      projectId,
      environment,
      serviceAccount: {
        projectId,
        clientEmail: saClientEmail.trim(),
        privateKey: normalizePrivateKey(saPrivateKey),
      },
    };
  }

  if (
    isValidServerEnvValue(env.FIREBASE_CLIENT_EMAIL) &&
    isValidServerEnvValue(env.FIREBASE_PRIVATE_KEY)
  ) {
    if (!configuredProjectId) {
      throw new FirebaseAdminInitError(
        'MISSING_CREDENTIALS',
        '[firebaseAdmin] FIREBASE_PROJECT_ID must be explicitly configured when using FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
      );
    }

    assertSafeProjectWithAdminError(configuredProjectId, env);

    return {
      mode: 'service_account',
      projectId: configuredProjectId,
      environment,
      serviceAccount: {
        projectId: configuredProjectId,
        clientEmail: env.FIREBASE_CLIENT_EMAIL.trim(),
        privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
      },
    };
  }

  if (hasEmulatorHost) {
    if (!configuredProjectId) {
      throw new FirebaseAdminInitError(
        'MISSING_CREDENTIALS',
        '[firebaseAdmin] Emulator mode requires explicit non-production FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID).'
      );
    }

    assertSafeProjectWithAdminError(configuredProjectId, env);

    return {
      mode: 'emulator',
      projectId: configuredProjectId,
      environment,
    };
  }

  throw new FirebaseAdminInitError(
    'MISSING_CREDENTIALS',
    '[firebaseAdmin] Missing Firebase Admin SDK credentials. Configure FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
  );
}

/**
 * Returns the initialized Firebase Admin SDK bundle, creating the default App
 * once if needed and guarding against cross-project reuse.
 */
export function getFirebaseAdmin(
  env: Record<string, string | undefined> = process.env
): FirebaseAdminBundle {
  const resolved = resolveAdminCredentials(env);

  let app: App;
  const existingApps = getApps();

  if (existingApps.length > 0) {
    app = getApp();
    const existingProjectId = app.options.projectId;
    if (existingProjectId && existingProjectId !== resolved.projectId) {
      throw new FirebaseAdminInitError(
        'PROJECT_MISMATCH',
        `[firebaseAdmin] Existing Firebase Admin App targets "${existingProjectId}", expected "${resolved.projectId}".`
      );
    }
  } else {
    try {
      app =
        resolved.mode === 'service_account' && resolved.serviceAccount
          ? initializeApp({
              credential: cert(resolved.serviceAccount),
              projectId: resolved.projectId,
            })
          : initializeApp({
              projectId: resolved.projectId,
            });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new FirebaseAdminInitError(
        'INIT_FAILED',
        `[firebaseAdmin] Failed to initialize Firebase Admin SDK: ${message}`
      );
    }
  }

  return {
    app,
    db: getFirestore(app),
    FieldValue,
    Timestamp,
    projectId: resolved.projectId,
    environment: resolved.environment,
    isEmulator: resolved.mode === 'emulator',
  };
}

export function getAdminDb(
  env: Record<string, string | undefined> = process.env
): Firestore {
  return getFirebaseAdmin(env).db;
}

function createLazyAdminProxy<T extends object>(resolveTarget: () => T): T {
  return new Proxy({} as T, {
    get(_unused, prop) {
      const target = resolveTarget();
      const value = Reflect.get(target, prop, target);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });
}

export const adminDb: Firestore = createLazyAdminProxy<Firestore>(() => getAdminDb());

export { FieldValue, Timestamp };
