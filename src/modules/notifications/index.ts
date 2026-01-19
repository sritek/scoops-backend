export {
  processEvent,
  processEvents,
  getNotificationLogs,
  getFailedNotifications,
  retryNotification as retryNotificationService,
  NOTIFICATION_STATUS,
} from "./notification.service.js";

export {
  sendWhatsAppMessage,
  sendOTP,
  sendTextMessage,
  isValidIndianPhone,
  normalizePhone,
} from "./whatsapp.provider.js";

export { notificationsRoutes } from "./notifications.routes.js";
export { webhookRoutes } from "./webhook.routes.js";
export { handleWebhook } from "./gupshup.webhook.js";