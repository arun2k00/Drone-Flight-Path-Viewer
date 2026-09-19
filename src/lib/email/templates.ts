/**
 * Transactional email templates. Table layout + inline styles because Gmail/Outlook ignore <style>
 * blocks and flexbox. Every interpolated value goes through esc(): project names, client messages and
 * user names are user input.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const C = {
  brand: "#c2560c",
  brandSoft: "#fdf1e8",
  ink: "#14181f",
  body: "#3b4452",
  muted: "#6b7584",
  line: "#e3e6eb",
  page: "#f3f4f7",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "button"; label: string; url: string }
  | { kind: "details"; rows: Array<[string, string]> }
  | { kind: "quote"; text: string; by: string }
  | { kind: "steps"; items: Array<[string, string]> }
  | { kind: "note"; text: string }
  | { kind: "link"; url: string };

interface Spec {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  blocks: Block[];
  /** Why the recipient got this email (footer). */
  reason: string;
  appUrl: string;
}

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "p":
      return `<p style="margin:0 0 16px;font:400 15px/1.65 ${FONT};color:${C.body};">${esc(b.text)}</p>`;
    case "button":
      return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;"><tr><td bgcolor="${C.brand}" style="border-radius:10px;">
<a href="${esc(b.url)}" target="_blank" style="display:inline-block;padding:13px 26px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:10px;">${esc(b.label)} &rarr;</a></td></tr></table>`;
    case "details":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;border:1px solid ${C.line};border-radius:12px;border-collapse:separate;">${b.rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:12px 16px;font:500 13px/1.4 ${FONT};color:${C.muted};${i ? `border-top:1px solid ${C.line};` : ""}width:40%;">${esc(k)}</td><td style="padding:12px 16px;font:600 14px/1.4 ${FONT};color:${C.ink};${i ? `border-top:1px solid ${C.line};` : ""}">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`;
    case "quote":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;"><tr><td style="background:${C.brandSoft};border-left:3px solid ${C.brand};border-radius:0 10px 10px 0;padding:16px 18px;">
<p style="margin:0 0 6px;font:italic 400 15px/1.6 ${FONT};color:${C.ink};">&ldquo;${esc(b.text).replace(/\n/g, "<br>")}&rdquo;</p>
<p style="margin:0;font:500 13px/1.4 ${FONT};color:${C.muted};">&mdash; ${esc(b.by)}</p></td></tr></table>`;
    case "steps":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">${b.items
        .map(
          ([title, text], i) =>
            `<tr><td valign="top" style="padding:0 14px 16px 0;width:28px;"><div style="width:28px;height:28px;border-radius:14px;background:${C.brandSoft};color:${C.brand};font:700 13px/28px ${FONT};text-align:center;">${i + 1}</div></td>
<td style="padding:3px 0 16px;"><p style="margin:0 0 2px;font:600 15px/1.4 ${FONT};color:${C.ink};">${esc(title)}</p><p style="margin:0;font:400 14px/1.55 ${FONT};color:${C.body};">${esc(text)}</p></td></tr>`,
        )
        .join("")}</table>`;
    case "note":
      return `<p style="margin:0 0 16px;font:400 13px/1.6 ${FONT};color:${C.muted};">${esc(b.text)}</p>`;
    case "link":
      return `<p style="margin:0 0 16px;font:400 12px/1.6 ${FONT};color:${C.muted};">Button not working? Paste this link into your browser:<br><a href="${esc(b.url)}" style="color:${C.brand};word-break:break-all;">${esc(b.url)}</a></p>`;
  }
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "p":
    case "note":
      return b.text;
    case "button":
      return `${b.label}: ${b.url}`;
    case "details":
      return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    case "quote":
      return `"${b.text}"\n— ${b.by}`;
    case "steps":
      return b.items.map(([t, d], i) => `${i + 1}. ${t} — ${d}`).join("\n");
    case "link":
      return "";
  }
}

