// Centralized string constants for type-safe usage across the codebase.
// Prevents typo bugs and makes refactoring easier.

/** Notification types (matches Notification.type — stored as String in Prisma) */
export const NOTIFICATION_TYPES = {
  COMMENT: 'comment',
  FOLLOW: 'follow',
  LIKE: 'like',
  MESSAGE: 'message',
  SYSTEM: 'system',
  MOD_REMOVED: 'mod_removed',
  WARNING: 'warning',
  BANNED: 'banned',
} as const;
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

/** Moderation queue item statuses */
export const MOD_QUEUE_STATUS = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated',
} as const;
export type ModQueueStatus = typeof MOD_QUEUE_STATUS[keyof typeof MOD_QUEUE_STATUS];

/** Appeal statuses */
export const APPEAL_STATUS = {
  PENDING: 'pending',
  VOTING: 'voting',
  UPHELD: 'upheld',
  OVERTURNED: 'overturned',
  EXPIRED: 'expired',
} as const;
export type AppealStatus = typeof APPEAL_STATUS[keyof typeof APPEAL_STATUS];
