import { z } from "zod";

/**
 * Environment variable schema with validation rules.
 * All required variables must be present at startup.
 */
const envSchema = z.object({
  // Server configuration
  PORT: z.coerce
    .number()
    .int("PORT must be an integer")
    .min(1, "PORT must be at least 1")
    .max(65535, "PORT must be at most 65535")
    .default(3000),

  HOST: z.string().min(1, "HOST cannot be empty").default("0.0.0.0"),

  NODE_ENV: z
    .enum(["development", "production", "test"], {
      errorMap: () => ({
        message: "NODE_ENV must be one of: development, production, test",
      }),
    })
    .default("development"),

  // Database configuration - required
  DATABASE_URL: z
    .string({
      required_error: "DATABASE_URL is required",
    })
    .min(1, "DATABASE_URL cannot be empty")
    .refine(
      (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
      "DATABASE_URL must be a valid PostgreSQL connection string (must start with postgresql:// or postgres://)"
    ),

  // Logging configuration
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"], {
      errorMap: () => ({
        message:
          "LOG_LEVEL must be one of: fatal, error, warn, info, debug, trace",
      }),
    })
    .default("info"),

  // CORS configuration
  // In production, set to comma-separated list of allowed origins
  // e.g., "https://app.example.com,https://admin.example.com"
  // In development, defaults to "*" (all origins)
  CORS_ORIGIN: z
    .string()
    .default("*")
    .transform((val) => {
      if (val === "*") return val;
      // Split comma-separated origins into array
      return val.split(",").map((origin) => origin.trim());
    }),

  // JWT configuration
  JWT_SECRET: z
    .string({
      required_error: "JWT_SECRET is required",
    })
    .min(32, "JWT_SECRET must be at least 32 characters for security"),

  JWT_EXPIRES_IN: z
    .string()
    .default("7d")
    .refine(
      (val) => /^\d+[smhd]$/.test(val),
      "JWT_EXPIRES_IN must be a valid duration (e.g., '7d', '24h', '60m')"
    ),
});

/**
 * Validated environment type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables and fail fast with clear error messages.
 * This runs at startup before the application initializes.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n❌ Environment validation failed:\n");

    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "unknown";
      console.error(`   ${path}: ${issue.message}`);
    }

    console.error(
      "\n💡 Please check your .env file or environment variables.\n"
    );
    process.exit(1);
  }

  return result.data;
}

/**
 * Validated environment variables.
 * Import this to access validated env values.
 *
 * @example
 * import { env } from './config/env.js';
 * console.log(env.PORT); // number
 * console.log(env.DATABASE_URL); // string (validated)
 */
export const env = validateEnv();
