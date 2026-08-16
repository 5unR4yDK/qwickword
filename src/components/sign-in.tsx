"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Signing in from a browser: an address, then a code.
 *
 * The same two steps as the app, and the same rule underneath — a correct code
 * either signs you in or creates the account, and nobody has to know which.
 * There is no password and no separate registration.
 *
 * The session arrives as an HttpOnly cookie the server sets, so nothing here
 * ever touches the token. That is the point: anything this script could read,
 * injected script could steal.
 *
 * Deliberately a dialog reached from a quiet link, never a gate. Someone can
 * create a Qwickword, send it and join one without ever seeing this, and that
 * must stay true — the account exists so a person can be *reached*, not so
 * they can be admitted.
 */

export type Account = { id: string; displayName: string };

type Step =
  | { name: "email" }
  | { name: "code"; challengeId: string; sentTo: string };

export function SignInDialog({
  open,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn: (account: Account) => void;
}) {
  // Unmounted while closed, so every open starts from a fresh form with no
  // half-typed address or stale error. Resetting by remount rather than by an
  // effect means there is no moment where the old state is on screen.
  if (!open) return null;
  return <SignInForm onClose={onClose} onSignedIn={onSignedIn} />;
}

function SignInForm({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: (account: Account) => void;
}) {
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape closes, and Tab stays within the modal surface. `aria-modal` is a
  // behavioural promise as well as an announcement: keyboard focus must not
  // move into the page behind it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          element.getAttribute("aria-hidden") !== "true"
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sendCode = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Couldn't send a code.");
        return;
      }
      setStep({ name: "code", challengeId: payload.challengeId, sentTo: email.trim() });
      setCode("");
    } catch {
      setError("No connection. Check your network and try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, email]);

  const verify = useCallback(
    async (value: string) => {
      if (busy || step.name !== "code") return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/auth/challenges/${encodeURIComponent(step.challengeId)}/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: value, deviceLabel: "Browser" }),
          }
        );
        const payload = await response.json();
        if (!response.ok) {
          setError(payload?.error ?? "That code isn't right.");
          setCode("");
          return;
        }
        onSignedIn(payload.user);
      } catch {
        setError("No connection. Check your network and try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, step, onSignedIn]
  );

  // Six digits is the whole input, so there is nothing left to confirm.
  const onCodeChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 6);
      setCode(digits);
      if (digits.length === 6) void verify(digits);
    },
    [verify]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2
          id="signin-title"
          className="text-lg font-semibold text-zinc-950 dark:text-white"
        >
          {step.name === "email" ? "Sign in" : "Check your email"}
        </h2>

        {step.name === "email" ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Calls never need an account. Sign in so people can reach you by
              name.
            </p>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendCode();
              }}
              placeholder="you@work.com"
              autoComplete="email"
              // The dialog was opened on purpose; there is nothing else in it
              // to read first.
              autoFocus
              className="mt-4 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-[15px] text-zinc-950 outline-none focus:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-[#3DFEF1] dark:focus-visible:ring-[#3DFEF1] dark:focus-visible:ring-offset-zinc-950"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-500">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={busy || email.trim().length < 3}
              className="mt-4 h-12 w-full cursor-pointer rounded-full bg-[#3DFEF1] text-sm font-semibold text-[#062B28] transition hover:bg-[#7FFFF5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send me a code"}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              No password. We email you a six-digit code that works once.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              We sent a six-digit code to{" "}
              <span className="font-semibold text-zinc-900 dark:text-white">
                {step.sentTo}
              </span>
              . It expires in ten minutes.
            </p>
            <input
              inputMode="numeric"
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              placeholder="000000"
              // Lets a browser offer the code from an email or an SMS.
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              className="mt-4 h-14 w-full rounded-xl border border-zinc-300 bg-white text-center text-2xl font-semibold tracking-[0.4em] tabular-nums text-zinc-950 outline-none focus:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-[#3DFEF1] dark:focus-visible:ring-[#3DFEF1] dark:focus-visible:ring-offset-zinc-950"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-500">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void verify(code)}
              disabled={busy || code.length !== 6}
              className="mt-4 h-12 w-full cursor-pointer rounded-full bg-[#3DFEF1] text-sm font-semibold text-[#062B28] transition hover:bg-[#7FFFF5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setStep({ name: "email" })}
              className="mt-2 h-11 w-full cursor-pointer text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Use a different address
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 h-11 w-full cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

/**
 * The quiet entry point: shows who you are, or offers to sign in.
 *
 * Sits in the footer rather than a header, because signing in is never why
 * anyone came here.
 */
export function SignInLink() {
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me")
      .then((r) => r.json())
      .then((payload) => {
        if (!cancelled) {
          setAccount(payload?.user ?? null);
          setKnown(true);
        }
      })
      .catch(() => {
        if (!cancelled) setKnown(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/me", { method: "DELETE" }).catch(() => {});
    setAccount(null);
  }, []);

  // Nothing at all until the answer is known, so the label does not flip from
  // "Sign in" to a name a moment after the page settles.
  if (!known) return null;

  return (
    <>
      {account ? (
        <span className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
          <span>{account.displayName}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="cursor-pointer underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-400"
          >
            Sign out
          </button>
        </span>
      ) : (
        <button
          ref={openerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer text-[13px] text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Sign in
        </button>
      )}
      <SignInDialog
        open={open}
        onClose={closeDialog}
        onSignedIn={(signedIn) => {
          setAccount(signedIn);
          setOpen(false);
        }}
      />
    </>
  );
}
