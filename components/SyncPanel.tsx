"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSync } from "./SyncProvider";

const STATUS: Record<string, { label: string; tone: string }> = {
  off: { label: "Not configured", tone: "text-faint" },
  "signed-out": { label: "Not signed in", tone: "text-faint" },
  idle: { label: "Synced", tone: "text-volt" },
  syncing: { label: "Syncing…", tone: "text-amber" },
  error: { label: "Sync failed", tone: "text-warn" },
  offline: { label: "Offline, will retry", tone: "text-amber" },
};

export default function SyncPanel() {
  const { enabled, session, state, lastResult, syncNow } = useSync();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!enabled) return null;

  const status = STATUS[state] ?? STATUS.off;

  const sendLink = async () => {
    const sb = supabase();
    if (!sb || !email.trim()) return;
    setBusy(true);
    setErr(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  };

  const signOut = async () => {
    const sb = supabase();
    if (sb) await sb.auth.signOut();
  };

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="display text-sm font-bold uppercase tracking-wide">Cloud sync</span>
        <span className={`text-xs font-semibold ${status.tone}`}>{status.label}</span>
      </div>

      {session ? (
        <>
          <p className="mb-3 text-xs text-muted">
            Signed in as {session.user.email}. Your sessions back up automatically and appear on any
            device you sign in from.
          </p>
          {lastResult && <p className="mb-3 text-xs text-faint">{lastResult}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void syncNow()}
              className="h-10 flex-1 rounded-lg border border-line bg-surface px-3 text-sm font-semibold transition-colors duration-150 hover:border-volt/40"
            >
              Sync now
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-faint transition-colors duration-150 hover:text-warn"
            >
              Sign out
            </button>
          </div>
        </>
      ) : sent ? (
        <p className="text-xs text-muted">
          Check {email} and tap the link. Open it on this device to finish signing in.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            Sign in to back up your training and use it on more than one device. No password, you
            get a link by email.
          </p>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mb-2 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-volt/50"
          />
          {err && <p className="mb-2 text-xs text-warn">{err}</p>}
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => void sendLink()}
            className="h-11 w-full rounded-lg bg-volt text-sm font-bold uppercase tracking-wide text-volt-ink transition-opacity duration-150 disabled:opacity-40"
          >
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </>
      )}
    </div>
  );
}
