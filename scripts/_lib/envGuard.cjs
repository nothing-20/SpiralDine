const fs = require('fs');
const path = require('path');

const PRODUCTION_PROJECT_ID = 'spiral-restaurant-saas-v1';
const FORBIDDEN_CREDENTIAL_MARKER = 'dev-admin-reset';
const PLACEHOLDER_PATTERN = /^(your_|<|replace[-_]|obtain_from_|placeholder|changeme|example)/i;

function isValidEnvValue(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed === '[SENSITIVE]' || trimmed.includes('undefined')) return false;
  if (PLACEHOLDER_PATTERN.test(trimmed) || trimmed.includes('your_project_id')) {
    return false;
  }
  return true;
}

function normalizeEnvName(raw) {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'prod' || val === 'production') return 'production';
  if (val === 'stage' || val === 'staging' || val === 'preview') return 'staging';
  if (val === 'dev' || val === 'development') return 'development';
  return val;
}

function parseCliFlags(argv = process.argv.slice(2)) {
  const result = {
    env: '',
    project: '',
    execute: false,
    dryRun: false,
    confirm: false,
    email: '',
    uid: '',
    key: '',
    positional: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--execute') {
      result.execute = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--confirm') {
      result.confirm = true;
    } else if (arg.startsWith('--env=')) {
      result.env = arg.slice('--env='.length).trim();
    } else if (arg === '--env' && argv[i + 1]) {
      result.env = argv[++i].trim();
    } else if (arg.startsWith('--project=')) {
      result.project = arg.slice('--project='.length).trim();
    } else if ((arg === '--project' || arg === '-P') && argv[i + 1]) {
      result.project = argv[++i].trim();
    } else if (arg.startsWith('--email=')) {
      result.email = arg.slice('--email='.length).trim();
    } else if (arg === '--email' && argv[i + 1]) {
      result.email = argv[++i].trim();
    } else if (arg.startsWith('--uid=')) {
      result.uid = arg.slice('--uid='.length).trim();
    } else if (arg === '--uid' && argv[i + 1]) {
      result.uid = argv[++i].trim();
    } else if (arg.startsWith('--key=')) {
      result.key = arg.slice('--key='.length).trim();
    } else if (arg === '--key' && argv[i + 1]) {
      result.key = argv[++i].trim();
    } else {
      result.positional.push(arg);
    }
  }

  return result;
}

function loadEnvFile(filePath, envTarget = process.env) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIndex).trim();
    const rawVal = trimmed.slice(eqIndex + 1).trim();
    const val = rawVal.replace(/^["']|["']$/g, '');
    if (key && envTarget[key] === undefined) {
      envTarget[key] = val;
    }
  }
  return true;
}

function loadScriptEnvironment({ rootDir, envName = '', envTarget = process.env } = {}) {
  const resolvedRoot = rootDir || path.resolve(__dirname, '../..');
  const normalized = normalizeEnvName(envName);

  const loaded = [];
  if (normalized === 'development') {
    for (const f of ['.env.development.local', '.env.development']) {
      const p = path.resolve(resolvedRoot, f);
      if (loadEnvFile(p, envTarget)) loaded.push(f);
    }
  } else if (normalized === 'staging') {
    for (const f of ['.env.staging.local', '.env.staging']) {
      const p = path.resolve(resolvedRoot, f);
      if (loadEnvFile(p, envTarget)) loaded.push(f);
    }
  } else if (normalized === 'production') {
    for (const f of ['.env.production.local', '.env.production', '.env']) {
      const p = path.resolve(resolvedRoot, f);
      if (loadEnvFile(p, envTarget)) loaded.push(f);
    }
  } else {
    for (const f of ['.env.local', '.env']) {
      const p = path.resolve(resolvedRoot, f);
      if (loadEnvFile(p, envTarget)) loaded.push(f);
    }
  }
  return loaded;
}

function referencesProductionProject(configOrId) {
  if (!configOrId) return false;
  if (typeof configOrId === 'string') {
    return configOrId.trim().toLowerCase().includes(PRODUCTION_PROJECT_ID);
  }
  const fields = [configOrId.projectId, configOrId.authDomain, configOrId.storageBucket];
  return fields.some((f) => typeof f === 'string' && f.trim().toLowerCase().includes(PRODUCTION_PROJECT_ID));
}

function assertNotProductionProject(configOrId, contextName = 'Script') {
  if (referencesProductionProject(configOrId)) {
    throw new Error(
      `[PRODUCTION SAFEGUARD] ${contextName} permanently refuses to run against production Firebase project "${PRODUCTION_PROJECT_ID}".`
    );
  }
}

function resolveScriptFirebaseConfig(env = process.env, { expectedEnv = '' } = {}) {
  const normalizedExpected = normalizeEnvName(expectedEnv);
  const mappings = [
    ['apiKey', ['FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY']],
    ['authDomain', ['FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN']],
    ['projectId', ['FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID']],
    ['storageBucket', ['FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET']],
    ['messagingSenderId', ['FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID']],
    ['appId', ['FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID']],
  ];

  const config = {};
  const missing = [];

  for (const [field, keys] of mappings) {
    const val = keys.map((k) => env[k]).find((candidate) => isValidEnvValue(candidate));
    if (!val) {
      missing.push(keys.join(' or '));
    } else {
      config[field] = val.trim();
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[ENV VALIDATION ERROR] Missing or invalid Firebase configuration keys: ${missing.join(', ')}. Silent fallback to production is permanently disabled.`
    );
  }

  if (
    (normalizedExpected === 'development' || normalizedExpected === 'staging') &&
    referencesProductionProject(config)
  ) {
    throw new Error(
      `[ENVIRONMENT ISOLATION ERROR] "${normalizedExpected}" execution refuses to connect to production Firebase project "${PRODUCTION_PROJECT_ID}".`
    );
  }

  return config;
}

function resolveRunnerCredentials(
  env = process.env,
  {
    emailKeys = ['FIREBASE_ADMIN_EMAIL', 'FIREBASE_SERVER_EMAIL'],
    passwordKeys = ['FIREBASE_ADMIN_PASSWORD', 'FIREBASE_SERVER_PASSWORD'],
  } = {}
) {
  const email = emailKeys.map((k) => env[k]).find((v) => isValidEnvValue(v));
  const password = passwordKeys.map((k) => env[k]).find((v) => isValidEnvValue(v));

  if (!email || !password) {
    throw new Error(
      `[AUTH CONFIG ERROR] Missing explicit credentials (${emailKeys.join(' / ')} and ${passwordKeys.join(' / ')}). Hardcoded development administrator credentials have been removed.`
    );
  }

  if (email.trim().toLowerCase().includes(FORBIDDEN_CREDENTIAL_MARKER)) {
    throw new Error(
      '[AUTH CONFIG ERROR] Deprecated internal dev-admin-reset credentials are forbidden.'
    );
  }

  return { email: email.trim(), password: password.trim() };
}

module.exports = {
  PRODUCTION_PROJECT_ID,
  isValidEnvValue,
  normalizeEnvName,
  parseCliFlags,
  loadScriptEnvironment,
  referencesProductionProject,
  assertNotProductionProject,
  resolveScriptFirebaseConfig,
  resolveRunnerCredentials,
};

