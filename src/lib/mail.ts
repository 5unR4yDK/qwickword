// Sending a one-time code.
//
// A thin adapter over Resend, behind an interface, for the same reason
// MediaTransport sits in front of Daily: the provider is a supplier, not an
// architecture. Swapping to Postmark or SES should mean editing this file and
// nothing else.
//
// Deliberately not the Resend SDK. This makes one POST to one documented
// endpoint; a dependency that pulls its own HTTP client and types in to do that
// is more surface than the problem justifies.
import { maskEmail } from "./identity-core";

export type MailResult =
  | { ok: true }
  /** The caller shows one sentence; `detail` is for the log, never the screen. */
  | { ok: false; detail: string };

export type Mailer = {
  sendCode(to: string, code: string): Promise<MailResult>;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * The sign-in email.
 *
 * Plain, short, and it says what to do with the code and what to do if you did
 * not ask for it. No marketing, no unsubscribe footer, no images: a login code
 * that looks like a newsletter is a login code people report as phishing.
 *
 * The code is repeated in the subject line because most people read it from the
 * notification without opening anything.
 */
function body(code: string): { subject: string; text: string; html: string } {
  const subject = `${code} is your Qwickword code`;
  const text = [
    `${code} is your Qwickword sign-in code.`,
    "",
    "It expires in 10 minutes and can only be used once.",
    "",
    "If you didn't try to sign in, you can ignore this email. Nobody can use",
    "this code without also having access to your inbox.",
  ].join("\n");

  // Inline styles only: every mail client strips a stylesheet. Dark text on
  // white, because a login email rendering as black-on-black in someone's dark
  // mode is a support ticket.
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b">
<p style="margin:0 0 16px;font-size:15px;line-height:22px">Your Qwickword sign-in code:</p>
<p style="margin:0 0 16px;font-size:34px;line-height:40px;font-weight:600;letter-spacing:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>
<p style="margin:0 0 16px;font-size:14px;line-height:21px;color:#52525b">It expires in 10 minutes and can only be used once.</p>
<p style="margin:0;font-size:13px;line-height:20px;color:#71717a">If you didn't try to sign in, you can ignore this email. Nobody can use this code without also having access to your inbox.</p>
</body></html>`;

  return { subject, text, html };
}

/**
 * Never sends. Writes the code to the server log instead.
 *
 * Used when no API key is configured, which is every local checkout that has
 * not been given one and every CI run. Without this the whole sign-in flow
 * would be untestable outside production, and the alternative — failing at the
 * send — would make a missing key look like a broken flow.
 */
export function createLogMailer(): Mailer {
  return {
    async sendCode(to, code) {
      console.warn(
        `[Qwickword] No RESEND_API_KEY set. Sign-in code for ` +
          `${maskEmail(to)} is ${code} (logged, not sent).`
      );
      return { ok: true };
    },
  };
}

export function createResendMailer(apiKey: string, from: string): Mailer {
  return {
    async sendCode(to, code) {
      const { subject, text, html } = body(code);
      try {
        const response = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: [to], subject, text, html }),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return {
            ok: false,
            detail: `Resend returned ${response.status}: ${detail.slice(0, 300)}`,
          };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, detail: `Resend request failed: ${String(err)}` };
      }
    },
  };
}

let cached: Mailer | null = null;

/**
 * The mailer this deploy should use.
 *
 * Falls back to logging rather than throwing when unconfigured, and says so
 * once. A deploy that silently cannot send is worse than one that says it is
 * only logging.
 */
export function getMailer(): Mailer {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.QWICKWORD_MAIL_FROM?.trim();

  if (!apiKey || !from) {
    console.warn(
      "[Qwickword] Mail: log mode. RESEND_API_KEY / QWICKWORD_MAIL_FROM not " +
        "set, so sign-in codes are written to this log instead of sent."
    );
    cached = createLogMailer();
  } else {
    cached = createResendMailer(apiKey, from);
  }
  return cached;
}
