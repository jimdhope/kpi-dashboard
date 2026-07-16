BEGIN;

DROP TABLE IF EXISTS "UserNotificationSettings";
DROP TABLE IF EXISTS "AppPushSettings";
DROP TABLE IF EXISTS "Notification";

DROP TYPE IF EXISTS "NotificationPriority";
DROP TYPE IF EXISTS "NotificationType";

COMMIT;
