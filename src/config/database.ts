import { PrismaClient } from "@prisma/client";
import { createModuleLogger } from "./logger.js";

const log = createModuleLogger("database");

log.info("Creating Prisma client...");

export const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "warn", emit: "stdout" },
  ],
});

// Log query events in development when debug logging is enabled
// if (process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL === 'debug') {
//   prisma.$on('query', (e) => {
//     log.debug(
//       {
//         query: e.query,
//         params: e.params,
//         duration: e.duration
//       },
//       "Database query executed"
//     );
//   });
// }

log.info("Prisma client created");

/**
 * Test database connection on startup
 */
export async function testDbConnection(): Promise<boolean> {
  log.info("Testing database connection...");
  try {
    await prisma.$queryRaw`SELECT 1`;
    log.info("Database connection successful");
    return true;
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error.message : "Unknown error" },
      "Database connection failed",
    );
    return false;
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDb(): Promise<void> {
  log.info("Disconnecting from database...");
  await prisma.$disconnect();
  log.info("Database disconnected");
}