function render(spec: Spec): RenderedEmail {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(spec.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(spec.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.page}"><tr><td align="center" style="padding:36px 16px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
<tr><td style="padding:0 4px 20px;">
<a href="${esc(spec.appUrl)}" style="text-decoration:none;"><img src="${esc(spec.appUrl)}/brand/aeroxpress-logo.png" width="186" height="26" alt="Aeroxpress" style="display:block;border:0;height:26px;width:186px;font:700 20px/26px ${FONT};color:${C.brand};"></a>
</td></tr>
<tr><td bgcolor="#ffffff" style="border:1px solid ${C.line};border-radius:16px;overflow:hidden;">
<div style="height:4px;background:${C.brand};background-image:linear-gradient(90deg,${C.brand},#f59e0b);font-size:0;line-height:0;">&nbsp;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:36px 40px 20px;">
<p style="margin:0 0 10px;font:700 12px/1 ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${C.brand};">${esc(spec.eyebrow)}</p>
<h1 style="margin:0 0 20px;font:700 24px/1.3 ${FONT};color:${C.ink};letter-spacing:-0.3px;">${esc(spec.title)}</h1>
${spec.blocks.map(blockHtml).join("\n")}
</td></tr></table></td></tr>
<tr><td style="padding:24px 8px 0;text-align:center;">
<p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:${C.muted};">${esc(spec.reason)}</p>
<p style="margin:0;font:400 12px/1.6 ${FONT};color:${C.muted};">Aeroxpress &middot; Drone video with its flight data, ready to share &middot; <a href="${esc(spec.appUrl)}" style="color:${C.muted};">${esc(spec.appUrl.replace(/^https?:\/\//, ""))}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = [spec.title, "", ...spec.blocks.map(blockText).filter(Boolean), "", "—", spec.reason, `Aeroxpress · ${spec.appUrl}`].join("\n\n");
  return { subject: spec.subject, html, text };
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(d) + " UTC";

export const emails = {
  /** User: after signing up. */
  welcome: (p: { appUrl: string; name: string }) =>
    render({
      appUrl: p.appUrl,
      subject: "Welcome to Aeroxpress",
      preheader: "Turn DJI footage and its SRT flight log into a shareable flight in minutes.",
      eyebrow: "Welcome aboard",
      title: `You're all set, ${p.name}`,
      blocks: [
        { kind: "p", text: "Aeroxpress turns a DJI video and its SRT flight log into a synchronized flight: video, live map position, altitude, speed and camera settings, all on one screen." },
        {
          kind: "steps",
          items: [
            ["Create a project", "Upload the MP4 and the matching .SRT file from your drone's SD card."],
            ["Design the overlay", "Place the telemetry panel, mini-map, altitude and speed graphs on the video."],
            ["Share or export", "Send your client a temporary link, or export an MP4 with the widgets burned in."],
          ],
        },
        { kind: "button", label: "Open your dashboard", url: `${p.appUrl}/dashboard` },
        { kind: "note", text: "Just want a quick look at a flight? The Flight Viewer plays files straight from your device; nothing is uploaded." },
      ],
      reason: "You're receiving this because you created an Aeroxpress account.",
    }),

  /** User: forgot-password flow, also sent when an admin triggers a reset. */
  passwordReset: (p: { appUrl: string; name: string; url: string; minutes: number }) =>
    render({
      appUrl: p.appUrl,
      subject: "Reset your Aeroxpress password",
      preheader: `This link expires in ${p.minutes} minutes.`,
      eyebrow: "Account security",
      title: "Reset your password",
      blocks: [
        { kind: "p", text: `Hi ${p.name}, we received a request to reset the password for your Aeroxpress account. Choose a new one with the button below.` },
        { kind: "button", label: "Choose a new password", url: p.url },
        { kind: "note", text: `The link works once and expires in ${p.minutes} minutes. If you didn't ask for this, ignore this email; your password stays the same.` },
        { kind: "link", url: p.url },
      ],
      reason: "You're receiving this because a password reset was requested for your account.",
    }),

  /** User: confirmation after the password changed. */
  passwordChanged: (p: { appUrl: string; name: string; when: Date }) =>
    render({
      appUrl: p.appUrl,
      subject: "Your Aeroxpress password was changed",
      preheader: "If this wasn't you, reset your password now.",
      eyebrow: "Account security",
      title: "Your password was changed",
      blocks: [
        { kind: "p", text: `Hi ${p.name}, the password for your Aeroxpress account was changed on ${fmtDate(p.when)}. All other sessions were signed out.` },
        { kind: "p", text: "If you made this change, there's nothing else to do." },
        { kind: "button", label: "Wasn't you? Reset password", url: `${p.appUrl}/forgot-password` },
      ],
      reason: "You're receiving this security notice for your Aeroxpress account.",
    }),

  /** User: export finished. */
  exportReady: (p: { appUrl: string; name: string; projectName: string; fileName: string; size: string; resolution: string; projectId: string }) =>
    render({
      appUrl: p.appUrl,
      subject: `Your video is ready: ${p.projectName}`,
      preheader: `${p.fileName} · ${p.resolution} · ${p.size}`,
      eyebrow: "Export complete",
      title: "Your telemetry video is ready",
      blocks: [
        { kind: "p", text: `Hi ${p.name}, the export for "${p.projectName}" finished. The overlay widgets are burned into the video, so it plays anywhere.` },
        {
          kind: "details",
          rows: [
            ["Project", p.projectName],
            ["File", p.fileName],
            ["Resolution", p.resolution],
            ["Size", p.size],
          ],
        },
        { kind: "button", label: "Download or share", url: `${p.appUrl}/projects/${p.projectId}/export` },
        { kind: "note", text: "From the export page you can also create a temporary link so your client can watch it in the browser." },
      ],
      reason: "You're receiving this because you started an export in Aeroxpress.",
    }),

  /** User: export failed. */
  exportFailed: (p: { appUrl: string; name: string; projectName: string; message: string; projectId: string }) =>
    render({
      appUrl: p.appUrl,
      subject: `Export failed: ${p.projectName}`,
      preheader: p.message,
      eyebrow: "Export failed",
      title: "Your export didn't finish",
      blocks: [
        { kind: "p", text: `Hi ${p.name}, the export for "${p.projectName}" stopped with this error:` },
        { kind: "details", rows: [["Reason", p.message]] },
        { kind: "button", label: "Open the export page", url: `${p.appUrl}/projects/${p.projectId}/export` },
        { kind: "note", text: "Your project and uploads are untouched; you can start the export again." },
      ],
      reason: "You're receiving this because you started an export in Aeroxpress.",
    }),

  /** Client: a temporary share link. No account needed. */
  shareInvite: (p: {
    appUrl: string;
    senderName: string;
    recipientName: string | null;
    projectName: string;
    message: string | null;
    url: string;
    expiresAt: Date;
    allowDownload: boolean;
  }) =>
    render({
      appUrl: p.appUrl,
      subject: `${p.senderName} shared a drone flight with you: ${p.projectName}`,
      preheader: `Watch the footage with its live flight path. Link valid until ${fmtDate(p.expiresAt)}.`,
      eyebrow: "Shared flight",
      title: p.projectName,
      blocks: [
        { kind: "p", text: `${p.recipientName ? `Hi ${p.recipientName}, ` : ""}${p.senderName} shared drone footage with you. It plays next to the drone's live position on the map, with altitude, speed and camera data at every moment of the flight.` },
        ...(p.message ? [{ kind: "quote" as const, text: p.message, by: p.senderName }] : []),
        { kind: "button", label: "View the flight", url: p.url },
        {
          kind: "details",
          rows: [
            ["Link valid until", fmtDate(p.expiresAt)],
            ["Video download", p.allowDownload ? "Included" : "View only"],
            ["Account needed", "No, it opens in your browser"],
          ],
        },
        { kind: "link", url: p.url },
      ],
      reason: `${p.senderName} sent you this link from Aeroxpress. It stops working after it expires.`,
    }),

  /** User: the client opened the link for the first time. */
  shareViewed: (p: { appUrl: string; name: string; projectName: string; recipient: string | null; projectId: string }) =>
    render({
      appUrl: p.appUrl,
      subject: `${p.recipient ?? "Your client"} opened ${p.projectName}`,
      preheader: "Your shared flight link was just viewed for the first time.",
      eyebrow: "Link activity",
      title: "Your shared flight was opened",
      blocks: [
        { kind: "p", text: `Hi ${p.name}, ${p.recipient ?? "someone with the link"} just opened "${p.projectName}" for the first time.` },
        { kind: "button", label: "Manage share links", url: `${p.appUrl}/projects/${p.projectId}/export` },
      ],
      reason: "You're receiving this because you shared a flight from Aeroxpress.",
    }),

  /** Admin: a new account was created. */
  adminNewUser: (p: { appUrl: string; userName: string; userEmail: string; when: Date; totalUsers: number }) =>
    render({
      appUrl: p.appUrl,
      subject: `New Aeroxpress signup: ${p.userName}`,
      preheader: `${p.userEmail} just created an account.`,
      eyebrow: "Admin",
      title: "A new user signed up",
      blocks: [
        {
          kind: "details",
          rows: [
            ["Name", p.userName],
            ["Email", p.userEmail],
            ["Signed up", fmtDate(p.when)],
            ["Total users", String(p.totalUsers)],
          ],
        },
        { kind: "button", label: "Open the admin console", url: `${p.appUrl}/admin/users` },
      ],
      reason: "You're receiving this because you're an Aeroxpress administrator.",
    }),

  /** User: an admin suspended or reactivated the account. */
  accountStatus: (p: { appUrl: string; name: string; suspended: boolean }) =>
    render({
      appUrl: p.appUrl,
      subject: p.suspended ? "Your Aeroxpress account was suspended" : "Your Aeroxpress account is active again",
      preheader: p.suspended ? "You can't sign in until an administrator reactivates it." : "You can sign in again.",
      eyebrow: "Account",
      title: p.suspended ? "Your account was suspended" : "Welcome back",
      blocks: p.suspended
        ? [
            { kind: "p", text: `Hi ${p.name}, an administrator suspended your Aeroxpress account. You're signed out and your share links no longer open.` },
            { kind: "note", text: "If you think this is a mistake, reply to this email or contact the site administrator." },
          ]
        : [
            { kind: "p", text: `Hi ${p.name}, your Aeroxpress account has been reactivated. Your projects and share links work again.` },
            { kind: "button", label: "Sign in", url: `${p.appUrl}/login` },
          ],
      reason: "You're receiving this because of a change to your Aeroxpress account.",
    }),
};

export type EmailTemplate = keyof typeof emails;

/** Sample data for the admin template previews. */
export function sampleEmails(appUrl: string): Record<EmailTemplate, RenderedEmail> {
  const soon = new Date(Date.now() + 7 * 864e5);
  return {
    welcome: emails.welcome({ appUrl, name: "Priya" }),
    passwordReset: emails.passwordReset({ appUrl, name: "Priya", url: `${appUrl}/reset-password?token=example`, minutes: 60 }),
    passwordChanged: emails.passwordChanged({ appUrl, name: "Priya", when: new Date() }),
    exportReady: emails.exportReady({ appUrl, name: "Priya", projectName: "Hyderabad Ring Road Survey", fileName: "hyderabad-ring-road-survey_telemetry.mp4", size: "412 MB", resolution: "3840 × 2160", projectId: "example" }),
    exportFailed: emails.exportFailed({ appUrl, name: "Priya", projectName: "Hyderabad Ring Road Survey", message: "Not enough free disk space to finish the export.", projectId: "example" }),
    shareInvite: emails.shareInvite({ appUrl, senderName: "Priya Raman", recipientName: "Arjun", projectName: "Hyderabad Ring Road Survey", message: "Here's the inspection flight from Tuesday. Pier 14 is at 03:20.", url: `${appUrl}/s/example`, expiresAt: soon, allowDownload: true }),
    shareViewed: emails.shareViewed({ appUrl, name: "Priya", projectName: "Hyderabad Ring Road Survey", recipient: "Arjun", projectId: "example" }),
    adminNewUser: emails.adminNewUser({ appUrl, userName: "Priya Raman", userEmail: "priya@example.com", when: new Date(), totalUsers: 42 }),
    accountStatus: emails.accountStatus({ appUrl, name: "Priya", suspended: true }),
  };
}
