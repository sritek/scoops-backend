export {
  // Event emission
  emitEvent,
  emitEvents,
  // Event processing
  getPendingEvents,
  markEventProcessed,
  markEventFailed,
  getEventsByType,
  // Constants
  EVENT_TYPES,
  EVENT_STATUS,
} from "./event-emitter.js";

export type {
  EventType,
  EventStatus,
  EventPayload,
  StoredEvent,
} from "./event-emitter.js";
