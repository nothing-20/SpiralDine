/**
 * Deprecated client-SDK server helper.
 * All serverless routes now use Firebase Admin SDK (`api/_lib/firebaseAdmin.ts`).
 */
export async function ensureServerAuth(): Promise<never> {
  throw new Error(
    '[firebaseServer] Client-SDK server authentication is deprecated. Migrate caller to Firebase Admin SDK (api/_lib/firebaseAdmin.ts).'
  );
}
