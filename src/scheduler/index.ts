import type { FastifyInstance } from "fastify";
import fastifySchedule from "@fastify/schedule";
import { SimpleIntervalJob, CronJob, AsyncTask } from "toad-scheduler";
import { createModuleLogger } from "../config/logger.js";
import { processEventsJob } from "./jobs/event-processor.job.js";
import { checkOverdueFeesJob } from "./jobs/fee-overdue.job.js";
import { sendFeeRemindersJob } from "./jobs/fee-reminder.job.js";
import { sendBirthdayNotificationsJob } from "./jobs/birthday.job.js";
import { trackJobRun, cleanupOldJobRuns, type JobDefinition } from "./job-tracker.js";

const log = createModuleLogger("scheduler");

/**
 * Job definitions for the API
 */
export const JOB_DEFINITIONS: JobDefinition[] = [
  {
    id: "event-processor",
    name: "Event Processor",
    description: "Processes pending attendance events. Only runs during school hours (7-11 AM) and respects org's attendance window.",
    schedule: "Every 15 mins, 7-11 AM, Mon-Sat",
    cronExpression: "*/15 7-10 * * 1-6",
    isRunning: false,
  },
  {
    id: "fee-overdue-check",
    name: "Fee Overdue Check",
    description: "Checks for overdue fees and emits events",
    schedule: "Every hour (org-specific time)",
    intervalMinutes: 60,
    isRunning: false,
  },
  {
    id: "fee-reminder",
    name: "Fee Reminder",
    description: "Sends reminders for fees due soon",
    schedule: "Daily at 8:00 AM",
    cronExpression: "0 8 * * *",
    isRunning: false,
  },
  {
    id: "birthday-notifications",
    name: "Birthday Notifications",
    description: "Sends birthday wishes to students",
    schedule: "Daily at 9:00 AM",
    cronExpression: "0 9 * * *",
    isRunning: false,
  },
  {
    id: "cleanup-job-runs",
    name: "Job Runs Cleanup",
    description: "Cleans up old job run records (30 day retention)",
    schedule: "Daily at 3:00 AM",
    cronExpression: "0 3 * * *",
    isRunning: false,
  },
];

/**
 * Map of running jobs for status checking
 */
const runningJobs = new Set<string>();

/**
 * Get job definitions with real-time running status
 */
export function getJobDefinitions(): JobDefinition[] {
  return JOB_DEFINITIONS.map((job) => ({
    ...job,
    isRunning: runningJobs.has(job.id),
  }));
}

/**
 * Trigger a job manually
 */
export async function triggerJob(jobName: string): Promise<void> {
  log.info({ jobName }, "Manually triggering job");

  switch (jobName) {
    case "event-processor":
      await trackJobRun("event-processor", processEventsJob);
      break;
    case "fee-overdue-check":
      await trackJobRun("fee-overdue-check", checkOverdueFeesJob);
      break;
    case "fee-reminder":
      await trackJobRun("fee-reminder", sendFeeRemindersJob);
      break;
    case "birthday-notifications":
      await trackJobRun("birthday-notifications", sendBirthdayNotificationsJob);
      break;
    case "cleanup-job-runs":
      await trackJobRun("cleanup-job-runs", async () => {
        const deleted = await cleanupOldJobRuns(30);
        return { recordsProcessed: deleted };
      });
      break;
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
}

/**
 * Create a tracked async task
 */
function createTrackedTask(jobName: string, jobFn: () => Promise<unknown>): AsyncTask {
  return new AsyncTask(
    jobName,
    async () => {
      runningJobs.add(jobName);
      try {
        await trackJobRun(jobName, jobFn as () => Promise<{ skipped?: boolean }>);
      } finally {
        runningJobs.delete(jobName);
      }
    },
    (err) => {
      runningJobs.delete(jobName);
      log.error({ error: err, jobName }, "Job failed");
    }
  );
}

/**
 * Scheduler Plugin for Fastify
 * 
 * Registers cron jobs for:
 * - Event processing (every 15 mins, 7-11 AM, Mon-Sat)
 * - Fee overdue checks (configurable per org, default 9 AM)
 * - Fee reminders (daily at 8 AM)
 * - Birthday notifications (daily at 9 AM)
 * - Job runs cleanup (daily at 3 AM)
 * 
 * Uses @fastify/schedule which:
 * - Provides app.scheduler (ToadScheduler instance)
 * - Auto-stops jobs on server close
 */
export async function schedulerPlugin(app: FastifyInstance) {
  // Register fastify-schedule plugin (provides app.scheduler)
  await app.register(fastifySchedule);

  // Get scheduler from the plugin
  const { scheduler } = app;

  // 1. Event Processor - runs every 15 minutes during school hours (7-11 AM, Mon-Sat)
  // The job itself also checks org's attendance window for fine-grained control
  scheduler.addCronJob(
    new CronJob(
      { cronExpression: "*/15 7-10 * * 1-6" }, // Every 15 mins, 7:00-10:45 AM, Mon-Sat
      createTrackedTask("event-processor", processEventsJob),
      { id: "event-processor" }
    )
  );
  log.info("Event processor job scheduled (every 15 mins, 7-11 AM, Mon-Sat)");

  // 2. Fee Overdue Check - runs hourly
  scheduler.addSimpleIntervalJob(
    new SimpleIntervalJob(
      { hours: 1, runImmediately: false },
      createTrackedTask("fee-overdue-check", checkOverdueFeesJob),
      { id: "fee-overdue-check" }
    )
  );
  log.info("Fee overdue check job scheduled (every hour)");

  // 3. Fee Reminder - runs at 8 AM daily
  scheduler.addCronJob(
    new CronJob(
      { cronExpression: "0 8 * * *" },
      createTrackedTask("fee-reminder", sendFeeRemindersJob),
      { id: "fee-reminder" }
    )
  );
  log.info("Fee reminder job scheduled (daily at 8 AM)");

  // 4. Birthday Notifications - runs at 9 AM daily
  scheduler.addCronJob(
    new CronJob(
      { cronExpression: "0 9 * * *" },
      createTrackedTask("birthday-notifications", sendBirthdayNotificationsJob),
      { id: "birthday-notifications" }
    )
  );
  log.info("Birthday notifications job scheduled (daily at 9 AM)");

  // 5. Job Runs Cleanup - runs at 3 AM daily (retention policy)
  scheduler.addCronJob(
    new CronJob(
      { cronExpression: "0 3 * * *" },
      createTrackedTask("cleanup-job-runs", async () => {
        const deleted = await cleanupOldJobRuns(30);
        return { recordsProcessed: deleted };
      }),
      { id: "cleanup-job-runs" }
    )
  );
  log.info("Job runs cleanup scheduled (daily at 3 AM, 30 day retention)");

  log.info("Scheduler plugin registered successfully");
}
