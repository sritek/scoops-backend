import { prisma } from "../config/database.js";
import { createModuleLogger } from "../config/logger.js";
import type { JobStatus } from "@prisma/client";

const log = createModuleLogger("job-tracker");

/**
 * Result returned by tracked jobs
 */
export interface JobResult {
  /** Number of events emitted by the job */
  eventsEmitted?: number;
  /** Number of records processed */
  recordsProcessed?: number;
  /** Whether the job was skipped (early exit, no work) */
  skipped?: boolean;
  /** Additional metadata to store */
  metadata?: Record<string, unknown>;
}

/**
 * Job definition for registration and manual triggering
 */
export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string; // Human-readable schedule
  cronExpression?: string;
  intervalMinutes?: number;
  lastRunAt?: Date | null;
  lastStatus?: JobStatus | null;
  isRunning: boolean;
}

/**
 * Track a job run in the database
 * 
 * Only logs jobs that did actual work (completed) or failed.
 * Skipped jobs are not logged to avoid flooding the database.
 * 
 * @param jobName - Unique identifier for the job
 * @param jobFn - Async function that performs the job work
 * @param orgId - Optional org ID for org-specific jobs
 * @param branchId - Optional branch ID for branch-specific jobs
 */
export async function trackJobRun(
  jobName: string,
  jobFn: () => Promise<JobResult>,
  orgId?: string,
  branchId?: string
): Promise<void> {
  const startedAt = new Date();

  try {
    const result = await jobFn();
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Don't log skipped jobs - they just clutter the database
    if (result.skipped) {
      log.debug(
        {
          jobName,
          durationMs,
          reason: result.metadata?.reason || "No work to do",
        },
        "Job skipped - not logging to database"
      );
      return;
    }

    // Only create DB record for jobs that did actual work
    await prisma.jobRun.create({
      data: {
        jobName,
        orgId,
        branchId,
        status: "completed",
        startedAt,
        completedAt,
        durationMs,
        eventsEmitted: result.eventsEmitted ?? 0,
        recordsProcessed: result.recordsProcessed ?? 0,
        metadata: result.metadata ? JSON.stringify(result.metadata) : null,
      },
    });

    log.info(
      {
        jobName,
        durationMs,
        eventsEmitted: result.eventsEmitted ?? 0,
        recordsProcessed: result.recordsProcessed ?? 0,
      },
      "Job run completed"
    );
  } catch (error) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Always log failures to database
    try {
      await prisma.jobRun.create({
        data: {
          jobName,
          orgId,
          branchId,
          status: "failed",
          startedAt,
          completedAt,
          durationMs,
          errorMessage,
        },
      });
    } catch (dbError) {
      log.warn({ jobName, dbError }, "Failed to log job failure to database");
    }

    log.error(
      {
        jobName,
        durationMs,
        error: errorMessage,
      },
      "Job run failed"
    );

    // Re-throw so the scheduler can also handle the error
    throw error;
  }
}

/**
 * Get the last run info for a job
 */
export async function getLastJobRun(jobName: string) {
  return prisma.jobRun.findFirst({
    where: { jobName },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Get job run statistics
 */
export async function getJobStats(jobName?: string, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where = {
    startedAt: { gte: since },
    ...(jobName ? { jobName } : {}),
  };

  const [total, completed, failed, skipped, avgDuration] = await Promise.all([
    prisma.jobRun.count({ where }),
    prisma.jobRun.count({ where: { ...where, status: "completed" } }),
    prisma.jobRun.count({ where: { ...where, status: "failed" } }),
    prisma.jobRun.count({ where: { ...where, status: "skipped" } }),
    prisma.jobRun.aggregate({
      where: { ...where, durationMs: { not: null } },
      _avg: { durationMs: true },
    }),
  ]);

  return {
    total,
    completed,
    failed,
    skipped,
    running: total - completed - failed - skipped,
    successRate: total > 0 ? ((completed + skipped) / total) * 100 : 0,
    avgDurationMs: avgDuration._avg.durationMs ?? 0,
  };
}

/**
 * Clean up old job runs (retention policy)
 */
export async function cleanupOldJobRuns(daysToKeep = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const result = await prisma.jobRun.deleteMany({
    where: {
      startedAt: { lt: cutoff },
    },
  });

  if (result.count > 0) {
    log.info({ deleted: result.count, daysKept: daysToKeep }, "Cleaned up old job runs");
  }

  return result.count;
}
