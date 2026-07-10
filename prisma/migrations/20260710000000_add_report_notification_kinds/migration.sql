-- AlterEnum: report-related notification kinds emitted by social-socket-server
-- when a post is reported / a report is approved or rejected.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'report_submitted';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'report_approved';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'report_rejected';
