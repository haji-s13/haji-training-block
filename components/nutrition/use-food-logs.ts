"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import type { FoodLog } from "@/lib/nutrition";
import { authEnabled, foodLogError, loadFoodLogs, saveFoodLog } from "@/lib/supabase";

/** Food logs by ISO date. Signed in: loaded from and saved to the account for `from`–`to`.
 *  Guests: kept in memory only (never in localStorage), so they're gone on reload. */
export function useFoodLogs(from: string, to: string) {
  const { user } = useApp();
  const signedIn = !!user && authEnabled;
  const [logs, setLogs] = useState<Record<string, FoodLog>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // A different account (or signing out) starts from a clean slate.
  useEffect(() => { setLogs({}); }, [user?.id]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    setLoading(true);
    loadFoodLogs(from, to)
      .then((rows) => { if (!cancelled) setLogs((cur) => ({ ...cur, ...Object.fromEntries(rows.map((r) => [r.date, r])) })); })
      .catch((e) => { if (!cancelled) toast.error(foodLogError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [signedIn, from, to, user?.id]);

  const save = useCallback(async (log: FoodLog) => {
    if (!signedIn || !user) { setLogs((cur) => ({ ...cur, [log.date]: log })); return true; }
    setSaving(true);
    try {
      await saveFoodLog(user.id, log);
      setLogs((cur) => ({ ...cur, [log.date]: log }));
      toast.success("Day saved");
      return true;
    } catch (e) {
      toast.error(foodLogError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [signedIn, user]);

  return { logs, save, loading, saving, signedIn };
}
