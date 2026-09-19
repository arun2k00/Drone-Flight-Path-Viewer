/** Human-readable labels for Activity.action codes in the admin console. Unknown codes fall back to the raw code. */
export const ACTIVITY_LABELS: Record<string, string> = {
  "auth.signup": "Signed up",
  "auth.login": "Logged in",
  "auth.login_failed": "Failed login",
  "auth.logout": "Logged out",
  "auth.password_reset_requested": "Requested password reset",
  "auth.password_reset": "Reset password",
  "account.profile_updated": "Updated profile",
  "account.password_changed": "Changed password",
  "project.create": "Created project",
  "project.delete": "Deleted project",
  "export.start": "Started export",
  "export.complete": "Export finished",
  "export.failed": "Export failed",
  "share.create": "Created share link",
  "share.revoke": "Revoked share link",
  "share.first_view": "Client opened link",
  "admin.user.suspend": "Suspended user",
  "admin.user.reactivate": "Reactivated user",
  "admin.user.promote": "Made admin",
  "admin.user.demote": "Removed admin",
  "admin.user.password_reset": "Sent password reset",
  "admin.user.delete": "Deleted user",
  "admin.site.update": "Updated landing page",
};

export const activityLabel = (action: string) => ACTIVITY_LABELS[action] ?? action;

export function activityTone(action: string): "danger" | "admin" | "success" | "neutral" {
  if (action.endsWith("failed") || action.includes("suspend") || action.includes("delete")) return "danger";
  if (action.startsWith("admin.")) return "admin";
  if (action === "export.complete" || action === "auth.signup" || action === "share.first_view") return "success";
  return "neutral";
}
