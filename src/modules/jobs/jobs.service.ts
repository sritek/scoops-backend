import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { getJobDefinitions, triggerJob as triggerScheduledJob } from "../../scheduler/index.js";
import { getJobStats, getLastJobRun } from "../../scheduler/job-tracker.js";
import type { JobStatus } from "@prisma/client";

const log = createModuleLogger("jobs-service");

export interface JobRunFilters {
  jobName?: string;
  status?: JobStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Check if jobs dashboard is enabled for the organization
 */
export async function isJobsDashboardEnabled(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { jobsDashboardEnabled: true },
  });
  return org?.jobsDashboardEnabled ?? false;
}

/**
 * Get all job definitions with last run info
 */
export async function getJobs(orgId: string) {
  const definitions = getJobDefinitions();

  // Get last run for each job
  const jobsWithLastRun = await Promise.all(
    definitions.map(async (job) => {
      const lastRun = await getLastJobRun(job.id);
      return {
        ...job,
        lastRunAt: lastRun?.startedAt ?? null,
        lastStatus: lastRun?.status ?? null,
        lastDurationMs: lastRun?.durationMs ?? null,
      };
    })
  );

  return jobsWithLastRun;
}

/**
 * Get paginated job runs
 */
export async function getJobRuns(
  orgId: string,
  filters: JobRunFilters,
  pagination: PaginationParams
) {
  const where: Record<string, unknown> = {};

  // For now, we show all job runs (they're global)
  // In future, could filter by orgId if jobs become org-specific

  if (filters.jobName) {
    where.jobName = filters.jobName;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.startedAt = {};
    if (filters.startDate) {
      (where.startedAt as Record<string, Date>).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.startedAt as Record<string, Date>).lte = filters.endDate;
    }
  }

  const [runs, total] = await Promise.all([
    prisma.jobRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    prisma.jobRun.count({ where }),
  ]);

  return {
    data: runs,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    },
  };
}

/**
 * Get a single job run by ID
 */
export async function getJobRunById(runId: string) {
  const run = await prisma.jobRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return null;
  }

  // Parse metadata if present
  let metadata = null;
  if (run.metadata) {
    try {
      metadata = JSON.parse(run.metadata);
    } catch {
      metadata = run.metadata;
    }
  }

  return {
    ...run,
    metadata,
  };
}

/**
 * Get job statistics
 */
export async function getJobStatistics(orgId: string, jobName?: string, days = 7) {
  const stats = await getJobStats(jobName, days);

  // Get per-job breakdown
  const jobs = getJobDefinitions();
  const jobBreakdown = await Promise.all(
    jobs.map(async (job) => {
      const jobStats = await getJobStats(job.id, days);
      return {
        jobName: job.id,
        jobDisplayName: job.name,
        ...jobStats,
      };
    })
  );

  return {
    overall: stats,
    byJob: jobBreakdown,
    periodDays: days,
  };
}

/**
 * Trigger a job manually
 */
export async function triggerJob(jobName: string) {
  log.info({ jobName }, "Manually triggering job");

  try {
    await triggerScheduledJob(jobName);
    return { success: true, message: `Job ${jobName} triggered successfully` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ jobName, error: message }, "Failed to trigger job");
    throw new Error(`Failed to trigger job: ${message}`);
  }
}

/**
 * Retry a failed job run
 * Creates a new run with the same parameters
 */
export async function retryJobRun(runId: string) {
  const originalRun = await prisma.jobRun.findUnique({
    where: { id: runId },
  });

  if (!originalRun) {
    throw new Error("Job run not found");
  }

  if (originalRun.status !== "failed") {
    throw new Error("Can only retry failed jobs");
  }

  log.info(
    { runId, jobName: originalRun.jobName },
    "Retrying failed job"
  );

  // Trigger a new run of the same job
  await triggerScheduledJob(originalRun.jobName);

  return { success: true, message: `Job ${originalRun.jobName} retriggered` };
}
