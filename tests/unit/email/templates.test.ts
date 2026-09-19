import { describe, expect, it } from "vitest";
import { emails, esc, sampleEmails } from "@/lib/email/templates";

const APP = "https://aeroxpress.example";

describe("email templates", () => {
  it("every template renders a subject, HTML and a plain-text part", () => {
    for (const [id, email] of Object.entries(sampleEmails(APP))) {
      expect(email.subject, id).not.toBe("");
      expect(email.html, id).toContain("<!doctype html>");
      expect(email.html, id).toContain("Aeroxpress");
      expect(email.text.length, id).toBeGreaterThan(40);
    }
  });

  it("escapes user-controlled text (project names, client messages)", () => {
    const email = emails.shareInvite({
      appUrl: APP,
      senderName: 'Eve <img src=x onerror="alert(1)">',
      recipientName: null,
      projectName: "<script>alert(1)</script>",
      message: "Hi & bye\n<b>bold</b>",
      url: `${APP}/s/token`,
      expiresAt: new Date("2026-10-01T12:00:00Z"),
      allowDownload: false,
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Hi &amp; bye<br>&lt;b&gt;");
    expect(email.html).toContain(`href="${APP}/s/token"`);
    expect(email.html).toContain("View only");
  });

  it("esc covers all five HTML-significant characters", () => {
    expect(esc(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
