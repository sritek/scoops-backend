import { prisma } from "../../config/database.js";
import { createModuleLogger } from "../../config/logger.js";
import { EVENT_STATUS } from "../../modules/events/event-emitter.js";
import { processEvents } from "../../modules/notifications/notification.service.js";
import type { StoredEvent, EventPayload, EventType } from "../../modules/events/event-emitter.js";
import type { JobResult } from "../job-tracker.js";

const log = createModuleLogger("event-processor-job");

const BATCH_SIZE = 100;

// Default fallback window if no period template exists
const DEFAULT_WINDOW_START = "08:00";
const DEFAULT_WINDOW_END = "10:00";
const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat

interface AttendanceWindow {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  activeDays: number[];
}

/**
 * Event Processor Job
 * 
 * Processes pending events for each organization, but only during their
 * attendance window (based on period template). This prevents unnecessary
 * processing outside of school hours.
 * 
 * Window logic:
 * - Start: First period start + attendanceBufferMinutes
 * - End: Second period end
 * - Only runs on active days from the period template
 * 
 * @returns JobResult with processing stats
 */
export async function processEventsJob(): Promise<JobResult> {
  // Get all organizations with notifications enabled and their period templates
  const orgs = await prisma.organization.findMany({
    where: {
      notificationsEnabled: true,
    },
    select: {
      id: true,
      name: true,
      timezone: true,
      attendanceBufferMinutes: true,
      branches: {
        select: {
          id: true,
        },
      },
      periodTemplates: {
        where: {
          isDefault: true,
        },
        select: {
          activeDays: true,
          slots: {
            where: {
              isBreak: false,
              periodNumber: { in: [1, 2] }, // First two periods
            },
            orderBy: {
              periodNumber: "asc",
            },
            select: {
              periodNumber: true,
              startTime: true,
              endTime: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (orgs.length === 0) {
    log.debug("No organizations with notifications enabled");
    return { skipped: true, metadata: { reason: "No orgs with notifications enabled" } };
  }

  let totalProcessed = 0;
  let totalFailed = 0;
  let orgsSkipped = 0;
  let orgsProcessed = 0;

  // Process events for each org
  for (const org of orgs) {
    // Get attendance window for this org
    const window = getAttendanceWindow(org);
    
    // Check if we should process this org now
    if (!isWithinWindow(window, org.timezone)) {
      log.debug(
        { 
          orgId: org.id, 
          orgName: org.name,
          window,
          timezone: org.timezone,
        },
        "Org outside attendance window, skipping"
      );
      orgsSkipped++;
      continue;
    }

    log.debug(
      { orgId: org.id, orgName: org.name },
      "Processing events for org (within attendance window)"
    );

    // Process events for each branch
    for (const branch of org.branches) {
      const pendingEvents = await prisma.event.findMany({
        where: {
          orgId: org.id,
          branchId: branch.id,
          status: EVENT_STATUS.PENDING,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: BATCH_SIZE,
      });

      if (pendingEvents.length === 0) {
        continue;
      }

      log.debug(
        { orgId: org.id, branchId: branch.id, count: pendingEvents.length },
        "Processing pending events"
      );

      // Convert to StoredEvent format
      const events: StoredEvent[] = pendingEvents.map((e) => ({
        id: e.id,
        type: e.type as EventType,
        orgId: e.orgId,
        branchId: e.branchId,
        payload: safeParsePayload(e.payload, e.id),
        status: e.status as "pending" | "processed" | "failed",
        createdAt: e.createdAt,
        processedAt: e.processedAt,
      }));

      // Process events
      const result = await processEvents(events);
      totalProcessed += result.processed;
      totalFailed += result.failed;
    }

    orgsProcessed++;
  }

  if (totalProcessed > 0 || totalFailed > 0) {
    log.info(
      { processed: totalProcessed, failed: totalFailed, orgsProcessed },
      "Event processor job completed"
    );
  }

  // If all orgs were skipped (outside window), return skipped
  if (orgsProcessed === 0) {
    return { 
      skipped: true, 
      metadata: { 
        reason: "All orgs outside attendance window",
        orgsSkipped,
      } 
    };
  }

  // If we processed orgs but found no events
  if (totalProcessed === 0 && totalFailed === 0) {
    return { 
      skipped: true, 
      metadata: { 
        reason: "No pending events",
        orgsProcessed,
        orgsSkipped,
      } 
    };
  }

  return {
    recordsProcessed: totalProcessed,
    metadata: { 
      processed: totalProcessed, 
      failed: totalFailed,
      orgsProcessed,
      orgsSkipped,
    },
  };
}

/**
 * Get the attendance window for an organization based on their period template
 */
function getAttendanceWindow(org: {
  attendanceBufferMinutes: number;
  periodTemplates: Array<{
    activeDays: number[];
    slots: Array<{
      periodNumber: number;
      startTime: string;
      endTime: string;
    }>;
  }>;
}): AttendanceWindow {
  const template = org.periodTemplates[0];
  
  // If no template, use defaults
  if (!template || template.slots.length === 0) {
    return {
      startTime: DEFAULT_WINDOW_START,
      endTime: DEFAULT_WINDOW_END,
      activeDays: DEFAULT_ACTIVE_DAYS,
    };
  }

  const firstPeriod = template.slots.find(s => s.periodNumber === 1);
  const secondPeriod = template.slots.find(s => s.periodNumber === 2);

  // If missing periods, use defaults
  if (!firstPeriod) {
    return {
      startTime: DEFAULT_WINDOW_START,
      endTime: DEFAULT_WINDOW_END,
      activeDays: template.activeDays || DEFAULT_ACTIVE_DAYS,
    };
  }

  // Calculate window start: first period start + buffer
  const windowStart = addMinutesToTime(firstPeriod.startTime, org.attendanceBufferMinutes);
  
  // Window end: second period end (or first period end + 1 hour if no second period)
  const windowEnd = secondPeriod?.endTime || addMinutesToTime(firstPeriod.endTime, 60);

  return {
    startTime: windowStart,
    endTime: windowEnd,
    activeDays: template.activeDays || DEFAULT_ACTIVE_DAYS,
  };
}

/**
 * Check if current time is within the attendance window
 */
function isWithinWindow(window: AttendanceWindow, timezone: string): boolean {
  // Get current time in org's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);
  const hour = parts.find(p => p.type === "hour")?.value || "00";
  const minute = parts.find(p => p.type === "minute")?.value || "00";
  const weekday = parts.find(p => p.type === "weekday")?.value || "Mon";

  const currentTime = `${hour}:${minute}`;
  const currentDay = weekdayToNumber(weekday);

  // Check if today is an active day
  if (!window.activeDays.includes(currentDay)) {
    log.debug({ currentDay, activeDays: window.activeDays }, "Not an active day");
    return false;
  }

  // Check if current time is within window
  const inWindow = currentTime >= window.startTime && currentTime <= window.endTime;
  
  if (!inWindow) {
    log.debug(
      { currentTime, windowStart: window.startTime, windowEnd: window.endTime },
      "Outside time window"
    );
  }

  return inWindow;
}

/**
 * Add minutes to a time string (HH:mm)
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
}

/**
 * Convert weekday string to number (1=Mon, 7=Sun)
 */
function weekdayToNumber(weekday: string): number {
  const days: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return days[weekday] || 1;
}

/**
 * Safely parse JSON payload
 */
function safeParsePayload(payloadStr: string, eventId: string): EventPayload {
  try {
    return JSON.parse(payloadStr) as EventPayload;
  } catch {
    log.error({ eventId }, "Failed to parse event payload");
    return {
      entityType: "unknown",
      entityId: "unknown",
      data: { _parseError: true },
    };
  }
}
