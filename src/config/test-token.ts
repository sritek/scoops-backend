#!/usr/bin/env tsx
/**
 * Test Token Generator Script
 *
 * Creates a custom Firebase token for testing purposes.
 *
 * Usage:
 *   npm run token:test
 *   npm run token:test -- <uid>
 *   npm run token:test -- <uid> <phone> <email>
 *
 * Examples:
 *   npm run token:test                          # Creates token with default test-user-uid
 *   npm run token:test -- my-custom-uid         # Creates token with custom UID
 *   npm run token:test -- user123 +911234567890 # Creates token with UID and phone
 */

import { createCustomToken } from "./firebase.js";
import { createModuleLogger } from "./logger.js";

const log = createModuleLogger("token-generator");

log.info("========================================");
log.info("FIREBASE CUSTOM TOKEN GENERATOR");
log.info("========================================");

// Parse command line arguments
const args = process.argv.slice(2);
const uid = args[0] || "test-user-uid";
const phone = args[1];
const email = args[2];

log.info(
  { uid, phone: phone ?? null, email: email ?? null },
  "Input parameters"
);

// Build custom claims if phone/email provided
const claims: Record<string, string> = {};
if (phone) claims.phone_number = phone;
if (email) claims.email = email;

log.info("Creating custom token...");

createCustomToken(uid, Object.keys(claims).length > 0 ? claims : undefined)
  .then((customToken) => {
    log.info("========================================");
    log.info("TOKEN CREATED SUCCESSFULLY");
    log.info("========================================");

    log.info({ tokenLength: customToken.length }, "Token details");

    // Output the raw token for easy copy-paste
    // Using console.log here intentionally for clean CLI output
    process.stdout.write("\n--- CUSTOM TOKEN (copy below) ---\n\n");
    process.stdout.write(customToken);
    process.stdout.write("\n\n--- END TOKEN ---\n\n");

    log.warn("Custom tokens are NOT the same as ID tokens!");
    log.info("To get an ID token:");
    log.info("  1. Use this custom token to sign in via Firebase Client SDK");
    log.info("  2. Call getIdToken() on the signed-in user");
    log.info(
      "  For Swagger/API testing, you need the ID token, not the custom token."
    );
  })
  .catch((error: Error) => {
    log.error("========================================");
    log.error("TOKEN CREATION FAILED");
    log.error("========================================");

    log.error({ err: error.message }, "Error creating token");

    if (error.message.includes("credential")) {
      log.error("This error usually means:");
      log.error("  1. GOOGLE_APPLICATION_CREDENTIALS is not set correctly");
      log.error("  2. The service account JSON file is missing or invalid");
      log.error(
        "  3. The service account doesn't have the required permissions"
      );
    }

    process.exit(1);
  });
