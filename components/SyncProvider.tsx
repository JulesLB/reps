"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, syncEnabled } from "@/lib/supabase";
import { reconcile, startSync, type SyncState } from "@/lib/sync";

interface SyncContext {
  enabled: boolean;
  session: Session | null;
  state: SyncState;
  lastResult: string | null;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<SyncContext>({
  enabled: false,
  session: null,
  state: "off",
  lastResult: null,
  syncNow: async () => {},
});

export function useSync(): SyncContext {
  return useContext(Ctx);
}

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<SyncState>(syncEnabled ? "signed-out" : "off");
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setState(syncEnabled ? "signed-out" : "off");
      return;
    }
    let stop = () => {};
    setState("syncing");
    reconcile(userId)
      .then((r) => {
        setLastResult(
          r === "pushed"
            ? "Uploaded this device's data"
            : r === "pulled"
              ? "Downloaded your data from the cloud"
              : "Nothing to sync yet",
        );
        setState("idle");
      })
      .catch(() => setState(navigator.onLine ? "error" : "offline"))
      .finally(() => {
        stop = startSync(userId, setState);
      });
    return () => stop();
  }, [session]);

  const syncNow = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setState("syncing");
    try {
      await reconcile(userId);
      setState("idle");
    } catch {
      setState(navigator.onLine ? "error" : "offline");
    }
  }, [session]);

  const value = useMemo(
    () => ({ enabled: syncEnabled, session, state, lastResult, syncNow }),
    [session, state, lastResult, syncNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
