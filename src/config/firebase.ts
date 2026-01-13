import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { env } from "./env.js";
import { createModuleLogger } from "./logger.js";

const log = createModuleLogger("firebase");

/**
 * Firebase Admin SDK initialization
 * Uses service account credentials from GOOGLE_APPLICATION_CREDENTIALS env var
 */
log.info("Initializing Firebase Admin SDK...");
log.info(
  { credentialsPath: env.GOOGLE_APPLICATION_CREDENTIALS },
  "Using credentials file"
);

if (getApps().length === 0) {
  log.info("No existing Firebase apps found, creating new app...");
  try {
    initializeApp({
      credential: cert(env.GOOGLE_APPLICATION_CREDENTIALS),
    });
    log.info("Firebase Admin SDK initialized successfully");
  } catch (error) {
    log.error({ err: error }, "Failed to initialize Firebase Admin SDK");
    throw error;
  }
} else {
  log.info("Using existing Firebase app (already initialized)");
}

/**
 * Firebase Auth instance for token verification
 */
const firebaseAuth = getAuth();
log.info("Firebase Auth instance created");

/**
 * Decoded token result from Firebase verification
 */
export interface FirebaseDecodedToken {
  uid: string;
  email?: string;
  phone_number?: string;
}

/**
 * Verify a Firebase ID token
 *
 * @param token - The Firebase ID token to verify
 * @returns Decoded token with uid, email, phone_number or null if invalid
 *
 * @example
 * const decoded = await verifyIdToken(token);
 * if (!decoded) {
 *   // Token is invalid or expired
 * }
 * console.log(decoded.uid); // Firebase user ID
 */
export async function verifyIdToken(
  token: string
): Promise<FirebaseDecodedToken | null> {
  log.debug({ tokenLength: token.length }, "Verifying ID token...");

  try {
    const decoded: DecodedIdToken = await firebaseAuth.verifyIdToken(token);
    log.info(
      {
        uid: decoded.uid,
        email: decoded.email ?? null,
        phone: decoded.phone_number ?? null,
      },
      "Token verified successfully"
    );

    return {
      uid: decoded.uid,
      email: decoded.email,
      phone_number: decoded.phone_number,
    };
  } catch (error) {
    log.warn(
      { err: error instanceof Error ? error.message : "Unknown error" },
      "Token verification failed"
    );
    // Token verification failed (invalid, expired, or revoked)
    return null;
  }
}

/**
 * Create a custom token for testing
 *
 * @param uid - The user ID to create a token for
 * @param claims - Optional custom claims
 * @returns Custom token string
 */
export async function createCustomToken(
  uid: string,
  claims?: Record<string, unknown>
): Promise<string> {
  log.info({ uid, hasClaims: !!claims }, "Creating custom token...");

  try {
    const token = await firebaseAuth.createCustomToken(uid, claims);
    log.info(
      { uid, tokenLength: token.length },
      "Custom token created successfully"
    );
    return token;
  } catch (error) {
    log.error(
      { uid, err: error instanceof Error ? error.message : "Unknown error" },
      "Failed to create custom token"
    );
    throw error;
  }
}

/**
 * Export auth instance for advanced use cases
 */
export { firebaseAuth };
